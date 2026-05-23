export type ReferenceVisualStyle = {
  hasPerson: boolean;
  hasEnvironment: boolean;
  designType: string;
  oneHeroOnly?: boolean;
};

export type CopywritingProfile = {
  wordCount: number | null;
  headlineWordCount: number | null;
  mainCopyWordCount: number | null;
  textStructure: string | null;
  tone: string | null;
  styleCategory: string | null;
  functionOfLine2?: string | null;
  linguisticDeviceLine2?: string | null;
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
  hasPersonInReference: boolean;
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
  poseAndArrangementParagraph: string;
  peopleAndSceneRules: string;
  compositionRules: string;
  brandingNotes: string;
  iconRowNotes?: string;
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
