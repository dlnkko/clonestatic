import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import {
  buildClonePipelineCost,
  defaultReferenceLogoAnalysis,
  mergeStep2Usage,
  parseReferenceLogoPlacement,
  runStep2Adaptation,
  usageFromMetadata,
} from '@/lib/adaptation';
import {
  parseAdCopyStyle,
  parseHasPromoOfferLine,
  parseLine2CopyPattern,
  parseReferenceTextLines,
  parseReferenceTrustBadge,
  parseReferenceVisualStyle,
  parseVerbatimPhrasesFromCopyBlock,
} from '@/lib/adaptation/parse-reference-analysis';
import { getStaticAdAnalysisPrompt } from '@/lib/adaptation/old-prompts';
import type {
  MatchedProductVisual,
  ReferenceTrustBadge,
  ReferenceVisualStyle,
  Step2Usage,
} from '@/lib/adaptation/types';
import { refineProductImageKinds } from '@/lib/products/classify-images';
import { resolveCopyLanguage } from '@/lib/copy-languages';
import { GEMINI_MODEL } from '@/lib/gemini-model';
import { getProductAllowedPrice, getProductPricingInstructions, productCopywritingPayload, rowToProduct } from '@/lib/products/db';
import { allowedPriceForAds, extractPricingFromText } from '@/lib/products/extract-pricing';
import { identifyReferenceProductElements } from '@/lib/products/identify-elements';
import {
  matchProductImagesToReference,
  uploadProductImageUrlsToGemini,
} from '@/lib/products/match-images';
import type { ProductImage, ProductRecord } from '@/lib/products/types';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isInternalServerJob } from '@/lib/internal-job';
import { checkRateLimit } from '@/lib/rate-limit';
import { classifyAdVisualMode } from '@/lib/ad-visual-mode';
import { fetchImageAsDataUrl } from '@/lib/images/fetch-as-data-url';

export const maxDuration = 300;

/** En `npm run dev`, imprime el prompt completo en la terminal y lo guarda en disco. */
async function logFinalPromptForDev(finalPrompt: string) {
  if (process.env.NODE_ENV !== 'development') return;
  const sep = '='.repeat(72);
  console.log(`\n${sep}`);
  console.log('  STATIC AD — PROMPT FINAL (dev) — TEXTO COMPLETO');
  console.log(sep);
  console.log(finalPrompt);
  console.log(sep);
  console.log(`  FIN (${finalPrompt.length} caracteres)\n`);
  try {
    const filePath = path.join(process.cwd(), 'last-static-ad-prompt.txt');
    await writeFile(filePath, finalPrompt, 'utf8');
    console.log(`[dev] También guardado en: ${filePath}\n`);
  } catch (e) {
    console.warn('[dev] No se pudo escribir last-static-ad-prompt.txt:', e);
  }
}

// Helper function to get and validate API key at runtime
function getGoogleGenAI() {
  const googleApiKey = process.env.GOOGLE_GENAI_API_KEY;
  
  if (!googleApiKey) {
    throw new Error('GOOGLE_GENAI_API_KEY is not set in environment variables. Please configure it in Vercel dashboard or .env.local file.');
  }
  
  return new GoogleGenAI({ 
    apiKey: googleApiKey 
  });
}

