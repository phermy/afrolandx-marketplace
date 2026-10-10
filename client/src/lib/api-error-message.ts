/**
 * Converts apiRequest's status-prefixed errors into readable UI copy without
 * changing the original Error (callers can still inspect its status prefix).
 */
export function getApiErrorMessage(error: unknown, fallback = "Something went wrong. Please try again."): string {
  if (!(error instanceof Error)) return fallback;

  const raw = error.message.trim();
  const payload = raw.replace(/^\d{3}:\s*/, "").trim();
  if (!payload) return fallback;

  try {
    const parsed: unknown = JSON.parse(payload);
    if (parsed && typeof parsed === "object" && "message" in parsed) {
      const message = (parsed as { message?: unknown }).message;
      if (typeof message === "string" && message.trim()) return message.trim();
    }
    return fallback;
  } catch {
    return payload || fallback;
  }
}
