export const CREDIT_BASE_PRICE_PER_CREDIT = 0.16;
export const CREDIT_PRICING_CURRENCY = "EUR" as const;
export const CREDIT_PRICING_STRIPE_CURRENCY = "eur" as const;

export type CreditPricingPoint = {
  credits: number;
  pricePerCredit: number;
};

export type CreditPricingBreakdown = {
  credits: number;
  pricePerCredit: number;
  basePrice: number;
  discountPercent: number;
  discountAmount: number;
  finalPrice: number;
  currency: typeof CREDIT_PRICING_CURRENCY;
};

export const CREDIT_PRICING: ReadonlyArray<CreditPricingPoint> = [
  { credits: 10, pricePerCredit: 0.16 },
  { credits: 20, pricePerCredit: 0.158 },
  { credits: 30, pricePerCredit: 0.156 },
  { credits: 40, pricePerCredit: 0.154 },
  { credits: 50, pricePerCredit: 0.152 },
  { credits: 60, pricePerCredit: 0.15 },
  { credits: 70, pricePerCredit: 0.149 },
  { credits: 80, pricePerCredit: 0.148 },
  { credits: 90, pricePerCredit: 0.147 },
  { credits: 100, pricePerCredit: 0.145 },
  { credits: 120, pricePerCredit: 0.142 },
  { credits: 140, pricePerCredit: 0.139 },
  { credits: 160, pricePerCredit: 0.136 },
  { credits: 180, pricePerCredit: 0.133 },
  { credits: 200, pricePerCredit: 0.13 },
  { credits: 220, pricePerCredit: 0.127 },
  { credits: 240, pricePerCredit: 0.124 },
  { credits: 260, pricePerCredit: 0.121 },
  { credits: 280, pricePerCredit: 0.118 },
  { credits: 300, pricePerCredit: 0.115 },
  { credits: 325, pricePerCredit: 0.112 },
  { credits: 350, pricePerCredit: 0.11 },
  { credits: 375, pricePerCredit: 0.108 },
  { credits: 400, pricePerCredit: 0.106 },
  { credits: 425, pricePerCredit: 0.104 },
  { credits: 450, pricePerCredit: 0.102 },
  { credits: 475, pricePerCredit: 0.101 },
  { credits: 500, pricePerCredit: 0.1 },
];

export const ALLOWED_CREDIT_VALUES = CREDIT_PRICING.map(
  (entry) => entry.credits,
);

const roundToCurrency = (value: number) => {
  return Math.round((value + Number.EPSILON) * 100) / 100;
};

export const isAllowedCreditQuantity = (credits: number) => {
  return ALLOWED_CREDIT_VALUES.includes(credits);
};

export const calculateCreditPrice = (
  credits: number,
): CreditPricingBreakdown | null => {
  const pricingPoint = CREDIT_PRICING.find(
    (entry) => entry.credits === credits,
  );

  if (!pricingPoint) {
    return null;
  }

  const basePrice = roundToCurrency(credits * CREDIT_BASE_PRICE_PER_CREDIT);
  const finalPrice = roundToCurrency(credits * pricingPoint.pricePerCredit);
  const discountAmount = roundToCurrency(basePrice - finalPrice);
  const discountPercent =
    basePrice === 0
      ? 0
      : Math.round((discountAmount / basePrice) * 10000) / 100;

  return {
    credits,
    pricePerCredit: pricingPoint.pricePerCredit,
    basePrice,
    discountPercent,
    discountAmount,
    finalPrice,
    currency: CREDIT_PRICING_CURRENCY,
  };
};
