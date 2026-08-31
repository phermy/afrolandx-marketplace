import crypto from "crypto";

const FROM_EMAIL = process.env.FROM_EMAIL || "management@afrolandx.com";
const APP_NAME = "Afrolandx";

export function generateOtp(): string {
  return crypto.randomInt(100000, 1_000_000).toString();
}

export function otpExpiryTime(): Date {
  const expiry = new Date();
  expiry.setMinutes(expiry.getMinutes() + 15);
  return expiry;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const { ReplitConnectors } = await import("@replit/connectors-sdk");
  const connectors = new ReplitConnectors();
  const response = await connectors.proxy("resend", "/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      from: `${APP_NAME} <${FROM_EMAIL}>`,
      to: [to],
      subject,
      html,
    }),
  });

  if (response.ok) return;
  const providerMessage = await response.text().catch(() => "");
  throw new Error(`Email delivery failed (${response.status})${providerMessage ? `: ${providerMessage.slice(0, 200)}` : ""}`);
}

function otpEmailHtml(title: string, greeting: string, description: string, codeLabel: string, otp: string, accent: string): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f9f9f9; padding: 40px 20px;">
      <div style="background: white; border-radius: 12px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
        <div style="text-align: center; margin-bottom: 32px;">
          <h1 style="color: #1a5c2a; font-size: 28px; margin: 0;">${APP_NAME}</h1>
          <p style="color: #888; font-size: 14px; margin: 4px 0 0;">Authentic African Fashion</p>
        </div>
        <h2 style="color: #1a5c2a; font-size: 22px; margin-bottom: 8px;">${title}</h2>
        <p style="color: #444; line-height: 1.6; margin-bottom: 24px;">${greeting}</p>
        <p style="color: #444; line-height: 1.6; margin-bottom: 24px;">${description}</p>
        <div style="background: #f8fbf8; border: 2px dashed ${accent}; border-radius: 8px; padding: 24px; text-align: center; margin-bottom: 24px;">
          <p style="color: #888; font-size: 14px; margin: 0 0 8px;">${codeLabel}</p>
          <div style="font-size: 40px; font-weight: bold; letter-spacing: 8px; color: #1a5c2a;">${otp}</div>
          <p style="color: #888; font-size: 12px; margin: 8px 0 0;">Expires in 15 minutes</p>
        </div>
        <p style="color: #888; font-size: 13px; line-height: 1.5;">
          If you didn't request this email, you can safely ignore it.
        </p>
      </div>
    </div>
  `;
}

export async function sendVerificationEmail(email: string, firstName: string, otp: string): Promise<void> {
  const safeName = escapeHtml(firstName || "there");
  await sendEmail(
    email,
    `Verify your ${APP_NAME} account`,
    otpEmailHtml(
      "Welcome to Afrolandx!",
      `Thanks for joining us, ${safeName}.`,
      "Please verify your email address to activate your account.",
      "Your verification code",
      otp,
      "#4caf50",
    ),
  );
}

export async function sendLoginOtpEmail(email: string, firstName: string, otp: string): Promise<void> {
  const safeName = escapeHtml(firstName || "there");
  await sendEmail(
    email,
    `Your ${APP_NAME} sign-in code`,
    otpEmailHtml(
      "Your sign-in code",
      `Hi ${safeName},`,
      "Use the code below to sign in to your Afrolandx account.",
      "Your sign-in code",
      otp,
      "#4caf50",
    ),
  );
}

export async function sendPasswordResetEmail(email: string, firstName: string, otp: string): Promise<void> {
  const safeName = escapeHtml(firstName || "there");
  await sendEmail(
    email,
    `Reset your ${APP_NAME} password`,
    otpEmailHtml(
      "Password reset request",
      `Hi ${safeName},`,
      "Use the code below to create a new password.",
      "Your reset code",
      otp,
      "#ff9800",
    ),
  );
}