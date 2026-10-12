// trailingSlash: true makes Next answer a slashless path with a 308, which
// res.revalidate() treats as a failure. Every path goes through this first.
export function normalizeRevalidatePath(raw: string): string | null {
  const path = raw.split(/[?#]/)[0].trim();
  if (!path.startsWith("/")) return null;
  return path.endsWith("/") ? path : `${path}/`;
}
