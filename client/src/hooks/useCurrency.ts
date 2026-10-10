import { useState, useEffect } from "react";

export interface CurrencyInfo {
  code: string;
  symbol: string;
  ngnPerUsd: number;
  localPerUsd: number;
}

export const CURRENCY_SYMBOLS: Record<string, string> = {
  // African
  NGN: "₦", ZAR: "R", GHS: "GH₵", KES: "KSh", EGP: "E£", ETB: "Br",
  TZS: "TSh", UGX: "USh", MAD: "MAD", XAF: "FCFA", XOF: "CFA",
  TND: "DT", RWF: "FRw", AOA: "Kz", ZMW: "ZK", MZN: "MT", MWK: "MK",
  BWP: "P", NAD: "N$", SZL: "E", LSL: "L", MGA: "Ar", MUR: "Rs",
  SCR: "Rs", CVE: "Esc", GNF: "FG", LRD: "L$", SLL: "Le", GMD: "D",
  CDF: "FC", BIF: "FBu", KMF: "CF", MRU: "UM", LYD: "LD", DZD: "DA",
  DJF: "Fdj", SDG: "SDG", SOS: "Sh", SSP: "£", STN: "Db", ERN: "Nfk",
  // World
  USD: "$", EUR: "€", GBP: "£", CAD: "CA$", AUD: "A$", NZD: "NZ$",
  JPY: "¥", CNY: "¥", HKD: "HK$", SGD: "S$", KRW: "₩", TWD: "NT$",
  INR: "₹", PKR: "₨", BDT: "৳", IDR: "Rp", MYR: "RM", THB: "฿",
  VND: "₫", PHP: "₱", AED: "د.إ", SAR: "﷼", QAR: "﷼", KWD: "KD",
  BHD: "BD", OMR: "OMR", JOD: "JD", ILS: "₪", TRY: "₺", RUB: "₽",
  PLN: "zł", CZK: "Kč", HUF: "Ft", RON: "lei", SEK: "kr", NOK: "kr",
  DKK: "kr", CHF: "Fr", UAH: "₴", KZT: "₸", BRL: "R$", MXN: "MX$",
  ARS: "AR$", CLP: "CL$", COP: "CO$", PEN: "S/", UYU: "UY$",
};

