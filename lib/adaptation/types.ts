export type ReferenceVisualStyle = {
  /** Real photographic human model — NOT illustrations/diagrams */
  hasPerson: boolean;
  hasIllustrationOrDiagram: boolean;
  visualMedium: 'photo' | 'illustration' | 'diagram' | '3d-render' | 'mixed' | 'product-graphic-only';
  illustrationNotes?: string;
  hasEnvironment: boolean;
  designType: string;
  oneHeroOnly?: boolean;
};

export type TypographyHierarchyLine = {
  role: string;
  sizeTier: string;
  weight?: string;
};

/** Top text block layout from reference (stacked, alignment, tiers). */
export type ReferenceTextLayout = {
  alignment: 'center' | 'left' | 'right' | 'mixed';
  stackDirection: 'vertical' | 'horizontal' | 'mixed';
  hasEyebrow: boolean;
  eyebrowStyle: string | null;
  heroStyle: string | null;
  subheroStyle: string | null;
  layoutNotes: string;
};

/** Before/after comparison module in reference ad. */
export type ReferenceComparisonModule = {
  present: boolean;
  layoutType: string;
  subjectFraming: string;
  labelStyle: string;
  transitionStyle: string;
  placement: string;
  notes: string;
};

/** Relative text sizes from reference ad (headline vs subheadline vs footer). */
export type ReferenceTypographyHierarchy = {
  headlineTier: string;
  subheadlineTier: string;
  sizeRatioHeadlineToSub: string | null;
  hierarchySummary: string;
  lines: TypographyHierarchyLine[];
};

/** Rhetorical pattern of the subhero / line-2 under the headline. */
export type Line2CopyPattern =
  | 'product-helps-you'
  | 'curiosity-gap'
  | 'pain-agitation'
  | 'authority-credential'
  | 'ingredient-spec'
  | 'transparency-craft'
  | 'wordplay'
  | 'benefit-bullet-list'
  | 'other';

/** What the reference ad is really doing (beyond surface layout). */
export type MarketingFunnelStage =
  | 'curiosity-gap'
  | 'product-led'
  | 'direct-offer'
  | 'social-proof'
  | 'other';

export type MarketingAngleProfile = {
  realTopic: string;
  targetAudience: string;
  painPoint: string;
  funnelStage: MarketingFunnelStage;
  productMentionedInCopy: boolean;
  headlineRhetoricalRole: string;
  copyExtrapolationNotes: string;
};

export type VisualMetaphorProfile = {
  present: boolean;
  visualSubject: string;
  symbolicMeaning: string;
  connectionToHeadline: string;
  adaptationGuidance: string;
};

export type AdCopyStyle =
  | 'dtc-benefit-led'
  | 'authority-led'
  | 'spec-led'
  | 'promo-led'
  | 'other';

export type CopywritingProfile = {
  wordCount: number | null;
  headlineWordCount: number | null;
  mainCopyWordCount: number | null;
  textStructure: string | null;
  tone: string | null;
  styleCategory: string | null;
  functionOfLine2?: string | null;
  linguisticDeviceLine2?: string | null;
  /** From Step 1 or inferred — drives subhero adaptation rules */
  adCopyStyle?: AdCopyStyle | null;
  line2Pattern?: Line2CopyPattern | null;
  line2SentenceTemplate?: string | null;
  hasPromoOfferLine?: boolean;
  /** Verbatim reference lines for rhetorical mirroring (not to reuse verbatim in output) */
  referenceHeadlineExample?: string | null;
  referenceLine2Example?: string | null;
  referenceAllTextLines?: { role: string; text: string }[];
  /** Step 1: whether competitor product/brand name appears in ad text */
  productMentionedInCopy?: boolean | null;
};

export type ReferenceTrustBadge = {
  present: boolean;
  placement: string;
  description: string;
};

export type AdaptedTextLine = {
  role: string;
  text: string;
};

export type AdaptedFeatureIcon = {
  iconDescription: string;
  label: string;
};

export type RhetoricalFigures = {
  primary: string | null;
};

/** How brand identity appears in the REFERENCE ad layout (not scraped page). */
export type ReferenceLogoPlacement =
  | 'copy-only'
  | 'logo-on-product-only'
  | 'standalone-logo'
  | 'standalone-and-product'
  | 'unknown';

