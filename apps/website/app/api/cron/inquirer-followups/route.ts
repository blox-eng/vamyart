import { sendOverdueInquirerFollowups } from "@vamy/db";
import { NextResponse } from "next/server";

export const config = { schedule: "@daily" };

export async function GET(req: Request) {
  const url = new URL(req.url);
  const provided = url.searchParams.get("key");
  if (process.env.CRON_SECRET && provided !== process.env.CRON_SECRET) {
    if (!req.headers.get("x-nf-scheduled")) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }
  const result = await sendOverdueInquirerFollowups();
  return NextResponse.json(result);
}
