import { describe, it, expect } from "vitest";
import { trpcMutation, extractResult } from "./helpers";

describe("inquiries.create", () => {
  it("rejects empty name", async () => {
    const res = await trpcMutation("inquiries.create", {
      name: "",
      email: "test@example.com",
      pieceInterest: "Whispers",
    });
    expect(res.error).toBeDefined();
  });

  it("rejects invalid email", async () => {
    const res = await trpcMutation("inquiries.create", {
      name: "Test",
      email: "not-an-email",
      pieceInterest: "Whispers",
    });
    expect(res.error).toBeDefined();
  });

  it("accepts a valid inquiry", async () => {
    const res = await trpcMutation("inquiries.create", {
      name: "E2E Test",
      email: `e2e-${Date.now()}@example.com`,
      pieceInterest: "Whispers",
      message: "Integration test inquiry — safe to delete.",
    });
    expect(extractResult(res)).toMatchObject({ success: true });
  });
});
