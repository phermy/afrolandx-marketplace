const COMMON_PASSWORDS = new Set([
  "password", "password123", "password1234", "password12345", "password123456",
  "12345678", "123456789", "123456789012", "qwerty123456", "letmein123456",
  "abcdefghijkl", "111111111111", "000000000000",
]);

export function passwordProblem(password: unknown, email?: string): string | null {
  if (typeof password !== "string" || password.length < 12) return "Use a password of at least 12 characters.";
  if (new TextEncoder().encode(password).length > 72) return "Use a password of no more than 72 bytes.";
  const normalized = password.toLowerCase();
  if (COMMON_PASSWORDS.has(normalized) || /^(.)\1+$/.test(normalized) || (email && normalized === email.toLowerCase())) {
    return "Choose a less predictable password that is not your email address.";
  }
  return null;
}

export function accountNameProblem(firstName: unknown, lastName: unknown): string | null {
  if (typeof firstName !== "string" || !firstName.trim() || firstName.trim().length > 120) {
    return "Enter a first name of 1 to 120 characters.";
  }
  if (lastName != null && (typeof lastName !== "string" || lastName.trim().length > 120)) return "Use a last name of no more than 120 characters.";
  return null;
}
