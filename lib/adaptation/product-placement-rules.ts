import type { AdaptationContext } from './types';
import { authenticProductPlacementBlock } from '@/lib/products/infer-product-use';

export function productPlacementOnModelBlock(ctx: AdaptationContext): string {
  return authenticProductPlacementBlock({
    hasPersonInReference: ctx.hasPersonInReference,
    productUseProfile: ctx.productUseProfile,
    productName: ctx.productName,
  });
}
