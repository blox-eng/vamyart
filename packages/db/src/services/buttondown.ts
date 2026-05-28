import { db } from "../client";
import { newsletterSubscribers } from "../schema";
import { upsertContact } from "./upsert-contact";

export type NewsletterSource = "footer" | "inquiry" | "checkout" | "bid";

export interface SubscribeInput {
  email: string;
  source: NewsletterSource;
  locale?: string;
}

export interface SubscribeResult {
  alreadySubscribed: boolean;
}

export async function subscribeToButtondown(input: SubscribeInput): Promise<SubscribeResult> {
  const email = input.email.trim().toLowerCase();
  const { source, locale } = input;

  await db
    .insert(newsletterSubscribers)
    .values({ email })
    .onConflictDoNothing();

  try {
    await upsertContact(db, { email });
  } catch (err) {
    console.error("[buttondown] contact upsert failed", err);
  }

  const apiKey = process.env.BUTTONDOWN_API_KEY;
  if (!apiKey) {
    console.warn("[buttondown] BUTTONDOWN_API_KEY not set, skipping remote sync");
    return { alreadySubscribed: false };
  }

  try {
    // X-Buttondown-Collision-Behavior: add → on duplicate email, Buttondown
    // merges the new tags into the existing subscriber instead of returning 400.
    // This means re-subscribing via a different surface (footer → inquiry → bid)
    // accretes tags rather than silently dropping the second signup.
    const res = await fetch("https://api.buttondown.com/v1/subscribers", {
      method: "POST",
      headers: {
        Authorization: `Token ${apiKey}`,
        "Content-Type": "application/json",
        "X-API-Version": "2026-04-01",
        "X-Buttondown-Collision-Behavior": "add",
      },
      body: JSON.stringify({
        email_address: email,
        tags: [source],
        metadata: { source, ...(locale ? { locale } : {}) },
      }),
    });

    if (res.status === 201 || res.status === 200) return { alreadySubscribed: false };
    // With the collision header set, 400 shouldn't occur for duplicates. If it
    // ever does (account doesn't support the header, future API change), treat
    // it defensively as "already subscribed" rather than surface a confusing
    // error — input email passed zod validation, so duplicate is the most
    // likely cause of a 400 here.
    if (res.status === 400) {
      console.warn("[buttondown] 400 from create, treating as duplicate", await res.text().catch(() => ""));
      return { alreadySubscribed: true };
    }
    console.error("[buttondown] sync failed", res.status, await res.text().catch(() => ""));
    return { alreadySubscribed: false };
  } catch (err) {
    console.error("[buttondown] fetch threw", err);
    return { alreadySubscribed: false };
  }
}
