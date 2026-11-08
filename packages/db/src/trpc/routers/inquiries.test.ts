import { describe, it, expect, vi, beforeEach } from "vitest";
import { createCaller } from "../root";

const insertValues = vi.fn().mockResolvedValue(undefined);
vi.mock("../../client", () => ({
  db: { insert: vi.fn(() => ({ values: insertValues })) },
}));

const sendEmail = vi.fn().mockResolvedValue({ id: "test-id" });
vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({ emails: { send: sendEmail } })),
}));

const verifyHuman = vi.fn();
vi.mock("../../services/turnstile", () => ({ verifyHuman: (...a: unknown[]) => verifyHuman(...a) }));

const subscribeToButtondown = vi.fn().mockResolvedValue({ alreadySubscribed: false });
vi.mock("../../services/buttondown", () => ({
  subscribeToButtondown: (...a: unknown[]) => subscribeToButtondown(...a),
}));

const valid = {
  name: "Test Collector",
  email: "collector@example.com",
  pieceInterest: "Untitled No. 3",
  message: "I am very interested.",
  turnstileToken: "tok",
};

beforeEach(() => {
  vi.clearAllMocks();
  verifyHuman.mockResolvedValue(true);
});

describe("inquiries.create", () => {
  it("rejects missing required fields", async () => {
    const caller = createCaller({ db: {} as never, userId: null });
    await expect(
      caller.inquiries.create({ name: "", email: "not-an-email", pieceInterest: "", turnstileToken: "tok" }),
    ).rejects.toThrow();
  });

  it("accepts a valid inquiry, checking the token against the visitor's IP", async () => {
    const caller = createCaller({ db: {} as never, userId: null, clientIp: "203.0.113.7" });
    await expect(caller.inquiries.create(valid)).resolves.toMatchObject({ success: true });
    expect(verifyHuman).toHaveBeenCalledWith("tok", "203.0.113.7");
  });

  it("refuses a bot before storing anything or sending any email", async () => {
    verifyHuman.mockResolvedValue(false);
    const caller = createCaller({ db: {} as never, userId: null });
    await expect(caller.inquiries.create(valid)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(insertValues).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("subscribes to the newsletter on the server when the visitor opts in", async () => {
    const caller = createCaller({ db: {} as never, userId: null, clientIp: "203.0.113.7" });
    await caller.inquiries.create({ ...valid, newsletterOptIn: true, locale: "de" });
    expect(subscribeToButtondown).toHaveBeenCalledWith({
      email: "collector@example.com",
      source: "inquiry",
      locale: "de",
      ipAddress: "203.0.113.7",
    });
  });

  it("does not subscribe without opt-in", async () => {
    const caller = createCaller({ db: {} as never, userId: null });
    await caller.inquiries.create(valid);
    expect(subscribeToButtondown).not.toHaveBeenCalled();
  });
});
