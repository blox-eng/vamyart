/**
 * Model spike for the critique (#59): runs every model in CRITIQUE_MODELS on a
 * few paintings through the same requestCritique the studio uses, and prints
 * what each returned, how long it took and what it cost. Nothing is written to
 * the database or Storage: images go inline as data URLs.
 *
 * --compare runs each model twice per painting, without and with the measured
 * value/chroma/temperature facts, to see whether grounding changes the read.
 *
 * Run with: cd packages/db && OPENROUTER_API_KEY=... pnpm dlx tsx scripts/critique-spike.ts [--compare] [--out results.json] [image ...]
 */
import { createRequire } from "module";
import { writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, basename, resolve } from "path";
import { describeMeasurements, extractPalette, measure } from "@vamy/palette";
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
const compareIndex = args.indexOf("--compare");
const arms = compareIndex >= 0 && args.splice(compareIndex, 1) ? [false, true] : [true];
const images = args.length ? args : DEFAULT_IMAGES;

const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey) throw new Error("Set OPENROUTER_API_KEY");

async function prepare(path: string) {
  const jpeg = await sharp(path).rotate().resize(SEND_EDGE, SEND_EDGE, { fit: "inside" }).jpeg({ quality: 85 }).toBuffer();
  const { data, info } = await sharp(path).rotate().resize(ANALYSIS_EDGE, ANALYSIS_EDGE, { fit: "inside" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const rgba = new Uint8ClampedArray(data);
  const swatches = extractPalette(rgba, { k: 6 }).map(({ hex, area }) => ({ hex, area }));
  const measurements = describeMeasurements(measure(rgba, info.width));
  return { name: basename(path), imageUrl: `data:image/jpeg;base64,${jpeg.toString("base64")}`, swatches, measurements };
}

async function main() {
  const paintings = await Promise.all(images.map(prepare));
  const results = await Promise.all(
    CRITIQUE_MODELS.flatMap((model) =>
      arms.flatMap((measured) =>
        paintings.map(async (p) => {
          const started = Date.now();
          const base = { model: measured ? model : `${model} (photo only)`, painting: p.name, measured };
          try {
            const { read, costUsd } = await requestCritique({
              apiKey, model, imageUrl: p.imageUrl, prompt: PROMPT, swatches: p.swatches, measurements: measured ? p.measurements : null,
            });
            return { ...base, ok: true, seconds: (Date.now() - started) / 1000, costUsd, read, swatches: p.swatches, measurements: p.measurements };
          } catch (err) {
            return { ...base, ok: false, seconds: (Date.now() - started) / 1000, error: err instanceof Error ? err.message : String(err) };
          }
        })
      )
    )
  );

  for (const model of [...new Set(results.map((r) => r.model))]) {
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