// Maps IANA timezone → ISO 4217 currency code.
// This works entirely in the browser with zero network calls.
const TIMEZONE_CURRENCY: Record<string, string> = {
  // ── Africa ────────────────────────────────────────────────────────────
  "Africa/Abidjan": "XOF", "Africa/Accra": "GHS", "Africa/Addis_Ababa": "ETB",
  "Africa/Algiers": "DZD", "Africa/Asmara": "ERN", "Africa/Bamako": "XOF",
  "Africa/Bangui": "XAF", "Africa/Banjul": "GMD", "Africa/Bissau": "XOF",
  "Africa/Blantyre": "MWK", "Africa/Brazzaville": "XAF", "Africa/Bujumbura": "BIF",
  "Africa/Cairo": "EGP", "Africa/Casablanca": "MAD", "Africa/Ceuta": "EUR",
  "Africa/Conakry": "GNF", "Africa/Dakar": "XOF", "Africa/Dar_es_Salaam": "TZS",
  "Africa/Djibouti": "DJF", "Africa/Douala": "XAF", "Africa/El_Aaiun": "MAD",
  "Africa/Freetown": "SLL", "Africa/Gaborone": "BWP", "Africa/Harare": "USD",
  "Africa/Johannesburg": "ZAR", "Africa/Juba": "SSP", "Africa/Kampala": "UGX",
  "Africa/Khartoum": "SDG", "Africa/Kigali": "RWF", "Africa/Kinshasa": "CDF",
  "Africa/Lagos": "NGN", "Africa/Libreville": "XAF", "Africa/Lome": "XOF",
  "Africa/Luanda": "AOA", "Africa/Lubumbashi": "CDF", "Africa/Lusaka": "ZMW",
  "Africa/Malabo": "XAF", "Africa/Maputo": "MZN", "Africa/Maseru": "LSL",
  "Africa/Mbabane": "SZL", "Africa/Mogadishu": "SOS", "Africa/Monrovia": "LRD",
  "Africa/Nairobi": "KES", "Africa/Ndjamena": "XAF", "Africa/Niamey": "XOF",
  "Africa/Nouakchott": "MRU", "Africa/Ouagadougou": "XOF", "Africa/Porto-Novo": "XOF",
  "Africa/Sao_Tome": "STN", "Africa/Tripoli": "LYD", "Africa/Tunis": "TND",
  "Africa/Windhoek": "NAD",
  // ── Europe ────────────────────────────────────────────────────────────
  "Europe/Amsterdam": "EUR", "Europe/Andorra": "EUR", "Europe/Athens": "EUR",
  "Europe/Belgrade": "RSD", "Europe/Berlin": "EUR", "Europe/Bratislava": "EUR",
  "Europe/Brussels": "EUR", "Europe/Bucharest": "RON", "Europe/Budapest": "HUF",
  "Europe/Chisinau": "MDL", "Europe/Copenhagen": "DKK", "Europe/Dublin": "EUR",
  "Europe/Gibraltar": "GIP", "Europe/Helsinki": "EUR", "Europe/Istanbul": "TRY",
  "Europe/Kiev": "UAH", "Europe/Kyiv": "UAH", "Europe/Lisbon": "EUR",
  "Europe/Ljubljana": "EUR", "Europe/London": "GBP", "Europe/Luxembourg": "EUR",
  "Europe/Madrid": "EUR", "Europe/Malta": "EUR", "Europe/Minsk": "BYN",
  "Europe/Monaco": "EUR", "Europe/Moscow": "RUB", "Europe/Nicosia": "EUR",
  "Europe/Oslo": "NOK", "Europe/Paris": "EUR", "Europe/Prague": "CZK",
  "Europe/Riga": "EUR", "Europe/Rome": "EUR", "Europe/Sarajevo": "BAM",
  "Europe/Skopje": "MKD", "Europe/Sofia": "BGN", "Europe/Stockholm": "SEK",
  "Europe/Tallinn": "EUR", "Europe/Tirane": "ALL", "Europe/Uzhgorod": "UAH",
  "Europe/Vaduz": "CHF", "Europe/Vienna": "EUR", "Europe/Vilnius": "EUR",
  "Europe/Warsaw": "PLN", "Europe/Zagreb": "EUR", "Europe/Zurich": "CHF",
  // ── Americas ──────────────────────────────────────────────────────────
  "America/Anchorage": "USD", "America/Argentina/Buenos_Aires": "ARS",
  "America/Bogota": "COP", "America/Caracas": "VES", "America/Chicago": "USD",
  "America/Denver": "USD", "America/Edmonton": "CAD", "America/Halifax": "CAD",
  "America/Havana": "CUP", "America/Lima": "PEN", "America/Los_Angeles": "USD",
  "America/Mexico_City": "MXN", "America/Montevideo": "UYU",
  "America/New_York": "USD", "America/Phoenix": "USD", "America/Regina": "CAD",
  "America/Santiago": "CLP", "America/Sao_Paulo": "BRL", "America/St_Johns": "CAD",
  "America/Toronto": "CAD", "America/Vancouver": "CAD", "America/Winnipeg": "CAD",
  "Pacific/Honolulu": "USD",
  // ── Asia ──────────────────────────────────────────────────────────────
  "Asia/Almaty": "KZT", "Asia/Amman": "JOD", "Asia/Baghdad": "IQD",
  "Asia/Bahrain": "BHD", "Asia/Baku": "AZN", "Asia/Bangkok": "THB",
  "Asia/Beirut": "LBP", "Asia/Calcutta": "INR", "Asia/Colombo": "LKR",
  "Asia/Damascus": "SYP", "Asia/Dhaka": "BDT", "Asia/Dubai": "AED",
  "Asia/Ho_Chi_Minh": "VND", "Asia/Hong_Kong": "HKD", "Asia/Jakarta": "IDR",
  "Asia/Jerusalem": "ILS", "Asia/Kabul": "AFN", "Asia/Karachi": "PKR",
  "Asia/Kathmandu": "NPR", "Asia/Kolkata": "INR", "Asia/Kuala_Lumpur": "MYR",
  "Asia/Kuwait": "KWD", "Asia/Macau": "MOP", "Asia/Manila": "PHP",
  "Asia/Muscat": "OMR", "Asia/Nicosia": "EUR", "Asia/Qatar": "QAR",
  "Asia/Rangoon": "MMK", "Asia/Riyadh": "SAR", "Asia/Seoul": "KRW",
  "Asia/Shanghai": "CNY", "Asia/Singapore": "SGD", "Asia/Taipei": "TWD",
  "Asia/Tashkent": "UZS", "Asia/Tbilisi": "GEL", "Asia/Tehran": "IRR",
  "Asia/Tokyo": "JPY", "Asia/Ulaanbaatar": "MNT", "Asia/Yangon": "MMK",
  "Asia/Yerevan": "AMD",
  // ── Pacific / Oceania ─────────────────────────────────────────────────
  "Australia/Adelaide": "AUD", "Australia/Brisbane": "AUD",
  "Australia/Darwin": "AUD", "Australia/Hobart": "AUD",
  "Australia/Melbourne": "AUD", "Australia/Perth": "AUD",
  "Australia/Sydney": "AUD", "Pacific/Auckland": "NZD",
  "Pacific/Fiji": "FJD", "Pacific/Guam": "USD", "Pacific/Port_Moresby": "PGK",
};

