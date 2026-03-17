import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const FROM = process.env.EMAIL_FROM || `Zapp <${process.env.GMAIL_USER}>`;

// ─── Claim email ─────────────────────────────────────────────────────────────

export async function sendClaimEmail({
  toEmail,
  fromEmail,
  amount,
  token,
  zapId,
  claimSecret,
  message,
  apy,
}: {
  toEmail: string;
  fromEmail: string;
  amount: string;
  token: string;
  zapId: string;
  claimSecret: string;
  message?: string | null;
  apy?: number;
}): Promise<void> {
  const claimUrl = `${APP_URL}/claim/${zapId}?s=${claimSecret}`;
  const apyDisplay = apy ? `${(apy * 100).toFixed(1)}%` : "5%";

  await transporter.sendMail({
    from: FROM,
    to: toEmail,
    subject: `${fromEmail} sent you ${amount} ${token} — earning ${apyDisplay} APY while you wait`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:480px;margin:40px auto;background:#111;border:1px solid #222;border-radius:16px;overflow:hidden">

    <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:40px 32px;text-align:center">
      <h1 style="color:#fff;margin:0;font-size:28px;font-weight:900;letter-spacing:-0.03em">Zapp</h1>
      <p style="color:rgba(255,255,255,0.85);margin:12px 0 0;font-size:15px;font-weight:600">You received ${token}</p>
      <p style="color:rgba(255,255,255,0.65);margin:4px 0 0;font-size:13px">${fromEmail} sent you crypto on Starknet</p>
    </div>

    <div style="padding:32px">
      <div style="background:#1a1a2e;border:1px solid #2a2a4a;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px">
        <div style="color:#a78bfa;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px">Amount Sent</div>
        <div style="color:#fff;font-size:36px;font-weight:800">${amount} <span style="color:#a78bfa">${token}</span></div>
        <div style="color:#6b7280;font-size:12px;margin-top:8px">Earning ${apyDisplay} APY until you claim</div>
      </div>

      ${message ? `
      <div style="background:#1a1a1a;border-left:3px solid #6366f1;border-radius:4px;padding:16px;margin-bottom:24px">
        <div style="color:#9ca3af;font-size:12px;margin-bottom:4px">Message from ${fromEmail}</div>
        <div style="color:#e5e7eb;font-size:14px">${message}</div>
      </div>
      ` : ""}

      <a href="${claimUrl}" style="display:block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;text-align:center;padding:16px;border-radius:12px;text-decoration:none;font-weight:700;font-size:16px;margin-bottom:16px">
        Claim Your ${token} + Yield →
      </a>

      <p style="color:#4b5563;font-size:12px;text-align:center;margin:0">
        No wallet needed — sign in with Google or Apple.<br>
        Unclaimed funds return to sender after 30 days.
      </p>
    </div>

    <div style="padding:16px 32px;border-top:1px solid #1f1f1f;text-align:center">
      <p style="color:#374151;font-size:11px;margin:0">
        Zapp — Send crypto to anyone · Powered by Starknet
      </p>
    </div>
  </div>
</body>
</html>
    `,
  });
}

// ─── Request money email ──────────────────────────────────────────────────────

export async function sendRequestEmail({
  toEmail,
  fromEmail,
  amount,
  token,
  requestId,
  message,
}: {
  toEmail: string;
  fromEmail: string;
  amount: string;
  token: string;
  requestId: string;
  message?: string | null;
}): Promise<void> {
  const payUrl = `${APP_URL}/pay/${requestId}`;

  await transporter.sendMail({
    from: FROM,
    to: toEmail,
    subject: `${fromEmail} is requesting ${amount} ${token} from you`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:480px;margin:40px auto;background:#111;border:1px solid #222;border-radius:16px;overflow:hidden">

    <div style="background:linear-gradient(135deg,#f59e0b,#d97706);padding:40px 32px;text-align:center">
      <h1 style="color:#fff;margin:0;font-size:28px;font-weight:900;letter-spacing:-0.03em">Zapp</h1>
      <p style="color:rgba(255,255,255,0.85);margin:12px 0 0;font-size:15px;font-weight:600">Payment Request</p>
      <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:14px">${fromEmail} is requesting payment</p>
    </div>

    <div style="padding:32px">
      <div style="background:#1a1400;border:1px solid #3a2800;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px">
        <div style="color:#fbbf24;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px">Amount Requested</div>
        <div style="color:#fff;font-size:36px;font-weight:800">${amount} <span style="color:#fbbf24">${token}</span></div>
        <div style="color:#6b7280;font-size:12px;margin-top:8px">from ${toEmail}</div>
      </div>

      ${message ? `
      <div style="background:#1a1a1a;border-left:3px solid #f59e0b;border-radius:4px;padding:16px;margin-bottom:24px">
        <div style="color:#9ca3af;font-size:12px;margin-bottom:4px">Note from ${fromEmail}</div>
        <div style="color:#e5e7eb;font-size:14px">${message}</div>
      </div>
      ` : ""}

      <a href="${payUrl}" style="display:block;background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff;text-align:center;padding:16px;border-radius:12px;text-decoration:none;font-weight:700;font-size:16px;margin-bottom:16px">
        Pay ${amount} ${token} →
      </a>

      <p style="color:#4b5563;font-size:12px;text-align:center;margin:0">
        Gasless payment via Starknet · No wallet required to receive
      </p>
    </div>

    <div style="padding:16px 32px;border-top:1px solid #1f1f1f;text-align:center">
      <p style="color:#374151;font-size:11px;margin:0">Zapp · Powered by Starknet</p>
    </div>
  </div>
</body>
</html>
    `,
  });
}