export async function POST(request: NextRequest) {
  try {
    const internalJob = isInternalServerJob(request);

    // Check rate limit (background jobs use internal secret, not user session)
    if (!internalJob) {
      const rateLimitResult = await checkRateLimit('generateStaticAd', request);
      if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          details: rateLimitResult.error,
          limit: rateLimitResult.limit,
          remaining: rateLimitResult.remaining,
          reset: rateLimitResult.reset,
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': rateLimitResult.limit?.toString() || '',
            'X-RateLimit-Remaining': rateLimitResult.remaining?.toString() || '0',
            'X-RateLimit-Reset': rateLimitResult.reset?.toString() || '',
            'Retry-After': rateLimitResult.reset?.toString() || '3600',
          },
        }
      );
      }
    }

    // Initialize AI client at runtime
    const ai = getGoogleGenAI();
    
    const body = await request.json();
    const {
      staticAdImage,
      referenceImageUrl,
      productImage,
      productImageUrl,
      copywriting,
      isUrlScraped: isUrlScrapedParam,
      guidelines,
      copyLanguage,
      productId: productIdParam,
      internalUserId,
      productCatalogImages: productCatalogImagesParam,
      productDisplayName,
    } = body;
    const guidelinesTrimmed = typeof guidelines === 'string' ? guidelines.trim() : '';
    const resolvedCopyLang = resolveCopyLanguage(copyLanguage);
    const productId =
      typeof productIdParam === 'string' && productIdParam.trim()
        ? productIdParam.trim()
        : null;

    const preloadedCatalogImages: ProductImage[] = Array.isArray(productCatalogImagesParam)
      ? productCatalogImagesParam.filter(
          (item): item is ProductImage =>
            !!item &&
            typeof item === 'object' &&
            typeof (item as ProductImage).url === 'string' &&
            (item as ProductImage).url.startsWith('http')
        )
      : [];
    const preloadedProductName =
      typeof productDisplayName === 'string' && productDisplayName.trim()
        ? productDisplayName.trim()
        : null;

    let savedProduct: ProductRecord | null = null;
    if (productId) {
      const jobUserId =
        internalJob && typeof internalUserId === 'string' && internalUserId.trim()
          ? internalUserId.trim()
          : null;

      if (jobUserId) {
        const admin = createAdminClient();
        const { data: row, error: prodErr } = await admin
          .from('products')
          .select('*')
          .eq('id', productId)
          .eq('user_id', jobUserId)
          .single();
        if (prodErr || !row) {
          return NextResponse.json({ error: 'Product not found' }, { status: 404 });
        }
        savedProduct = rowToProduct(row as Record<string, unknown>);
      } else if (internalJob) {
        return NextResponse.json(
          { error: 'internalUserId required for background product lookup' },
          { status: 400 }
        );
      } else {
        const supabase = await createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          return NextResponse.json({ error: 'Sign in required to use saved products' }, { status: 401 });
        }
        const { data: row, error: prodErr } = await supabase
          .from('products')
          .select('*')
          .eq('id', productId)
          .eq('user_id', user.id)
          .single();
        if (prodErr || !row) {
          return NextResponse.json({ error: 'Product not found' }, { status: 404 });
        }
        savedProduct = rowToProduct(row as Record<string, unknown>);
      }
    }

    let isUrlScraped = Boolean(isUrlScrapedParam);
    let copywritingResolved: string | null =
      typeof copywriting === 'string' ? copywriting : null;

    if (savedProduct) {
      isUrlScraped = savedProduct.source === 'url' && !!savedProduct.scrape_cache;
      copywritingResolved = productCopywritingPayload(savedProduct);
    }

    let scrapedSummary: string | null = null;
    let scrapedBranding: Record<string, unknown> | null = null;
    let scrapedMarkdown: string | null = null;
    let allowedPrice: string | null = savedProduct ? getProductAllowedPrice(savedProduct) : null;
    let pricingDetail: string | null = savedProduct ? getProductPricingInstructions(savedProduct) : null;

    if (isUrlScraped && copywritingResolved) {
      try {
        const scrapedData = JSON.parse(copywritingResolved);
        scrapedSummary = scrapedData.summary || null;
        scrapedBranding = scrapedData.branding || null;
        scrapedMarkdown = scrapedData.markdown || null;
        if (!allowedPrice && scrapedData.allowedPrice) {
          allowedPrice = String(scrapedData.allowedPrice);
        }
        if (!allowedPrice && scrapedData.extractedPricing) {
          allowedPrice = allowedPriceForAds(scrapedData.extractedPricing, scrapedData.priceDisplay);
        }
      } catch {
        scrapedSummary = copywritingResolved;
        if (!allowedPrice) {
          allowedPrice = allowedPriceForAds(
            extractPricingFromText(copywritingResolved),
            null
          );
        }
      }
    }

    let staticAdImageResolved =
      typeof staticAdImage === 'string' && staticAdImage.startsWith('data:') ? staticAdImage : null;
    if (!staticAdImageResolved && typeof referenceImageUrl === 'string' && referenceImageUrl.startsWith('http')) {
      try {
        staticAdImageResolved = await fetchImageAsDataUrl(referenceImageUrl);
      } catch (e) {
        return NextResponse.json(
          { error: 'Could not load reference ad image from URL' },
          { status: 400 }
        );
      }
    }

    let productImageResolved =
      typeof productImage === 'string' && productImage.startsWith('data:') ? productImage : null;
    if (
      !savedProduct &&
      !productImageResolved &&
      typeof productImageUrl === 'string' &&
      productImageUrl.startsWith('http')
    ) {
      try {
        productImageResolved = await fetchImageAsDataUrl(productImageUrl);
      } catch (e) {
        return NextResponse.json(
          { error: 'Could not load product image from URL' },
          { status: 400 }
        );
      }
    }

    console.log('=== GENERATE STATIC AD PROMPT REQUEST ===');
    console.log('Input received:');
    console.log('- Has static ad image:', !!staticAdImageResolved);
    console.log('- Has product image:', !!productImageResolved);
    console.log('- Product id:', productId);
    console.log('- Has copywriting:', !!copywritingResolved);
    console.log('- Is URL scraped:', isUrlScraped);
    console.log('- Allowed price:', allowedPrice ?? '(none — no price in ad)');
    console.log('- Copy language:', resolvedCopyLang.code, resolvedCopyLang.name);

    if (scrapedSummary) {
      console.log('- Scraped summary length:', scrapedSummary.length);
      console.log('- Scraped markdown length:', scrapedMarkdown?.length || 0);
      console.log('- Has branding data:', !!scrapedBranding);
    } else if (copywritingResolved) {
      console.log('- Copywriting length:', copywritingResolved.length);
    }

    if (!staticAdImageResolved) {
      return NextResponse.json({ error: 'Reference static ad image is required' }, { status: 400 });
    }
    const hasCatalogImages =
      (savedProduct?.images?.length ?? 0) > 0 || preloadedCatalogImages.length > 0;
    if (!savedProduct && !productImageResolved && !hasCatalogImages) {
      return NextResponse.json(
        { error: 'Select a saved product or upload a product image' },
        { status: 400 }
      );
    }

    // Convert base64 to Buffer
    const staticAdBuffer = Buffer.from(staticAdImageResolved.split(',')[1], 'base64');
    const staticAdMime = staticAdImageResolved.split(';')[0].split(':')[1] || 'image/png';

    console.log('Uploading images to Gemini Files...');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let staticAdFile: any;
    let productFiles: { uri: string; mimeType?: string }[] = [];
    let catalogImages: ProductImage[] =
      savedProduct?.images ?? preloadedCatalogImages;
    const resolvedProductName =
      savedProduct?.name ?? preloadedProductName ?? 'Product';

    try {
      const staticAdUint8Array = new Uint8Array(staticAdBuffer);
      const staticAdBlob = new Blob([staticAdUint8Array], { type: staticAdMime });
      staticAdFile = await ai.files.upload({
        file: staticAdBlob,
        config: { mimeType: staticAdMime },
      });
      console.log('Static ad uploaded:', staticAdFile.uri);

      if (savedProduct && catalogImages.length > 0) {
        console.log(
          `Product catalog: ${catalogImages.length} URLs in DB — NOT uploaded yet. Agent will pick which to send to Gemini after Step 1.`
        );
      } else if (productImageResolved) {
        const productBuffer = Buffer.from(productImageResolved.split(',')[1], 'base64');
        const productMime = productImageResolved.split(';')[0].split(':')[1] || 'image/png';
        const productUint8Array = new Uint8Array(productBuffer);
        const productBlob = new Blob([productUint8Array], { type: productMime });
        const productFile = await ai.files.upload({
          file: productBlob,
          config: { mimeType: productMime },
        });
        if (!productFile.uri) throw new Error('Product upload missing URI');
        productFiles = [{ uri: productFile.uri, mimeType: productFile.mimeType }];
        catalogImages = [{ url: 'upload', kind: 'product' }];
        console.log('Product image uploaded:', productFile.uri);
      }
    } catch (uploadError: any) {
      console.error('Error uploading images:', uploadError);
      return NextResponse.json(
        { error: 'Error uploading images to Gemini', details: uploadError.message },
        { status: 500 }
      );
    }

    // Wait for files to be ACTIVE
    const maxWaitTime = 60000;
    const checkInterval = 2000;
    const startTime = Date.now();

    const waitForFile = async (file: any, fileName: string) => {
      if (file.state === 'ACTIVE') return file;
      
      while (file.state !== 'ACTIVE') {
        if (Date.now() - startTime > maxWaitTime) {
          throw new Error(`Timeout waiting for ${fileName} to be ready`);
        }
        await new Promise(resolve => setTimeout(resolve, checkInterval));
        
        try {
          const fileInfo = await ai.files.get({ name: fileName });
          file = fileInfo;
        } catch (err) {
          console.error(`Error checking file status for ${fileName}:`, err);
        }
      }
      return file;
    };

    try {
      const staticAdFileName = staticAdFile.name || staticAdFile.uri?.split('/').pop() || '';
      if (!staticAdFileName) {
        return NextResponse.json({ error: 'Failed to get reference file id' }, { status: 500 });
      }
      staticAdFile = await waitForFile(staticAdFile, staticAdFileName);

      if (!staticAdFile.uri) {
        return NextResponse.json(
          { error: 'Reference ad file is not ready' },
          { status: 500 }
        );
      }
    } catch (waitError: any) {
      return NextResponse.json(
        { error: 'Error waiting for files to be ready', details: waitError.message },
        { status: 500 }
      );
    }

    // Step 1: Generate the detailed prompt that would recreate the static ad image
    console.log('Step 1: Generating detailed prompt for reference static ad...');
    const staticAdAnalysisPrompt = getStaticAdAnalysisPrompt();

    let staticAdAnalysis;
    try {
      staticAdAnalysis = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: [
          {
            role: 'user',
            parts: [
              {
                fileData: {
                  fileUri: staticAdFile.uri,
                  mimeType: staticAdFile.mimeType
                }
              },
              {
                text: staticAdAnalysisPrompt
              }
            ]
          }
        ]
      });
    } catch (analysisError: any) {
      console.error('Error analyzing static ad:', analysisError);
      return NextResponse.json(
        { error: 'Error analyzing static ad', details: analysisError.message },
        { status: 500 }
      );
    }

        // Extract reference prompt, typography, visual style, copywriting analysis, and review/social proof module
    let analysisText = '';
    let referencePrompt = '';
    let referenceTypography = '';
    let referenceProductPoseAndArrangement = '';
    let referenceReviewModule = '';
    let hasReferenceReviewModule = false;
    let referenceFeatureRow = '';
    let hasReferenceFeatureRow = false;
    let referenceVisualStyle: ReferenceVisualStyle | null = null;
    let referenceLogoAnalysis = defaultReferenceLogoAnalysis();
    let copywritingProfile = null;
    let rhetoricalFigures = null;
    let referenceHasPromoOfferLine = false;
    let referenceTrustBadge: ReferenceTrustBadge = {
      present: false,
      placement: '',
      description: '',
    };
    let referenceVerbatimPhrases: string[] = [];
    let referenceTextLayoutBlock = '';
    let referenceComparisonModule = '';
    let hasReferenceComparisonModule = false;
    let step1Usage: Step2Usage | null = null;
    const productMatchingUsages: Step2Usage[] = [];
    try {
      if (staticAdAnalysis.candidates && staticAdAnalysis.candidates[0]?.content?.parts) {
        analysisText = staticAdAnalysis.candidates[0].content.parts
          .map((part: any) => part.text || '')
          .join('');

        console.log('\n=== STEP 1 OUTPUT: REFERENCE AD PROMPT GENERATED ===');
        console.log('Full analysis:', analysisText);

        // Extract typography from reference ad
        const typographyMatch = analysisText.match(/\*\*TYPOGRAPHY \(REFERENCE AD\):\*\*\s*([\s\S]*?)(?=\*\*TEXT LAYOUT|\*\*BEFORE \/ AFTER|\*\*VISUAL STYLE|\*\*BRAND|\*\*COPYWRITING ANALYSIS:\*\*|\*\*REFERENCE AD PROMPT:\*\*|$)/i);
        if (typographyMatch) {
          referenceTypography = typographyMatch[1].trim();
          console.log('\n=== REFERENCE AD TYPOGRAPHY EXTRACTED ===');
          console.log('Typography:', referenceTypography.substring(0, 300) + (referenceTypography.length > 300 ? '...' : ''));
        }

        const textLayoutMatch = analysisText.match(
          /\*\*TEXT LAYOUT \(REFERENCE AD\):\*\*\s*([\s\S]*?)(?=\*\*BEFORE \/ AFTER|\*\*VISUAL STYLE|\*\*BRAND|\*\*COPYWRITING ANALYSIS:\*\*|\*\*REFERENCE AD PROMPT:\*\*|$)/i
        );
        if (textLayoutMatch) {
          referenceTextLayoutBlock = textLayoutMatch[1].trim();
          console.log('\n=== REFERENCE TEXT LAYOUT EXTRACTED ===', referenceTextLayoutBlock.substring(0, 200));
        }

        const comparisonMatch = analysisText.match(
          /\*\*BEFORE \/ AFTER COMPARISON \(REFERENCE AD\):\*\*\s*([\s\S]*?)(?=\*\*VISUAL STYLE|\*\*BRAND|\*\*COPYWRITING ANALYSIS:\*\*|\*\*PROMO|\*\*TRUST BADGE|\*\*ICON \/ FEATURE|\*\*SOCIAL PROOF|\*\*PRODUCT POSE|\*\*REFERENCE AD PROMPT:\*\*|$)/i
        );
        if (comparisonMatch) {
          referenceComparisonModule = comparisonMatch[1].trim();
          hasReferenceComparisonModule =
            referenceComparisonModule.length > 0 && /Present:\s*yes/i.test(referenceComparisonModule);
          console.log('\n=== REFERENCE BEFORE/AFTER MODULE ===', hasReferenceComparisonModule);
        }

        // Extract visual style (graphic vs person/environment) — do not add gym/person if reference is graphic-only
        const visualStyleMatch = analysisText.match(/\*\*VISUAL STYLE \(REFERENCE AD\):\*\*\s*([\s\S]*?)(?=\*\*BRAND|\*\*COPYWRITING ANALYSIS:\*\*|\*\*REFERENCE AD PROMPT:\*\*|$)/i);
        if (visualStyleMatch) {
          referenceVisualStyle = parseReferenceVisualStyle(visualStyleMatch[1]);
          console.log('\n=== REFERENCE VISUAL STYLE EXTRACTED ===', referenceVisualStyle);
        }

        const logoPlacementMatch = analysisText.match(
          /\*\*BRAND \/ LOGO PLACEMENT \(REFERENCE AD\):\*\*\s*([\s\S]*?)(?=\*\*COPYWRITING ANALYSIS:\*\*|\*\*SOCIAL PROOF|\*\*PRODUCT POSE|\*\*REFERENCE AD PROMPT:\*\*|$)/i
        );
        if (logoPlacementMatch) {
          referenceLogoAnalysis = parseReferenceLogoPlacement(logoPlacementMatch[1]);
          console.log('\n=== REFERENCE LOGO PLACEMENT EXTRACTED ===', referenceLogoAnalysis);
        }

        // Extract copywriting analysis
        const copywritingAnalysisMatch = analysisText.match(
          /\*\*COPYWRITING ANALYSIS:\*\*\s*([\s\S]*?)(?=\*\*SOCIAL PROOF|\*\*PRODUCT POSE|\*\*REFERENCE AD PROMPT:\*\*|$)/i
        );
        if (copywritingAnalysisMatch) {
          const analysisText2 = copywritingAnalysisMatch[1];
          const wordCountMatch = analysisText2.match(/Word Count:\s*(\d+)/i);
          const headlineWordsMatch = analysisText2.match(/Headline\/Tagline Word Count:\s*(\d+)/i);
          const mainCopyWordsMatch = analysisText2.match(/Main Copy Word Count:\s*(\d+)/i);
          const textStructureMatch = analysisText2.match(/Text Structure:\s*([\s\S]+?)(?=\n-|\n\*\*|$)/i);
          const rhetoricalMatch = analysisText2.match(/Rhetorical Figure:\s*(.+)/i);
          const toneMatch = analysisText2.match(/Tone:\s*(.+)/i);
          const styleMatch = analysisText2.match(/Style:\s*(.+)/i);
          const functionLine2Match = analysisText2.match(/Function of Line 2 \(CRITICAL\):\s*([\s\S]+?)(?=\n-\s*\*\*|\n\*\*|$)/i);
          const linguisticDeviceMatch = analysisText2.match(/Linguistic device of second line:\s*\[?\s*(.+?)\s*\]/i);
          const adCopyStyleMatch = analysisText2.match(/Ad copy style:\s*\[?\s*(.+?)\s*\]?/i);
          const line2PatternMatch = analysisText2.match(/Line 2 pattern:\s*\[?\s*(.+?)\s*\]?/i);
          const line2TemplateMatch = analysisText2.match(
            /Line 2 sentence template:\s*\[?\s*(.+?)\s*\]?(?=\n-\s|\n\*\*|$)/i
          );

          referenceVerbatimPhrases = parseVerbatimPhrasesFromCopyBlock(analysisText2);
          referenceHasPromoOfferLine = parseHasPromoOfferLine(analysisText);
          const refTextLines = parseReferenceTextLines(analysisText2);
          const headlineLine = refTextLines.find((l) =>
            /headline|tagline|hook|main\s*head|title/i.test(l.role)
          );
          const line2Candidate = refTextLines.find((l) =>
            /sub|secondary|body|line\s*2|support|main copy|slogan/i.test(l.role)
          ) ?? refTextLines[1];

          copywritingProfile = {
            wordCount: wordCountMatch ? parseInt(wordCountMatch[1]) : null,
            headlineWordCount: headlineWordsMatch ? parseInt(headlineWordsMatch[1]) : null,
            mainCopyWordCount: mainCopyWordsMatch ? parseInt(mainCopyWordsMatch[1]) : null,
            textStructure: textStructureMatch ? textStructureMatch[1].trim() : null,
            tone: toneMatch ? toneMatch[1].trim() : null,
            styleCategory: styleMatch ? styleMatch[1].trim() : null,
            functionOfLine2: functionLine2Match ? functionLine2Match[1].trim() : null,
            linguisticDeviceLine2: linguisticDeviceMatch ? linguisticDeviceMatch[1].trim() : null,
            adCopyStyle: adCopyStyleMatch
              ? parseAdCopyStyle(adCopyStyleMatch[1].trim())
              : null,
            line2Pattern: line2PatternMatch
              ? parseLine2CopyPattern(line2PatternMatch[1].trim())
              : null,
            line2SentenceTemplate: line2TemplateMatch ? line2TemplateMatch[1].trim() : null,
            hasPromoOfferLine: referenceHasPromoOfferLine,
            referenceHeadlineExample: headlineLine?.text ?? null,
            referenceLine2Example: line2Candidate?.text ?? null,
            referenceAllTextLines: refTextLines.length > 0 ? refTextLines : undefined,
          };

          rhetoricalFigures = {
            primary: rhetoricalMatch ? rhetoricalMatch[1].trim() : null,
          };

          console.log('\n=== COPYWRITING ANALYSIS EXTRACTED ===');
          console.log('Word Count:', copywritingProfile.wordCount);
          console.log('Headline Word Count:', copywritingProfile.headlineWordCount);
          console.log('Main Copy Word Count:', copywritingProfile.mainCopyWordCount);
          console.log('Text Structure:', copywritingProfile.textStructure);
          console.log('Rhetorical Figure:', rhetoricalFigures.primary);
          console.log('Tone:', copywritingProfile.tone);
          console.log('Style:', copywritingProfile.styleCategory);
          console.log('Function of Line 2:', (copywritingProfile as any).functionOfLine2);
          console.log('Linguistic device (line 2):', (copywritingProfile as any).linguisticDeviceLine2);
        }

        referenceTrustBadge = parseReferenceTrustBadge(analysisText);
        console.log('\n=== REFERENCE TRUST BADGE ===', referenceTrustBadge);
        console.log('\n=== REFERENCE PROMO LINE ===', referenceHasPromoOfferLine);
        console.log('\n=== VERBATIM PHRASES TO AVOID ===', referenceVerbatimPhrases);

        const featureRowMatch = analysisText.match(
          /\*\*ICON \/ FEATURE ROW \(REFERENCE AD\):\*\*\s*([\s\S]*?)(?=\*\*SOCIAL PROOF|\*\*PRODUCT POSE|\*\*REFERENCE AD PROMPT:\*\*|$)/i
        );
        if (featureRowMatch) {
          referenceFeatureRow = featureRowMatch[1].trim();
          hasReferenceFeatureRow =
            referenceFeatureRow.length > 0 && /Present:\s*yes/i.test(referenceFeatureRow);
          console.log('\n=== REFERENCE FEATURE ROW EXTRACTED ===', {
            hasReferenceFeatureRow,
            preview: referenceFeatureRow.substring(0, 300),
          });
        }

        // Extract product pose and arrangement (CRITICAL — used to place user's product in same layout)
        const productPoseMatch = analysisText.match(/\*\*PRODUCT POSE AND ARRANGEMENT \(REFERENCE AD\)[^\n]*\n([\s\S]*?)(?=\n\*\*REFERENCE AD PROMPT:\*\*|\*\*REFERENCE AD PROMPT:\*\*|$)/i);
        if (productPoseMatch) {
          referenceProductPoseAndArrangement = productPoseMatch[1].trim();
          console.log('\n=== REFERENCE PRODUCT POSE AND ARRANGEMENT EXTRACTED ===');
          console.log('Pose block length:', referenceProductPoseAndArrangement.length);
          console.log('Pose block preview:', referenceProductPoseAndArrangement.substring(0, 400) + (referenceProductPoseAndArrangement.length > 400 ? '...' : ''));
        }

        // Extract review/social proof module (if present)
        const reviewMatch = analysisText.match(/\*\*SOCIAL PROOF \/ REVIEW MODULE \(REFERENCE AD\):\*\*\s*([\s\S]*?)(?=\*\*PRODUCT POSE AND ARRANGEMENT \(REFERENCE AD\)|\*\*ICON \/ FEATURE ROW|\*\*REFERENCE AD PROMPT:\*\*|$)/i);
        if (reviewMatch) {
          referenceReviewModule = reviewMatch[1].trim();
          hasReferenceReviewModule = referenceReviewModule.length > 0 && !/no\b|none\b|not present\b/i.test(referenceReviewModule);
          console.log('\n=== REFERENCE REVIEW MODULE EXTRACTED ===');
          console.log('Has review module:', hasReferenceReviewModule);
          console.log('Review module preview:', referenceReviewModule.substring(0, 400) + (referenceReviewModule.length > 400 ? '...' : ''));
        }

        // Extract the reference ad prompt
        const referencePromptMatch = analysisText.match(/\*\*REFERENCE AD PROMPT:\*\*\s*([\s\S]*?)$/i);
        if (referencePromptMatch) {
          referencePrompt = referencePromptMatch[1].trim();
          console.log('\n=== REFERENCE AD PROMPT EXTRACTED ===');
          console.log('Prompt length:', referencePrompt.length);
          console.log('Prompt preview:', referencePrompt.substring(0, 500) + '...');
        } else {
          console.warn('⚠️  REFERENCE AD PROMPT NOT FOUND');
          // Fallback: use the full analysis text if format is different
          referencePrompt = analysisText;
        }

        step1Usage = usageFromMetadata(
          (staticAdAnalysis as { usageMetadata?: unknown }).usageMetadata as
            | Parameters<typeof usageFromMetadata>[0]
            | undefined
        );
        if (step1Usage) {
          console.log('\n=== STEP 1 TOKENS ===', step1Usage);
        }
      }
    } catch (err) {
      console.error('Error extracting analysis:', err);
    }

    // Match product images to reference visual elements (packaging + product, etc.)
    let matchedProductVisuals: MatchedProductVisual[] = [];
    let productFilesForStep2 = productFiles;

    if (catalogImages.length > 0 && catalogImages[0]?.url !== 'upload') {
      const classified = await refineProductImageKinds(ai, catalogImages, {
        needTrustBadge: referenceTrustBadge.present,
      });
      catalogImages = classified.images;
      if (classified.usage) productMatchingUsages.push(classified.usage);
      console.log(
        '\n=== PRODUCT IMAGE CLASSIFICATION ===',
        catalogImages.map((i) => ({ kind: i.kind, url: i.url.slice(0, 80) }))
      );
    }

    if (catalogImages.length > 0) {
      try {
        const identified = await identifyReferenceProductElements(
          ai,
          { uri: staticAdFile.uri!, mimeType: staticAdFile.mimeType },
          referenceVisualStyle,
          referenceProductPoseAndArrangement || referencePrompt.slice(0, 800)
        );
        if (identified.usage) productMatchingUsages.push(identified.usage);

        const matched = await matchProductImagesToReference(
          ai,
          identified.elements,
          catalogImages,
          resolvedProductName
        );
        if (matched.usage) productMatchingUsages.push(matched.usage);

        const matches = matched.matches;
        matchedProductVisuals = matches.map((m) => ({
          role: m.role,
          url: m.url,
          description: m.description,
        }));
        console.log('\n=== PRODUCT IMAGE MATCHING ===', matchedProductVisuals);

        const uniqueUrls = [...new Set(matches.map((m) => m.url))].filter((u) =>
          u.startsWith('http')
        );
        if (uniqueUrls.length > 0) {
          console.log(
            `\n=== UPLOAD TO GEMINI: ${uniqueUrls.length} agent-selected image(s) (of ${catalogImages.length} in catalog) ===`
          );
          productFilesForStep2 = await uploadProductImageUrlsToGemini(ai, uniqueUrls);
        }
      } catch (matchErr) {
        console.warn('Product image matching failed, fallback to primary only:', matchErr);
        const primary =
          savedProduct?.primary_image_url ||
          catalogImages.find((i) => i.url.startsWith('http'))?.url;
        if (primary) {
          matchedProductVisuals = [
            {
              role: 'product',
              url: primary,
              description: 'Primary product image (matching failed)',
            },
          ];
          productFilesForStep2 = await uploadProductImageUrlsToGemini(ai, [primary]);
        }
      }
    }

    if (productFilesForStep2.length === 0 && catalogImages.length > 0) {
      const primary =
        savedProduct?.primary_image_url ||
        catalogImages.find((i) => i.url.startsWith('http'))?.url;
      if (primary) {
        console.log('Retrying product upload with primary image only');
        productFilesForStep2 = await uploadProductImageUrlsToGemini(ai, [primary]);
        if (productFilesForStep2.length > 0 && matchedProductVisuals.length === 0) {
          matchedProductVisuals = [
            {
              role: 'product',
              url: primary,
              description: 'Primary product image',
            },
          ];
        }
      }
    }

    if (productFilesForStep2.length === 0 && !productImage) {
      return NextResponse.json(
        {
          error:
            'Could not download product images from the store (connection reset or CDN blocked). Try re-saving the product in Products.',
        },
        { status: 502 }
      );
    }

    // Step 2: Adapt the reference prompt for the new product (agent or legacy)
    console.log('\n=== STEP 2: ADAPTING REFERENCE PROMPT FOR NEW PRODUCT ===');
    console.log('- Reference prompt length:', referencePrompt.length);
    console.log('- Product images for step 2:', productFilesForStep2.length);

    let step2Result;
    try {
      step2Result = await runStep2Adaptation(
        ai,
        {
          referencePrompt,
          referenceTypography,
          referenceProductPoseAndArrangement,
          referenceReviewModule,
          hasReferenceReviewModule,
          referenceFeatureRow,
          hasReferenceFeatureRow,
          referenceLogoAnalysis,
          referenceVisualStyle,
          copywritingProfile,
          rhetoricalFigures,
          scrapedSummary,
          scrapedBranding,
          scrapedMarkdown,
          isUrlScraped,
          copywriting: copywritingResolved,
          guidelinesTrimmed,
          copyLanguage: resolvedCopyLang.code,
          matchedProductVisuals,
          productName: savedProduct?.name ?? null,
          allowedPrice,
          pricingDetail,
          referenceHasPromoOfferLine,
          referenceTrustBadge,
          referenceVerbatimPhrases,
          referenceTextLayoutBlock,
          referenceComparisonModule,
          hasReferenceComparisonModule,
        },
        productFilesForStep2
      );
    } catch (adaptationError: unknown) {
      const message =
        adaptationError instanceof Error ? adaptationError.message : 'Unknown error';
      console.error('Error adapting prompt:', adaptationError);
      return NextResponse.json(
        { error: 'Error adapting prompt for product', details: message },
        { status: 500 }
      );
    }

    const finalPrompt = step2Result.finalPrompt;
    const step2Usage = step2Result.usage;

    if (!finalPrompt) {
      return NextResponse.json(
        { error: 'Failed to generate prompt' },
        { status: 500 }
      );
    }

    await logFinalPromptForDev(finalPrompt);

    const productMatchingUsage = mergeStep2Usage(productMatchingUsages);

    const pipelineCost = buildClonePipelineCost({
      model: GEMINI_MODEL,
      step1Usage,
      productMatchingUsage,
      step2Usage,
      step2Mode: step2Result.mode,
    });

    console.log('\n=== GEMINI CLONE PIPELINE COST (USD) ===');
    console.log('Model:', pipelineCost.model);
    console.log(
      'Rates:',
      `$${pipelineCost.rates.inputPerMillionUsd}/M in, $${pipelineCost.rates.outputPerMillionUsd}/M out`
    );
    console.log(
      'Step 1:',
      pipelineCost.breakdown.step1.cost?.totalCostFormatted ?? 'n/a',
      pipelineCost.breakdown.step1.usage
    );
    console.log(
      'Product matching:',
      pipelineCost.breakdown.productMatching.cost?.totalCostFormatted ?? 'n/a',
      pipelineCost.breakdown.productMatching.usage
    );
    console.log(
      'Step 2:',
      pipelineCost.breakdown.step2.cost?.totalCostFormatted ?? 'n/a',
      `(${step2Result.mode})`,
      pipelineCost.breakdown.step2.usage
    );
    console.log(
      'TOTAL:',
      pipelineCost.total.cost?.totalCostFormatted ?? 'n/a',
      pipelineCost.total.usage
    );
    const adVisualMode = classifyAdVisualMode({
      referenceVisualStyle,
      hasReferenceFeatureRow,
      referencePrompt,
    });
    console.log('\n=== AD VISUAL MODE ===', adVisualMode);

    console.log('\n=== REQUEST COMPLETE ===\n');

    return NextResponse.json({
      success: true,
      prompt: finalPrompt,
      adVisualMode,
      cost: pipelineCost,
      // Include intermediate outputs for debugging
      debug: {
        step2Mode: step2Result.mode,
        adaptationAgent: step2Result.agentDebug ?? null,
        copywritingProfile: copywritingProfile,
        rhetoricalFigures: rhetoricalFigures,
        referenceVisualStyle: referenceVisualStyle,
        referenceLogoPlacement: referenceLogoAnalysis,
        copyLanguage: resolvedCopyLang.code,
        referenceTypography: referenceTypography ? referenceTypography.substring(0, 500) + '...' : null,
        referenceProductPoseAndArrangement: referenceProductPoseAndArrangement ? referenceProductPoseAndArrangement.substring(0, 500) + (referenceProductPoseAndArrangement.length > 500 ? '...' : '') : null,
        referencePrompt: referencePrompt.substring(0, 1000) + '...',
        scrapedSummary: scrapedSummary ? scrapedSummary.substring(0, 500) + '...' : null,
        scrapedBranding: scrapedBranding
          ? {
              colors: (scrapedBranding as Record<string, unknown>).colors || null,
              typography: (scrapedBranding as Record<string, unknown>).typography || null,
              fonts: (scrapedBranding as Record<string, unknown>).fonts || null,
            }
          : null,
        matchedProductVisuals,
        productId: savedProduct?.id ?? null,
      },
      matchedProductImageUrls: matchedProductVisuals.map((m) => m.url),
      usage: {
        step1: step1Usage,
        productMatching: productMatchingUsage,
        step2: step2Usage,
        total: pipelineCost.total.usage,
      },
    });

  } catch (error: any) {
    console.error('Error generating static ad prompt:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}

