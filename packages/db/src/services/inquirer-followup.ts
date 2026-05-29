import { and, isNotNull, isNull, lt, eq, sql } from "drizzle-orm";
import { Resend } from "resend";
import { db } from "../client";
import { inquiries } from "../schema";

export interface RunFollowupsResult {
  sent: number;
  skipped: number;
}

function buildFollowupText(name: string, pieceInterest: string): string {
  return `Hi ${name},

A while back you asked about ${pieceInterest}. I'm circling back because I'd rather know than not — is there something specific you're looking for that I haven't shown yet?

If now's not the right moment, no need to reply. If it is, I'm here.

— Maeve
vamy.art
`;
}

export async function sendOverdueInquirerFollowups(): Promise<RunFollowupsResult> {
  const overdue = await db
    .select()
    .from(inquiries)
    .where(
      and(
        isNotNull(inquiries.handledAt),
        isNull(inquiries.followupSentAt),
        lt(inquiries.handledAt, sql`now() - interval '14 days'`),
      ),
    );

  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !fromEmail) {
    console.warn("[inquirer-followup] RESEND_API_KEY or RESEND_FROM_EMAIL not set, skipping");
    return { sent: 0, skipped: overdue.length };
  }

  const resend = new Resend(apiKey);
  let sent = 0;
  let skipped = 0;

  for (const row of overdue) {
    try {
      await resend.emails.send({
        from: fromEmail,
        to: row.email,
        subject: `About ${row.pieceInterest}`,
        text: buildFollowupText(row.name, row.pieceInterest),
      });
      await db
        .update(inquiries)
        .set({ followupSentAt: new Date() })
        .where(eq(inquiries.id, row.id));
      sent += 1;
    } catch (err) {
      console.error("[inquirer-followup] send failed", row.id, err);
      skipped += 1;
    }
  }

  return { sent, skipped };
}
