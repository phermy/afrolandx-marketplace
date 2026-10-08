// Run with: npx tsx scripts/auth-email-e2e.mjs --email=FRESH_INBOX
import { ReplitConnectors } from "@replit/connectors-sdk";
import { randomBytes } from "node:crypto";
import { emailPayload } from "../server/email.ts";

const baseUrl = process.env.AUTH_E2E_BASE_URL
  || (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : "http://127.0.0.1:5000");
// CLI input avoids saving a test recipient in the workspace environment.
const testEmail = process.argv.find(argument => argument.startsWith("--email="))?.slice(8).trim()
  || process.env.AUTH_E2E_EMAIL;
const sender = emailPayload(testEmail || "", "", "").from;
const resumeQa = process.argv.includes("--resume-unverified-qa");
const subjects = {
  verification: "Verify your Afrolandx account",
  login: "Your Afrolandx sign-in code",
  reset: "Reset your Afrolandx password",
};
const waitMs = Number(process.env.AUTH_E2E_POLL_MS || 2000);
const maxPolls = Number(process.env.AUTH_E2E_MAX_POLLS || 45);
const startedAt = Date.now() - 1000;
const consumedMessages = new Set();

if (!testEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testEmail)) {
  throw new Error("Provide --email=ADDRESS or AUTH_E2E_EMAIL using a fresh inbox or plus address.");
}

const resend = new ReplitConnectors();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

function cookieFrom(response) {
  const header = response.headers.get("set-cookie");
  return header ? header.split(";")[0] : "";
}

async function jsonResponse(response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}

async function post(path, body, cookie = "") {
  const headers = { "Content-Type": "application/json" };
  if (cookie) headers.Cookie = cookie;
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  return { status: response.status, body: await jsonResponse(response), cookie: cookieFrom(response) };
}

async function getAuth(cookie = "") {
  const response = await fetch(`${baseUrl}/api/auth/user`, {
    headers: cookie ? { Cookie: cookie } : {},
  });
  return { status: response.status, body: await jsonResponse(response) };
}

async function deliveredMessage(subject) {
  for (let attempt = 0; attempt < maxPolls; attempt += 1) {
    const response = await resend.proxy("resend", "/emails?limit=100");
    const body = await response.json();
    const message = (Array.isArray(body?.data) ? body.data : [])
      .filter((item) => item.subject === subject)
      .filter((item) => Date.parse(item.created_at) >= startedAt && !consumedMessages.has(item.id))
      .filter((item) => Array.isArray(item.to) && item.to.some((recipient) => String(recipient).toLowerCase() === testEmail.toLowerCase()))
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0];
    if (message?.last_event === "delivered") {
      consumedMessages.add(message.id);
      return message;
    }
    await sleep(waitMs);
  }
  throw new Error(`Timed out waiting for a delivered "${subject}" message.`);
}

async function codeFromMessage(message) {
  const response = await resend.proxy("resend", `/emails/${encodeURIComponent(message.id)}`);
  assert(response.ok, `Could not read delivered message ${message.id}.`);
  const body = await response.json();
  const content = `${typeof body?.html === "string" ? body.html : ""}\n${typeof body?.text === "string" ? body.text : ""}`;
  const match = content.match(/\b\d{6}\b/);
  assert(match, `Delivered "${message.subject}" message did not contain a six-digit code.`);
  return match[0];
}

const initialPassword = `E2E-${randomBytes(24).toString("base64url")}-Initial!`;
const resetPassword = `E2E-${randomBytes(24).toString("base64url")}-Reset!`;
if (resumeQa) {
  const { storage } = await import("../server/storage.ts");
  const user = await storage.getUserByEmail(testEmail);
  assert(user && !user.emailVerified && !user.closedAt && user.firstName === "Delivery" && user.lastName === "Test"
    && user.roles?.length === 1 && user.roles[0] === "customer"
    && Date.now() - new Date(user.createdAt).getTime() < 15 * 60 * 1000,
    "Resume is restricted to the fresh unverified QA customer created by this test.");
  const resendVerification = await post("/api/resend-verification", { email: testEmail });
  assert(resendVerification.status === 200, "Could not resend verification for the QA customer.");
} else {
  const registration = await post("/api/register", {
    firstName: "Delivery",
    lastName: "Test",
    email: testEmail,
    password: initialPassword,
    phone: "+2348000000000",
  });
  assert(registration.status === 200 && registration.body.emailVerificationSent === true, "Registration did not confirm verification email delivery.");
  assert(!registration.cookie, "Registration issued a session cookie before verification.");
  assert((await getAuth(registration.cookie)).status === 401, "Registration created an authenticated session before verification.");
}

