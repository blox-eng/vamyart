import { afterEach, describe, expect, it, vi } from "vitest";
import { buildNetlifyImageUrl, netlifyImage, netlifyImageSrcSet } from "./netlify-image";

describe("buildNetlifyImageUrl", () => {
  it("builds a URL with encoded source, width, and default quality 75", () => {
    expect(buildNetlifyImageUrl("https://x.co/a.jpg", { width: 400 })).toBe(
      "/.netlify/images?url=https%3A%2F%2Fx.co%2Fa.jpg&w=400&q=75"
    );
  });

  it("respects a custom quality", () => {
    expect(buildNetlifyImageUrl("/local.jpg", { width: 800, quality: 60 })).toBe(
      "/.netlify/images?url=%2Flocal.jpg&w=800&q=60"
    );
  });

  it("adds h and fit only when height is given", () => {
    expect(buildNetlifyImageUrl("/a.jpg", { width: 400, height: 500, fit: "cover" })).toBe(
      "/.netlify/images?url=%2Fa.jpg&w=400&h=500&fit=cover&q=75"
    );
  });

  it("passes through falsy, data:, .svg, and already-optimized sources", () => {
    expect(buildNetlifyImageUrl("", { width: 400 })).toBe("");
    expect(buildNetlifyImageUrl("data:image/png;base64,AAAA", { width: 400 })).toBe("data:image/png;base64,AAAA");
    expect(buildNetlifyImageUrl("/images/img-placeholder.svg", { width: 400 })).toBe("/images/img-placeholder.svg");
    expect(buildNetlifyImageUrl("/.netlify/images?url=%2Fa.jpg&w=400", { width: 800 })).toBe("/.netlify/images?url=%2Fa.jpg&w=400");
  });

  it("ignores query/hash when checking the .svg extension", () => {
    expect(buildNetlifyImageUrl("/a.svg?v=2", { width: 400 })).toBe("/a.svg?v=2");
  });
});

describe("runtime gate", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("netlifyImage no-ops outside production", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(netlifyImage("/a.jpg", { width: 400 })).toBe("/a.jpg");
  });

  it("netlifyImage no-ops in Stackbit preview", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("stackbitPreview", "true");
    expect(netlifyImage("/a.jpg", { width: 400 })).toBe("/a.jpg");
  });

  it("netlifyImage optimizes in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("stackbitPreview", "");
    expect(netlifyImage("/a.jpg", { width: 400 })).toBe("/.netlify/images?url=%2Fa.jpg&w=400&q=75");
  });

  it("netlifyImageSrcSet formats '<url> <w>w' entries in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("stackbitPreview", "");
    expect(netlifyImageSrcSet("/a.jpg", [400, 800])).toBe(
      "/.netlify/images?url=%2Fa.jpg&w=400&q=75 400w, /.netlify/images?url=%2Fa.jpg&w=800&q=75 800w"
    );
  });

  it("netlifyImageSrcSet returns empty string outside production", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(netlifyImageSrcSet("/a.jpg", [400, 800])).toBe("");
  });

  it("netlifyImageSrcSet returns '' for a non-transformable src even in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("stackbitPreview", "");
    expect(netlifyImageSrcSet("/x.svg", [400])).toBe("");
  });

  it("netlifyImage passes through a non-transformable src in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("stackbitPreview", "");
    expect(netlifyImage("/x.svg", { width: 400 })).toBe("/x.svg");
  });
});
