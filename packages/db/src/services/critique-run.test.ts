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
    expect(body).not.toHaveProperty("temperature");
    expect(body.response_format.json_schema.strict).toBe(true);
    expect(body.provider.require_parameters).toBe(true);
    const user = body.messages.find((m: { role: string }) => m.role === "user");
    expect(JSON.stringify(user.content)).toContain("https://signed.example/photo.jpg");
    expect(JSON.stringify(user.content)).toContain("what's off about the shadows?");
    expect(JSON.stringify(user.content)).toContain("#1f2b7a 60%");
  });

  it("adds the measurements to the message when given", async () => {
    const fetchImpl = fakeFetch({ choices: [{ message: { content: JSON.stringify(read) } }] });
    await requestCritique({ ...input, measurements: "Value: low key.", fetchImpl });
    const body = JSON.parse((fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(JSON.stringify(body.messages[1].content)).toContain("Measurements:\\nValue: low key.");
  });

  it("returns the parsed read and the reported cost", async () => {
    const fetchImpl = fakeFetch({ choices: [{ message: { content: JSON.stringify(read) } }], usage: { cost: 0.0012 } });
    expect(await requestCritique({ ...input, fetchImpl })).toEqual({ read, costUsd: 0.0012 });
  });

  it("asks for one name per swatch, in order", async () => {
    const fetchImpl = fakeFetch({ choices: [{ message: { content: JSON.stringify({ ...read, swatchNames: ["only one"] }) } }] });
    await expect(requestCritique({ ...input, fetchImpl })).rejects.toThrow(/swatch names/);
  });

  it("accepts JSON wrapped in a markdown fence", async () => {
    const fetchImpl = fakeFetch({ choices: [{ message: { content: "```json\n" + JSON.stringify(read) + "\n```" } }] });
    expect((await requestCritique({ ...input, fetchImpl })).read).toEqual(read);
  });

  it("says plainly when the model returns no usable JSON", async () => {
    await expect(requestCritique({ ...input, fetchImpl: fakeFetch({ choices: [] }) })).rejects.toThrow(/no reply/);
    const prose = fakeFetch({ choices: [{ message: { content: "Lovely painting!" } }] });
    await expect(requestCritique({ ...input, fetchImpl: prose })).rejects.toThrow(/not valid JSON.*Lovely painting/);
    const partial = fakeFetch({ choices: [{ message: { content: JSON.stringify({ ...read, colour: undefined }) } }] });
    await expect(requestCritique({ ...input, fetchImpl: partial })).rejects.toThrow(/missing colour/);
  });

  it("surfaces provider errors", async () => {
    const fetchImpl = fakeFetch({ error: { message: "model not found" } }, 404);
    await expect(requestCritique({ ...input, fetchImpl })).rejects.toThrow(/404.*model not found/);
  });
});
