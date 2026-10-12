import { describe, it, expect } from "vitest";
import { normalizeRevalidatePath } from "./revalidate-path";

describe("normalizeRevalidatePath", () => {
  it("keeps the root as /", () => {
    expect(normalizeRevalidatePath("/")).toBe("/");
  });

  it("adds the trailing slash", () => {
    expect(normalizeRevalidatePath("/gallery")).toBe("/gallery/");
    expect(normalizeRevalidatePath("/gallery/collections/oil")).toBe("/gallery/collections/oil/");
  });

  it("leaves slashed paths alone", () => {
    expect(normalizeRevalidatePath("/gallery/")).toBe("/gallery/");
  });

  it("strips query and hash", () => {
    expect(normalizeRevalidatePath("/gallery?x=1")).toBe("/gallery/");
    expect(normalizeRevalidatePath("/gallery/#top")).toBe("/gallery/");
    expect(normalizeRevalidatePath("/?x=1")).toBe("/");
  });

  it("rejects paths that do not start with /", () => {
    expect(normalizeRevalidatePath("gallery")).toBeNull();
    expect(normalizeRevalidatePath("https://evil.example/")).toBeNull();
    expect(normalizeRevalidatePath("")).toBeNull();
    expect(normalizeRevalidatePath("?x=1")).toBeNull();
  });
});
