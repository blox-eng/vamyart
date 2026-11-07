import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// One critique_runs row in memory. Updates that claim a run (status → running)
// only apply while it is still queued, as the WHERE clause in runCritique says.
const store: { row: Record<string, unknown> | null } = { row: null };

vi.mock("../client", () => {
  const apply = (values: Record<string, unknown>) => {
    if (!store.row) return [];
    if (values.status === "running" && store.row.status !== "queued") return [];
    store.row = { ...store.row, ...values };
    return [store.row];
  };
  return {
    db: {
      select: () => ({ from: () => ({ where: async () => (store.row ? [store.row] : []) }) }),
      update: () => ({
        set: (values: Record<string, unknown>) => ({
          where: () => {
            const done = Promise.resolve().then(() => apply(values));
            return Object.assign(done, { returning: () => done });
          },
        }),
      }),
    },
  };
});

vi.mock("./storage", () => ({
  getStorageClient: () => ({
    storage: { from: () => ({ createSignedUrl: async () => ({ data: { signedUrl: "https://signed.example/x.jpg" }, error: null }) }) },
  }),
}));

import { runCritique, CRITIQUE_MODELS } from "./critique-run";

const read = { answer: "a", swatchNames: ["night blue"], colour: "c", value: "v", composition: "k" };
const fetchMock = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(read) } }], usage: { cost: 0.0012 } })));

function queuedRun() {
  store.row = {
    id: "run-1",
    status: "queued",
    model: null,
    storagePath: "x.jpg",
    prompt: null,
    measurements: null,
    palette: { swatches: [{ hex: "#1f2b7a", area: 1, name: "", recipe: null }] },
  };
}

beforeEach(() => {
  queuedRun();
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
  process.env.OPENROUTER_API_KEY = "key";
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("runCritique", () => {
  it("does nothing for a run that is not queued", async () => {
    store.row!.status = "done";
    await runCritique("run-1");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(store.row!.status).toBe("done");
  });

  it("does nothing for a missing run", async () => {
    store.row = null;
    await expect(runCritique("run-1")).resolves.toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("calls the model once when two invocations race for the same run", async () => {
    await Promise.all([runCritique("run-1"), runCritique("run-1")]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("marks the run failed when the API key is missing", async () => {
    delete process.env.OPENROUTER_API_KEY;
    await runCritique("run-1");
    expect(store.row).toMatchObject({ status: "failed", error: "OPENROUTER_API_KEY is not set" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("stores the read, the model and the cost on success", async () => {
    await runCritique("run-1");
    expect(store.row).toMatchObject({ status: "done", result: read, costUsd: "0.0012", model: CRITIQUE_MODELS[0] });
  });
});
