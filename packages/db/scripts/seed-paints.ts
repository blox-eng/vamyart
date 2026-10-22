/**
 * Idempotent: inserts the starter tube catalogue; existing rows (and the
 * artist's `owned` flags) are left untouched.
 *
 * Run with: cd packages/db && pnpm dlx tsx scripts/seed-paints.ts
 */
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const here = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(here, "../../../.env.local") });

import { db } from "../src/client";
import { paints } from "../src/schema";
import { PAINTS } from "../src/data/paints";

async function main() {
  const inserted = await db.insert(paints).values(PAINTS).onConflictDoNothing().returning({ id: paints.id });
  console.log(`paints: ${inserted.length} inserted, ${PAINTS.length - inserted.length} already present`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
