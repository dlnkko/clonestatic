import {
  copyLanguageInstruction,
  resolveCopyLanguage,
  type CopyLanguageOption,
} from '@/lib/copy-languages';
import { inferProductUseProfile } from '@/lib/products/infer-product-use';
import { effectiveHasPersonInReference, isIllustrativeVisualStyle } from '@/lib/ad-visual-mode';
import { buildCreativeBridge } from './creative-bridge';
import { buildPricingInstructions } from './pricing-rules';
import {
  detectSubheroCopyPattern,
  enrichCopywritingProfile,
  inferSecondaryWordLimitFromReferenceLines,
  parseReferenceComparisonModule,
  parseReferenceLayoutZones,
  parseReferenceLayoutZonesFromAnalysis,
  parseReferencePhotoStyle,
  parseReferenceTextLayout,
  parseTypographyHierarchy,
} from './parse-reference-analysis';
import { subheroCopyPatternBlockForProfile } from './adaptation-rules';
import type { Line2CopyPattern } from './types';
import type {
  AdaptationContext,
  CopywritingProfile,
  MatchedProductVisual,
  ReferenceLogoAnalysis,
  ReferenceLogoPlacement,
  ReferenceTrustBadge,
  ReferenceVisualStyle,
  RhetoricalFigures,
} from './types';

export function defaultReferenceLogoAnalysis(): ReferenceLogoAnalysis {
  return {
    placement: 'unknown',
    standaloneLogoInLayout: false,
    logoOnProductOnly: true,
    notes: '',
  };
}

export function parseReferenceLogoPlacement(text: string): ReferenceLogoAnalysis {
  const standalone = /Standalone brand logo in layout:\s*yes/i.test(text);
  const onProduct = /Logo appears only on product packaging:\s*yes/i.test(text);
  const typeMatch = text.match(
    /Brand identity in layout type:\s*(copy-only-text|logo-on-product-only|standalone-logo|standalone-and-product)/i
  );
  const notesMatch = text.match(/Logo placement notes:\s*([\s\S]+?)(?=\n\*\*|$)/i);

  let placement: ReferenceLogoPlacement = 'unknown';
  if (typeMatch) {
    const t = typeMatch[1].toLowerCase();
    if (t === 'copy-only-text') placement = 'copy-only';
    else if (t === 'logo-on-product-only') placement = 'logo-on-product-only';
    else if (t === 'standalone-logo') placement = 'standalone-logo';
    else if (t === 'standalone-and-product') placement = 'standalone-and-product';
  } else if (!standalone && onProduct) {
    placement = 'logo-on-product-only';
  } else if (!standalone && !onProduct) {
    placement = 'copy-only';
  } else if (standalone && onProduct) {
    placement = 'standalone-and-product';
  } else if (standalone) {
    placement = 'standalone-logo';
  }

  return {
    placement,
    standaloneLogoInLayout: standalone,
    logoOnProductOnly: onProduct,
    notes: notesMatch ? notesMatch[1].trim() : '',
  };
}

export type BuildContextInput = {
  referencePrompt: string;
  referenceTypography: string;
  referenceProductPoseAndArrangement: string;
  referenceProductUnits?: import('@/lib/products/types').ReferenceProductUnitsProfile | null;
  referenceReviewModule: string;
  hasReferenceReviewModule: boolean;
  referenceFeatureRow: string;
  hasReferenceFeatureRow: boolean;
  referenceLogoAnalysis: ReferenceLogoAnalysis;
  referenceVisualStyle: ReferenceVisualStyle | null;
  copywritingProfile: CopywritingProfile | null;
  rhetoricalFigures: RhetoricalFigures | null;
  scrapedSummary: string | null;
  scrapedBranding: Record<string, unknown> | null;
  scrapedMarkdown: string | null;
  isUrlScraped: boolean;
  copywriting: string | null;
  guidelinesTrimmed: string;
  copyLanguage?: string;
  matchedProductVisuals?: MatchedProductVisual[];
  productName?: string | null;
  productDescription?: string | null;
  productTargetAudience?: string | null;
  productBrandColors?: string[];
  allowedPrice?: string | null;
  pricingDetail?: string | null;
  referenceHasPromoOfferLine?: boolean;
  referenceTrustBadge?: ReferenceTrustBadge;
  referenceVerbatimPhrases?: string[];
  referenceTextLayoutBlock?: string;
  referenceComparisonModule?: string;
  hasReferenceComparisonModule?: boolean;
  referenceLayoutZonesBlock?: string;
  marketingAngle?: import('./types').MarketingAngleProfile | null;
  visualMetaphor?: import('./types').VisualMetaphorProfile | null;
  creativeDeconstruction?: import('./types').ReferenceCreativeDeconstruction | null;
  productCreativeProfile?: import('./types').ProductCreativeProfile | null;
};

