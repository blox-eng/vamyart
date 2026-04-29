import { eq, and, isNull } from "drizzle-orm";
import { Resend } from "resend";
import { db } from "../client";
import { productVariants, variantWaitlist } from "../schema";
import { renderBackInStockHtml } from "../emails/back-in-stock";

export type VariantStockState = {
  available: boolean;
  stockQuantity: number;
};

export function detectRestockTransition(
  before: VariantStockState,
  after: VariantStockState,
): boolean {
  const wasOut = !before.available || before.stockQuantity <= 0;
  const isIn = after.available && after.stockQuantity >= 1;
  return wasOut && isIn;
}

export type RestockNotifyResult = {
  notified: number;
  failed: number;
};

export async function notifyWaitlistForVariant(
  variantId: string,
): Promise<RestockNotifyResult> {
  const resendKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://vamy.art";
  if (!resendKey || !fromEmail) {
    console.error("[restock-notify] missing RESEND_API_KEY or RESEND_FROM_EMAIL; skipping");
    return { notified: 0, failed: 0 };
  }

  const variant = await db.query.productVariants.findFirst({
    where: eq(productVariants.id, variantId),
    with: { product: { with: { artwork: true } } },
  });
  if (!variant) return { notified: 0, failed: 0 };

  const rows = await db.query.variantWaitlist.findMany({
    where: and(
      eq(variantWaitlist.productVariantId, variantId),
      isNull(variantWaitlist.notifiedAt),
    ),
  });
  if (rows.length === 0) return { notified: 0, failed: 0 };

  const resend = new Resend(resendKey);
  const pieceName = variant.product?.artwork?.title ?? variant.product?.name ?? "Your piece";
  const slug = variant.product?.artwork?.slug;
  const pieceUrl = slug
    ? `${siteUrl}/get-a-piece/${slug}/`
    : `${siteUrl}/get-a-piece/`;
  const html = renderBackInStockHtml({
    pieceName,
    variantName: variant.name,
    pieceUrl,
    termsUrl: `${siteUrl}/terms`,
    privacyUrl: `${siteUrl}/privacy`,
  });

  // Send-then-mark, not transactional: if the process crashes between resend.emails.send
  // and the notifiedAt update, the same subscriber may be re-emailed on the next restock.
  // Acceptable trade — duplicate notify is mild; silent miss (mark-then-send) is worse.
  const CHUNK_SIZE = 10;
  let notified = 0;
  let failed = 0;
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);
    const results = await Promise.allSettled(
      chunk.map(async (row) => {
        await resend.emails.send({
          from: fromEmail,
          to: row.email,
          replyTo: "maeve@vamy.art",
          subject: "The piece you asked about is available again",
          html,
        });
        await db
          .update(variantWaitlist)
          .set({ notifiedAt: new Date() })
          .where(eq(variantWaitlist.id, row.id));
        return row.id;
      }),
    );
    results.forEach((r, idx) => {
      if (r.status === "fulfilled") {
        notified += 1;
      } else {
        failed += 1;
        console.error("[restock-notify] send failed", {
          variantId,
          waitlistRowId: chunk[idx]!.id,
          err: r.reason,
        });
      }
    });
  }
  return { notified, failed };
}
