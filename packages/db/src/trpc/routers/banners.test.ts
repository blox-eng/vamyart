import { describe, it, expect } from "vitest";
import { selectActiveBanner } from "./banners";

describe("selectActiveBanner", () => {
  const global = { id: "1", text: "Sale", isActive: true, scope: "global" as const, pageSlug: null };
  const scoped = { id: "2", text: "Gallery sale", isActive: true, scope: "page" as const, pageSlug: "gallery" };

  it("returns null when no banners", () => {
    expect(selectActiveBanner([], "gallery")).toBeNull();
  });

  it("returns page-scoped banner over global for matching slug", () => {
    expect(selectActiveBanner([global, scoped], "gallery")).toEqual(scoped);
  });

  it("returns global banner when no scoped match", () => {
    expect(selectActiveBanner([global, scoped], "shop")).toEqual(global);
  });

  it("returns null when only inactive banners exist", () => {
    const inactive = { ...global, isActive: false };
    expect(selectActiveBanner([inactive], "shop")).toBeNull();
  });
});
