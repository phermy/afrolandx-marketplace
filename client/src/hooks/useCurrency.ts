import { useState, useEffect } from "react";

export interface CurrencyInfo {
  code: string;
  symbol: string;
  country: string;
  countryCode: string;
  ngnPerUsd: number;
  localPerUsd: number;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  // African currencies
  NGN: "₦", ZAR: "R", GHS: "GH₵", KES: "KSh", EGP: "E£", ETB: "Br",
  TZS: "TSh", UGX: "USh", MAD: "MAD", XAF: "FCFA", XOF: "CFA",
  TND: "DT", RWF: "FRw", AOA: "Kz", ZMW: "ZK", MZN: "MT", MWK: "MK",
  BWP: "P", NAD: "N$", SZL: "E", LSL: "L", MGA: "Ar", MUR: "Rs",
  SCR: "Rs", CVE: "Esc", GNF: "FG", LRD: "L$", SLL: "Le", GMD: "D",
  CDF: "FC", BIF: "FBu", KMF: "CF", MRU: "UM", LYD: "LD", DZD: "DA",
  DJF: "Fdj", SDG: "SDG", SOS: "Sh", SSP: "£", STN: "Db",
  // Major world currencies
  USD: "$", EUR: "€", GBP: "£", CAD: "CA$", AUD: "A$", JPY: "¥",
  CNY: "¥", INR: "₹", BRL: "R$", MXN: "MX$", SGD: "S$", HKD: "HK$",
  CHF: "Fr", SEK: "kr", NOK: "kr", DKK: "kr", NZD: "NZ$", AED: "د.إ",
  SAR: "﷼", QAR: "﷼", KWD: "KD", BHD: "BD", OMR: "OMR", JOD: "JD",
  PKR: "₨", BDT: "৳", IDR: "Rp", MYR: "RM", THB: "฿", VND: "₫",
  PHP: "₱", KRW: "₩", TRY: "₺", RUB: "₽", PLN: "zł", CZK: "Kč",
  HUF: "Ft", RON: "lei", ILS: "₪", ARS: "AR$", CLP: "CL$", COP: "CO$",
  PEN: "S/", UYU: "UY$", UAH: "₴", KZT: "₸",
};

const GEO_CACHE_KEY  = "afrolandx_geo_v3";
const RATES_CACHE_KEY = "afrolandx_rates_v3";
const GEO_TTL   = 7 * 24 * 60 * 60 * 1000; // 7 days
const RATES_TTL =      6 * 60 * 60 * 1000;  // 6 hours

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

export function useCurrency() {
  const [currencyInfo, setCurrencyInfo] = useState<CurrencyInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function detect() {
      try {
        // 1. Geo-detect the visitor's country & currency
        let geo = getCached<{ currency: string; country_code: string; country_name: string }>(GEO_CACHE_KEY, GEO_TTL);
        if (!geo) {
          const res = await fetch("/api/geo", { credentials: "include" });
          if (res.ok) {
            const data = await res.json();
            // data.local = true when running on localhost/dev — no currency conversion
            if (!data.local && !data.error && data.currency) {
              geo = data;
              setCache(GEO_CACHE_KEY, geo);
            }
          }
        }

        // No geo data, or visitor is on localhost — stay in NGN
        if (!geo || !geo.currency) {
          if (!cancelled) setIsLoading(false);
          return;
        }

        const currencyCode = geo.currency;

        // Visitor is already in Nigeria — no conversion needed
        if (currencyCode === "NGN") {
          if (!cancelled) setIsLoading(false);
          return;
        }

        // 2. Fetch USD-based exchange rates (cached server-side too)
        let rates = getCached<Record<string, number>>(RATES_CACHE_KEY, RATES_TTL);
        if (!rates) {
          const rRes = await fetch("/api/exchange-rates");
          if (rRes.ok) {
            const rData = await rRes.json();
            if (rData.rates) {
              rates = rData.rates;
              setCache(RATES_CACHE_KEY, rates);
            }
          }
        }

        // Rates are USD-based: rates["NGN"] ≈ 1600, rates["GHS"] ≈ 15
        const ngnPerUsd = rates?.["NGN"];
        const localPerUsd = rates?.[currencyCode];

        if (!ngnPerUsd || !localPerUsd || cancelled) {
          if (!cancelled) setIsLoading(false);
          return;
        }

        if (!cancelled) {
          setCurrencyInfo({
            code: currencyCode,
            symbol: CURRENCY_SYMBOLS[currencyCode] || currencyCode,
            country: geo.country_name,
            countryCode: geo.country_code,
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

    detect();
    return () => { cancelled = true; };
  }, []);

  /**
   * Convert a Naira (NGN) amount to the visitor's local currency.
   * Uses USD as the pivot: NGN → USD → local.
   * Returns null if geo/rates are not available yet.
   */
  function formatNGN(ngnAmount: number): string | null {
    if (!currencyInfo) return null;
    const usd = ngnAmount / currencyInfo.ngnPerUsd;
    const local = usd * currencyInfo.localPerUsd;
    const formatted = local >= 1000
      ? local.toLocaleString(undefined, { maximumFractionDigits: 0 })
      : local.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `${currencyInfo.symbol}${formatted}`;
  }

  return { currencyInfo, isLoading, formatNGN };
}