const verificationMessage = await deliveredMessage(subjects.verification);
assert(verificationMessage.from === sender, "Verification email used an unexpected sender.");
const verification = await post("/api/verify-email", { email: testEmail, otp: await codeFromMessage(verificationMessage) });
assert(verification.status === 200, "Verification code was not accepted.");
assert((await getAuth(verification.cookie)).status === 200, "Verification did not create the expected authenticated session.");

// A stopped run cannot recover its generated password. Establish a controlled
// baseline through the real reset flow, only for the restricted QA resume above.
if (resumeQa) {
  const baselineRequest = await post("/api/forgot-password", { email: testEmail });
  assert(baselineRequest.status === 200, "QA baseline reset request failed.");
  const baselineMessage = await deliveredMessage(subjects.reset);
  assert(baselineMessage.from === sender, "QA baseline email used an unexpected sender.");
  const baselineReset = await post("/api/reset-password", {
    email: testEmail, otp: await codeFromMessage(baselineMessage), newPassword: initialPassword,
  });
  assert(baselineReset.status === 200, "Could not establish the QA baseline password.");
}

const loginRequest = await post("/api/send-login-otp", { email: testEmail });
assert(loginRequest.status === 200 && !loginRequest.cookie, "Email-code login unexpectedly created a session while requesting the code.");
const loginMessage = await deliveredMessage(subjects.login);
assert(loginMessage.from === sender, "Sign-in email used an unexpected sender.");
const loginCode = await codeFromMessage(loginMessage);
const codeLogin = await post("/api/login-with-otp", { email: testEmail, otp: loginCode });
assert(codeLogin.status === 200, "Email sign-in code was not accepted.");
assert((await getAuth(codeLogin.cookie)).status === 200, "Email-code login did not create an authenticated session.");
const replay = await post("/api/login-with-otp", { email: testEmail, otp: loginCode });
assert(replay.status === 400, "A consumed sign-in code was accepted a second time.");

const resetRequest = await post("/api/forgot-password", { email: testEmail });
assert(resetRequest.status === 200, "Password-reset request did not return the generic success response.");
const resetMessage = await deliveredMessage(subjects.reset);
assert(resetMessage.from === sender, "Password-reset email used an unexpected sender.");
const reset = await post("/api/reset-password", {
  email: testEmail,
  otp: await codeFromMessage(resetMessage),
  newPassword: resetPassword,
});
assert(reset.status === 200, "Password-reset code was not accepted.");
assert((await getAuth(codeLogin.cookie)).status === 401, "Password reset did not invalidate the previous session.");
const oldPasswordLogin = await post("/api/login", { email: testEmail, password: initialPassword });
assert(oldPasswordLogin.status === 401, "The original password still worked after password reset.");
const passwordLogin = await post("/api/login", { email: testEmail, password: resetPassword });
assert(passwordLogin.status === 200 && (await getAuth(passwordLogin.cookie)).status === 200, "The reset password could not be used to sign in.");

console.log(JSON.stringify({
  result: "passed",
  recipient: testEmail.replace(/^(.{2}).*(@.*)$/, "$1…$2"),
  sender,
  checks: [
    "verification email delivered and code accepted",
    ...(resumeQa ? ["resumed only a fresh unverified QA customer"] : ["registration did not authenticate before verification"]),
    "email sign-in code delivered and accepted once",
    "reused email sign-in code rejected",
    "password-reset email delivered and code accepted",
    "password reset invalidated the previous session",
    "original password rejected after reset",
    "new password accepted by password login",
  ],
}, null, 2));
process.exit(0);