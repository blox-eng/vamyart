import { describe, it, expect } from "vitest";
import { trpcMutation, extractResult } from "./helpers";

describe("newsletter.subscribe", () => {
  it("rejects invalid email", async () => {
    const res = await trpcMutation("newsletter.subscribe", { email: "bad" });
    expect(res.error).toBeDefined();
  });

  it("subscribes a valid email", async () => {
    const email = `e2e-newsletter-${Date.now()}@example.com`;
    const res = await trpcMutation("newsletter.subscribe", { email });
    expect(extractResult(res)).toMatchObject({ success: true });
  });

  it("is idempotent — duplicate email does not error", async () => {
    const email = `e2e-idempotent-${Date.now()}@example.com`;
    await trpcMutation("newsletter.subscribe", { email });
    const res = await trpcMutation("newsletter.subscribe", { email });
    expect(extractResult(res)).toMatchObject({ success: true });
  });
});
