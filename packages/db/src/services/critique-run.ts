import { eq } from "drizzle-orm";
import { db } from "../client";
import { critiqueRuns, type CritiqueRead } from "../schema";
import { getStorageClient } from "./storage";

export const CRITIQUE_BUCKET = "critique-uploads";
// Vision models with strict JSON output on OpenRouter, one per vendor, for the
// model spike. The first is the default.
export const CRITIQUE_MODELS = [
  "google/gemini-3.8-flash",
  "google/gemini-4-argon",
  "openai/gpt-5.6-terra",
  "anthropic/claude-sonnet-5.5",
  "qwen/qwen3-vl-235b-a22b-instruct",
  "z-ai/glm-5.3-flash",
] as const;

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

const SYSTEM_PROMPT = `You are a studio mentor giving a painter honest, specific feedback on a photo of their painting.
Describe before you judge: ground every remark in what is visible in the image and in the measured palette you are given.
Answer the painter's question first, if they asked one. No flattery, no generic art-school phrases, no hedging filler.
Name each measured swatch the way a painter would say it out loud ("cool grey-violet shadow", "warm ochre light"), in the order given.
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

export async function requestCritique({
  apiKey,
  model,
  imageUrl,
  prompt,
  swatches,
  fetchImpl = fetch,
}: {
  apiKey: string;
  model: string;
  imageUrl: string;
  prompt: string | null;
  swatches: Swatch[];
  fetchImpl?: typeof fetch;
}): Promise<{ read: CritiqueRead; costUsd: number | null }> {
  const palette = swatches.map((s) => `${s.hex} ${Math.round(s.area * 100)}%`).join(", ");
  const res = await fetchImpl(OPENROUTER_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      temperature: 0,
      usage: { include: true },
      response_format: { type: "json_schema", json_schema: { name: "critique", strict: true, schema: RESPONSE_SCHEMA } },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: `Painter's question: ${prompt?.trim() || "(none)"}\nMeasured palette (hex, share of the canvas): ${palette}` },
            { type: "image_url", image_url: { url: imageUrl } },
          ],
        },
      ],
    }),
  });

  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${body?.error?.message ?? res.statusText}`);

  const read = JSON.parse(body.choices[0].message.content) as CritiqueRead;
  if (read.swatchNames?.length !== swatches.length) {
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
