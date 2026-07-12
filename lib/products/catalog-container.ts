import type { ReferenceProductVisibility } from '@/lib/adaptation/parse-reference-analysis';
import type { ProductImage } from './types';

/** Infer the user's sellable container/format from catalog metadata (not the reference ad). */
export function inferCatalogContainerHint(images: ProductImage[]): string {
  const pool = images.filter((i) => i.kind !== 'logo' && i.kind !== 'trust_badge');
  const hay = pool.map((i) => `${i.url} ${i.alt || ''} ${i.kind || ''}`).join(' ').toLowerCase();

  if (/\bpouch|\bsachet|\bstand-up bag|\bflat bag|\bzip bag|\bpackaging.*bag/.test(hay)) {
    return 'flexible stand-up pouch/bag (NOT a bottle, jar, or cylinder)';
  }
  if (/\bbottle|\btube|\bjar|\bcanister|\bflask|\bcylinder|\bserum bottle/.test(hay)) {
    return 'rigid bottle/jar/tube container';
  }
  if (/\bbox|\bcarton|\bcase|\bsleeve/.test(hay)) {
    return 'product box/carton';
  }
  if (/\bgumm|\bcapsule|\bsoftgel|\bloose|\bunit|\bcookie|\bbar\b/.test(hay)) {
    return 'loose product units (gummies/capsules/bars) — use exact shape from catalog photo';
  }
  if (pool.some((i) => i.kind === 'packaging')) {
    return 'retail packaging exactly as shown in attached catalog packaging photo';
  }
  return 'exact container/format shown in attached catalog image(s) — do not invent a new shape';
}

/** Words that describe competitor containers — must not appear in final Kie prompt when catalog differs. */
const COMPETITOR_CONTAINER_TERMS =
  /\b(cylindrical|cylinder|serum bottle|skincare bottle|pill bottle|supplement bottle|dark blue bottle|glass jar|amber jar|tub|canister|tube with cap)\b/gi;

export function stripCompetitorContainerLanguage(text: string): string {
  return text
    .replace(COMPETITOR_CONTAINER_TERMS, 'user catalog product')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function catalogContainerLockBlock(
  catalogHint: string,
  productName?: string | null,
  visibility: ReferenceProductVisibility = 'standard'
): string {
  if (visibility === 'none') {
    return `**PRODUCT VISIBILITY (match reference — NON-NEGOTIABLE):**
Reference shows NO product photo, NO packshot, NO loose units — illustration/copy/branding only.
- Do NOT add the user's pouch, bottle, box, gummies, or any catalog product visual anywhere in the ad.
- Clone layout, illustration, comparison panels, and copy only. Brand via text — not product photography.`;
  }

  const label = productName ? `"${productName}"` : 'the user product';
  const visibilityRule =
    visibility === 'symbolic-only'
      ? `- Product appears ONLY in the reference's symbolic zone (thought/dream bubble, tiny inset, icon). Show user's loose unit there ONLY — same size and placement. **FORBIDDEN:** retail packaging/pouch packshot elsewhere (no bottom hero pack, no corner pouch, no extra product under the scene).`
      : visibility === 'loose-units-only'
        ? `- Reference shows loose units/items only — no retail packaging packshot. Show catalog loose product in the same zone. **FORBIDDEN:** adding a separate pouch/bottle/box packshot the reference did not have.`
        : `- Clone reference **layout zone + interaction** only — NEVER the reference competitor's container shape.
- If reference shows a bottle/cylinder/jar but catalog shows a pouch/bag/box → show the **catalog pouch/bag/box** in that same zone only (not extra zones).`;

  return `**CATALOG CONTAINER LOCK (NON-NEGOTIABLE — read first):**
Attached catalog defines ${label}. Container/format = **${catalogHint}** when product IS shown.
${visibilityRule}
- FORBIDDEN: reskinning reference container with user label; inventing pack types; adding product/packaging zones the reference lacked.
- When product IS shown: reproduce label, logo, colors, container 1:1 from attached image(s) — in the **same visibility/placement mode as the reference**.`;
}

export function filterVisualsForProductVisibility<T extends { role: string; url: string }>(
  visuals: T[],
  visibility: ReferenceProductVisibility
): T[] {
  if (visibility === 'none') {
    return visuals.filter((v) => v.role === 'logo' || v.role === 'trust_badge');
  }
  if (visibility === 'symbolic-only' || visibility === 'loose-units-only') {
    return visuals.filter((v) => v.role !== 'packaging');
  }
  return visuals;
}

export function referenceProductVisibilityBlock(
  visibility: ReferenceProductVisibility
): string {
  switch (visibility) {
    case 'none':
      return 'Product render: NONE — reference had no product imagery.';
    case 'symbolic-only':
      return 'Product render: symbolic zone ONLY (bubble/inset) — no packshot elsewhere.';
    case 'loose-units-only':
      return 'Product render: loose units only — no retail packaging packshot.';
    default:
      return 'Product render: only in zones the reference used — do not add extra packshots.';
  }
}

/** Programmatic guard: fail if prompt adds product/packaging the reference did not show. */
export function findProductVisibilityViolations(
  prompt: string,
  visibility: ReferenceProductVisibility
): string[] {
  const issues: string[] = [];
  const lower = prompt.toLowerCase();

  if (visibility === 'none') {
    if (
      /\bpouch\b|\bpackshot\b|\bpackaging\b|\bproduct pouch\b|\bhero pack\b|\bgummies scattered\b|\bbottom.*product|\bproduct at the bottom|\bfeals pouch/i.test(
        lower
      )
    ) {
      issues.push(
        'PRODUCT VISIBILITY: reference had no product imagery — remove all product/packaging from prompt'
      );
    }
    return issues;
  }

  if (visibility === 'symbolic-only' || visibility === 'loose-units-only') {
    if (
      /\bbottom third\b.*\bpouch\b|\bpouch.*\bbottom\b|\bpackshot in (?:the )?(?:lower|bottom)|\bhero packaging\b|\bretail packaging.*(?:bottom|lower|corner)|\bproduct pouch prominently/i.test(
        lower
      )
    ) {
      issues.push(
        `PRODUCT VISIBILITY: reference = ${visibility} — remove extra packaging/packshot outside reference zone`
      );
    }
  }

  return issues;
}

/** Programmatic guard: fail if final prompt describes wrong container vs catalog. */
export function findCatalogContainerViolations(
  prompt: string,
  catalogHint: string
): string[] {
  const issues: string[] = [];
  const lower = prompt.toLowerCase();
  const isPouchCatalog = /pouch|bag|sachet|flexible stand-up/.test(catalogHint.toLowerCase());

  if (isPouchCatalog) {
    const bad = [
      /\bcylindrical\b/i,
      /\bcylinder\b/i,
      /\bserum bottle\b/i,
      /\bglass bottle\b/i,
      /\bjar with\b/i,
      /\bscrew.?cap bottle\b/i,
      /\bamber bottle\b/i,
    ];
    for (const re of bad) {
      if (re.test(prompt)) {
        issues.push(
          `PRODUCT CONTAINER: prompt describes a bottle/cylinder/jar but catalog is ${catalogHint} — must show catalog packaging only`
        );
        break;
      }
    }
  }

  if (/reskin|user.?label on (?:the )?bottle|bottle with user/i.test(lower)) {
    issues.push('PRODUCT CONTAINER: prompt reskins reference bottle — forbidden');
  }

  return issues;
}
