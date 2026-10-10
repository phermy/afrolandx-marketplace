import { useCurrency } from "@/hooks/useCurrency";

type ProductPriceProps = {
  ngnAmount: number;
  large?: boolean;
};

export default function ProductPrice({ ngnAmount, large = false }: ProductPriceProps) {
  const { currencyInfo, formatNGN } = useCurrency();
  const converted = Number.isFinite(ngnAmount) ? formatNGN(ngnAmount) : null;
  const naira = Number.isFinite(ngnAmount)
    ? `₦${ngnAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
    : "Price unavailable";

  return (
    <div className="flex flex-col gap-1" aria-label={converted ? `Approximately ${converted} ${currencyInfo?.code}; payable price ${naira} NGN` : `${naira} NGN`}>
      <span className={`${large ? "text-3xl" : "text-lg"} font-bold leading-tight text-nigerian-green`}>
        {converted && currencyInfo ? `≈ ${converted} ${currencyInfo.code}` : naira}
      </span>
      {converted && (
        <span className={`${large ? "text-sm" : "text-xs"} text-gray-600`}>
          {naira} NGN at checkout
        </span>
      )}
      {large && (
        <span className="text-xs text-gray-500">
          {converted ? "Local price is an estimate. You pay in NGN." : "You pay in NGN."}
        </span>
      )}
    </div>
  );
}