export function buildAdaptationContext(input: BuildContextInput): AdaptationContext {
  const {
    referencePrompt,
    referenceTypography,
    referenceProductPoseAndArrangement,
    referenceProductUnits = null,
    referenceReviewModule,
    hasReferenceReviewModule,
    referenceFeatureRow = '',
    hasReferenceFeatureRow = false,
    referenceLogoAnalysis,
    referenceVisualStyle,
    copywritingProfile,
    rhetoricalFigures,
    scrapedSummary,
    scrapedBranding,
    scrapedMarkdown,
    isUrlScraped,
    copywriting,
    guidelinesTrimmed,
    copyLanguage,
    matchedProductVisuals = [],
    productName = null,
    productDescription = null,
    productTargetAudience = null,
    productBrandColors = [],
    allowedPrice = null,
    pricingDetail = null,
    referenceHasPromoOfferLine = false,
    referenceTrustBadge = { present: false, placement: '', description: '' },
    referenceVerbatimPhrases = [],
    referenceTextLayoutBlock = '',
    referenceComparisonModule = '',
    hasReferenceComparisonModule = false,
    referenceLayoutZonesBlock = '',
    marketingAngle: marketingAngleInput = null,
    visualMetaphor: visualMetaphorInput = null,
    creativeDeconstruction: creativeDeconstructionInput = null,
    productCreativeProfile: productCreativeProfileInput = null,
  } = input;

  const referenceTextLayout = referenceTextLayoutBlock
    ? parseReferenceTextLayout(referenceTextLayoutBlock)
    : null;
  const referenceComparisonParsed = referenceComparisonModule
    ? parseReferenceComparisonModule(referenceComparisonModule)
    : null;
  const referenceLayoutZones = referenceLayoutZonesBlock
    ? parseReferenceLayoutZones(referenceLayoutZonesBlock)
    : null;

  const referencePhotoStyle =
    referenceVisualStyle?.hasPerson && referenceVisualStyle.visualMedium === 'photo'
      ? parseReferencePhotoStyle(referencePrompt)
      : null;

  const pricingInstructions = buildPricingInstructions(allowedPrice, pricingDetail);

  const resolvedLang: CopyLanguageOption = resolveCopyLanguage(copyLanguage);
  const langInstruction = copyLanguageInstruction(resolvedLang);

  const isGraphicOnly =
    referenceVisualStyle?.designType === 'graphic-product-only' ||
    referenceVisualStyle?.designType === 'illustration-led' ||
    referenceVisualStyle?.designType === 'diagram-led' ||
    (referenceVisualStyle?.hasIllustrationOrDiagram === true && !referenceVisualStyle?.hasPerson);
  const oneHeroOnly = referenceVisualStyle?.oneHeroOnly === true;
  const guidelinesAskSingleHero =
    !!guidelinesTrimmed &&
    /main\s*element|as\s*(the\s*)?main\s*element|only\s*one\s*(main\s*)?element|single\s*(main\s*)?element/i.test(
      guidelinesTrimmed
    );
  const referenceShowsPackaging = matchedProductVisuals.some((m) => m.role === 'packaging');
  const multiUnitLayout = (referenceProductUnits?.unitCount ?? 1) > 1;
  const enforceOneMainElement =
    (oneHeroOnly || guidelinesAskSingleHero) && !referenceShowsPackaging && !multiUnitLayout;
  const hasIllustrativeVisual = isIllustrativeVisualStyle(referenceVisualStyle, {
    referenceShowsPackaging,
    matchedProductVisuals,
  });
  const hasPersonInReference = effectiveHasPersonInReference(referenceVisualStyle, {
    referenceShowsPackaging,
    matchedProductVisuals,
  });

  const referenceTextLines =
    copywritingProfile?.referenceAllTextLines?.length
      ? copywritingProfile.referenceAllTextLines
      : [];

  const typographyHierarchy = parseTypographyHierarchy(referenceTypography);

  const enrichedCopywritingProfile = enrichCopywritingProfile(
    copywritingProfile,
    marketingAngleInput
  );
  const line2Detected = detectSubheroCopyPattern(
    enrichedCopywritingProfile?.referenceLine2Example,
    enrichedCopywritingProfile?.functionOfLine2,
    enrichedCopywritingProfile?.linguisticDeviceLine2,
    enrichedCopywritingProfile?.line2Pattern ?? null,
    {
      productMentionedInCopy:
        enrichedCopywritingProfile?.productMentionedInCopy ??
        marketingAngleInput?.productMentionedInCopy ??
        null,
      funnelStage: marketingAngleInput?.funnelStage ?? null,
      referenceLines: enrichedCopywritingProfile?.referenceAllTextLines,
    }
  );
  const line2Pattern = line2Detected.pattern;

  const headlineWords =
    copywritingProfile?.headlineWordCount ??
    (copywritingProfile?.wordCount != null
      ? Math.min(5, Math.max(2, Math.floor((copywritingProfile.wordCount || 8) / 2)))
      : 4);
  let mainCopyWords =
    copywritingProfile?.mainCopyWordCount ??
    (copywritingProfile?.wordCount != null
      ? Math.min(8, Math.max(3, copywritingProfile.wordCount || 8))
      : 6);
  if (referenceTextLines.length > 0) {
    mainCopyWords = inferSecondaryWordLimitFromReferenceLines(
      referenceTextLines,
      mainCopyWords
    );
  }

  const productUseProfile = inferProductUseProfile(
    productName ?? '',
    productDescription,
    productTargetAudience
  );

  const creativeBridge = buildCreativeBridge(
    creativeDeconstructionInput,
    marketingAngleInput,
    productCreativeProfileInput,
    productName
  );

  const brandingIntegration = buildBrandingIntegration(
    scrapedBranding,
    referenceLogoAnalysis,
    matchedProductVisuals,
    productName,
    productBrandColors
  );
  const copywritingInstructions =
    buildCopywritingInstructions({
      isUrlScraped,
      scrapedSummary,
      scrapedMarkdown,
      copywriting,
      copywritingProfile: enrichedCopywritingProfile,
      rhetoricalFigures,
      headlineWords,
      mainCopyWords,
      referenceHasPromoOfferLine,
      referenceVerbatimPhrases,
      line2Pattern,
    }) +
    '\n\n' +
    subheroCopyPatternBlockForProfile(enrichedCopywritingProfile, line2Pattern);
  const trustBadgeInstructions = buildTrustBadgeInstructions(
    referenceTrustBadge,
    matchedProductVisuals
  );
  const reviewModuleInstructions = hasReferenceReviewModule
    ? buildReviewModuleInstructions(referenceReviewModule)
    : '';

  return {
    referencePrompt,
    referenceTypography,
    typographyHierarchy,
    referenceTextLayout,
    referenceComparisonModule,
    referenceComparisonParsed,
    hasReferenceComparisonModule,
    referenceLayoutZones,
    referenceProductPoseAndArrangement,
    referencePhotoStyle,
    referenceProductUnits,
    referenceReviewModule,
    hasReferenceReviewModule,
    referenceFeatureRow,
    hasReferenceFeatureRow,
    referenceLogoAnalysis,
    referenceVisualStyle,
    copywritingProfile: enrichedCopywritingProfile,
    rhetoricalFigures,
    scrapedSummary,
    scrapedBranding,
    scrapedMarkdown,
    isUrlScraped,
    manualCopywriting: copywriting && !isUrlScraped ? copywriting : null,
    guidelinesTrimmed,
    isGraphicOnly,
    oneHeroOnly,
    guidelinesAskSingleHero,
    enforceOneMainElement,
    referenceShowsPackaging,
    hasPersonInReference,
    hasIllustrativeVisual,
    referenceTextLines,
    line2Pattern,
    headlineWords,
    mainCopyWords,
    brandingIntegration,
    copywritingInstructions,
    reviewModuleInstructions,
    copyLanguageCode: resolvedLang.code,
    copyLanguageName: resolvedLang.name,
    copyLanguageInstruction: langInstruction,
    matchedProductVisuals,
    productName,
    productDescription,
    productBrandColors,
    productUseProfile,
    allowedPrice,
    pricingInstructions,
    referenceHasPromoOfferLine,
    referenceTrustBadge,
    referenceVerbatimPhrases,
    trustBadgeInstructions,
    marketingAngle: marketingAngleInput,
    visualMetaphor: visualMetaphorInput,
    creativeDeconstruction: creativeDeconstructionInput,
    productCreativeProfile: productCreativeProfileInput,
    creativeBridge,
  };
}

