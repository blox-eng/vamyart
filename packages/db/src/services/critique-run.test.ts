import { describe, it, expect, vi } from "vitest";
import { requestCritique } from "./critique-run";

const read = {
  answer: "The shadows are too warm.",
  swatchNames: ["deep blue night", "ochre glow"],
  colour: "c",
  value: "v",
  composition: "k",
};

function fakeFetch(body: unknown, status = 200) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status }));
}

const input = {
  apiKey: "key",
  model: "google/gemini-3.8-flash",
  imageUrl: "https://signed.example/photo.jpg",
  prompt: "what's off about the shadows?",
  swatches: [{ hex: "#1f2b7a", area: 0.6 }, { hex: "#c4963d", area: 0.4 }],
};

describe("requestCritique", () => {
  it("sends the image, prompt and measured palette with a strict JSON schema", async () => {
    const fetchImpl = fakeFetch({ choices: [{ message: { content: JSON.stringify(read) } }], usage: { cost: 0.0012 } });
    await requestCritique({ ...input, fetchImpl });

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer key");
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe("google/gemini-3.8-flash");
    expect(body.temperature).toBe(0);
    expect(body.response_format.json_schema.strict).toBe(true);
    const user = body.messages.find((m: { role: string }) => m.role === "user");
    expect(JSON.stringify(user.content)).toContain("https://signed.example/photo.jpg");
    expect(JSON.stringify(user.content)).toContain("what's off about the shadows?");
    expect(JSON.stringify(user.content)).toContain("#1f2b7a 60%");
  });

  it("returns the parsed read and the reported cost", async () => {
    const fetchImpl = fakeFetch({ choices: [{ message: { content: JSON.stringify(read) } }], usage: { cost: 0.0012 } });
    expect(await requestCritique({ ...input, fetchImpl })).toEqual({ read, costUsd: 0.0012 });
  });

  it("asks for one name per swatch, in order", async () => {
    const fetchImpl = fakeFetch({ choices: [{ message: { content: JSON.stringify({ ...read, swatchNames: ["only one"] }) } }] });
    await expect(requestCritique({ ...input, fetchImpl })).rejects.toThrow(/swatch names/);
  });

  it("surfaces provider errors", async () => {
    const fetchImpl = fakeFetch({ error: { message: "model not found" } }, 404);
    await expect(requestCritique({ ...input, fetchImpl })).rejects.toThrow(/404.*model not found/);
  });
});
