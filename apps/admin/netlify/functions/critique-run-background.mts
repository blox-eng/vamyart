import { timingSafeEqual } from "node:crypto";
import { runCritique } from "@vamy/db/critique-run";

// Netlify background function (the "-background" suffix): returns 202 at once and
// keeps running for up to 15 minutes. Only the studio's tRPC server calls it.
// The caller never sees what this returns, so failures are logged for the function logs.
export default async (req: Request) => {
  const secret = process.env.CRITIQUE_FN_SECRET;
  const given = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  if (!secret || given.length !== expected.length || !timingSafeEqual(Buffer.from(given), Buffer.from(expected))) {
    console.error("critique-run-background: rejected a call with a missing or wrong CRITIQUE_FN_SECRET");
    return new Response("Unauthorized", { status: 401 });
  }
  const { runId } = ((await req.json().catch(() => null)) ?? {}) as { runId?: unknown };
  if (typeof runId !== "string") {
    console.error("critique-run-background: body has no runId");
    return new Response("Bad request", { status: 400 });
  }
  await runCritique(runId);
};
