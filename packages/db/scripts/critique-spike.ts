/**
 * Model spike for the critique (#59): runs every model in CRITIQUE_MODELS on a
 * few paintings through the same requestCritique the studio uses, and prints
 * what each returned, how long it took and what it cost. Nothing is written to
 * the database or Storage: images go inline as data URLs.
 *
 * Run with: cd packages/db && OPENROUTER_API_KEY=... pnpm dlx tsx scripts/critique-spike.ts [--out results.json] [image ...]
 */
import { createRequire } from "module";
import { writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, basename, resolve } from "path";
import { extractPalette } from "@vamy/palette";
import { CRITIQUE_MODELS, requestCritique } from "../src/services/critique-run";

const here = dirname(fileURLToPath(import.meta.url));
// sharp is borrowed from Next.js's install (not a dependency of this package).
const websiteRequire = createRequire(resolve(here, "../../../apps/website/package.json"));
const sharp = createRequire(websiteRequire.resolve("next/package.json"))("sharp") as typeof import("sharp");

const SEND_EDGE = 1600;
const ANALYSIS_EDGE = 640;
const PROMPT = "What is the weakest part of this painting, and what would you change first?";
const DEFAULT_IMAGES = ["first-contact.jpg", "on-the-horizon.jpg", "whispers.jpg"].map((f) =>
  resolve(here, "../../../apps/website/public/images", f)
);

const args = process.argv.slice(2);
const outIndex = args.indexOf("--out");
const out = outIndex >= 0 ? args.splice(outIndex, 2)[1] : null;
const images = args.length ? args : DEFAULT_IMAGES;

const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey) throw new Error("Set OPENROUTER_API_KEY");

async function prepare(path: string) {
  const jpeg = await sharp(path).rotate().resize(SEND_EDGE, SEND_EDGE, { fit: "inside" }).jpeg({ quality: 85 }).toBuffer();
  const { data } = await sharp(path).rotate().resize(ANALYSIS_EDGE, ANALYSIS_EDGE, { fit: "inside" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const swatches = extractPalette(new Uint8ClampedArray(data), { k: 6 }).map(({ hex, area }) => ({ hex, area }));
  return { name: basename(path), imageUrl: `data:image/jpeg;base64,${jpeg.toString("base64")}`, swatches };
}

async function main() {
  const paintings = await Promise.all(images.map(prepare));
  const results = await Promise.all(
    CRITIQUE_MODELS.flatMap((model) =>
      paintings.map(async (p) => {
        const started = Date.now();
        try {
          const { read, costUsd } = await requestCritique({ apiKey, model, imageUrl: p.imageUrl, prompt: PROMPT, swatches: p.swatches });
          return { model, painting: p.name, ok: true, seconds: (Date.now() - started) / 1000, costUsd, read, swatches: p.swatches };
        } catch (err) {
          return { model, painting: p.name, ok: false, seconds: (Date.now() - started) / 1000, error: err instanceof Error ? err.message : String(err) };
        }
      })
    )
  );

  for (const model of CRITIQUE_MODELS) {
    const rows = results.filter((r) => r.model === model);
    const ok = rows.filter((r) => r.ok);
    const cost = ok.reduce((sum, r) => sum + ("costUsd" in r ? r.costUsd ?? 0 : 0), 0);
    const secs = rows.map((r) => r.seconds);
    console.log(`\n${model}: ${ok.length}/${rows.length} ok · ${Math.max(...secs).toFixed(1)}s slowest · $${cost.toFixed(4)} total`);
    for (const r of rows) {
      if ("read" in r && r.read) console.log(`  ${r.painting}: ${r.read.swatchNames.join(" | ")}\n    ${r.read.answer}`);
      else console.log(`  ${r.painting}: FAILED ${"error" in r ? r.error : ""}`);
    }
  }
  if (out) writeFileSync(out, JSON.stringify(results, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
