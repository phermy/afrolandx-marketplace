import crypto from "crypto";

const FROM_EMAIL = process.env.FROM_EMAIL || "management@afrolandx.com";
const MANAGEMENT_EMAIL = "femi.elegbeleye@afrolandx.com";
// Replies must reach an existing Titan mailbox, even when the sender is no-reply.
const SUPPORT_EMAIL = "support@afrolandx.com";
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
      reply_to: SUPPORT_EMAIL,
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

type ExperienceFeedbackNotification = {
  mood: "sad" | "indifferent" | "happy";
  comment?: string | null;
  pagePath?: string | null;
  createdAt: Date;
};

export async function sendExperienceFeedbackNotification(
  feedback: ExperienceFeedbackNotification,
): Promise<void> {
  const moodLabels = {
    sad: "Sad 😢",
    indifferent: "Indifferent 😐",
    happy: "Happy 😊",
  } as const;
  const priority = feedback.mood === "sad" ? "[Action requested] " : "";
  const safeMood = moodLabels[feedback.mood];
  const safeComment = feedback.comment
    ? escapeHtml(feedback.comment)
    : "No written note was provided.";
  const safePagePath = escapeHtml(feedback.pagePath || "/");
  const safeSubmittedAt = escapeHtml(feedback.createdAt.toISOString());

  await sendEmail(
    MANAGEMENT_EMAIL,
    `${priority}New Afrolandx feedback: ${safeMood}`,
    `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f4f1e8; padding: 32px 20px;">
        <div style="background: #ffffff; border-radius: 12px; padding: 32px; border-top: 5px solid ${feedback.mood === "sad" ? "#b42318" : "#1a5c2a"};">
          <h1 style="color: #17352e; font-size: 24px; margin: 0 0 20px;">New Afrolandx experience feedback</h1>
          <p style="color: #444; margin: 0 0 12px;"><strong>Mood:</strong> ${safeMood}</p>
          <p style="color: #444; margin: 0 0 12px;"><strong>Page:</strong> ${safePagePath}</p>
          <p style="color: #444; margin: 0 0 20px;"><strong>Submitted:</strong> ${safeSubmittedAt}</p>
          <div style="background: #f8fbf8; border-radius: 8px; padding: 18px;">
            <p style="color: #17352e; font-weight: bold; margin: 0 0 8px;">Visitor note</p>
            <p style="color: #444; line-height: 1.6; white-space: pre-wrap; margin: 0;">${safeComment}</p>
          </div>
          <p style="color: #777; font-size: 12px; line-height: 1.5; margin: 24px 0 0;">
            The complete response remains stored in the Afrolandx database. This notification intentionally excludes customer identity details.
          </p>
        </div>
      </div>
    `,
  );
}