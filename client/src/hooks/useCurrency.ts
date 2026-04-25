import { useState, useEffect } from "react";

const AFRICAN_COUNTRIES = new Set([
  "NG","ZA","GH","KE","EG","ET","TZ","UG","MA","CM","SN","TN","RW","CI","AO",
  "ZM","MZ","SD","MW","BW","NA","LS","SZ","MG","SC","MU","CV","GN","LR","SL",
  "GM","BJ","TG","BF","ML","GW","NE","CD","CG","GA","CF","TD","GQ","BI","KM",
  "MR","LY","DZ","ER","SO","DJ","ZW","SS","ST"
]);

export interface CurrencyInfo {
  code: string;
  symbol: string;
  country: string;
  countryCode: string;
  rate: number;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  NGN: "₦", ZAR: "R", GHS: "GH₵", KES: "KSh", EGP: "E£", ETB: "Br",
  TZS: "TSh", UGX: "USh", MAD: "MAD", XAF: "FCFA", XOF: "CFA",
  TND: "DT", RWF: "FRw", AOA: "Kz", ZMW: "ZK", MZN: "MT", MWK: "MK",
  BWP: "P", NAD: "N$", SZL: "E", LSL: "L", MGA: "Ar", MUR: "Rs",
  SCR: "Rs", CVE: "Esc", GNF: "FG", LRD: "L$", SLL: "Le", GMD: "D",
  CDF: "FC", BIF: "FBu", KMF: "CF", MRU: "UM", LYD: "LD", DZD: "DA",
  DJF: "Fdj", SDG: "SDG", SOS: "Sh", SSP: "£",
};

const GEO_CACHE_KEY = "afrolandx_geo_v2";
const RATES_CACHE_KEY = "afrolandx_rates_v2";
const GEO_TTL = 7 * 24 * 60 * 60 * 1000;   // 7 days
const RATES_TTL = 6 * 60 * 60 * 1000;        // 6 hours

function getCached<T>(key: string, ttl: number): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > ttl) return null;
    return data as T;
  } catch {
    return null;
  }
}

function setCache(key: string, data: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() }));
  } catch {}
}

export function useCurrency() {
  const [currencyInfo, setCurrencyInfo] = useState<CurrencyInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function detect() {
      try {
        // 1. Get geolocation via server proxy (avoids CORS)
        let geo = getCached<{ currency: string; country_code: string; country_name: string }>(GEO_CACHE_KEY, GEO_TTL);
        if (!geo) {
          const res = await fetch("/api/geo", { credentials: "include" });
          if (res.ok) {
            const data = await res.json();
            if (!data.local && !data.error) {
              geo = data;
              setCache(GEO_CACHE_KEY, geo);
            }
          }
        }

        if (!geo || !AFRICAN_COUNTRIES.has(geo.country_code)) {
          if (!cancelled) setIsLoading(false);
          return;
        }

        const currencyCode = geo.currency;
        if (!currencyCode || currencyCode === "USD") {
          if (!cancelled) setIsLoading(false);
          return;
        }

        // 2. Get exchange rates via server proxy
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

        const rate = rates?.[currencyCode];
        if (!rate || cancelled) {
          if (!cancelled) setIsLoading(false);
          return;
        }

        setCurrencyInfo({
          code: currencyCode,
          symbol: CURRENCY_SYMBOLS[currencyCode] || currencyCode,
          country: geo.country_name,
          countryCode: geo.country_code,
          rate,
        });
      } catch {
        // silently fail — USD only shown
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    detect();
    return () => { cancelled = true; };
  }, []);

  function formatLocal(usdAmount: number): string | null {
    if (!currencyInfo) return null;
    const local = usdAmount * currencyInfo.rate;
    const formatted = local >= 1000
      ? local.toLocaleString(undefined, { maximumFractionDigits: 0 })
      : local.toLocaleString(undefined, { maximumFractionDigits: 2 });
    return `${currencyInfo.symbol}${formatted}`;
  }

  function formatUsd(amount: number): string {
    return `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  return { currencyInfo, isLoading, formatLocal, formatUsd };
}
