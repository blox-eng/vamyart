/**
 * One-time, idempotent backfill: unions distinct non-empty emails from inquiries,
 * orders, bids, variant_waitlist, and newsletter_subscribers into `contacts`,
 * taking the earliest-seen name per email. Safe to re-run (all upserts).
 *
 * Run with: cd packages/db && pnpm dlx tsx scripts/backfill-contacts.ts
 */
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

// Load DATABASE_URL from the repo-root .env.local before the db client is used.
const here = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(here, "../../../.env.local") });

import { db } from "../src/client";
import { inquiries, orders, bids, variantWaitlist, newsletterSubscribers } from "../src/schema";
import { upsertContact } from "../src/services/upsert-contact";

async function main() {
  const rows: { email: string; name: string | null; seenAt: Date }[] = [];

  const inqs = await db
    .select({ email: inquiries.email, name: inquiries.name, seenAt: inquiries.createdAt })
    .from(inquiries);
  rows.push(...inqs);

  const ords = await db
    .select({ email: orders.buyerEmail, name: orders.buyerName, seenAt: orders.createdAt })
    .from(orders);
  rows.push(...ords);

  const bds = await db
    .select({ email: bids.bidderEmail, name: bids.bidderName, seenAt: bids.createdAt })
    .from(bids);
  rows.push(...bds);

  const wl = await db
    .select({ email: variantWaitlist.email, seenAt: variantWaitlist.createdAt })
    .from(variantWaitlist);
  for (const r of wl) rows.push({ email: r.email, name: null, seenAt: r.seenAt });

  const ns = await db
    .select({ email: newsletterSubscribers.email, seenAt: newsletterSubscribers.subscribedAt })
    .from(newsletterSubscribers);
  for (const r of ns) rows.push({ email: r.email, name: null, seenAt: r.seenAt });

  // Earliest first so the earliest name fills the contact (upsertContact only fills a missing name).
  rows.sort((a, b) => new Date(a.seenAt).getTime() - new Date(b.seenAt).getTime());

  const seen = new Set<string>();
  let count = 0;
  for (const r of rows) {
    const email = (r.email ?? "").trim().toLowerCase();
    if (!email) continue;
    await upsertContact(db, { email, name: r.name });
    if (!seen.has(email)) {
      seen.add(email);
      count++;
    }
  }

  console.log(`[backfill-contacts] processed ${rows.length} source rows → ${count} distinct contacts`);
  process.exit(0);
}

main().catch((err) => {
  console.error("[backfill-contacts] failed:", err);
  process.exit(1);
});
