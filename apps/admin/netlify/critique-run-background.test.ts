import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@vamy/db/critique-run", () => ({ runCritique: vi.fn(async () => undefined) }));

import handler from "./critique-run-background.mjs";
import { runCritique } from "@vamy/db/critique-run";

const request = (authorization?: string, body: string = JSON.stringify({ runId: "run-1" })) =>
  new Request("https://studio.example/.netlify/functions/critique-run-background", {
    method: "POST",
    headers: authorization ? { authorization } : {},
    body,
  });

beforeEach(() => {
  vi.mocked(runCritique).mockClear();
  vi.stubEnv("CRITIQUE_FN_SECRET", "s3cret");
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("critique-run-background", () => {
  it.each([
    ["no header", undefined],
    ["a wrong secret of another length", "Bearer nope"],
    ["a wrong secret of the same length", "Bearer s3creX"],
    ["the wrong scheme", "Basic s3cret"],
  ])("rejects %s without starting a run", async (_, authorization) => {
    const res = await handler(request(authorization));
    expect(res?.status).toBe(401);
    expect(runCritique).not.toHaveBeenCalled();
  });

  it("rejects everything when the secret is unset", async () => {
    vi.stubEnv("CRITIQUE_FN_SECRET", "");
    expect((await handler(request("Bearer ")))?.status).toBe(401);
    expect(runCritique).not.toHaveBeenCalled();
  });

  it("starts the run with the right secret", async () => {
    await handler(request("Bearer s3cret"));
    expect(runCritique).toHaveBeenCalledTimes(1);
    expect(runCritique).toHaveBeenCalledWith("run-1");
  });

  it("answers 400 to a body that isn't a run", async () => {
    expect((await handler(request("Bearer s3cret", "not json")))?.status).toBe(400);
    expect((await handler(request("Bearer s3cret", JSON.stringify({ runId: 7 }))))?.status).toBe(400);
    expect(runCritique).not.toHaveBeenCalled();
  });
});