const RATES_CACHE_KEY = "afrolandx_rates_v4";
const RATES_TTL = 6 * 60 * 60 * 1000; // 6 hours
const GEO_CACHE_KEY = "afrolandx_geo_v2";
const GEO_TTL = 24 * 60 * 60 * 1000;
let geoRequest: Promise<{ currency?: string; local?: boolean } | null> | null = null;
let ratesRequest: Promise<Record<string, number> | null> | null = null;

function getCached<T>(key: string, ttl: number): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > ttl) return null;
    return data as T;
  } catch { return null; }
}

function setCache(key: string, data: unknown) {
  try { localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() })); } catch {}
}

/** Detect currency from the browser's IANA timezone — no server call, no proxy issues. */
function detectCurrencyFromTimezone(): string | null {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return TIMEZONE_CURRENCY[tz] ?? null;
  } catch { return null; }
}

async function detectCurrency(): Promise<string | null> {
  const cached = getCached<{ currency?: string }>(GEO_CACHE_KEY, GEO_TTL);
  if (cached?.currency && /^[A-Z]{3}$/.test(cached.currency)) return cached.currency;
  if (!geoRequest) {
    geoRequest = fetch("/api/geo")
      .then(async response => response.ok ? response.json() : null)
      .then(data => {
        if (data?.currency && /^[A-Z]{3}$/.test(data.currency)) {
          setCache(GEO_CACHE_KEY, data);
        }
        return data;
      })
      .catch(() => null)
      .finally(() => { geoRequest = null; });
  }
  const geo = await geoRequest;
  return geo?.currency && /^[A-Z]{3}$/.test(geo.currency)
    ? geo.currency
    : detectCurrencyFromTimezone();
}

async function getRates(): Promise<Record<string, number> | null> {
  const cached = getCached<Record<string, number>>(RATES_CACHE_KEY, RATES_TTL);
  if (cached) return cached;
  if (!ratesRequest) {
    ratesRequest = fetch("/api/exchange-rates")
      .then(async response => response.ok ? response.json() : null)
      .then(data => {
        if (!data?.rates || typeof data.rates !== "object") return null;
        setCache(RATES_CACHE_KEY, data.rates);
        return data.rates as Record<string, number>;
      })
      .catch(() => null)
      .finally(() => { ratesRequest = null; });
  }
  return ratesRequest;
}

export function useCurrency() {
  const [currencyInfo, setCurrencyInfo] = useState<CurrencyInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        // Prefer visitor location; timezone is a fallback when location is unavailable.
        const currencyCode = await detectCurrency();

        // If already in Nigeria or detection failed, stay in NGN
        if (!currencyCode || currencyCode === "NGN") {
          if (!cancelled) setIsLoading(false);
          return;
        }

        const rates = await getRates();

        // Rates are USD-based: rates["NGN"] ≈ 1600, rates["ZAR"] ≈ 18
        const ngnPerUsd   = rates?.["NGN"];
        const localPerUsd = rates?.[currencyCode];

        if (typeof ngnPerUsd !== "number" || !Number.isFinite(ngnPerUsd) || ngnPerUsd <= 0
          || typeof localPerUsd !== "number" || !Number.isFinite(localPerUsd) || localPerUsd <= 0 || cancelled) {
          if (!cancelled) setIsLoading(false);
          return;
        }

        if (!cancelled) {
          setCurrencyInfo({
            code: currencyCode,
            symbol: CURRENCY_SYMBOLS[currencyCode] || currencyCode,
            ngnPerUsd,
            localPerUsd,
          });
        }
      } catch {
        // silently fail — NGN prices remain
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    init();
    return () => { cancelled = true; };
  }, []);

  /**
   * Convert a Naira (NGN) price to the visitor's local currency.
   * Formula: NGN → USD (÷ ngnPerUsd) → local (× localPerUsd)
   * Returns null when no conversion is available (visitor is in Nigeria or detection failed).
   */
  function formatNGN(ngnAmount: number): string | null {
    if (!currencyInfo) return null;
    const usd   = ngnAmount / currencyInfo.ngnPerUsd;
    const local = usd * currencyInfo.localPerUsd;
    const formatted = local >= 1000
      ? local.toLocaleString(undefined, { maximumFractionDigits: 0 })
      : local.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `${currencyInfo.symbol}${formatted}`;
  }

  return { currencyInfo, isLoading, formatNGN };
}
