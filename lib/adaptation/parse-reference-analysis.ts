import type { ReferenceTrustBadge } from './types';

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
