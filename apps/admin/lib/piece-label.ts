// The piece picker's option text: the title, then the piece's collections in the studio's collection order.
export function pieceLabel(title: string, collectionIds: string[], collections: { id: string; title: string }[]): string {
  const names = collections.filter((c) => collectionIds.includes(c.id)).map((c) => c.title.trim());
  return `${title} · ${names.length ? names.join(", ") : "no collection"}`;
}
