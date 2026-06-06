import type {
  CreativeBridge,
  MarketingAngleProfile,
  ReferenceCreativeDeconstruction,
} from './types';
import type { ProductCreativeProfile } from '@/lib/products/infer-product-creative';

export function buildCreativeBridge(
  deconstruction: ReferenceCreativeDeconstruction | null,
  marketingAngle: MarketingAngleProfile | null,
  productProfile: ProductCreativeProfile | null,
  productName: string | null
): CreativeBridge | null {
  const referenceHook =
    deconstruction?.emotionalHook?.trim() ||
    marketingAngle?.painPoint?.trim() ||
    marketingAngle?.realTopic?.trim() ||
    '';
  const coreConcept =
    deconstruction?.coreConcept?.trim() ||
    marketingAngle?.realTopic?.trim() ||
    '';
  const resolutionMechanism =
    deconstruction?.resolutionMechanism?.trim() ||
    marketingAngle?.copyExtrapolationNotes?.trim() ||
    '';

  if (!referenceHook && !coreConcept && !productProfile) return null;

  const adaptedHook = productProfile
    ? `${productProfile.tension} → ${productProfile.resolution}`
    : marketingAngle?.copyExtrapolationNotes?.trim() ||
      (productName ? `Same persuasive structure applied to ${productName}` : '');

  const hookTransferValid = Boolean(
    productProfile?.resolution || marketingAngle?.copyExtrapolationNotes
  );

  const changeReason = hookTransferValid
    ? undefined
    : 'Reference hook may not transfer directly — adapt emotional structure to user product category.';

  const targetMoment =
    deconstruction?.targetMoment?.trim() ||
    (productProfile?.primaryUseCases.includes('sleep') ? 'sleep / recovery routine' : '') ||
    productProfile?.primaryUseCases.split(',')[0]?.trim() ||
    '';

  const whyThisWorks = composeWhyThisWorks({
    referenceHook,
    coreConcept,
    adaptedHook,
    productName,
    targetMoment,
    hookTransferValid,
    changeReason,
  });

  return {
    referenceHook,
    coreConcept,
    resolutionMechanism,
    targetMoment,
    adaptedHook,
    hookTransferValid,
    changeReason,
    whyThisWorks,
  };
}

function composeWhyThisWorks(input: {
  referenceHook: string;
  coreConcept: string;
  adaptedHook: string;
  productName: string | null;
  targetMoment: string;
  hookTransferValid: boolean;
  changeReason?: string;
}): string {
  const parts: string[] = [];
  if (input.coreConcept) {
    parts.push(`The reference ad sells the idea "${input.coreConcept.slice(0, 120)}" — not just its visuals.`);
  }
  if (input.referenceHook && input.adaptedHook) {
    parts.push(
      `We map that tension (${input.referenceHook.slice(0, 100)}) to the user product${input.productName ? ` (${input.productName})` : ''}: ${input.adaptedHook.slice(0, 160)}.`
    );
  }
  if (input.targetMoment) {
    parts.push(`The adapted concept anchors in the ${input.targetMoment} moment so the ad feels native to this brand.`);
  }
  if (!input.hookTransferValid && input.changeReason) {
    parts.push(input.changeReason);
  }
  return parts.join(' ').slice(0, 600) || 'Adapted to preserve reference emotional structure for the user product.';
}

export function creativeBridgeBlock(bridge: CreativeBridge | null): string {
  if (!bridge) {
    return `**CREATIVE BRIDGE (CRITICAL — concept-first adaptation):**
Before writing copy or visual direction, identify the reference's emotional tension and map it to the user's product world.
Do NOT visual-swap the competitor product. Rebuild the same persuasive logic natively for the new brand.`;
  }

  return `**CREATIVE BRIDGE (CRITICAL — read before any copy or visual decisions):**
This is NOT a visual swap. Extract the reference **concept** and rebuild it for the user's product.

**Reference deconstruction:**
- Emotional hook: ${bridge.referenceHook || '(see marketing angle)'}
- Core concept: ${bridge.coreConcept || '(infer from reference)'}
- Resolution mechanism: ${bridge.resolutionMechanism || '(how reference positions product as answer)'}
- Target moment: ${bridge.targetMoment || '(when/where tension happens)'}

**Mapped adaptation for user product:**
- Equivalent hook: ${bridge.adaptedHook}
- Hook transfers cleanly: ${bridge.hookTransferValid ? 'yes — preserve emotional structure' : 'partial — adapt tension to user category; do NOT force competitor metaphor'}
${bridge.changeReason ? `- Note: ${bridge.changeReason}` : ''}

**WHY THIS WORKS:** ${bridge.whyThisWorks}

**FORBIDDEN:** Copying competitor scene/product literally without validating the hook transfers. Generic template fill instead of native concept rebuild.`;
}
