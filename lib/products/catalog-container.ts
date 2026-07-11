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
  productName?: string | null
): string {
  const label = productName ? `"${productName}"` : 'the user product';
  return `**CATALOG CONTAINER LOCK (NON-NEGOTIABLE — read first):**
The attached catalog photo(s) define ${label}'s sellable product. Container/format = **${catalogHint}**.
- Clone reference **layout, scene, pose zone, and interaction** only — NEVER the reference competitor's container shape.
- If reference shows a bottle/cylinder/jar but catalog shows a pouch/bag/box → show the **catalog pouch/bag/box** in that same zone (held, on surface, in hand, etc.).
- FORBIDDEN: reskinning the reference bottle/cylinder with user colors/label; inventing a new pack type; "bottle version" of a pouch product.
- Describe the hero as "the same exact product as in the attached image(s)" — reproduce label, logo, colors, and container 1:1.`;
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
