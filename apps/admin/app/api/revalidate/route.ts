import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Same-origin proxy for triggering website ISR revalidation.
//
// The studio client cannot call the website's /api/revalidate directly: it's a
// cross-origin request (CORS preflight + trailingSlash redirect issues) and the
// REVALIDATION_SECRET is server-only, so it isn't available in the browser bundle.
// This route runs in the studio's own deployment — same origin as the client, with
// the secret available server-side — and forwards to the website server-to-server.
const WEBSITE_URL = process.env.NEXT_PUBLIC_WEBSITE_URL ?? "http://localhost:3000";
const SECRET = process.env.REVALIDATION_SECRET ?? "";

export async function POST(req: Request) {
  // Auth gate: only an authenticated studio user may trigger revalidation.
  // (The auth middleware excludes /api, so we check the session here.)
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as { paths?: unknown } | null;
  const paths = body?.paths;
  if (!Array.isArray(paths) || paths.length === 0 || !paths.every((p) => typeof p === "string")) {
    return NextResponse.json({ error: "No paths provided" }, { status: 400 });
  }

  try {
    // Trailing slash avoids the website's trailingSlash 308 redirect.
    const res = await fetch(
      `${WEBSITE_URL}/api/revalidate/?paths=${encodeURIComponent(paths.join(","))}`,
      { method: "POST", headers: { "x-revalidate-secret": SECRET } }
    );
    if (!res.ok) {
      console.error("Website revalidation failed", res.status, await res.text().catch(() => ""));
    }
    return NextResponse.json({ ok: res.ok }, { status: res.ok ? 200 : 502 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 502 });
  }
}
