# Studio Auto-Downscale + About Portrait Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-downscale every studio image upload to a sane max dimension before it reaches Storage, and add Maeve's portrait to the About page.

**Architecture:** Part A adds a client-side resize step (canvas re-encode) inside the studio's existing `handleImageUpload`, so oversized camera exports are shrunk in the browser before the signed direct-to-Storage upload — Netlify never receives a 12 MB source again. Part B adds a static portrait asset to the website and renders it on the (currently hardcoded) About page.

**Tech Stack:** Next.js (App Router admin / Pages Router website), TypeScript, Supabase Storage signed uploads, Canvas API (`createImageBitmap` + `canvas.toBlob`), Vitest.

## Global Constraints

- **Downscale rule:** longest edge ≤ **2560px**, re-encode quality **0.85**, **preserve original format** (JPEG→JPEG, PNG→PNG, WebP→WebP). Never upscale; if already ≤ 2560px on the long edge, upload the original untouched.
- **EXIF orientation must be honored:** decode with `createImageBitmap(file, { imageOrientation: "from-image" })` so phone photos aren't re-encoded sideways (canvas output strips the EXIF orientation flag).
- **Fail open:** if resize throws or canvas is unavailable, upload the original file — never block an upload on the resize step.
- **No server changes:** resized output stays within the existing `image/jpeg|png|webp` allowlist, so `createUploadUrl` (Zod enum) and the Storage bucket accept it unchanged.
- **One push per PR** (protect Netlify preview credits). Both parts ship in one PR on branch `feat/studio-image-downscale-and-about-portrait`.
- Public OSS repo — no local absolute paths or secrets in committed files.

---

## File Structure

- `apps/admin/lib/image/resize.ts` (create) — `computeTargetDimensions` (pure) + `resizeImageForUpload` (canvas glue).
- `apps/admin/lib/image/resize.test.ts` (create) — unit tests for `computeTargetDimensions`.
- `apps/admin/vitest.config.ts` (create) — node-env Vitest config (mirrors website).
- `apps/admin/package.json` (modify) — add `"test": "vitest run"` script + `vitest` devDependency.
- `apps/admin/app/(dashboard)/artworks/page.tsx` (modify `handleImageUpload`, lines 190–220) — call resize, upload the resulting blob.
- `apps/website/public/images/maeve-portrait.jpg` (create — **needs the source file from Maeve**) — downscaled portrait.
- `apps/website/src/pages/about.tsx` (modify) — render the portrait.

---

## Task 1: Studio auto-downscale on upload

**Files:**
- Create: `apps/admin/lib/image/resize.ts`
- Test: `apps/admin/lib/image/resize.test.ts`
- Create: `apps/admin/vitest.config.ts`
- Modify: `apps/admin/package.json`
- Modify: `apps/admin/app/(dashboard)/artworks/page.tsx:190-220`

**Interfaces:**
- Produces:
  - `computeTargetDimensions(width: number, height: number, maxEdge: number): { width: number; height: number; resized: boolean }`
  - `resizeImageForUpload(file: File, maxEdge?: number, quality?: number): Promise<Blob>`

- [ ] **Step 1: Add Vitest to the admin app**

