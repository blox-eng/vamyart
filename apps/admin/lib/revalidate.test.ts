import { describe, it, expect, vi, afterEach } from "vitest";
import { revalidatePaths, onRevalidateFailed } from "./revalidate";

afterEach(() => vi.unstubAllGlobals());

function stubFetch(impl: () => Promise<Partial<Response>>) {
  vi.stubGlobal("fetch", vi.fn(impl));
  vi.spyOn(console, "warn").mockImplementation(() => {});
}

describe("revalidatePaths", () => {
  it("tells listeners when the website refuses the refresh", async () => {
    stubFetch(async () => ({ ok: false, status: 502 }));
    const listener = vi.fn();
    const off = onRevalidateFailed(listener);
    try {
      await revalidatePaths(["/"]);
    } finally {
      off();
    }
    expect(listener).toHaveBeenCalledOnce();
  });

  it("tells listeners when the request cannot be sent", async () => {
    stubFetch(async () => {
      throw new TypeError("network down");
    });
    const listener = vi.fn();
    const off = onRevalidateFailed(listener);
    try {
      await revalidatePaths(["/"]);
    } finally {
      off();
    }
    expect(listener).toHaveBeenCalledOnce();
  });

  it("stays quiet when the refresh succeeds", async () => {
    stubFetch(async () => ({ ok: true, status: 200 }));
    const listener = vi.fn();
    const off = onRevalidateFailed(listener);
    try {
      await revalidatePaths(["/"]);
    } finally {
      off();
    }
    expect(listener).not.toHaveBeenCalled();
  });
});
