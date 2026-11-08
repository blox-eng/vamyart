import { describe, it, expect, vi, beforeEach } from "vitest";
import { verifyHuman } from "./turnstile";

const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

beforeEach(() => {
  vi.restoreAllMocks();
  process.env.TURNSTILE_SECRET_KEY = "secret-test";
});

describe("verifyHuman", () => {
  it("passes when Cloudflare confirms the token, sending the secret, token and visitor IP", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 }));

    await expect(verifyHuman("tok", "203.0.113.7")).resolves.toBe(true);

    expect(fetchMock).toHaveBeenCalledWith(SITEVERIFY, expect.objectContaining({ method: "POST" }));
    const body = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string);
    expect(body).toEqual({ secret: "secret-test", response: "tok", remoteip: "203.0.113.7" });
  });

  it("fails when Cloudflare rejects the token", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ success: false, "error-codes": ["timeout-or-duplicate"] }), { status: 200 }),
    );
    await expect(verifyHuman("tok", null)).resolves.toBe(false);
  });

  it("fails closed when the secret is not configured, without calling Cloudflare", async () => {
    delete process.env.TURNSTILE_SECRET_KEY;
    const fetchMock = vi.spyOn(globalThis, "fetch");
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(verifyHuman("tok", null)).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fails closed when Cloudflare is unreachable", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(verifyHuman("tok", null)).resolves.toBe(false);
  });

  it("fails on an empty token without calling Cloudflare", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    await expect(verifyHuman("", null)).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
