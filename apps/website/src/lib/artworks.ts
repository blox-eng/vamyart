export type ArtworkOption = { slug: string; title: string };

// Gallery pieces are DB-driven — the inquiry dropdown loads them via
// trpc.artworks.listPublic (see ReachOutBlock). Only the non-piece options live here.
export const COMMISSION_OPTION = { slug: 'commission', title: 'A commission' };
export const OTHER_OPTION = { slug: 'other', title: 'Something else' };
