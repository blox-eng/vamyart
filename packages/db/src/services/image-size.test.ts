import { describe, it, expect } from "vitest";
import { readImageSize } from "./image-size";

const u32be = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const u16be = (n: number) => [(n >>> 8) & 255, n & 255];
const u24le = (n: number) => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255];
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));

const png = (w: number, h: number) =>
  new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ...u32be(13), ...ascii("IHDR"), ...u32be(w), ...u32be(h), 8, 6, 0, 0, 0,
  ]);

const jpeg = (w: number, h: number, marker = 0xc0) =>
  new Uint8Array([
    0xff, 0xd8,
    0xff, 0xe0, ...u16be(16), ...ascii("JFIF"), 0, 1, 1, 0, 0, 1, 0, 1, 0, 0,
    0xff, marker, ...u16be(11), 8, ...u16be(h), ...u16be(w), 1, 1, 0x11, 0,
  ]);

const riff = (chunk: number[]) => new Uint8Array([...ascii("RIFF"), 0, 0, 0, 0, ...ascii("WEBP"), ...chunk]);

describe("readImageSize", () => {
  it("reads PNG IHDR", () => {
    expect(readImageSize(png(640, 480))).toEqual({ width: 640, height: 480 });
  });

  it("reads JPEG SOF0 after APP0", () => {
    expect(readImageSize(jpeg(800, 600))).toEqual({ width: 800, height: 600 });
  });

  it("reads progressive JPEG SOF2", () => {
    expect(readImageSize(jpeg(800, 600, 0xc2))).toEqual({ width: 800, height: 600 });
  });

  it("reads WebP VP8X", () => {
    const chunk = [...ascii("VP8X"), 10, 0, 0, 0, 0, 0, 0, 0, ...u24le(999), ...u24le(1249)];
    expect(readImageSize(riff(chunk))).toEqual({ width: 1000, height: 1250 });
  });

  it("reads WebP VP8L", () => {
    const w = 300 - 1;
    const h = 200 - 1;
    const bits = w | (h << 14);
    const chunk = [...ascii("VP8L"), 5, 0, 0, 0, 0x2f, bits & 255, (bits >>> 8) & 255, (bits >>> 16) & 255, (bits >>> 24) & 255];
    expect(readImageSize(riff(chunk))).toEqual({ width: 300, height: 200 });
  });

  it("reads WebP VP8", () => {
    const chunk = [
      ...ascii("VP8 "), 10, 0, 0, 0,
      0, 0, 0, 0x9d, 0x01, 0x2a, 120, 0, 90, 0,
    ];
    expect(readImageSize(riff(chunk))).toEqual({ width: 120, height: 90 });
  });

  it("returns null for unknown bytes", () => {
    expect(readImageSize(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]))).toBeNull();
  });

  it("returns null for a truncated PNG", () => {
    expect(readImageSize(png(640, 480).slice(0, 20))).toBeNull();
  });

  it("returns null for truncated JPEG and empty input", () => {
    expect(readImageSize(jpeg(800, 600).slice(0, 24))).toBeNull();
    expect(readImageSize(new Uint8Array())).toBeNull();
  });

  describe("JPEG EXIF orientation", () => {
    const exif = (orientation: number, le: boolean) => {
      const u16 = (n: number) => (le ? [n & 255, n >> 8] : [n >> 8, n & 255]);
      const u32 = (n: number) => (le ? [n, 0, 0, 0] : [0, 0, 0, n]);
      const body = [
        ...ascii("Exif"), 0, 0,
        ...(le ? ascii("II") : ascii("MM")), ...u16(0x2a), ...u32(8),
        ...u16(1), ...u16(0x0112), ...u16(3), ...u32(1), ...u16(orientation), 0, 0, ...u32(0),
      ];
      return [0xff, 0xe1, ...u16be(body.length + 2), ...body];
    };
    const withExif = (seg: number[], w = 800, h = 600) => {
      const base = jpeg(w, h);
      return new Uint8Array([...base.slice(0, 2), ...seg, ...base.slice(2)]);
    };

    it("swaps dims for orientation 6 (both byte orders)", () => {
      expect(readImageSize(withExif(exif(6, false)))).toEqual({ width: 600, height: 800 });
      expect(readImageSize(withExif(exif(6, true)))).toEqual({ width: 600, height: 800 });
    });

    it("leaves orientation 1 and 3 unchanged", () => {
      expect(readImageSize(withExif(exif(1, false)))).toEqual({ width: 800, height: 600 });
      expect(readImageSize(withExif(exif(3, true)))).toEqual({ width: 800, height: 600 });
    });

    it("ignores a truncated or garbage APP1", () => {
      expect(readImageSize(withExif(exif(6, false).slice(0, 20)))).toBeNull();
      const bad = [0xff, 0xe1, ...u16be(12), ...ascii("Exif"), 0, 0, 1, 2, 3, 4];
      expect(readImageSize(withExif(bad))).toEqual({ width: 800, height: 600 });
    });
  });

  it("returns null for a truncated VP8X", () => {
    expect(readImageSize(riff([...ascii("VP8X"), 10, 0, 0, 0, 0, 0, 0, 0, 1, 0]))).toBeNull();
  });

  it("returns null for zero or oversized dimensions", () => {
    expect(readImageSize(png(0, 480))).toBeNull();
    expect(readImageSize(png(70000, 480))).toBeNull();
  });
});
