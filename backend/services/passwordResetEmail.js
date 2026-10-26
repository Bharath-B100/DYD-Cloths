const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

function passwordResetEmail(resetURL) {
    const url = escapeHtml(resetURL);
    return {
        subject: 'Reset your DYD-Clothes password',
        text: `DYD-CLOTHES — Design your dream clothes\n\nReset your password\nWe received a request to reset your account password. Use this link within 10 minutes:\n${resetURL}\n\nIf you didn't request this, you can ignore this email. Your password won't change unless you complete the reset.\n\nKeep this link private. The DYD-Clothes team`,
        html: `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Reset your password</title></head>
<body style="margin:0;padding:0;background-color:#f3f1eb;color:#202020;font-family:Arial,Helvetica,sans-serif;">
<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">Your password reset link is ready. It expires in 10 minutes.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f1eb;"><tr><td align="center" style="padding:32px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border:1px solid #e5e1d7;border-radius:16px;overflow:hidden;">
<tr><td style="padding:32px 28px;background-color:#151515;border-bottom:4px solid #f4b400;">
<p style="margin:0 0 8px;color:#f4b400;font-size:24px;font-weight:bold;letter-spacing:2px;">DYD<span style="color:#ffffff;">-CLOTHES</span></p>
<p style="margin:0;color:#d2d2d2;font-size:12px;letter-spacing:2px;">DESIGN YOUR DREAM CLOTHES</p></td></tr>
<tr><td style="padding:36px 28px 28px;">
<p style="margin:0 0 14px;color:#6b6250;font-size:11px;letter-spacing:2px;font-weight:bold;">ACCOUNT SECURITY</p>
<h1 style="margin:0 0 18px;color:#171717;font-size:30px;line-height:1.2;">A fresh start.<br>A new password.</h1>
<p style="margin:0 0 24px;color:#555555;font-size:16px;line-height:1.65;">We received a request to reset your DYD-Clothes password. Use the button below to choose a new one and get back to creating.</p>
<table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr><td align="center" bgcolor="#f4b400" style="border-radius:8px;background-color:#f4b400;mso-padding-alt:17px 24px;">
<a href="${url}" style="display:block;padding:17px 24px;color:#171300;font-size:16px;font-weight:bold;text-decoration:none;border:1px solid #f4b400;border-radius:8px;">Reset my password &rarr;</a>
</td></tr></table>
<p style="margin:14px 0 28px;text-align:center;color:#665d4c;font-size:13px;line-height:1.5;">This link expires in <strong>10 minutes.</strong></p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:18px;background-color:#f7f6f2;border-left:3px solid #d3c9ad;">
<p style="margin:0 0 6px;font-size:14px;font-weight:bold;color:#343434;">Didn't request a reset?</p>
<p style="margin:0;font-size:14px;line-height:1.6;color:#555555;">You can safely ignore this email. Your password won't change unless you complete the reset.</p></td></tr></table>
<p style="margin:26px 0 8px;font-size:12px;line-height:1.6;color:#666666;">Button not working? Copy and paste this link into your browser:</p>
<p style="margin:0;font-size:12px;line-height:1.7;word-break:break-all;overflow-wrap:anywhere;"><a href="${url}" style="color:#665000;text-decoration:underline;word-break:break-all;">${url}</a></p>
</td></tr>
<tr><td style="padding:22px 28px;border-top:1px solid #ece9e0;">
<p style="margin:0;color:#555555;font-size:13px;line-height:1.6;">Made for your next idea.<br><strong>The DYD-Clothes team</strong></p></td></tr>
</table>
<p style="margin:18px 0 0;color:#706b60;font-size:12px;line-height:1.6;">Keep this reset link private. Don't forward this email.</p>
</td></tr></table></body></html>`
    };
}
module.exports = { passwordResetEmail };
