/** Instructions for agents: never invent or copy reference prices. */
export function buildPricingInstructions(
  allowedPrice: string | null,
  pricingDetail?: string | null,
  referenceHasPriceVisual = false
): string {
  if (!referenceHasPriceVisual) {
    return `**PRICING (STRICT):** Do NOT show any price, dollar amount, "$XX", price sticker, or price badge in the ad. The reference ad had NO price badge/sticker — omit all pricing visuals even if the product page lists a price.`;
  }

  const detail = pricingDetail?.trim() || allowedPrice?.trim();
  if (detail) {
    if (pricingDetail && pricingDetail !== allowedPrice) {
      return `**PRICING (STRICT):** Reference had a price badge — ${pricingDetail.trim()} Do NOT use any other dollar amount. Do NOT copy prices from the reference ad.`;
    }
    return `**PRICING (STRICT):** Reference had a price badge — the ONLY price that may appear is exactly: "${allowedPrice!.trim()}". Do NOT use any other dollar amount. Do NOT copy prices from the reference ad (e.g. competitor "$79").`;
  }
  return `**PRICING (STRICT):** Reference had a price badge slot but no verified product price — omit the price badge entirely. Do NOT invent dollar amounts.`;
}

export function synthesisPricingBlock(
  allowedPrice: string | null,
  pricingDetail?: string | null,
  referenceHasPriceVisual = false
): string {
  return buildPricingInstructions(allowedPrice, pricingDetail, referenceHasPriceVisual);
}
