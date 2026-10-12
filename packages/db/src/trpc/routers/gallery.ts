import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure } from "../index";
import { db } from "../../client";
import { collectionCoverUrl } from "./collections";
import {
  allOrder,
  collectionOrder,
  landingOrder,
  pieceAltText,
  publicFilters,
  type OrderCollection,
  type OrderPiece,
} from "../../services/gallery";

export type GalleryImage = { url: string; width: number | null; height: number | null; alt: string };
export type GalleryPiece = {
  slug: string;
  title: string;
  excerpt: string | null;
  medium: string | null;
  image: GalleryImage | null;
};

async function loadGallery() {
  const [collectionRows, pieceRows] = await Promise.all([
    db.query.collections.findMany({
      with: { pieces: { orderBy: (ac, { asc }) => [asc(ac.sortOrder)] } },
    }),
    db.query.artworks.findMany({
      with: { images: { orderBy: (img, { asc }) => [asc(img.sortOrder)] } },
    }),
  ]);

  const orderCollections: OrderCollection[] = collectionRows.map((c) => ({
    id: c.id,
    slug: c.slug,
    title: c.title,
    published: c.published,
    deleted: c.deletedAt != null,
    onLanding: c.onLanding,
    sortOrder: c.sortOrder,
    pieceIds: c.pieces.map((ac) => ac.artworkId),
  }));
  const orderPieces: OrderPiece[] = pieceRows.map((a) => ({
    id: a.id,
    published: a.published,
    deleted: a.deletedAt != null,
    sortOrder: a.sortOrder,
    title: a.title,
  }));

  const piecesById = new Map(
    pieceRows.map((a): [string, GalleryPiece] => {
      const img = a.images.find((i) => i.isPrimary) ?? a.images[0] ?? null;
      const url = img ? collectionCoverUrl(img.storagePath, null) : null;
      return [
        a.id,
        {
          slug: a.slug,
          title: a.title.trim(),
          excerpt: a.excerpt,
          medium: a.medium,
          image:
            img && url
              ? {
                  url,
                  width: img.width,
                  height: img.height,
                  alt: pieceAltText({ altText: img.altText ?? null, title: a.title, medium: a.medium }),
                }
              : null,
        },
      ];
    })
  );

  const toPieces = (ids: string[]) => ids.map((id) => piecesById.get(id)!);
  return { collectionRows, orderCollections, orderPieces, toPieces };
}

export const galleryRouter = router({
  landing: publicProcedure.query(async (): Promise<GalleryPiece[]> => {
    const { orderCollections, orderPieces, toPieces } = await loadGallery();
    return toPieces(landingOrder(orderCollections, orderPieces));
  }),

  wall: publicProcedure
    .input(z.object({ collectionSlug: z.string().min(1).optional() }))
    .query(async ({ input }) => {
      const { collectionRows, orderCollections, orderPieces, toPieces } = await loadGallery();
      const filters = publicFilters(orderCollections, orderPieces);

      if (!input.collectionSlug) {
        return { pieces: toPieces(allOrder(orderCollections, orderPieces)), filters, collection: null };
      }

      const slug = input.collectionSlug;
      const row = filters.some((f) => f.slug === slug) ? collectionRows.find((c) => c.slug === slug) : undefined;
      const ordered = orderCollections.find((c) => c.slug === slug);
      if (!row || !ordered) throw new TRPCError({ code: "NOT_FOUND", message: "Collection not found" });

      const pieces = toPieces(collectionOrder(ordered, orderPieces));
      return {
        pieces,
        filters,
        collection: {
          slug: row.slug,
          title: row.title,
          description: row.description,
          seoTitle: row.seoTitle,
          seoDescription: row.seoDescription,
          coverUrl: collectionCoverUrl(row.coverImagePath, null) ?? pieces[0]?.image?.url ?? null,
        },
      };
    }),
});
