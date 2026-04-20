import { escapeHtml } from "../utils/escape-html";
import { inferCarrierTrackingUrl } from "./carrier-urls";

export type OrderTrackingData = {
    orderNumber: string;
    buyerName: string;
    pieceName: string;
    carrier: string;
    trackingNumber: string;
    note: string | null;
    termsUrl: string;
    privacyUrl: string;
};

export function renderOrderTrackingHtml(d: OrderTrackingData): string {
    const url = inferCarrierTrackingUrl(d.carrier, d.trackingNumber);
    const noteBlock = d.note
        ? `<p style="font-size:13px;line-height:1.6;color:#444;margin:0 0 20px;">${escapeHtml(d.note)}</p>`
        : "";
    const trackingCta = url
        ? `<table cellpadding="0" cellspacing="0" style="margin:24px 0;"><tr><td><a href="${escapeHtml(url)}" style="display:inline-block;background:#000;color:#fff;text-decoration:none;padding:12px 24px;font-size:13px;letter-spacing:.04em;">Track your shipment</a></td></tr></table>`
        : "";

    return `<!doctype html>
<html lang="en">
<body style="margin:0;padding:0;background:#fafafa;font-family:Georgia,serif;color:#222;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 0;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;padding:40px;">
<tr><td>
<h1 style="font-weight:300;font-size:22px;margin:0 0 8px;letter-spacing:.02em;">Maeve Vamy</h1>
<p style="font-size:12px;color:#888;margin:0 0 32px;">Order ${escapeHtml(d.orderNumber)}</p>

<p style="font-size:16px;line-height:1.5;margin:0 0 20px;">${escapeHtml(d.buyerName)}, your piece is on the way.</p>
${noteBlock}

<table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #eee;border-bottom:1px solid #eee;padding:16px 0;margin-bottom:8px;">
<tr><td style="padding:8px 0;font-size:13px;color:#666;width:40%;">Piece</td><td style="padding:8px 0;font-size:13px;">${escapeHtml(d.pieceName)}</td></tr>
<tr><td style="padding:8px 0;font-size:13px;color:#666;">Carrier</td><td style="padding:8px 0;font-size:13px;">${escapeHtml(d.carrier)}</td></tr>
<tr><td style="padding:8px 0;font-size:13px;color:#666;">Tracking number</td><td style="padding:8px 0;font-size:13px;font-family:monospace;">${escapeHtml(d.trackingNumber)}</td></tr>
</table>

${trackingCta}

<p style="font-size:13px;line-height:1.6;color:#444;margin:16px 0 8px;">Care instructions are included in the package. Reach out any time — I'm happy to help for as long as you own the piece.</p>
<p style="font-size:13px;line-height:1.6;color:#444;margin:0;">— Maeve</p>

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