function buildTrustBadgeInstructions(
  badge: ReferenceTrustBadge,
  matched: MatchedProductVisual[]
): string {
  if (!badge.present) return '';
  const matchedSeal = matched.find((m) => m.role === 'trust_badge');
  return `**TRUST BADGE / AWARD SEAL (CRITICAL — match reference composition):**
The reference ad includes a trust/award seal (${badge.description || 'award or press badge'}).
- Placement: ${badge.placement || 'same overlap position as reference (typically bottom-right on hero product)'}
- Use the user's trust badge from the provided product image${matchedSeal ? ` (matched asset: ${matchedSeal.description})` : ''} — render it at similar size, with soft shadow, overlapping the product like the reference.
- Do NOT omit the seal if a trust_badge image was provided.
- Do NOT invent a competitor's award text; use only what appears on the user's badge image.`;
}

function buildBrandingIntegration(
  scrapedBranding: Record<string, unknown> | null,
  logoAnalysis: ReferenceLogoAnalysis,
  matchedProductVisuals: MatchedProductVisual[] = [],
  productName: string | null = null,
  manualBrandColors: string[] = []
): string {
  const dedicatedLogo = matchedProductVisuals.find((m) => m.role === 'logo');
  const hasDedicatedLogo = !!dedicatedLogo;
  const placement = logoAnalysis.placement;
  const needsStandaloneLogo =
    logoAnalysis.standaloneLogoInLayout ||
    placement === 'standalone-logo' ||
    placement === 'standalone-and-product';
  const forbidStandaloneLogo =
    placement === 'copy-only' ||
    placement === 'logo-on-product-only' ||
    (placement === 'unknown' && !logoAnalysis.standaloneLogoInLayout);

  const brandColors = scrapedBranding
    ? ((scrapedBranding.colors as Record<string, unknown>) || {})
    : {};
  const colorList = [
    ...Object.entries(brandColors)
      .map(([key, value]) => {
        if (typeof value === 'string') return `${key}: ${value}`;
        if (value && typeof value === 'object' && 'value' in value) {
          return `${key}: ${(value as { value: string }).value}`;
        }
        return `${key}: ${JSON.stringify(value)}`;
      })
      .filter(Boolean),
    ...(manualBrandColors.length ? [`manual palette: ${manualBrandColors.join(', ')}`] : []),
  ].join(', ');

  const typographyInfo = scrapedBranding
    ? ((scrapedBranding.typography as Record<string, unknown>) || {})
    : {};
  const fontsInfo = scrapedBranding
    ? ((scrapedBranding.fonts as { family?: string; name?: string }[]) || [])
    : [];
  const fontList = fontsInfo
    .map((f) => f.family || f.name || '')
    .filter(Boolean)
    .join(', ');

  if (forbidStandaloneLogo) {
    return `**Brand Integration (NO STANDALONE LOGO — match reference layout):**
The reference ad does NOT use a separate brand logo mark in the layout (no centered wordmark, no corner logo badge, no large logo between headline and product, no footer brand name).
- **Do NOT add** a standalone brand logo, wordmark, footer brand text, or emblem in the design — even if scraped branding includes a logo URL.
- Brand identity = **headline/copy text only** + logos/labels **printed on the product packaging** in catalog photos (use the exact logotype from the pack — no separate logo upload required).
${logoAnalysis.notes ? `- Reference notes: ${logoAnalysis.notes}` : ''}
${colorList ? `- Product brand colors (USE FOR BACKGROUND & ACCENTS — not competitor colors): ${colorList}` : ''}
${typographyInfo.fontFamilies || fontList ? `- Typography for headlines: ${typographyInfo.fontFamilies || fontList}` : ''}
- **Background rule:** Replace reference competitor background hues with these product brand colors. Keep reference layout/mood.
Maintain the reference's copy-only brand presentation.`;
  }

  if (needsStandaloneLogo) {
    const logoInstruction = hasDedicatedLogo
      ? `- **Standalone brand logo (CRITICAL):** Reproduce the attached **dedicated logo catalog image** EXACTLY in the same layout position as the reference standalone logo (${logoAnalysis.notes || 'top center'}). Same letterforms, colors, stroke weight — do NOT render as plain text or a generic font. Asset: ${dedicatedLogo!.description}`
      : productName
        ? `- **Standalone brand logo:** The reference includes a separate logo in the layout — place "${productName}" logotype from **packaging photos** in the same position. Match typography on the pack exactly.`
        : `- **Standalone brand logo:** The reference includes a separate logo in the layout — place the user's logotype from **packaging photos** in the same position and style.`;

    return `**Brand Integration:**
The reference ad includes a **standalone logo** in the layout (not only on packaging). Replicate that placement with the user's brand.
${logoInstruction}
${colorList ? `- Product Brand Colors (USE FOR BACKGROUND & ACCENTS): ${colorList}` : ''}
${typographyInfo.fontFamilies || fontList ? `- Product Brand Typography: ${typographyInfo.fontFamilies || fontList}` : ''}
${typographyInfo.fontSizes ? `- Brand Font Sizes: ${JSON.stringify(typographyInfo.fontSizes)}` : ''}
- **Background rule:** Do not keep competitor category colors. Use product brand palette for backgrounds/gradients while preserving reference color roles.
Integrate while maintaining the reference ad's overall design structure.`;
  }

  if (!scrapedBranding) return '';

  return `**Brand Integration:**
${colorList ? `- Product Brand Colors (USE FOR BACKGROUND & ACCENTS): ${colorList}` : ''}
${typographyInfo.fontFamilies || fontList ? `- Product Brand Typography: ${typographyInfo.fontFamilies || fontList}` : ''}
- Use product brand palette for backgrounds/accents while preserving reference layout structure.`;
}

