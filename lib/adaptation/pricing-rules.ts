/** Instructions for agents: never invent or copy reference prices. */
export function buildPricingInstructions(allowedPrice: string | null): string {
  if (allowedPrice?.trim()) {
    return `**PRICING (STRICT):** The ONLY price that may appear anywhere in the ad (badges, stickers, text) is exactly: "${allowedPrice.trim()}". Do NOT use any other dollar amount. Do NOT copy prices from the reference ad (e.g. competitor "$79").`;
  }
  return `**PRICING (STRICT):** Do NOT show any price, dollar amount, "$XX", "NOW $XX", or price badges in the ad. The product page did not provide a verified price — omit all pricing visuals even if the reference ad has them.`;
}

export function synthesisPricingBlock(allowedPrice: string | null): string {
  return buildPricingInstructions(allowedPrice);
}