// ─── Stream created notification ─────────────────────────────────────────────

export async function sendStreamEmail({
  toEmail,
  fromEmail,
  amountPerSecond,
  total,
  token,
  durationDays,
  streamId,
  message,
}: {
  toEmail: string;
  fromEmail: string;
  amountPerSecond: string;
  total: string;
  token: string;
  durationDays: number;
  streamId: string;
  message?: string | null;
}): Promise<void> {
  const dashUrl = `${APP_URL}/dashboard`;

  await transporter.sendMail({
    from: FROM,
    to: toEmail,
    subject: `${fromEmail} started a salary stream — ${total} ${token} over ${durationDays} days`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:480px;margin:40px auto;background:#111;border:1px solid #222;border-radius:16px;overflow:hidden">
    <div style="background:linear-gradient(135deg,#0ea5e9,#2563eb);padding:40px 32px;text-align:center">
      <h1 style="color:#fff;margin:0;font-size:28px;font-weight:900;letter-spacing:-0.03em">Zapp</h1>
      <p style="color:rgba(255,255,255,0.85);margin:12px 0 0;font-size:15px;font-weight:600">Salary Stream Started</p>
      <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:14px">${fromEmail} is streaming you ${token}</p>
    </div>
    <div style="padding:32px">
      <div style="background:#0a1020;border:1px solid #1a2a40;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px">
        <div style="color:#38bdf8;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px">Total to receive</div>
        <div style="color:#fff;font-size:36px;font-weight:800">${total} <span style="color:#38bdf8">${token}</span></div>
        <div style="color:#6b7280;font-size:12px;margin-top:8px">over ${durationDays} days · ${amountPerSecond} ${token}/sec</div>
      </div>
      ${message ? `
      <div style="background:#1a1a1a;border-left:3px solid #0ea5e9;border-radius:4px;padding:16px;margin-bottom:24px">
        <div style="color:#9ca3af;font-size:12px;margin-bottom:4px">Note from ${fromEmail}</div>
        <div style="color:#e5e7eb;font-size:14px">${message}</div>
      </div>` : ""}
      <a href="${dashUrl}" style="display:block;background:linear-gradient(135deg,#0ea5e9,#2563eb);color:#fff;text-align:center;padding:16px;border-radius:12px;text-decoration:none;font-weight:700;font-size:16px;margin-bottom:16px">
        View &amp; Claim Stream →
      </a>
      <p style="color:#4b5563;font-size:12px;text-align:center;margin:0">
        Tokens drip per second. Claim anytime at Zap Dashboard.
      </p>
    </div>
    <div style="padding:16px 32px;border-top:1px solid #1f1f1f;text-align:center">
      <p style="color:#374151;font-size:11px;margin:0">Zapp · Salary streaming on Starknet · Stream ID: ${streamId.slice(0, 8)}</p>
    </div>
  </div>
</body>
</html>
    `,
  });
}

// ─── Subscription created notification ────────────────────────────────────────

export async function sendSubscriptionEmail({
  toEmail,
  merchantEmail,
  amount,
  token,
  intervalDays,
  description,
  subscriptionId,
}: {
  toEmail: string;
  merchantEmail: string;
  amount: string;
  token: string;
  intervalDays: number;
  description: string | null;
  subscriptionId: string;
}): Promise<void> {
  const authUrl = `${APP_URL}/subscribe/${subscriptionId}`;

  await transporter.sendMail({
    from: FROM,
    to: toEmail,
    subject: `${merchantEmail} is requesting a subscription — ${amount} ${token} every ${intervalDays} days`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:480px;margin:40px auto;background:#111;border:1px solid #222;border-radius:16px;overflow:hidden">
    <div style="background:linear-gradient(135deg,#7c3aed,#a855f7);padding:40px 32px;text-align:center">
      <h1 style="color:#fff;margin:0;font-size:28px;font-weight:900;letter-spacing:-0.03em">Zapp</h1>
      <p style="color:rgba(255,255,255,0.85);margin:12px 0 0;font-size:15px;font-weight:600">Subscription Request</p>
      <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:14px">${merchantEmail} wants to collect recurring payments</p>
    </div>
    <div style="padding:32px">
      <div style="background:#100a20;border:1px solid #2a1a40;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px">
        <div style="color:#c084fc;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px">Amount &amp; Frequency</div>
        <div style="color:#fff;font-size:36px;font-weight:800">${amount} <span style="color:#c084fc">${token}</span></div>
        <div style="color:#6b7280;font-size:12px;margin-top:8px">every ${intervalDays} days</div>
        ${description ? `<div style="color:#9ca3af;font-size:13px;margin-top:8px;font-style:italic">${description}</div>` : ""}
      </div>
      <a href="${authUrl}" style="display:block;background:linear-gradient(135deg,#7c3aed,#a855f7);color:#fff;text-align:center;padding:16px;border-radius:12px;text-decoration:none;font-weight:700;font-size:16px;margin-bottom:16px">
        Authorize Subscription →
      </a>
      <p style="color:#4b5563;font-size:12px;text-align:center;margin:0">
        You can cancel anytime. Payments are processed on-chain via Starknet.
      </p>
    </div>
    <div style="padding:16px 32px;border-top:1px solid #1f1f1f;text-align:center">
      <p style="color:#374151;font-size:11px;margin:0">Zapp · Subscription payments on Starknet</p>
    </div>
  </div>
</body>
</html>
    `,
  });
}

