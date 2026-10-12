export function collectionRevalidatePaths(slugs: string[]): string[] {
  return ["/", "/gallery/", ...slugs.map((s) => `/gallery/collections/${s}/`)];
}