export type ReferenceLogoAnalysis = {
  placement: ReferenceLogoPlacement;
  standaloneLogoInLayout: boolean;
  logoOnProductOnly: boolean;
  notes: string;
};

export type MatchedProductVisual = {
  role: string;
  url: string;
  description: string;
};

export type AdaptationContext = {
  referencePrompt: string;
  referenceTypography: string;
  typographyHierarchy: ReferenceTypographyHierarchy | null;
  referenceTextLayout: ReferenceTextLayout | null;
  referenceComparisonModule: string;
  referenceComparisonParsed: ReferenceComparisonModule | null;
  hasReferenceComparisonModule: boolean;
  referenceProductPoseAndArrangement: string;
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
  manualCopywriting: string | null;
  guidelinesTrimmed: string;
  isGraphicOnly: boolean;
  oneHeroOnly: boolean;
  guidelinesAskSingleHero: boolean;
  enforceOneMainElement: boolean;
  /** Reference shows retail packaging (bottle, box, pouch) as its own layout element */
  referenceShowsPackaging: boolean;
  hasPersonInReference: boolean;
  hasIllustrativeVisual: boolean;
  referenceTextLines: { role: string; text: string }[];
  line2Pattern: Line2CopyPattern;
  headlineWords: number;
  mainCopyWords: number;
  brandingIntegration: string;
  copywritingInstructions: string;
  reviewModuleInstructions: string;
  copyLanguageCode: string;
  copyLanguageName: string;
  copyLanguageInstruction: string;
  matchedProductVisuals: MatchedProductVisual[];
  productName: string | null;
  allowedPrice: string | null;
  pricingInstructions: string;
  referenceHasPromoOfferLine: boolean;
  referenceTrustBadge: ReferenceTrustBadge;
  referenceVerbatimPhrases: string[];
  trustBadgeInstructions: string;
  marketingAngle: MarketingAngleProfile | null;
  visualMetaphor: VisualMetaphorProfile | null;
};

export type CopyAdaptationResult = {
  tagline: string;
  mainLine: string;
  brandName?: string | null;
  brandSubtagline?: string | null;
  specLine?: string | null;
  textLines?: AdaptedTextLine[];
  featureIcons?: AdaptedFeatureIcon[];
  promoClaimsUsed: string[];
  promoClaimsOmitted: string[];
  reviewText?: string | null;
  reviewNumericClaims?: string | null;
  notes?: string;
};

export type VisualAdaptationResult = {
  productType: string;
  productDescription: string;
  visualMediumNotes?: string;
  poseAndArrangementParagraph: string;
  peopleAndSceneRules: string;
  compositionRules: string;
  brandingNotes: string;
  iconRowNotes?: string;
  trustBadgeNotes?: string;
};

export type QaResult = {
  pass: boolean;
  issues: string[];
};

export type Step2Usage = {
  promptTokenCount: number;
  candidatesTokenCount: number;
  totalTokenCount: number;
};

export type Step2Cost = {
  inputCost: number;
  outputCost: number;
  totalCost: number;
  inputCostFormatted: string;
  outputCostFormatted: string;
  totalCostFormatted: string;
};

export type PipelineStepCostEntry = {
  label: string;
  usage: Step2Usage | null;
  cost: Step2Cost | null;
  mode?: 'agent' | 'legacy';
};

/** Full Gemini USD cost for one clone (prompting only, no image gen). */
export type ClonePipelineCost = {
  model: string;
  rates: {
    inputPerMillionUsd: number;
    outputPerMillionUsd: number;
    pricingUrl: string;
  };
  breakdown: {
    step1: PipelineStepCostEntry;
    productMatching: PipelineStepCostEntry;
    step2: PipelineStepCostEntry;
  };
  total: {
    usage: Step2Usage | null;
    cost: Step2Cost | null;
  };
  /** Shorthand — same as breakdown.*.cost */
  step1: Step2Cost | null;
  step2: Step2Cost | null;
  productMatching: Step2Cost | null;
};

export type Step2Result = {
  finalPrompt: string;
  usage: Step2Usage | null;
  cost: Step2Cost | null;
  mode: 'agent' | 'legacy';
  agentDebug?: {
    copy?: CopyAdaptationResult;
    visual?: VisualAdaptationResult;
    qaPass?: boolean;
    qaIssues?: string[];
    retried?: boolean;
  };
};
