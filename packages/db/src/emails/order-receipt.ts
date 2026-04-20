import { escapeHtml } from "../utils/escape-html";

export type OrderReceiptData = {
    orderNumber: string;
    buyerName: string;
    pieceName: string;
    variantName: string;
    medium: string | null;
    totalPaidEur: number;
    shippingAddress: {
        line1: string | null;
        line2: string | null;
        city: string | null;
        postalCode: string | null;
        country: string | null;
    };
    termsUrl: string;
    privacyUrl: string;
};

export function renderOrderReceiptHtml(d: OrderReceiptData): string {
    const addressLines = [
        d.shippingAddress.line1,
        d.shippingAddress.line2,
        [d.shippingAddress.city, d.shippingAddress.postalCode].filter(Boolean).join(" "),
        d.shippingAddress.country,
    ].filter(Boolean).map((line) => escapeHtml(String(line))).join("<br/>");

    const total = `€${d.totalPaidEur.toLocaleString("en-IE")}`;

    return `<!doctype html>
<html lang="en">
<body style="margin:0;padding:0;background:#fafafa;font-family:Georgia,serif;color:#222;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 0;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;padding:40px;">
<tr><td>
<h1 style="font-weight:300;font-size:22px;margin:0 0 8px;letter-spacing:.02em;">Maeve Vamy</h1>
<p style="font-size:12px;color:#888;margin:0 0 32px;">Order ${escapeHtml(d.orderNumber)}</p>

<p style="font-size:16px;line-height:1.5;margin:0 0 20px;">Thank you, ${escapeHtml(d.buyerName)}.</p>
<p style="font-size:14px;line-height:1.6;color:#444;margin:0 0 28px;">Your piece will ship within 30 days. I'll email you tracking details once it's on its way.</p>

<table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #eee;border-bottom:1px solid #eee;padding:16px 0;margin-bottom:28px;">
<tr><td style="padding:8px 0;font-size:13px;color:#666;width:40%;">Piece</td><td style="padding:8px 0;font-size:13px;">${escapeHtml(d.pieceName)}</td></tr>
<tr><td style="padding:8px 0;font-size:13px;color:#666;">Variant</td><td style="padding:8px 0;font-size:13px;">${escapeHtml(d.variantName)}</td></tr>
${d.medium ? `<tr><td style="padding:8px 0;font-size:13px;color:#666;">Medium</td><td style="padding:8px 0;font-size:13px;">${escapeHtml(d.medium)}</td></tr>` : ""}
<tr><td style="padding:8px 0;font-size:13px;color:#666;">Total paid</td><td style="padding:8px 0;font-size:13px;font-weight:500;">${total}</td></tr>
</table>

<p style="font-size:12px;color:#888;margin:0 0 8px;">Ship to</p>
<p style="font-size:13px;line-height:1.6;margin:0 0 32px;">${addressLines}</p>

<p style="font-size:13px;line-height:1.6;color:#444;margin:0 0 8px;">— Maeve</p>

<p style="font-size:11px;color:#999;margin:28px 0 0;">
<a href="${escapeHtml(d.termsUrl)}" style="color:#999;text-decoration:underline;">Terms</a> ·
<a href="${escapeHtml(d.privacyUrl)}" style="color:#999;text-decoration:underline;">Privacy</a>
</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}
