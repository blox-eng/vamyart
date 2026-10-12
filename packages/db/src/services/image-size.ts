export type ImageSize = { width: number; height: number };

const u16be = (b: Uint8Array, i: number) => (b[i] << 8) | b[i + 1];
const u32be = (b: Uint8Array, i: number) => ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
const u16le = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8);
const u24le = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8) | (b[i + 2] << 16);
const tag = (b: Uint8Array, i: number, s: string) =>
  b.length >= i + s.length && [...s].every((c, k) => b[i + k] === c.charCodeAt(0));

const MAX_DIM = 65535;

function valid(width: number, height: number): ImageSize | null {
  return width > 0 && height > 0 && width <= MAX_DIM && height <= MAX_DIM ? { width, height } : null;
}

function readPng(b: Uint8Array): ImageSize | null {
  if (b.length < 24 || !tag(b, 12, "IHDR")) return null;
  return valid(u32be(b, 16), u32be(b, 20));
}

// EXIF orientation from an APP1 segment body (starting at "Exif\0\0"); 1 when absent or malformed.
function readExifOrientation(b: Uint8Array, start: number, end: number): number {
  if (end > b.length || end - start < 14 || !tag(b, start, "Exif") || b[start + 4] !== 0 || b[start + 5] !== 0) return 1;
  const t = start + 6;
  const le = b[t] === 0x49 && b[t + 1] === 0x49;
  if (!le && !(b[t] === 0x4d && b[t + 1] === 0x4d)) return 1;
  const r16 = (i: number) => (le ? u16le(b, i) : u16be(b, i));
  const r32 = (i: number) => (le ? (u16le(b, i) | (u16le(b, i + 2) << 16)) >>> 0 : u32be(b, i));
  if (r16(t + 2) !== 0x2a) return 1;
  const ifd = t + r32(t + 4);
  if (ifd + 2 > end) return 1;
  const count = r16(ifd);
  for (let n = 0; n < count; n++) {
    const e = ifd + 2 + n * 12;
    if (e + 12 > end) return 1;
    if (r16(e) === 0x0112) {
      const o = r16(e + 8);
      return o >= 1 && o <= 8 ? o : 1;
    }
  }
  return 1;
}

function readJpeg(b: Uint8Array): ImageSize | null {
  let i = 2;
  let orientation = 1;
  while (i + 4 <= b.length) {
    if (b[i] !== 0xff) return null;
    const marker = b[i + 1];
    if (marker === 0xff) {
      i++;
      continue;
    }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    }
    if (marker === 0xd9 || marker === 0xda) return null;
    if (marker === 0xe1) {
      orientation = readExifOrientation(b, i + 4, Math.min(i + 2 + u16be(b, i + 2), b.length));
    }
    const isSof = marker >= 0xc0 && marker <= 0xc2;
    if (isSof) {
      if (i + 9 > b.length) return null;
      const w = u16be(b, i + 7);
      const h = u16be(b, i + 5);
      return orientation >= 5 ? valid(h, w) : valid(w, h);
    }
    i += 2 + u16be(b, i + 2);
  }
  return null;
}

function readWebp(b: Uint8Array): ImageSize | null {
  if (!tag(b, 8, "WEBP")) return null;
  if (tag(b, 12, "VP8X")) {
    if (b.length < 30) return null;
    return valid(u24le(b, 24) + 1, u24le(b, 27) + 1);
  }
  if (tag(b, 12, "VP8L")) {
    if (b.length < 25 || b[20] !== 0x2f) return null;
    const bits = u32be(new Uint8Array([b[24], b[23], b[22], b[21]]), 0);
    return valid((bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1);
  }
  if (tag(b, 12, "VP8 ")) {
    if (b.length < 30 || b[23] !== 0x9d || b[24] !== 0x01 || b[25] !== 0x2a) return null;
    return valid(u16le(b, 26) & 0x3fff, u16le(b, 28) & 0x3fff);
  }
  return null;
}

export function readImageSize(buf: Uint8Array): ImageSize | null {
  try {
    if (buf.length >= 8 && buf[0] === 0x89 && tag(buf, 1, "PNG")) return readPng(buf);
    if (buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xd8) return readJpeg(buf);
    if (buf.length >= 12 && tag(buf, 0, "RIFF")) return readWebp(buf);
    return null;
  } catch {
    return null;
  }
}