Add to `apps/admin/package.json` scripts (alongside `dev`/`build`):
```json
"test": "vitest run"
```
Add to `devDependencies` (match the website's version):
```json
"vitest": "^2.1.9"
```
Then install: `pnpm install` (from repo root).

Create `apps/admin/vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
  },
});
```

- [ ] **Step 2: Write the failing test**

Create `apps/admin/lib/image/resize.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { computeTargetDimensions } from "./resize";

describe("computeTargetDimensions", () => {
  it("leaves images already within the cap untouched", () => {
    expect(computeTargetDimensions(2000, 1500, 2560)).toEqual({
      width: 2000,
      height: 1500,
      resized: false,
    });
  });

  it("treats an image exactly at the cap as no-op", () => {
    expect(computeTargetDimensions(2560, 1440, 2560)).toEqual({
      width: 2560,
      height: 1440,
      resized: false,
    });
  });

  it("scales a tall portrait so the long edge hits the cap", () => {
    // 4284x5712 (Maeve's phone export) -> long edge 5712 -> 2560
    expect(computeTargetDimensions(4284, 5712, 2560)).toEqual({
      width: 1920,
      height: 2560,
      resized: true,
    });
  });

  it("scales a wide landscape so the long edge hits the cap", () => {
    expect(computeTargetDimensions(4000, 2000, 2560)).toEqual({
      width: 2560,
      height: 1280,
      resized: true,
    });
  });

  it("scales a square image on both edges", () => {
    expect(computeTargetDimensions(4000, 4000, 2560)).toEqual({
      width: 2560,
      height: 2560,
      resized: true,
    });
  });

  it("never upscales a small image", () => {
    expect(computeTargetDimensions(800, 600, 2560)).toEqual({
      width: 800,
      height: 600,
      resized: false,
    });
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm --filter @vamy/admin test` (or `cd apps/admin && pnpm test`)
Expected: FAIL — `computeTargetDimensions` is not exported / module not found.

> Note: confirm the admin package name via `apps/admin/package.json` `name` field; use it in the `--filter`. If unsure, `cd apps/admin && pnpm test`.

- [ ] **Step 4: Write the implementation**

Create `apps/admin/lib/image/resize.ts`:
```ts
// Client-side downscale for studio uploads. Camera/phone exports are often
// 4000+px / 10+ MB; the site never displays above 1600px, so we cap the long
// edge and re-encode before the signed direct-to-Storage upload. Netlify then
// never has to fetch + resize a giant source on a cold transform.

const DEFAULT_MAX_EDGE = 2560; // 1600px display + retina headroom
const DEFAULT_QUALITY = 0.85;

export function computeTargetDimensions(
  width: number,
  height: number,
  maxEdge: number
): { width: number; height: number; resized: boolean } {
  const longest = Math.max(width, height);
  if (longest <= maxEdge) {
    return { width, height, resized: false };
  }
  const scale = maxEdge / longest;
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
    resized: true,
  };
}

// Browser-only. Returns a resized Blob, or the original File when no resize is
// needed / possible. Preserves the source MIME type so the result stays within
// the jpeg|png|webp allowlist enforced client- and server-side.
export async function resizeImageForUpload(
  file: File,
  maxEdge: number = DEFAULT_MAX_EDGE,
  quality: number = DEFAULT_QUALITY
): Promise<Blob> {
  // Honor EXIF orientation: phone photos carry a rotation flag that canvas
  // re-encoding would otherwise drop, flipping the image sideways.
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const { width, height, resized } = computeTargetDimensions(
      bitmap.width,
      bitmap.height,
      maxEdge
    );
    if (!resized) return file;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, file.type, quality)
    );
    return blob ?? file;
  } finally {
    bitmap.close();
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd apps/admin && pnpm test`
Expected: PASS — all 6 `computeTargetDimensions` cases green.

- [ ] **Step 6: Wire the resize into the upload path**

In `apps/admin/app/(dashboard)/artworks/page.tsx`, add the import near the top (after line 10):
```ts
import { resizeImageForUpload } from "@/lib/image/resize";
```
> Confirm the `@/` alias resolves to the admin app root (the file already imports `@/components/...` and `@/lib/...`), so `@/lib/image/resize` is correct.

Replace the body of `handleImageUpload` from the `const contentType` line (200) through the `uploadToSignedUrl` call (212). Change:
```ts
    const contentType = file.type as "image/jpeg" | "image/png" | "image/webp";
    setUploading(true);
    try {
      // 1. Get a signed URL, then upload bytes straight to Storage (no function
      //    body limit involved). 2. Record the object in the DB.
      const { path, token } = await createUploadUrl.mutateAsync({ artworkId: selectedKey, contentType });
      const supabase = createClient();
      const { error } = await supabase.storage
        .from("artwork-images")
        // One-year cache: the Netlify Image CDN inherits this, so cold transforms
        // of the source stop recurring hourly. Safe because storage keys are
        // content-addressed UUIDs (createUploadUrl mints a fresh one; upsert:false).
        .uploadToSignedUrl(path, token, file, { contentType, cacheControl: "31536000" });
```
to:
```ts
    setUploading(true);
    try {
      // Downscale oversized exports in the browser before upload (fail open to
      // the original if the resize can't run). Format is preserved, so the
      // content type stays within the jpeg|png|webp allowlist.
      let uploadBlob: Blob = file;
      try {
        uploadBlob = await resizeImageForUpload(file);
      } catch {
        uploadBlob = file;
      }
      const contentType = uploadBlob.type as "image/jpeg" | "image/png" | "image/webp";
      // 1. Get a signed URL, then upload bytes straight to Storage (no function
      //    body limit involved). 2. Record the object in the DB.
      const { path, token } = await createUploadUrl.mutateAsync({ artworkId: selectedKey, contentType });
      const supabase = createClient();
      const { error } = await supabase.storage
        .from("artwork-images")
        // One-year cache: the Netlify Image CDN inherits this, so cold transforms
        // of the source stop recurring hourly. Safe because storage keys are
        // content-addressed UUIDs (createUploadUrl mints a fresh one; upsert:false).
        .uploadToSignedUrl(path, token, uploadBlob, { contentType, cacheControl: "31536000" });
```
> The original `const contentType = file.type ...` line at 200 is removed (moved below, derived from `uploadBlob.type`). Keep the `setUploading(true)` and everything after `if (error) throw error;` unchanged.

- [ ] **Step 7: Verify the build compiles**

Run: `cd apps/admin && pnpm build`
Expected: build succeeds (type-checks the new import + edited handler).

- [ ] **Step 8: Commit**

```bash
git add apps/admin/lib/image/resize.ts apps/admin/lib/image/resize.test.ts \
        apps/admin/vitest.config.ts apps/admin/package.json \
        "apps/admin/app/(dashboard)/artworks/page.tsx" pnpm-lock.yaml
git commit -m "feat(studio): auto-downscale image uploads to 2560px before Storage"
```

---

## Task 2: Portrait on the About page

**Blocked on:** the portrait source file from Maeve (the Todoist attachment is behind a login wall). Once the file is available at a readable path, downscale it with the same rule (long edge ≤ 2560, q0.85) and commit it.

**Files:**
- Create: `apps/website/public/images/maeve-portrait.jpg`
- Modify: `apps/website/src/pages/about.tsx`

- [ ] **Step 1: Produce the downscaled asset**

Downscale the source to long-edge ≤ 2560px, quality ~0.85, saved as `apps/website/public/images/maeve-portrait.jpg`. Any of:
```bash
# ImageMagick
convert SOURCE.jpg -auto-orient -resize '2560x2560>' -quality 85 \
  apps/website/public/images/maeve-portrait.jpg
```
`-auto-orient` bakes EXIF rotation (mirrors the client rule). Confirm output dimensions and note them for Step 2:
```bash
identify apps/website/public/images/maeve-portrait.jpg
```

- [ ] **Step 2: Render the portrait on About**

In `apps/website/src/pages/about.tsx`, replace the Bio `<section>` (currently lines 38–52, the `<h1>` + two `<p>`) so the portrait sits beside/above the bio. Use the **actual** intrinsic dimensions from Step 2's `identify` output as `width`/`height` (example assumes a 3:4 portrait → 1920×2560):
```tsx
                            {/* Bio */}
                            <section className="mb-16 flex flex-col gap-8 sm:flex-row sm:items-start">
                                <img
                                    src="/images/maeve-portrait.jpg"
                                    alt="Maeve Vamy in her studio"
                                    width={1920}
                                    height={2560}
                                    className="w-40 sm:w-48 shrink-0 rounded-sm object-cover"
                                    loading="eager"
                                />
                                <div>
                                    <h1 className="text-3xl font-light mb-8">Maeve Vamy</h1>
                                    <div className="space-y-5 text-gray-600 leading-relaxed">
                                        <p>
                                            Maeve Vamy is a Bulgarian fine artist. She works between realism and
                                            abstraction, painting from direct observation in her studio in Stara
                                            Zagora.
                                        </p>
                                        <p>
                                            Each piece is finished slowly — built up in layers of oil on linen,
                                            then varnished and signed only when it's truly done.
                                        </p>
                                    </div>
                                </div>
                            </section>
```
> `width`/`height` are the intrinsic pixel dimensions (aspect-ratio reservation to avoid layout shift); `w-40 sm:w-48` controls the *rendered* width. Leave the artist-statement `<section>` and the SEO `<Head>` (incl. `og:image`) unchanged — the painting stays the social card.

- [ ] **Step 3: Verify the build**

Run: `cd apps/website && pnpm build`
Expected: build succeeds; `/about` references `/images/maeve-portrait.jpg` (present in `public/`).

- [ ] **Step 4: Commit**

```bash
git add apps/website/public/images/maeve-portrait.jpg apps/website/src/pages/about.tsx
git commit -m "feat(about): add artist portrait to the About page"
```

---

## Ship

After both tasks: verify tests + builds, then push once and open one PR (`feat/studio-image-downscale-and-about-portrait` → `main`). PR body should reference issue #24 (source-original shrink) and note that Part B's image will migrate into a content field once #27 lands.

## Self-Review notes

- **Spec coverage:** downscale rule (Task 1 constants + tests), EXIF (Task 1 Step 4 + Task 2 `-auto-orient`), fail-open (Task 1 Step 6 try/catch), no server changes (format preserved), portrait render (Task 2). ✓
- **Type consistency:** `computeTargetDimensions`/`resizeImageForUpload` signatures identical across definition, test, and call site. ✓
- **No placeholders:** all code shown; the only external dependency is the portrait file (explicitly flagged as a blocker, not a TODO in code). ✓
