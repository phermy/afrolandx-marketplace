const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || "noreply@afrolandx.com";
const APP_NAME = "Afrolandx";
let managedSendGrid: import("@replit/connectors-sdk").ReplitConnectors | null = null;

async function getManagedSendGrid() {
  if (!managedSendGrid) {
    const { ReplitConnectors } = await import("@replit/connectors-sdk");
    managedSendGrid = new ReplitConnectors();
  }
  return managedSendGrid;
}

export function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function otpExpiryTime(): Date {
  const expiry = new Date();
  expiry.setMinutes(expiry.getMinutes() + 15);
  return expiry;
}

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  try {
    const connectors = await getManagedSendGrid();
    const response = await connectors.proxy("sendgrid", "/v3/mail/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: FROM_EMAIL, name: APP_NAME },
        subject,
        content: [{ type: "text/html", value: html }],
      }),
    });

    if (response.ok) return;

    const providerMessage = await response.text().catch(() => "");
    throw new Error(`SendGrid connector returned ${response.status}${providerMessage ? `: ${providerMessage.slice(0, 200)}` : ""}`);
  } catch (connectorError) {
    // Keep the legacy key as a local-development fallback when the managed
    // connector proxy is unavailable.
    if (SENDGRID_API_KEY) {
      const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SENDGRID_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: to }] }],
          from: { email: FROM_EMAIL, name: APP_NAME },
          subject,
          content: [{ type: "text/html", value: html }],
        }),
      });

      if (response.ok) return;
      const providerMessage = await response.text().catch(() => "");
      throw new Error(`SendGrid delivery failed (${response.status})${providerMessage ? `: ${providerMessage.slice(0, 200)}` : ""}`);
    }

    throw connectorError;
  }

}

export async function sendVerificationEmail(email: string, firstName: string, otp: string): Promise<void> {
  const subject = `Verify your ${APP_NAME} account`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f9f9f9; padding: 40px 20px;">
      <div style="background: white; border-radius: 12px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
        <div style="text-align: center; margin-bottom: 32px;">
          <h1 style="color: #1a5c2a; font-size: 28px; margin: 0;">Afrolandx</h1>
          <p style="color: #888; font-size: 14px; margin: 4px 0 0;">Authentic African Fashion</p>
        </div>
        <h2 style="color: #1a5c2a; font-size: 22px; margin-bottom: 8px;">Welcome, ${firstName}! 🎉</h2>
        <p style="color: #444; line-height: 1.6; margin-bottom: 24px;">
          Thanks for joining Afrolandx. Please verify your email address to activate your account.
        </p>
        <div style="background: #f0f9f0; border: 2px dashed #4caf50; border-radius: 8px; padding: 24px; text-align: center; margin-bottom: 24px;">
          <p style="color: #888; font-size: 14px; margin: 0 0 8px;">Your verification code</p>
          <div style="font-size: 40px; font-weight: bold; letter-spacing: 8px; color: #1a5c2a;">${otp}</div>
          <p style="color: #888; font-size: 12px; margin: 8px 0 0;">Expires in 15 minutes</p>
        </div>
        <p style="color: #888; font-size: 13px; line-height: 1.5;">
          If you didn't create an account with Afrolandx, you can safely ignore this email.
        </p>
      </div>
    </div>
  `;
  await sendEmail(email, subject, html);
}

export async function sendLoginOtpEmail(email: string, firstName: string, otp: string): Promise<void> {
  const subject = `Your ${APP_NAME} sign-in code`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f9f9f9; padding: 40px 20px;">
      <div style="background: white; border-radius: 12px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
        <div style="text-align: center; margin-bottom: 32px;">
          <h1 style="color: #1a5c2a; font-size: 28px; margin: 0;">Afrolandx</h1>
          <p style="color: #888; font-size: 14px; margin: 4px 0 0;">Authentic African Fashion</p>
        </div>
        <h2 style="color: #1a5c2a; font-size: 22px; margin-bottom: 8px;">Your Sign-In Code 🔑</h2>
        <p style="color: #444; line-height: 1.6; margin-bottom: 24px;">
          Hi ${firstName}, use the code below to sign in to your Afrolandx account.
        </p>
        <div style="background: #f0f9f0; border: 2px dashed #4caf50; border-radius: 8px; padding: 24px; text-align: center; margin-bottom: 24px;">
          <p style="color: #888; font-size: 14px; margin: 0 0 8px;">Your sign-in code</p>
          <div style="font-size: 40px; font-weight: bold; letter-spacing: 8px; color: #1a5c2a;">${otp}</div>
          <p style="color: #888; font-size: 12px; margin: 8px 0 0;">Expires in 15 minutes</p>
        </div>
        <p style="color: #888; font-size: 13px; line-height: 1.5;">
          If you didn't request this code, you can safely ignore this email. Someone may have entered your email address by mistake.
        </p>
      </div>
    </div>
  `;
  await sendEmail(email, subject, html);
}

export async function sendPasswordResetEmail(email: string, firstName: string, otp: string): Promise<void> {
  const subject = `Reset your ${APP_NAME} password`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f9f9f9; padding: 40px 20px;">
      <div style="background: white; border-radius: 12px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
        <div style="text-align: center; margin-bottom: 32px;">
          <h1 style="color: #1a5c2a; font-size: 28px; margin: 0;">Afrolandx</h1>
          <p style="color: #888; font-size: 14px; margin: 4px 0 0;">Authentic African Fashion</p>
        </div>
        <h2 style="color: #1a5c2a; font-size: 22px; margin-bottom: 8px;">Password Reset Request 🔒</h2>
        <p style="color: #444; line-height: 1.6; margin-bottom: 24px;">
          Hi ${firstName}, we received a request to reset your password. Use the code below to create a new password.
        </p>
        <div style="background: #fff3e0; border: 2px dashed #ff9800; border-radius: 8px; padding: 24px; text-align: center; margin-bottom: 24px;">
          <p style="color: #888; font-size: 14px; margin: 0 0 8px;">Your reset code</p>
          <div style="font-size: 40px; font-weight: bold; letter-spacing: 8px; color: #e65100;">${otp}</div>
          <p style="color: #888; font-size: 12px; margin: 8px 0 0;">Expires in 15 minutes</p>
        </div>
        <p style="color: #888; font-size: 13px; line-height: 1.5;">
          If you didn't request a password reset, please ignore this email. Your password will remain unchanged.
        </p>
      </div>
    </div>
  `;
  await sendEmail(email, subject, html);
}
