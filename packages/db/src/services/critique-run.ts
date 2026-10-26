import { eq } from "drizzle-orm";
import { db } from "../client";
import { critiqueRuns, type CritiqueRead } from "../schema";
import { describeMeasurements } from "@vamy/palette";
import { getStorageClient } from "./storage";

export const CRITIQUE_BUCKET = "critique-uploads";
// Vision models with strict JSON output on OpenRouter. The first is the default.
// The spike (scripts/critique-spike.ts) dropped Qwen3-VL and GLM-5.3-flash:
// they misnamed swatches and ignored the length limit.
export const CRITIQUE_MODELS = [
  "google/gemini-3.8-flash",
  "google/gemini-4-argon",
  "openai/gpt-5.6-terra",
  "anthropic/claude-sonnet-5.5",
] as const;

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const REQUEST_TIMEOUT_MS = 180_000;
// A run older than this is dead: the background function has a 15-minute ceiling.
export const STALE_RUN_MS = 16 * 60_000;

const SYSTEM_PROMPT = `You are a studio mentor giving a painter honest, specific feedback on a photo of their painting.
Describe before you judge: ground every remark in what is visible in the image and in the measured palette you are given.
Answer the painter's question first, if they asked one. No flattery, no generic art-school phrases, no hedging filler.
Name each measured swatch the way a painter would say it out loud ("cool grey-violet shadow", "warm ochre light"), in the order given.
Measurements of the photo may follow the palette. They are exact where your eye on a phone photo is not: when they disagree with your impression, trust them, and translate them into a painter's terms rather than quoting the numbers.
Refer to colours by those names and to places by what is there ("the tree line", "upper left"); never by hex codes or pixel coordinates.
Keep each section to a few sentences.`;

const RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["answer", "swatchNames", "colour", "value", "composition"],
  properties: {
    answer: { type: "string", description: "Direct answer to the painter's question, or the single most useful observation if none was asked." },
    swatchNames: { type: "array", items: { type: "string" }, description: "One painterly name per measured swatch, same order." },
    colour: { type: "string", description: "Colour strategy: harmony, temperature, chroma, where colour sings or goes muddy." },
    value: { type: "string", description: "Value structure: massing, contrast, focal light." },
    composition: { type: "string", description: "Composition and eye path." },
  },
};

type Swatch = { hex: string; area: number };

const TEXT_FIELDS = ["answer", "colour", "value", "composition"] as const;

function parseRead(body: { choices?: { message?: { content?: unknown } }[] } | null): CritiqueRead {
  const content = body?.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new Error("Model sent no reply");
  let read: CritiqueRead;
  try {
    read = JSON.parse(content.trim().replace(/^```(?:json)?\s*|\s*```$/g, ""));
  } catch {
    throw new Error(`Model reply is not valid JSON: ${content.slice(0, 160)}`);
  }
  for (const field of TEXT_FIELDS) {
    if (typeof read?.[field] !== "string") throw new Error(`Model reply is missing ${field}`);
  }
  return read;
}

export async function requestCritique({
  apiKey,
  model,
  imageUrl,
  prompt,
  swatches,
  measurements = null,
  fetchImpl = fetch,
}: {
  apiKey: string;
  model: string;
  imageUrl: string;
  prompt: string | null;
  swatches: Swatch[];
  measurements?: string | null;
  fetchImpl?: typeof fetch;
}): Promise<{ read: CritiqueRead; costUsd: number | null }> {
  const palette = swatches.map((s) => `${s.hex} ${Math.round(s.area * 100)}%`).join(", ");
  const res = await fetchImpl(OPENROUTER_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      usage: { include: true },
      // Route only to providers that honour the strict schema below. No
      // temperature: reasoning models reject it, which this flag turns into a 404.
      provider: { require_parameters: true },
      response_format: { type: "json_schema", json_schema: { name: "critique", strict: true, schema: RESPONSE_SCHEMA } },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: [
                `Painter's question: ${prompt?.trim() || "(none)"}`,
                `Measured palette (hex, share of the canvas): ${palette}`,
                measurements && `Measurements:\n${measurements}`,
              ].filter(Boolean).join("\n"),
            },
            { type: "image_url", image_url: { url: imageUrl } },
          ],
        },
      ],
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${body?.error?.message ?? res.statusText}`);

  const read = parseRead(body);
  if (!Array.isArray(read.swatchNames) || read.swatchNames.length !== swatches.length) {
    throw new Error(`Model returned ${read.swatchNames?.length ?? 0} swatch names for ${swatches.length} swatches`);
  }
  return { read, costUsd: body.usage?.cost ?? null };
}

export async function runCritique(runId: string): Promise<void> {
  const [run] = await db.select().from(critiqueRuns).where(eq(critiqueRuns.id, runId));
  if (!run || run.status !== "queued") return;

  const model = run.model || process.env.CRITIQUE_MODEL || CRITIQUE_MODELS[0];
  await db.update(critiqueRuns).set({ status: "running", model, updatedAt: new Date() }).where(eq(critiqueRuns.id, runId));

  try {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set");
    const { data, error } = await getStorageClient().storage.from(CRITIQUE_BUCKET).createSignedUrl(run.storagePath, 600);
    if (error || !data) throw new Error(error?.message ?? "Could not sign image URL");

    const { read, costUsd } = await requestCritique({
      apiKey,
      model,
      imageUrl: data.signedUrl,
      prompt: run.prompt,
      swatches: run.palette.swatches,
      measurements: run.measurements && describeMeasurements(run.measurements),
    });
    await db
      .update(critiqueRuns)
      .set({ status: "done", result: read, costUsd: costUsd?.toString() ?? null, updatedAt: new Date() })
      .where(eq(critiqueRuns.id, runId));
  } catch (err) {
    await db
      .update(critiqueRuns)
      .set({ status: "failed", error: err instanceof Error ? err.message : String(err), updatedAt: new Date() })
      .where(eq(critiqueRuns.id, runId));
  }
}
