import { describe, it, expect, vi, beforeEach } from "vitest";
import { trackEvent } from "./umami";

beforeEach(() => {
  vi.restoreAllMocks();
  process.env.UMAMI_WEBSITE_ID = "test-website-id";
  delete process.env.UMAMI_HOST;
});

describe("trackEvent", () => {
  it("posts event with correct payload shape and headers", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("{}", { status: 200 }),
    );

    await trackEvent("inquiry.submitted", { piece: "Skin Hunger" });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://cloud.umami.is/api/send",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          "User-Agent": "vamy-server/1.0",
        }),
      }),
    );
    const body = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string);
    expect(body).toEqual({
      type: "event",
      payload: {
        website: "test-website-id",
        name: "inquiry.submitted",
        data: { piece: "Skin Hunger" },
        hostname: "vamy.art",
        url: "/",
        language: "en",
        screen: "1920x1080",
      },
    });
  });

  it("uses UMAMI_HOST override when set", async () => {
    process.env.UMAMI_HOST = "https://umami.example.com";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("{}", { status: 200 }),
    );

    await trackEvent("bid.placed", { amount: 100 });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://umami.example.com/api/send",
      expect.anything(),
    );
  });

  it("returns silently without fetching when UMAMI_WEBSITE_ID unset", async () => {
    delete process.env.UMAMI_WEBSITE_ID;
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("{}", { status: 200 }),
    );

    await expect(trackEvent("inquiry.submitted")).resolves.toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("swallows fetch rejections", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("network down"));
    await expect(trackEvent("checkout.completed", { amount: 5000 })).resolves.toBeUndefined();
  });

  it("swallows non-2xx responses", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("bad request", { status: 400 }),
    );
    await expect(trackEvent("newsletter.subscribed", { source: "footer" })).resolves.toBeUndefined();
  });
});
