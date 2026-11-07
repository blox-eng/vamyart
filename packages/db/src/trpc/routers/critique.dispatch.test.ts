import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const updates: Record<string, unknown>[] = [];

vi.mock("../../client", () => ({
  db: {
    insert: () => ({ values: () => ({ returning: async () => [{ id: "run-1" }] }) }),
    update: () => ({ set: (values: Record<string, unknown>) => ({ where: async () => void updates.push(values) }) }),
  },
}));

vi.mock("../../services/critique-run", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../services/critique-run")>()),
  runCritique: vi.fn(async () => undefined),
}));

import { createCaller } from "../root";
import { runCritique } from "../../services/critique-run";

const caller = createCaller({ db: {} as never, userId: "artist" });
const input = {
  storagePath: "00000000-0000-0000-0000-000000000000.jpg",
  prompt: null,
  whiteBalance: null,
  swatches: [{ hex: "#1f2b7a", area: 1 }],
  measurements: null,
  artworkId: null,
  model: null,
};

beforeEach(() => {
  updates.length = 0;
  vi.mocked(runCritique).mockClear();
  vi.stubEnv("CRITIQUE_FN_SECRET", "s3cret");
  vi.stubEnv("URL", "https://studio.example");
  vi.stubEnv("DEPLOY_PRIME_URL", "https://deploy-preview-60--studio.example");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("critique.create dispatch", () => {
  it("calls this deploy's background function, not production's", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response(null, { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);
    await caller.critique.create(input);
    expect(fetchMock.mock.calls[0][0]).toBe("https://deploy-preview-60--studio.example/.netlify/functions/critique-run-background");
  });

  it("marks the run failed when the function can't be reached", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("fetch failed"); }));
    await expect(caller.critique.create(input)).rejects.toThrow(/Could not start critique/);
    expect(updates).toContainEqual(expect.objectContaining({ status: "failed" }));
  });

  it("treats anything but 202 Accepted as not started", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>login</html>", { status: 200 })));
    await expect(caller.critique.create(input)).rejects.toThrow(/Could not start critique \(200\)/);
    expect(updates).toContainEqual(expect.objectContaining({ status: "failed" }));
  });

  it("refuses to run inline in production when the function isn't configured", async () => {
    vi.stubEnv("CRITIQUE_FN_SECRET", "");
    vi.stubEnv("NODE_ENV", "production");
    await expect(caller.critique.create(input)).rejects.toThrow(/not configured/);
    expect(runCritique).not.toHaveBeenCalled();
    expect(updates).toContainEqual(expect.objectContaining({ status: "failed" }));
  });

  it("runs inline in local development", async () => {
    vi.stubEnv("CRITIQUE_FN_SECRET", "");
    vi.stubEnv("NODE_ENV", "development");
    await caller.critique.create(input);
    expect(runCritique).toHaveBeenCalledWith("run-1");
  });
});
