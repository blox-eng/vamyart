#!/usr/bin/env node
// One-time backfill: re-apply a long Cache-Control (max-age=31536000) to every
// object already in the artwork-images bucket. Existing objects were uploaded
// with the Supabase default (max-age=3600), which the Netlify Image CDN inherits
// — so cold transforms recur hourly. Re-uploading in place (same key, upsert:true)
// with the long cacheControl fixes it without changing any public URL.
//
// Run once, from apps/website:
//   node --env-file=.env.local scripts/backfill-image-cache-control.mjs [--dry-run]
import { createClient } from "@supabase/supabase-js";

const BUCKET = "artwork-images";
const CACHE_CONTROL = "31536000";
const DRY_RUN = process.argv.includes("--dry-run");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const supabase = createClient(url, key);

// Storage keys are `<artwork-slug>/<uuid>.<ext>`. list("") returns folders as
// entries with a null `id`; recurse one level into each folder.
async function listAllPaths() {
  const paths = [];
  const { data: roots, error } = await supabase.storage.from(BUCKET).list("", { limit: 1000 });
  if (error) throw error;
  for (const entry of roots) {
    if (entry.id === null) {
      const { data: files, error: e2 } = await supabase.storage.from(BUCKET).list(entry.name, { limit: 1000 });
      if (e2) throw e2;
      for (const f of files) if (f.id !== null) paths.push(`${entry.name}/${f.name}`);
    } else {
      paths.push(entry.name);
    }
  }
  return paths;
}

async function main() {
  const paths = await listAllPaths();
  console.log(`Found ${paths.length} object(s) in ${BUCKET}.${DRY_RUN ? " (dry run)" : ""}`);
  let updated = 0;
  for (const path of paths) {
    if (DRY_RUN) { console.log(`would update: ${path}`); continue; }
    const { data: blob, error: dErr } = await supabase.storage.from(BUCKET).download(path);
    if (dErr) { console.error(`download failed ${path}: ${dErr.message}`); continue; }
    const contentType = blob.type || "application/octet-stream";
    const buffer = Buffer.from(await blob.arrayBuffer());
    const { error: uErr } = await supabase.storage.from(BUCKET).upload(path, buffer, {
      upsert: true,
      cacheControl: CACHE_CONTROL,
      contentType,
    });
    if (uErr) { console.error(`upload failed ${path}: ${uErr.message}`); continue; }
    updated++;
    console.log(`updated: ${path} -> max-age=${CACHE_CONTROL} (${contentType})`);
  }
  console.log(`Done. ${DRY_RUN ? "(dry run, no writes)" : `${updated}/${paths.length} updated.`}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
