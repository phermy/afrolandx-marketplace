import { useCurrency } from "@/hooks/useCurrency";

interface LocalPriceProps {
  ngnAmount: number;
  className?: string;
  size?: "sm" | "md";
}

export default function LocalPrice({ ngnAmount, className = "", size = "sm" }: LocalPriceProps) {
  const { currencyInfo, formatNGN } = useCurrency();

  const localFormatted = formatNGN(ngnAmount);
  if (!localFormatted || !currencyInfo) return null;

  const textSize = size === "sm" ? "text-xs" : "text-sm";

  return (
    <span
      className={`${textSize} text-gray-400 font-normal ${className}`}
      title={`Approximate ${currencyInfo.code} equivalent`}
    >
      ≈ {localFormatted}
    </span>
  );
}
