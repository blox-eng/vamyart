export type OrderCollection = {
  id: string;
  slug: string;
  title: string;
  published: boolean;
  deleted: boolean;
  onLanding: boolean;
  sortOrder: number;
  pieceIds: string[];
};

export type OrderPiece = {
  id: string;
  published: boolean;
  deleted: boolean;
  sortOrder: number;
  title: string;
};

const FALLBACK_ASPECT = 0.8;
const ARTIST = "Maeve Vamy";

const bySortThenTitle = (a: { sortOrder: number; title: string }, b: { sortOrder: number; title: string }) =>
  a.sortOrder - b.sortOrder || a.title.localeCompare(b.title);

function visiblePieceIds(pieces: OrderPiece[]): Set<string> {
  return new Set(pieces.filter((p) => p.published && !p.deleted).map((p) => p.id));
}

export function collectionOrder(col: OrderCollection, pieces: OrderPiece[]): string[] {
  const visible = visiblePieceIds(pieces);
  return col.pieceIds.filter((id) => visible.has(id));
}

function publicCollections(cols: OrderCollection[], pieces: OrderPiece[]): OrderCollection[] {
  return cols
    .filter((c) => c.published && !c.deleted && collectionOrder(c, pieces).length > 0)
    .sort(bySortThenTitle);
}

export function publicFilters(cols: OrderCollection[], pieces: OrderPiece[]): Array<{ slug: string; title: string }> {
  return publicCollections(cols, pieces).map(({ slug, title }) => ({ slug, title }));
}

function dedupedPieceIds(cols: OrderCollection[], pieces: OrderPiece[]): string[] {
  const seen = new Set<string>();
  for (const c of cols) for (const id of collectionOrder(c, pieces)) seen.add(id);
  return [...seen];
}

export function allOrder(cols: OrderCollection[], pieces: OrderPiece[]): string[] {
  const inCollections = dedupedPieceIds(publicCollections(cols, pieces), pieces);
  const placed = new Set(inCollections);
  const others = pieces
    .filter((p) => p.published && !p.deleted && !placed.has(p.id))
    .sort(bySortThenTitle)
    .map((p) => p.id);
  return [...inCollections, ...others];
}

export function landingOrder(cols: OrderCollection[], pieces: OrderPiece[]): string[] {
  return dedupedPieceIds(publicCollections(cols, pieces).filter((c) => c.onLanding), pieces);
}

export function aspectOf(img: { width: number | null; height: number | null }): number {
  const { width, height } = img;
  if (!width || !height || width <= 0 || height <= 0) return FALLBACK_ASPECT;
  return width / height;
}

export function pieceAltText(p: { altText: string | null; title: string; medium: string | null }): string {
  const custom = p.altText?.trim();
  if (custom) return custom;
  return p.medium ? `${p.title}, ${p.medium}, by ${ARTIST}` : `${p.title}, by ${ARTIST}`;
}
