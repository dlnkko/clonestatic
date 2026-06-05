import type { ReferenceProductElement, ReferenceProductUnitsProfile } from './types';

const WORD_TO_NUM: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
};

/** Fallback when Step 1 units block is missing — infer count from pose paragraph. */
export function inferProductUnitsFromPose(poseText: string): ReferenceProductUnitsProfile | null {
  if (!poseText?.trim()) return null;

  const distinctVariants =
    /\bdifferent\b|\bdistinct\b|\bvari(?:ation|ant|ety|ed)\b|\bmultiple colors?\b|\bmultiple flavors?\b|\beach (?:can|jar|bottle|pack|pouch)/i.test(
      poseText
    );

  const digitMatch = poseText.match(
    /\b(\d+)\s+(?:identical\s+)?(?:bottles?|cans?|jars?|tubs?|products?|units?|packs?|pouches?|variants?|items?)\b/i
  );
  if (digitMatch) {
    const n = Math.min(6, Math.max(1, Number(digitMatch[1])));
    return {
      unitCount: n,
      distinctVariants,
      arrangement: /row|side by side|horizontal/i.test(poseText) ? 'horizontal-row' : 'other',
      variantNotes: poseText.slice(0, 200),
    };
  }

  const wordMatch = poseText.match(
    /\b(one|two|three|four|five|six)\s+(?:identical\s+)?(?:bottles?|cans?|jars?|tubs?|products?|units?|packs?|pouches?|variants?|items?)\b/i
  );
  if (wordMatch) {
    const n = WORD_TO_NUM[wordMatch[1].toLowerCase()] ?? 1;
    return {
      unitCount: n,
      distinctVariants,
      arrangement: /row|side by side|horizontal/i.test(poseText) ? 'horizontal-row' : 'other',
      variantNotes: poseText.slice(0, 200),
    };
  }

  return null;
}

/**
 * Expand identified elements into N visible product slots when reference shows multiple units.
 */
export function expandElementsForProductUnits(
  elements: ReferenceProductElement[],
  units: ReferenceProductUnitsProfile | null
): ReferenceProductElement[] {
  const unitCount = units?.unitCount ?? 1;
  if (unitCount <= 1) return elements;

  const trustAndLogo = elements.filter((e) => e.role === 'trust_badge' || e.role === 'logo');
  const productLike = elements.filter(
    (e) => e.role === 'product' || e.role === 'packaging' || e.role === 'lifestyle'
  );
  const other = elements.filter(
    (e) =>
      e.role !== 'trust_badge' &&
      e.role !== 'logo' &&
      e.role !== 'product' &&
      e.role !== 'packaging' &&
      e.role !== 'lifestyle'
  );

  const heroRole =
    productLike.find((e) => e.role === 'packaging')?.role ??
    productLike.find((e) => e.role === 'product')?.role ??
    'product';
  const baseDesc =
    productLike.find((e) => e.role === heroRole)?.description ||
    productLike[0]?.description ||
    'product unit visible in reference';

  const slots: ReferenceProductElement[] = [];
  for (let i = 0; i < unitCount; i++) {
    const slotHint = units?.slots?.[i]?.description?.trim();
    slots.push({
      role: heroRole,
      description: slotHint
        ? `Slot ${i + 1}/${unitCount} (${slotHint}) — ${baseDesc}`
        : `Slot ${i + 1}/${unitCount} left-to-right in reference product row — ${baseDesc}`,
      slotIndex: i,
      needsDistinctVariant: units?.distinctVariants === true,
    });
  }

  return [...slots, ...trustAndLogo, ...other].slice(0, 8);
}
