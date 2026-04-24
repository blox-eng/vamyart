import { escapeHtml } from "../utils/escape-html";

export type BackInStockData = {
  pieceName: string;
  variantName: string;
  pieceUrl: string;
  termsUrl: string;
  privacyUrl: string;
};

export function renderBackInStockHtml(d: BackInStockData): string {
  return `<!doctype html>
<html lang="en">
<body style="margin:0;padding:0;background:#fafafa;font-family:Georgia,serif;color:#222;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 0;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;padding:40px;">
<tr><td>
<h1 style="font-weight:300;font-size:22px;margin:0 0 8px;letter-spacing:.02em;">Maeve Vamy</h1>
<p style="font-size:12px;color:#888;margin:0 0 32px;">Back in stock</p>

<p style="font-size:16px;line-height:1.5;margin:0 0 20px;">The piece you asked about is available again.</p>

<table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #eee;border-bottom:1px solid #eee;padding:16px 0;margin-bottom:8px;">
<tr><td style="padding:8px 0;font-size:13px;color:#666;width:40%;">Piece</td><td style="padding:8px 0;font-size:13px;">${escapeHtml(d.pieceName)}</td></tr>
<tr><td style="padding:8px 0;font-size:13px;color:#666;">Variant</td><td style="padding:8px 0;font-size:13px;">${escapeHtml(d.variantName)}</td></tr>
</table>

<table cellpadding="0" cellspacing="0" style="margin:24px 0;"><tr><td>
<a href="${escapeHtml(d.pieceUrl)}" style="display:inline-block;background:#000;color:#fff;text-decoration:none;padding:12px 24px;font-size:13px;letter-spacing:.04em;">View the piece</a>
</td></tr></table>

<p style="font-size:13px;line-height:1.6;color:#444;margin:16px 0 8px;">Pieces tend to move quickly. This is a one-time notification — if you'd like to be told next time, sign up again after purchase.</p>
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
