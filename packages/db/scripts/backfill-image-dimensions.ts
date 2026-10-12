/**
 * One-time, idempotent backfill: fills artwork_images.width/height where NULL by
 * reading the image header over a ranged GET of the public Storage URL.
 * Never touches rows that already have dimensions, nor any other column.
 *
 * With --recheck, recomputes every row and updates only those whose stored dims differ.
 *
 * Run with: cd packages/db && pnpm dlx tsx scripts/backfill-image-dimensions.ts
 */
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const here = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(here, "../../../.env.local") });

import { eq, isNull } from "drizzle-orm";
import { db } from "../src/client";
import { artworkImages } from "../src/schema";
import { readImageSize } from "../src/services/image-size";

const RANGES = [65536, 1048576]; // retry bigger when EXIF/ICC pushes the JPEG SOF marker past 64KB

async function fetchHead(url: string, bytes: number): Promise<Uint8Array> {
  const res = await fetch(url, { headers: { Range: `bytes=0-${bytes - 1}` } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

async function main() {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) throw new Error("NEXT_PUBLIC_SUPABASE_URL not set");

  const recheck = process.argv.includes("--recheck");
  const query = db
    .select({
      id: artworkImages.id,
      storagePath: artworkImages.storagePath,
      width: artworkImages.width,
      height: artworkImages.height,
    })
    .from(artworkImages);
  const rows = recheck ? await query : await query.where(isNull(artworkImages.width));

  let updated = 0;
  const skipped: string[] = [];
  for (const row of rows) {
    const url = `${base}/storage/v1/object/public/artwork-images/${row.storagePath}`;
    let size = null;
    try {
      for (const bytes of RANGES) {
        size = readImageSize(await fetchHead(url, bytes));
        if (size) break;
      }
    } catch (err) {
      console.error(`[backfill-image-dimensions] ${row.storagePath}:`, err);
    }
    if (!size) {
      skipped.push(row.storagePath);
      continue;
    }
    if (row.width === size.width && row.height === size.height) continue;
    if (recheck) {
      console.log(`  corrected: ${row.storagePath} ${row.width}x${row.height} -> ${size.width}x${size.height}`);
    }
    await db
      .update(artworkImages)
      .set({ width: size.width, height: size.height })
      .where(eq(artworkImages.id, row.id));
    updated++;
  }

  console.log(`[backfill-image-dimensions] updated ${updated}, skipped ${skipped.length}`);
  for (const p of skipped) console.log(`  skipped: ${p}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("[backfill-image-dimensions] failed:", err);
  process.exit(1);
});
