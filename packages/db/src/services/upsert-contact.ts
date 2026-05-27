import { sql } from "drizzle-orm";
import { db } from "../client";
import { contacts } from "../schema";

// Accepts either the db proxy or a transaction handle, so callers already inside
// a db.transaction(...) (orders, bids) can pass their tx and compose atomically.
type DbExecutor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Upsert the canonical contact for an email.
 * - No-op on empty/whitespace email.
 * - Fills `name` only when the stored name is null/empty; never overwrites it.
 * - Never touches tags/notes/doNotContact (artist-owned fields).
 */
export async function upsertContact(
  executor: DbExecutor,
  input: { email: string; name?: string | null },
): Promise<void> {
  const email = input.email.trim().toLowerCase();
  if (!email) return;
  const name = input.name?.trim() || null;

  await executor
    .insert(contacts)
    .values({ email, name })
    .onConflictDoUpdate({
      target: contacts.email,
      set: {
        name: sql`coalesce(nullif(${contacts.name}, ''), excluded.name)`,
        updatedAt: new Date(),
      },
    });
}
