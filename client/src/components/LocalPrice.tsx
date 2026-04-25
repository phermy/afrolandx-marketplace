import { useCurrency } from "@/hooks/useCurrency";

interface LocalPriceProps {
  usdAmount: number;
  className?: string;
  size?: "sm" | "md";
}

export default function LocalPrice({ usdAmount, className = "", size = "sm" }: LocalPriceProps) {
  const { currencyInfo, formatLocal } = useCurrency();

  const localFormatted = formatLocal(usdAmount);
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
