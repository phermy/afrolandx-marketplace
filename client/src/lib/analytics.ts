export type AnalyticsData = Record<string, string | number | boolean>;

declare global {
  interface Window {
    umami?: {
      track(name: string, data?: AnalyticsData): void;
    };
  }
}

export function trackEvent(name: string, data?: AnalyticsData): void {
  if (typeof window === "undefined") return;

  try {
    window.umami?.track(name, data);
  } catch {
    // Analytics must never interrupt a user action.
  }
}

export function valueBand(value: number): string {
  if (value < 10_000) return "under_10k";
  if (value < 50_000) return "10k_50k";
  if (value < 100_000) return "50k_100k";
  if (value < 250_000) return "100k_250k";
  return "250k_plus";
}

export function lengthBand(length: number): string {
  if (length < 50) return "short";
  if (length < 200) return "medium";
  return "long";
}