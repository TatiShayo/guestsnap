/**
 * Shared HTML shell for lifecycle emails (PLAYBOOK 3.2 matrix) — one
 * consistent, on-brand template (ivory/ink/terracotta, Fraunces-esque
 * serif headline via a websafe fallback since email clients can't load
 * custom fonts reliably). Keeps every transactional email from looking
 * like a bare paragraph.
 */
export function emailShell(opts: { heading: string; bodyHtml: string; ctaLabel?: string; ctaUrl?: string }): string {
  const cta =
    opts.ctaLabel && opts.ctaUrl
      ? `<div style="margin-top:28px;text-align:center;">
           <a href="${opts.ctaUrl}" style="display:inline-block;background:#C1502E;color:#FAF8F5;text-decoration:none;
             padding:12px 28px;border-radius:6px;font-weight:600;font-size:15px;">${opts.ctaLabel}</a>
         </div>`
      : "";
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#F3EFE8;font-family:Georgia,'Times New Roman',serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="100%" style="max-width:520px;background:#FAF8F5;border-radius:12px;overflow:hidden;">
          <tr><td style="padding:36px 36px 8px;">
            <p style="margin:0 0 20px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#C1502E;font-family:Arial,sans-serif;">GuestSnap</p>
            <h1 style="margin:0 0 18px;font-size:26px;line-height:1.25;color:#1C1917;font-weight:600;">${opts.heading}</h1>
            <div style="font-size:15px;line-height:1.6;color:#3a3633;font-family:Arial,sans-serif;">${opts.bodyHtml}</div>
            ${cta}
          </td></tr>
          <tr><td style="padding:24px 36px 32px;">
            <p style="margin:0;font-size:12px;color:#8a8480;font-family:Arial,sans-serif;">
              You're receiving this because you host or uploaded to an event on GuestSnap.
            </p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}
