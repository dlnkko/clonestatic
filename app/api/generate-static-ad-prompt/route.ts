import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import {
  defaultReferenceLogoAnalysis,
  parseReferenceLogoPlacement,
  runStep2Adaptation,
} from '@/lib/adaptation';
import { getStaticAdAnalysisPrompt } from '@/lib/adaptation/old-prompts';
import type { MatchedProductVisual } from '@/lib/adaptation/types';
import { resolveCopyLanguage } from '@/lib/copy-languages';
import { GEMINI_MODEL } from '@/lib/gemini-model';
import { getProductAllowedPrice, productCopywritingPayload, rowToProduct } from '@/lib/products/db';
import { allowedPriceForAds, extractPricingFromText } from '@/lib/products/extract-pricing';
import { identifyReferenceProductElements } from '@/lib/products/identify-elements';
import {
  matchProductImagesToReference,
  uploadProductImageUrlsToGemini,
} from '@/lib/products/match-images';
import type { ProductImage, ProductRecord } from '@/lib/products/types';
import { createClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/rate-limit';
import { classifyAdVisualMode } from '@/lib/ad-visual-mode';

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
    // Check rate limit
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

    // Initialize AI client at runtime
    const ai = getGoogleGenAI();
    
    const body = await request.json();
    const {
      staticAdImage,
      productImage,
      copywriting,
      isUrlScraped: isUrlScrapedParam,
      guidelines,
      copyLanguage,
      productId: productIdParam,
    } = body;
    const guidelinesTrimmed = typeof guidelines === 'string' ? guidelines.trim() : '';
    const resolvedCopyLang = resolveCopyLanguage(copyLanguage);
    const productId =
      typeof productIdParam === 'string' && productIdParam.trim()
        ? productIdParam.trim()
        : null;

    let savedProduct: ProductRecord | null = null;
    if (productId) {
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

    console.log('=== GENERATE STATIC AD PROMPT REQUEST ===');
    console.log('Input received:');
    console.log('- Has static ad image:', !!staticAdImage);
    console.log('- Has product image:', !!productImage);
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

    if (!staticAdImage) {
      return NextResponse.json({ error: 'Reference static ad image is required' }, { status: 400 });
    }
    if (!savedProduct && !productImage) {
      return NextResponse.json(
        { error: 'Select a saved product or upload a product image' },
        { status: 400 }
      );
    }

    // Convert base64 to Buffer
    const staticAdBuffer = Buffer.from(staticAdImage.split(',')[1], 'base64');
    const staticAdMime = staticAdImage.split(';')[0].split(':')[1] || 'image/png';

    console.log('Uploading images to Gemini Files...');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let staticAdFile: any;
    let productFiles: { uri: string; mimeType?: string }[] = [];
    let catalogImages: ProductImage[] = savedProduct?.images ?? [];

    try {
      const staticAdUint8Array = new Uint8Array(staticAdBuffer);
      const staticAdBlob = new Blob([staticAdUint8Array], { type: staticAdMime });
      staticAdFile = await ai.files.upload({
        file: staticAdBlob,
        config: { mimeType: staticAdMime },
      });
      console.log('Static ad uploaded:', staticAdFile.uri);

      if (savedProduct && catalogImages.length > 0) {
        productFiles = await uploadProductImageUrlsToGemini(
          ai,
          catalogImages.map((i) => i.url)
        );
        console.log('Product catalog uploaded:', productFiles.length);
      } else if (productImage) {
        const productBuffer = Buffer.from(productImage.split(',')[1], 'base64');
        const productMime = productImage.split(';')[0].split(':')[1] || 'image/png';
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

      if (!staticAdFile.uri || productFiles.length === 0) {
        return NextResponse.json(
          { error: 'Files are missing required URI properties' },
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
    let referenceVisualStyle: { hasPerson: boolean; hasEnvironment: boolean; designType: string; oneHeroOnly?: boolean } | null = null;
    let referenceLogoAnalysis = defaultReferenceLogoAnalysis();
    let copywritingProfile = null;
    let rhetoricalFigures = null;
    let step1Usage = null;
    let step1Cost = null;
    try {
      if (staticAdAnalysis.candidates && staticAdAnalysis.candidates[0]?.content?.parts) {
        analysisText = staticAdAnalysis.candidates[0].content.parts
          .map((part: any) => part.text || '')
          .join('');

        console.log('\n=== STEP 1 OUTPUT: REFERENCE AD PROMPT GENERATED ===');
        console.log('Full analysis:', analysisText);

        // Extract typography from reference ad
        const typographyMatch = analysisText.match(/\*\*TYPOGRAPHY \(REFERENCE AD\):\*\*\s*([\s\S]*?)(?=\*\*VISUAL STYLE|\*\*BRAND|\*\*COPYWRITING ANALYSIS:\*\*|\*\*REFERENCE AD PROMPT:\*\*|$)/i);
        if (typographyMatch) {
          referenceTypography = typographyMatch[1].trim();
          console.log('\n=== REFERENCE AD TYPOGRAPHY EXTRACTED ===');
          console.log('Typography:', referenceTypography.substring(0, 300) + (referenceTypography.length > 300 ? '...' : ''));
        }

        // Extract visual style (graphic vs person/environment) — do not add gym/person if reference is graphic-only
        const visualStyleMatch = analysisText.match(/\*\*VISUAL STYLE \(REFERENCE AD\):\*\*\s*([\s\S]*?)(?=\*\*BRAND|\*\*COPYWRITING ANALYSIS:\*\*|\*\*REFERENCE AD PROMPT:\*\*|$)/i);
        if (visualStyleMatch) {
          const vsText = visualStyleMatch[1];
          const hasPerson = /Has person\/character:\s*yes/i.test(vsText);
          const hasEnv = /Has gym, sport setting, or location environment:\s*yes/i.test(vsText);
          const designMatch = vsText.match(/Design type:\s*(graphic-product-only|has-person|has-environment)/i);
          const mainElementsMatch = vsText.match(/Main elements:\s*(one-hero-only|multiple)/i);
          const oneHeroOnly = mainElementsMatch ? mainElementsMatch[1].toLowerCase() === 'one-hero-only' : false;
          referenceVisualStyle = {
            hasPerson,
            hasEnvironment: hasEnv,
            designType: designMatch ? designMatch[1].toLowerCase() : (hasPerson || hasEnv ? 'has-person-or-environment' : 'graphic-product-only'),
            oneHeroOnly,
          };
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

          copywritingProfile = {
            wordCount: wordCountMatch ? parseInt(wordCountMatch[1]) : null,
            headlineWordCount: headlineWordsMatch ? parseInt(headlineWordsMatch[1]) : null,
            mainCopyWordCount: mainCopyWordsMatch ? parseInt(mainCopyWordsMatch[1]) : null,
            textStructure: textStructureMatch ? textStructureMatch[1].trim() : null,
            tone: toneMatch ? toneMatch[1].trim() : null,
            styleCategory: styleMatch ? styleMatch[1].trim() : null,
            functionOfLine2: functionLine2Match ? functionLine2Match[1].trim() : null,
            linguisticDeviceLine2: linguisticDeviceMatch ? linguisticDeviceMatch[1].trim() : null,
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

        // Extract usage info for Step 1
        const step1UsageMetadata = (staticAdAnalysis as any).usageMetadata;
        if (step1UsageMetadata) {
          const promptTokens = step1UsageMetadata.promptTokenCount || 0;
          const candidatesTokens = step1UsageMetadata.candidatesTokenCount || 0;
          const totalTokens = step1UsageMetadata.totalTokenCount || (promptTokens + candidatesTokens);
          
          const inputCostPerMillion = 0.5;
          const outputCostPerMillion = 3.0;
          const inputCost = (promptTokens / 1_000_000) * inputCostPerMillion;
          const outputCost = (candidatesTokens / 1_000_000) * outputCostPerMillion;
          const totalStep1Cost = inputCost + outputCost;

          step1Usage = {
            promptTokenCount: promptTokens,
            candidatesTokenCount: candidatesTokens,
            totalTokenCount: totalTokens
          };

          step1Cost = {
            inputCost,
            outputCost,
            totalCost: totalStep1Cost,
            inputCostFormatted: `$${inputCost.toFixed(6)}`,
            outputCostFormatted: `$${outputCost.toFixed(6)}`,
            totalCostFormatted: `$${totalStep1Cost.toFixed(6)}`
          };

          console.log('\n=== STEP 1 COST ===');
          console.log('Tokens:', step1Usage);
          console.log('Cost:', step1Cost);
        }
      }
    } catch (err) {
      console.error('Error extracting analysis:', err);
    }

    // Match product images to reference visual elements (packaging + product, etc.)
    let matchedProductVisuals: MatchedProductVisual[] = [];
    let productFilesForStep2 = productFiles;

    if (catalogImages.length > 0) {
      try {
        const refElements = await identifyReferenceProductElements(
          ai,
          { uri: staticAdFile.uri!, mimeType: staticAdFile.mimeType },
          referenceVisualStyle,
          referenceProductPoseAndArrangement || referencePrompt.slice(0, 800)
        );
        const matches = await matchProductImagesToReference(
          ai,
          refElements,
          catalogImages,
          savedProduct?.name || 'Product'
        );
        matchedProductVisuals = matches.map((m) => ({
          role: m.role,
          url: m.url,
          description: m.description,
        }));
        console.log('\n=== PRODUCT IMAGE MATCHING ===', matchedProductVisuals);

        if (matches.length > 0) {
          const uniqueUrls = [...new Set(matches.map((m) => m.url))];
          productFilesForStep2 = await uploadProductImageUrlsToGemini(ai, uniqueUrls);
        }
      } catch (matchErr) {
        console.warn('Product image matching failed, using all catalog images:', matchErr);
        matchedProductVisuals = catalogImages.slice(0, 3).map((img, i) => ({
          role: (img.kind || 'product') as MatchedProductVisual['role'],
          url: img.url,
          description: img.alt || `Image ${i + 1}`,
        }));
      }
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
    const step2Cost = step2Result.cost;

    if (!finalPrompt) {
      return NextResponse.json(
        { error: 'Failed to generate prompt' },
        { status: 500 }
      );
    }

    await logFinalPromptForDev(finalPrompt);

    if (step2Cost) {
      console.log('\n=== STEP 2 COST ===', step2Result.mode);
      console.log('Tokens:', step2Usage);
      console.log('Cost:', step2Cost);
    }

    // Calculate total costs
    const totalUsage = {
      step1: step1Usage,
      step2: step2Usage,
      total: {
        promptTokenCount: (step1Usage?.promptTokenCount || 0) + (step2Usage?.promptTokenCount || 0),
        candidatesTokenCount: (step1Usage?.candidatesTokenCount || 0) + (step2Usage?.candidatesTokenCount || 0),
        totalTokenCount: (step1Usage?.totalTokenCount || 0) + (step2Usage?.totalTokenCount || 0),
      }
    };

    const totalCost = {
      step1: step1Cost,
      step2: step2Cost,
      total: {
        inputCost: (step1Cost?.inputCost || 0) + (step2Cost?.inputCost || 0),
        outputCost: (step1Cost?.outputCost || 0) + (step2Cost?.outputCost || 0),
        totalCost: (step1Cost?.totalCost || 0) + (step2Cost?.totalCost || 0),
        inputCostFormatted: `$${((step1Cost?.inputCost || 0) + (step2Cost?.inputCost || 0)).toFixed(6)}`,
        outputCostFormatted: `$${((step1Cost?.outputCost || 0) + (step2Cost?.outputCost || 0)).toFixed(6)}`,
        totalCostFormatted: `$${((step1Cost?.totalCost || 0) + (step2Cost?.totalCost || 0)).toFixed(6)}`
      }
    };

    console.log('\n=== TOTAL COST SUMMARY ===');
    console.log(JSON.stringify(totalCost, null, 2));
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
      cost: totalCost,
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
        step2: step2Usage,
        total: totalUsage.total
      }
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