function buildCopywritingInstructions(opts: {
  isUrlScraped: boolean;
  scrapedSummary: string | null;
  scrapedMarkdown: string | null;
  copywriting: string | null;
  copywritingProfile: CopywritingProfile | null;
  rhetoricalFigures: RhetoricalFigures | null;
  headlineWords: number;
  mainCopyWords: number;
  referenceHasPromoOfferLine: boolean;
  referenceVerbatimPhrases: string[];
  line2Pattern: Line2CopyPattern;
}): string {
  const {
    isUrlScraped,
    scrapedSummary,
    scrapedMarkdown,
    copywriting,
    copywritingProfile,
    rhetoricalFigures,
    headlineWords,
    mainCopyWords,
    referenceHasPromoOfferLine,
    referenceVerbatimPhrases,
    line2Pattern,
  } = opts;

  const antiVerbatimBlock =
    referenceVerbatimPhrases.length > 0
      ? `**ORIGINAL COPY (CRITICAL — do NOT plagiarize reference):** The reference competitor phrases ${referenceVerbatimPhrases.map((p) => `"${p}"`).join(', ')} must NOT appear verbatim or near-verbatim in the new ad. Write NEW hooks with the same structure, tone, and rhetorical device (e.g. same "ditch X for Y" pattern but different words and product-specific target).`
      : `**ORIGINAL COPY (CRITICAL):** Do NOT reuse the reference ad's exact headline or hook wording. Paraphrase with the same tone, brevity, and rhetorical structure for the user's product.`;

  const promoStructureBlock = referenceHasPromoOfferLine
    ? `**PROMO LINES:** The reference includes a dedicated promo/offer line. You MAY add a promo line ONLY if the scraped product page explicitly mentions that offer (discount %, sale name, etc.). Use exact wording/numbers from scrape only.`
    : `**PROMO LINES (CRITICAL):** The reference ad has NO separate promo/offer/discount line (no "X% OFF", no "FLASH SALE", no checkout offer under the headline). Do NOT add any promo line, sale banner, or discount text — even if the product page mentions discounts. Scraped offers are omitted unless the reference layout includes a promo slot.`;

  if (isUrlScraped && scrapedSummary && copywritingProfile && rhetoricalFigures) {
    return `**Copywriting Creation (CRITICAL — SAME TEXT ARCHITECTURE + BREVITY):**
The reference ad has a specific text stack (see Text Structure). Your output MUST use the SAME number and types of lines — brand name, sub-tagline, headline, spec line, icon labels, etc. Do NOT collapse to a simplified 2-line ad.
The reference uses SHORT, punchy text — grammatically correct, natural phrasing:
- **Line 1 (tagline/headline):** MAX ${headlineWords} words.
- **Line 2 (subhero / main copy) — SAME FUNCTION AS REFERENCE:** MAX ${mainCopyWords} words. Pattern: **${line2Pattern}**. ${copywritingProfile.functionOfLine2 ? `Reference function: "${copywritingProfile.functionOfLine2}". Device: ${copywritingProfile.linguisticDeviceLine2 || 'match reference'}.` : 'Match reference tone/device.'}${line2Pattern === 'product-helps-you' ? ' Use "[Product] helps you [outcome] & [outcome]" — NOT authority-led openers.' : ''}${line2Pattern === 'curiosity-gap' || line2Pattern === 'pain-agitation' ? ' **NO product name, NO "helps you"** — mirror curiosity/pain structure only.' : ''}
- **Spec/credentials line:** If reference has one (e.g. "22 momme. Grade 6A..."), write equivalent using ONLY scraped facts; same brevity and punctuation style.
- **Icon labels:** If reference has icon row, adapt each label (1–3 words) from scrape; same count and order.
- **Text structure from reference:** ${copywritingProfile.textStructure || 'match all visible lines'}
- **Phrasing (CRITICAL):** Mirror reference sentence STRUCTURE per line — comparative hooks stay comparative, transparency lines stay transparency, NOT generic category headlines or authority tropes. Every phrase grammatically correct in target language. Line 2 must fulfill the SAME rhetorical function as reference (e.g. "every ingredient earns its place" → parallel craft/transparency line for user's product).
Using the scraped product page information below, DISTILL the key concepts (offer, product benefit, occasion) into these two SHORT, WELL-PHRASED lines. Same rhetorical figure: "${rhetoricalFigures.primary || 'match style'}", tone: "${copywritingProfile.tone || 'professional'}", style: "${copywritingProfile.styleCategory || 'persuasive'}".

${antiVerbatimBlock}

${promoStructureBlock}

**Scraped Product Page Data — use for product facts, benefits, credentials (and promos ONLY when reference has a promo line):**
Summary: ${scrapedSummary}
${scrapedMarkdown ? `
Full page content (markdown):
---
${scrapedMarkdown.length > 8000 ? scrapedMarkdown.slice(0, 8000) + '\n\n[...]' : scrapedMarkdown}
---` : ''}

**STRICT DATA RULE:** Use scraped data for product-specific facts (materials, benefits, awards on the user's product). Do NOT add "FREE GIFTS" or claims NOT in scraped data. Never copy competitor copy or numbers from the reference. **PRICES:** Never show a dollar amount unless allowed in pricing rules — never copy competitor prices.

Create two short phrases: (1) a brief tagline (${headlineWords} words or fewer), (2) a brief main line (${mainCopyWords} words or fewer). Both must be grammatically correct and natural-sounding in the target copy language specified in adaptation context. In your final prompt, specify the exact short text to appear, e.g. centered text: "[TAGLINE]" and below "[MAIN COPY]".`;
  }

  if (copywriting && !isUrlScraped) {
    return `**Copywriting:**
Use this exact copywriting in the prompt: "${copywriting}"`;
  }

  return `**Copywriting:**
${antiVerbatimBlock}
${promoStructureBlock}
Match the reference TEXT ARCHITECTURE (all lines: brand, sub-tagline, headline, spec line, icon labels) — same count and roles. Brevity per line; grammatically correct.
- Line 1 (tagline): max ${headlineWords} words. Line 2 (main copy): max ${mainCopyWords} words.
- **Structure:** ${copywritingProfile?.textStructure || 'mirror every text block from reference'}
- **Line 2 function:** Same rhetorical device as reference — not a generic spec dump unless reference line 2 is specs.
- **Icon row:** If reference has icons, adapt all labels (1–3 words each), same count/order.
- **STRICT DATA:** Do NOT add promo/discount lines unless reference had a promo slot. Never invent or copy competitor copy from reference.
- Rhetorical figure: ${rhetoricalFigures?.primary || 'match reference'}
- Tone: ${copywritingProfile?.tone || 'professional'}
- Style: ${copywritingProfile?.styleCategory || 'persuasive'}`;
}

