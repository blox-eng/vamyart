export function collectionRevalidatePaths(slugs: string[]): string[] {
  return ["/", "/gallery/", ...slugs.map((s) => `/gallery/collections/${s}/`)];
}

export function pieceRevalidatePaths(pieceSlug: string | null, collectionSlugs: string[]): string[] {
  const paths = collectionRevalidatePaths(collectionSlugs);
  return pieceSlug ? [...paths, `/gallery/${pieceSlug}/`] : paths;
}
