import { describe, it, expect, vi } from "vitest";
import { createCaller } from "../root";

// Mock the DB and email
vi.mock("../../client", () => ({
  db: {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    }),
  },
}));

vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: {
      send: vi.fn().mockResolvedValue({ id: "test-id" }),
    },
  })),
}));

describe("inquiries.create", () => {
  it("rejects missing required fields", async () => {
    const caller = createCaller({ db: {} as never, userId: null });
    await expect(
      caller.inquiries.create({
        name: "",
        email: "not-an-email",
        pieceInterest: "",
      })
    ).rejects.toThrow();
  });

  it("accepts valid inquiry", async () => {
    const caller = createCaller({ db: {} as never, userId: null });
    await expect(
      caller.inquiries.create({
        name: "Test Collector",
        email: "collector@example.com",
        pieceInterest: "Untitled No. 3",
        message: "I am very interested.",
      })
    ).resolves.toMatchObject({ success: true });
  });
});
