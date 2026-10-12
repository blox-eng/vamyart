/**
 * One-off: trims the white margin and drop shadow from existing artwork photos.
 * For each artwork_images row, the trimmed copy is uploaded to a NEW path
 * (<dir>/<uuid>-trim.jpg) and the row is repointed with its new size. The
 * original object is never deleted or overwritten, so the change is reverted by
 * pointing storage_path back at the old path. Rows already on a -trim.jpg path,
 * and photos the detector isn't sure about, are skipped.
 *
 * sharp is borrowed from Next.js's install (not a dependency of this package).
 *
 * Run with: cd packages/db && pnpm dlx tsx scripts/trim-existing-images.ts [--dry-run] [--preview <dir>]
 *   --dry-run      print the planned boxes, change nothing
 *   --preview dir  also write each trimmed JPEG to dir for a visual check
 */
import * as dotenv from "dotenv";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import { dirname, posix, resolve } from "path";
import { mkdirSync, writeFileSync } from "fs";
import { randomUUID } from "crypto";

const here = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(here, "../../../.env.local") });

import { createClient } from "@supabase/supabase-js";
import { eq } from "drizzle-orm";
import { db } from "../src/client";
import { artworkImages, artworks } from "../src/schema";
import { findContentBox, scaleContentBox } from "../src/services/content-box";

const BUCKET = "artwork-images";
const DETECT_EDGE = 800;
const MAX_EDGE = 2560;
const QUALITY = 85;

const websiteRequire = createRequire(resolve(here, "../../../apps/website/package.json"));
const nextRequire = createRequire(websiteRequire.resolve("next/package.json"));
const sharp = nextRequire("sharp") as typeof import("sharp");

function argValue(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i === -1 ? undefined : process.argv[i + 1];
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set");
  const dryRun = process.argv.includes("--dry-run");
  const previewDir = argValue("--preview");
  if (previewDir) mkdirSync(previewDir, { recursive: true });
  const storage = createClient(url, key).storage.from(BUCKET);

  const rows = await db
    .select({
      id: artworkImages.id,
      storagePath: artworkImages.storagePath,
      title: artworks.title,
    })
    .from(artworkImages)
    .innerJoin(artworks, eq(artworks.id, artworkImages.artworkId));

  const table: string[] = [];
  for (const row of rows) {
    if (row.storagePath.endsWith("-trim.jpg")) {
      table.push(`${row.title} | already trimmed | ${row.storagePath}`);
      continue;
    }
    try {
      const res = await fetch(`${url}/storage/v1/object/public/${BUCKET}/${row.storagePath}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { data: oriented, info: full } = await sharp(Buffer.from(await res.arrayBuffer()))
        .rotate()
        .toBuffer({ resolveWithObject: true });
      const { data: gray, info: small } = await sharp(oriented)
        .greyscale()
        .resize(DETECT_EDGE, DETECT_EDGE, { fit: "inside", withoutEnlargement: true })
        .raw()
        .toBuffer({ resolveWithObject: true });
      const found = findContentBox(new Uint8Array(gray), small.width, small.height);
      if (!found) {
        table.push(`${row.title} | skipped (no clear edge) | ${row.storagePath}`);
        continue;
      }
      const box = scaleContentBox(found, small.width, small.height, full.width, full.height);
      const { data: jpeg, info: out } = await sharp(oriented)
        .extract(box)
        .resize(MAX_EDGE, MAX_EDGE, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: QUALITY })
        .toBuffer({ resolveWithObject: true });
      const newPath = posix.join(posix.dirname(row.storagePath), `${randomUUID()}-trim.jpg`);
      if (previewDir) writeFileSync(resolve(previewDir, `${row.id}.jpg`), jpeg);
      console.log(`  ${row.title}: box ${JSON.stringify(box)} of ${full.width}x${full.height}`);

      if (!dryRun) {
        const { error } = await storage.upload(newPath, jpeg, { contentType: "image/jpeg", upsert: false });
        if (error) throw new Error(`upload: ${error.message}`);
        await db
          .update(artworkImages)
          .set({ storagePath: newPath, width: out.width, height: out.height, updatedAt: new Date() })
          .where(eq(artworkImages.id, row.id));
      }
      table.push(
        `${row.title} | ${full.width}x${full.height} -> ${out.width}x${out.height} | ${row.storagePath} -> ${dryRun ? "(dry run)" : newPath}`
      );
    } catch (err) {
      table.push(`${row.title} | FAILED ${(err as Error).message} | ${row.storagePath}`);
    }
  }

  console.log(`[trim-existing-images]${dryRun ? " dry run," : ""} ${rows.length} rows`);
  for (const line of table) console.log(`  ${line}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("[trim-existing-images] failed:", err);
  process.exit(1);
});