function buildReviewModuleInstructions(referenceReviewModule: string): string {
  return `**Social Proof / Review Module (CRITICAL — recreate but adapt content):**
The reference ad includes a customer review/testimonial/social-proof block. You MUST recreate the same module visually (same placement, card/bubble shape, background color, rounded corners, star row style, reviewer name line, "verified" badge/checkmark if present) but ADAPT its content to the user's product.
- **Do NOT copy the reference review text**. Write a new, believable testimonial that matches the reference tone/energy (including censored profanity like "f*ck" ONLY if the reference uses it), but is clearly about the user's product and its real use case.
- **STRICT DATA RULE for numbers:** If the scraped product page data includes star rating (e.g. 4.8/5), review count (e.g. 27,000+), or specific claims, use ONLY those. If not present in scraped data, do NOT invent numeric ratings/review counts. You may still show a star row as a purely visual element, but omit explicit numbers like "4.8/5" or "27,000+".
- Use the module structure described here as the blueprint:
---
${referenceReviewModule}
---`;
}

export function contextSummaryForAgent(ctx: AdaptationContext): string {
  return JSON.stringify(
    {
      rules: {
        isGraphicOnly: ctx.isGraphicOnly,
        hasPersonInReference: ctx.hasPersonInReference,
        hasIllustrativeVisual: ctx.hasIllustrativeVisual,
        enforceOneMainElement: ctx.enforceOneMainElement,
        referenceShowsPackaging: ctx.referenceShowsPackaging,
        headlineWords: ctx.headlineWords,
        mainCopyWords: ctx.mainCopyWords,
        line2Pattern: ctx.line2Pattern,
      },
      referenceVisualStyle: ctx.referenceVisualStyle,
      referenceTextLines: ctx.referenceTextLines,
      referenceLogoPlacement: ctx.referenceLogoAnalysis,
      copyLanguage: { code: ctx.copyLanguageCode, name: ctx.copyLanguageName },
      copywritingProfile: ctx.copywritingProfile,
      rhetoricalFigures: ctx.rhetoricalFigures,
      hasReferenceReviewModule: ctx.hasReferenceReviewModule,
      hasReferenceFeatureRow: ctx.hasReferenceFeatureRow,
      referenceFeatureRow: ctx.hasReferenceFeatureRow
        ? ctx.referenceFeatureRow.slice(0, 1500)
        : null,
      guidelines: ctx.guidelinesTrimmed || null,
      manualCopywriting: ctx.manualCopywriting,
      isUrlScraped: ctx.isUrlScraped,
      scrapedSummary: ctx.scrapedSummary?.slice(0, 4000) ?? null,
      scrapedMarkdown: ctx.scrapedMarkdown?.slice(0, 6000) ?? null,
      referenceTypography: ctx.referenceTypography?.slice(0, 2000) ?? null,
      typographyHierarchy: ctx.typographyHierarchy,
      referenceProductPoseAndArrangement: ctx.referenceProductPoseAndArrangement?.slice(0, 2000) ?? null,
      referencePhotoStyle: ctx.referencePhotoStyle?.slice(0, 800) ?? null,
      referenceReviewModule: ctx.hasReferenceReviewModule
        ? ctx.referenceReviewModule.slice(0, 1500)
        : null,
      referencePromptPreview: ctx.referencePrompt.slice(0, 3500),
      productName: ctx.productName,
      productDescription: ctx.productDescription,
      productUseProfile: ctx.productUseProfile,
      productCreativeProfile: ctx.productCreativeProfile,
      creativeBridge: ctx.creativeBridge,
      matchedProductVisuals: ctx.matchedProductVisuals,
      allowedPrice: ctx.allowedPrice,
      referenceHasPromoOfferLine: ctx.referenceHasPromoOfferLine,
      referenceTrustBadge: ctx.referenceTrustBadge,
      referenceVerbatimPhrases: ctx.referenceVerbatimPhrases,
      marketingAngle: ctx.marketingAngle,
      visualMetaphor: ctx.visualMetaphor,
    },
    null,
    2
  );
}
