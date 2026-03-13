# Artwork Image Management — Design Spec

**Date:** 2026-03-13
**Status:** Approved

## Overview

Replace hardcoded static artwork images with Supabase Storage-backed image management. Maeve uploads and manages artwork images through the existing admin panel. The website reads images from Supabase CDN with a fallback to existing static files.

## Scope

1. Supabase Storage bucket for artwork images
2. `artwork_images` table with multi-image support and primary flag
3. Image upload/delete/set-primary UI in admin artworks page
4. Website queries primary image from DB instead of markdown frontmatter
5. Homepage hero uses featured artwork's primary image from Supabase
6. Remove about page hero banner image

## Storage & Schema

### Supabase Storage

- **Bucket:** `artwork-images` (public read, service-role write)
- **Path convention:** `{artwork_slug}/{uuid}.{ext}` (e.g. `first-contact/a1b2c3.jpg`)
- **Public URL:** `{SUPABASE_URL}/storage/v1/object/public/artwork-images/{storage_path}`

### New table: `artwork_images`

```sql
CREATE TABLE artwork_images (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artwork_id  uuid NOT NULL REFERENCES artworks(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  alt_text    text,
  is_primary  boolean NOT NULL DEFAULT false,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Only one primary image per artwork
CREATE UNIQUE INDEX artwork_images_one_primary
  ON artwork_images (artwork_id) WHERE (is_primary = true);

-- Fast lookup by artwork
CREATE INDEX artwork_images_artwork_id ON artwork_images (artwork_id);
```

### RLS policies

- `SELECT`: allow for `anon` and `authenticated` (public read)
- `INSERT`, `UPDATE`, `DELETE`: service role only (admin writes through tRPC server-side)

## Admin: Image Upload Flow

### Location

Inline in the existing artworks page (`apps/admin/app/(dashboard)/artworks/page.tsx`). Each artwork row expands to show an image gallery section. No new pages.

### UI

- Click-to-upload zone (accepts jpg/png/webp, max 10MB)
- Thumbnails of uploaded images with actions: **Set as primary** (star icon) / **Delete** (trash icon)
- Primary image shows a star badge
- First image uploaded auto-becomes primary

### Upload flow

1. User selects file in admin UI
2. Client validates type + size (jpg/png/webp, max 10MB)
3. Client calls tRPC `artworkImages.upload` mutation with file as base64
4. Server-side: validates file type + size, uploads to Supabase Storage using service role key, inserts `artwork_images` row
5. UI refreshes to show new thumbnail

**Important:** The service role key never touches the browser. All storage writes go through tRPC server-side mutations.

### tRPC router: `artworkImages`

Lives in `packages/db/src/routers/`:

- `artworkImages.list` — get all images for an artwork, ordered by sort_order
- `artworkImages.upload` — accepts base64 file + metadata, validates server-side, uploads to Storage, inserts row (auto-sets primary if first image)
- `artworkImages.delete` — remove from Supabase Storage + delete row. If deleted image was primary, auto-promote next image (lowest sort_order) to primary
- `artworkImages.setPrimary` — in a transaction: unset all `is_primary` for the artwork first, then set the target image (order matters due to partial unique index)

## Website: Image Consumption

### Primary image query

The `[[...slug]].js` page already queries products/artworks from Supabase at build time (ISR). Add a join to `artwork_images WHERE is_primary = true` to get the image URL.

### Fallback strategy

If no `artwork_images` row exists for an artwork, fall back to the markdown `featuredImage.url`. This allows graceful migration — existing static images keep working until Maeve uploads replacements.

### Affected components

- **Gallery cards** — show primary image from DB (fallback to frontmatter)
- **Artwork detail pages** — show primary image only for now (schema supports multi-image gallery later)
- **Homepage hero** — featured product → artwork slug → primary artwork_image → Supabase CDN URL

### About page

Remove the hero `<div>` with `about-placeholder.jpg` (the 21:9 aspect ratio banner). Page starts directly with the bio section.

## Security & Validation

- **Storage bucket:** public read, service-role write
- **Client-side validation:** max 10MB, accepted types: `image/jpeg`, `image/png`, `image/webp`
- **Server-side validation:** tRPC upload mutation re-validates file type + size (client validation is trivially bypassed)
- **No server-side resize** — artist prepares properly sized images
- **Supabase bucket config:** set max file size 10MB and allowed MIME types at bucket level as defense-in-depth

## ISR Revalidation

Image mutations (upload, delete, set-primary) must trigger ISR revalidation on the website, same pattern as existing product saves in admin. Affected paths:
- `/gallery/{artwork-slug}` (artwork detail page)
- `/` (homepage, if the artwork is featured)
- `/gallery` (gallery listing)

The admin already has a `revalidatePaths` helper — image mutations call it after success.

## Prerequisites

Image upload requires an `artworks` DB row to exist (for the foreign key). All current artworks already have DB rows. If a new artwork is added via markdown but not yet in the DB, the admin artworks page must create the DB row first. This matches the existing flow — products reference artworks by slug, and the admin manages both.

## Performance

- Supabase Storage serves via CDN with cache headers
- `next/image` for automatic optimization (already in use on website)
- Primary image query is a simple indexed join

## No breaking changes

- Existing static images continue working (fallback)
- No markdown file modifications required
- No new environment variables needed (Supabase URL and keys already configured)
- No migration pressure — Maeve uploads images at her own pace

## What we're NOT building

- Image cropping/resizing in admin
- Drag-and-drop reordering (sort_order managed manually if ever needed)
- Decap CMS / Netlify CMS integration (doesn't fit Supabase-based architecture)
- Multiple image gallery view on artwork detail pages (future — just primary for now, but schema supports it)
