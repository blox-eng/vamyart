import { timingSafeEqual } from "node:crypto";
import { runCritique } from "@vamy/db/critique-run";

// Netlify background function (the "-background" suffix): returns 202 at once and
// keeps running for up to 15 minutes. Only the studio's tRPC server calls it.
export default async (req: Request) => {
  const secret = process.env.CRITIQUE_FN_SECRET;
  const given = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  if (!secret || given.length !== expected.length || !timingSafeEqual(Buffer.from(given), Buffer.from(expected))) {
    return new Response("Unauthorized", { status: 401 });
  }
  const { runId } = (await req.json()) as { runId?: string };
  if (typeof runId === "string") await runCritique(runId);
};