// ─── Request paid notification ────────────────────────────────────────────────

export async function sendRequestPaidEmail({
  toEmail,
  fromEmail,
  amount,
  token,
  zapId,
}: {
  toEmail: string;
  fromEmail: string;
  amount: string;
  token: string;
  zapId: string;
}): Promise<void> {
  const claimUrl = `${APP_URL}/claim/${zapId}`;

  await transporter.sendMail({
    from: FROM,
    to: toEmail,
    subject: `${fromEmail} paid your request — ${amount} ${token} ready to claim`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:480px;margin:40px auto;background:#111;border:1px solid #222;border-radius:16px;overflow:hidden">

    <div style="background:linear-gradient(135deg,#10b981,#059669);padding:40px 32px;text-align:center">
      <h1 style="color:#fff;margin:0;font-size:28px;font-weight:900;letter-spacing:-0.03em">Zapp</h1>
      <p style="color:rgba(255,255,255,0.85);margin:12px 0 0;font-size:15px;font-weight:600">Request Paid</p>
      <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:14px">${fromEmail} paid your request</p>
    </div>

    <div style="padding:32px">
      <div style="background:#0a1a0a;border:1px solid #1a3a1a;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px">
        <div style="color:#34d399;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px">Amount Paid</div>
        <div style="color:#fff;font-size:36px;font-weight:800">${amount} <span style="color:#34d399">${token}</span></div>
        <div style="color:#6b7280;font-size:12px;margin-top:8px">Earning yield until you claim</div>
      </div>

      <a href="${claimUrl}" style="display:block;background:linear-gradient(135deg,#10b981,#059669);color:#fff;text-align:center;padding:16px;border-radius:12px;text-decoration:none;font-weight:700;font-size:16px;margin-bottom:16px">
        Claim Your ${token} →
      </a>
    </div>

    <div style="padding:16px 32px;border-top:1px solid #1f1f1f;text-align:center">
      <p style="color:#374151;font-size:11px;margin:0">Zapp · Powered by Starknet</p>
    </div>
  </div>
</body>
</html>
    `,
  });
}
