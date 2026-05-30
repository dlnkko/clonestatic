import type { ReferenceTrustBadge } from './types';

export type ParsedTextLine = { role: string; text: string };

export function parseHasPromoOfferLine(analysisText: string): boolean {
  const block = analysisText.match(
    /\*\*PROMO \/ OFFER LINE \(REFERENCE AD\):\*\*\s*([\s\S]*?)(?=\*\*TRUST BADGE|\*\*ICON \/ FEATURE|\*\*SOCIAL PROOF|\*\*PRODUCT POSE|\*\*REFERENCE AD PROMPT:\*\*|$)/i
  );
  if (!block) return false;
  return /Present:\s*yes/i.test(block[1]);
}

export function parseReferenceTrustBadge(analysisText: string): ReferenceTrustBadge {
  const block = analysisText.match(
    /\*\*TRUST BADGE \/ AWARD SEAL \(REFERENCE AD\):\*\*\s*([\s\S]*?)(?=\*\*ICON \/ FEATURE|\*\*SOCIAL PROOF|\*\*PRODUCT POSE|\*\*REFERENCE AD PROMPT:\*\*|$)/i
  );
  if (!block) {
    return { present: false, placement: '', description: '' };
  }
  const text = block[1];
  const present = /Present:\s*yes/i.test(text);
  const placementMatch = text.match(/Placement:\s*([\s\S]+?)(?=\n-\s|\n\*\*|$)/i);
  const descMatch = text.match(/Description:\s*([\s\S]+?)(?=\n-\s|\n\*\*|$)/i);
  return {
    present,
    placement: placementMatch?.[1]?.trim() ?? '',
    description: descMatch?.[1]?.trim() ?? '',
  };
}

/** Headlines and hooks from reference — must NOT be reused verbatim in adapted ads. */
export function parseVerbatimPhrasesFromCopyBlock(copyBlock: string): string[] {
  const phrases: string[] = [];
  const linesSection = copyBlock.match(
    /All text lines \(top to bottom\):\s*([\s\S]+?)(?=\n-\s*Headline|\n-\s*\*\*|$)/i
  );
  const raw = linesSection?.[1] ?? copyBlock;

  const numberedLine = /^\s*\d+\.\s*([^—–:\n]+?)\s*[—–:-]\s*(.+)$/gim;
  let m: RegExpExecArray | null;
  while ((m = numberedLine.exec(raw)) !== null) {
    const role = m[1].toLowerCase();
    const text = m[2].replace(/^["']|["']$/g, '').trim();
    if (
      text.length >= 8 &&
      /headline|tagline|hook|main\s*head|title/i.test(role)
    ) {
      phrases.push(text);
    }
  }

  const promoExact = copyBlock.match(/Exact text \(if yes\):\s*(.+)/i);
  if (promoExact) {
    const t = promoExact[1].trim();
    if (t.length >= 6 && !/none|n\/a/i.test(t)) phrases.push(t);
  }

  return [...new Set(phrases.map((p) => p.toUpperCase().trim()))].slice(0, 8);
}

/** Parse numbered text lines from Step 1 copywriting analysis. */
export function parseReferenceTextLines(copyBlock: string): ParsedTextLine[] {
  const lines: ParsedTextLine[] = [];
  const linesSection = copyBlock.match(
    /All text lines \(top to bottom\):\s*([\s\S]+?)(?=\n-\s*Headline|\n-\s*\*\*|$)/i
  );
  const raw = linesSection?.[1] ?? copyBlock;
  const numberedLine = /^\s*\d+\.\s*([^—–:\n]+?)\s*[—–:-]\s*(.+)$/gim;
  let m: RegExpExecArray | null;
  while ((m = numberedLine.exec(raw)) !== null) {
    const role = m[1].trim();
    const text = m[2].replace(/^["']|["']$/g, '').trim();
    if (text.length >= 2) lines.push({ role, text });
  }
  return lines;
}

export function parseReferenceVisualStyle(vsText: string): import('./types').ReferenceVisualStyle {
  const hasRealPhotoPerson = /Has real photographic person(?:\/model)?:\s*yes/i.test(vsText);
  const legacyPerson = /Has person\/character:\s*yes/i.test(vsText);
  const hasIllustration = /Has illustration(?:\/diagram\/animation)?:\s*yes/i.test(vsText);
  const hasEnv = /Has gym, sport setting, or location environment:\s*yes/i.test(vsText);

  const mediumMatch = vsText.match(
    /Visual medium:\s*(photo|illustration|diagram|3d-render|mixed|product-graphic-only)/i
  );
  const visualMedium = (mediumMatch?.[1]?.toLowerCase() ??
    'product-graphic-only') as import('./types').ReferenceVisualStyle['visualMedium'];

  const illustTypeMatch = vsText.match(/Illustration\/diagram type:\s*([\s\S]+?)(?=\n-\s|\n\*\*|$)/i);
  const designMatch = vsText.match(
    /Design type:\s*(graphic-product-only|has-person|has-environment|illustration-led|diagram-led)/i
  );
  const mainElementsMatch = vsText.match(/Main elements:\s*(one-hero-only|multiple)/i);

  const hasPerson =
    hasRealPhotoPerson ||
    (legacyPerson && !hasIllustration && visualMedium === 'photo');

  let designType = designMatch?.[1]?.toLowerCase() ?? '';
  if (!designType) {
    if (hasIllustration || visualMedium === 'illustration' || visualMedium === 'diagram') {
      designType = 'illustration-led';
    } else if (hasPerson || hasEnv) {
      designType = hasPerson ? 'has-person' : 'has-environment';
    } else {
      designType = 'graphic-product-only';
    }
  }

  return {
    hasPerson,
    hasIllustrationOrDiagram:
      hasIllustration ||
      ['illustration', 'diagram', '3d-render', 'mixed'].includes(visualMedium),
    visualMedium,
    illustrationNotes: illustTypeMatch?.[1]?.trim() ?? '',
    hasEnvironment: hasEnv,
    designType,
    oneHeroOnly: mainElementsMatch ? mainElementsMatch[1].toLowerCase() === 'one-hero-only' : false,
  };
}
