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
    const res = await fetch("https://api.buttondown.email/v1/subscribers", {
      method: "POST",
      headers: {
        Authorization: `Token ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email_address: email,
        tags: [source],
        metadata: { source, ...(locale ? { locale } : {}) },
      }),
    });

    if (res.status === 201 || res.status === 200) return { alreadySubscribed: false };
    if (res.status === 400) {
      const text = await res.text().catch(() => "");
      if (text.includes("email_already_exists")) {
        return { alreadySubscribed: true };
      }
      console.error("[buttondown] sync failed", res.status, text);
      return { alreadySubscribed: false };
    }
    console.error("[buttondown] sync failed", res.status, await res.text().catch(() => ""));
    return { alreadySubscribed: false };
  } catch (err) {
    console.error("[buttondown] fetch threw", err);
    return { alreadySubscribed: false };
  }
}
