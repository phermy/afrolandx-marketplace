// Accept international and local numbers without guessing a country code.
export function normalizeAccountPhone(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const phone = value.trim();
  if (phone.length > 30 || !/^\+?[\d\s().-]+$/.test(phone)) return null;
  const normalized = phone.replace(/[\s().-]/g, "");
  const digits = normalized.replace(/^\+/, "");
  return digits.length >= 7 && digits.length <= 15 ? normalized : null;
}
