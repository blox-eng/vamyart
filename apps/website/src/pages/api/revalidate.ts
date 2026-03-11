import type { NextApiRequest, NextApiResponse } from "next";
import { timingSafeEqual } from "crypto";

function secretsMatch(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const secret = req.headers["x-revalidate-secret"] ?? req.query.secret;
  if (!secretsMatch(String(secret ?? ""), process.env.REVALIDATION_SECRET ?? "")) {
    return res.status(401).json({ error: "Invalid secret" });
  }

  const rawPaths = (req.query.paths as string) ?? "";
  const paths = rawPaths
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  if (paths.length === 0) {
    return res.status(400).json({ error: "No paths provided" });
  }

  try {
    await Promise.all(paths.map((path) => res.revalidate(path)));
    return res.json({ revalidated: true, paths });
  } catch (err) {
    return res.status(500).json({ error: "Revalidation failed", detail: String(err) });
  }
}
