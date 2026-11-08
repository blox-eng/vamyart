import { describe, it, expect, vi, beforeEach } from "vitest";
import { createCaller } from "../root";

const verifyHuman = vi.fn();
vi.mock("../../services/turnstile", () => ({ verifyHuman: (...a: unknown[]) => verifyHuman(...a) }));

const subscribeToButtondown = vi.fn().mockResolvedValue({ alreadySubscribed: false });
vi.mock("../../services/buttondown", () => ({
  subscribeToButtondown: (...a: unknown[]) => subscribeToButtondown(...a),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("newsletter.subscribe", () => {
  it("refuses a bot without touching the list (#61)", async () => {
    verifyHuman.mockResolvedValue(false);
    const caller = createCaller({ db: {} as never, userId: null, clientIp: "198.51.100.1" });
    await expect(
      caller.newsletter.subscribe({ email: "victim@example.com", turnstileToken: "forged" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(subscribeToButtondown).not.toHaveBeenCalled();
  });

  it("rejects a request with no token", async () => {
    const caller = createCaller({ db: {} as never, userId: null });
    await expect(
      // @ts-expect-error the token is required
      caller.newsletter.subscribe({ email: "a@example.com" }),
    ).rejects.toThrow();
    expect(subscribeToButtondown).not.toHaveBeenCalled();
  });

  it("subscribes a human and forwards their IP to Buttondown", async () => {
    verifyHuman.mockResolvedValue(true);
    const caller = createCaller({ db: {} as never, userId: null, clientIp: "203.0.113.7" });
    await expect(
      caller.newsletter.subscribe({ email: "Reader@Example.com", turnstileToken: "tok", locale: "en" }),
    ).resolves.toEqual({ success: true, alreadySubscribed: false });
    expect(verifyHuman).toHaveBeenCalledWith("tok", "203.0.113.7");
    expect(subscribeToButtondown).toHaveBeenCalledWith({
      email: "reader@example.com",
      source: "footer",
      locale: "en",
      ipAddress: "203.0.113.7",
    });
  });
});
