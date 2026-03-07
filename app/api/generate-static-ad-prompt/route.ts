import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { checkRateLimit } from '@/lib/rate-limit';

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
    const { staticAdImage, productImage, copywriting, isUrlScraped, guidelines } = body;
    const guidelinesTrimmed = typeof guidelines === 'string' ? guidelines.trim() : '';

    // Log input data for debugging
    console.log('=== GENERATE STATIC AD PROMPT REQUEST ===');
    console.log('Input received:');
    console.log('- Has static ad image:', !!staticAdImage);
    console.log('- Has product image:', !!productImage);
    console.log('- Has copywriting:', !!copywriting);
    console.log('- Is URL scraped:', isUrlScraped);
    
    // Parse scraped data if it's a JSON string
    let scrapedSummary = null;
    let scrapedBranding = null;
    if (isUrlScraped && copywriting) {
      try {
        const scrapedData = JSON.parse(copywriting);
        scrapedSummary = scrapedData.summary || null;
        scrapedBranding = scrapedData.branding || null;
        console.log('- Scraped summary length:', scrapedSummary?.length || 0);
        console.log('- Has branding data:', !!scrapedBranding);
        if (scrapedBranding) {
          console.log('- Branding colors:', scrapedBranding.colors ? Object.keys(scrapedBranding.colors) : 'none');
          console.log('- Branding typography:', scrapedBranding.typography ? 'yes' : 'no');
        }
      } catch (e) {
        // If not JSON, treat as plain summary
        scrapedSummary = copywriting;
        console.log('- Copywriting length:', copywriting.length);
        console.log('- Copywriting preview:', copywriting.substring(0, 200) + '...');
      }
    } else if (copywriting) {
      console.log('- Copywriting length:', copywriting.length);
      console.log('- Copywriting preview:', copywriting.substring(0, 200) + '...');
    }

    if (!staticAdImage || !productImage) {
      return NextResponse.json(
        { error: 'Both static ad image and product image are required' },
        { status: 400 }
      );
    }

    // Convert base64 to Buffer
    const staticAdBuffer = Buffer.from(staticAdImage.split(',')[1], 'base64');
    const productBuffer = Buffer.from(productImage.split(',')[1], 'base64');

    // Determine MIME types
    const staticAdMime = staticAdImage.split(';')[0].split(':')[1] || 'image/png';
    const productMime = productImage.split(';')[0].split(':')[1] || 'image/png';

    // Upload images to Gemini Files
    console.log('Uploading images to Gemini Files...');
    let staticAdFile, productFile;

    try {
      // Upload static ad image
      const staticAdUint8Array = new Uint8Array(staticAdBuffer);
      const staticAdBlob = new Blob([staticAdUint8Array], { type: staticAdMime });
      staticAdFile = await ai.files.upload({
        file: staticAdBlob,
        config: { mimeType: staticAdMime }
      });
      console.log('Static ad uploaded:', staticAdFile.uri);

      // Upload product image
      const productUint8Array = new Uint8Array(productBuffer);
      const productBlob = new Blob([productUint8Array], { type: productMime });
      productFile = await ai.files.upload({
        file: productBlob,
        config: { mimeType: productMime }
      });
      console.log('Product image uploaded:', productFile.uri);
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
      const productFileName = productFile.name || productFile.uri?.split('/').pop() || '';
      
      if (!staticAdFileName || !productFileName) {
        return NextResponse.json(
          { error: 'Failed to get file identifiers' },
          { status: 500 }
        );
      }
      
      staticAdFile = await waitForFile(staticAdFile, staticAdFileName);
      productFile = await waitForFile(productFile, productFileName);
      
      // Verify files have required properties
      if (!staticAdFile.uri || !productFile.uri) {
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
    const staticAdAnalysisPrompt = `You are an expert prompt engineer for AI image generation. Analyze the provided static ad image and generate a COMPREHENSIVE, DETAILED prompt that would recreate this EXACT image.

Your task:

1. **Identify Copywriting Characteristics and BREVITY** (for later adaptation):
    - **Text structure**: How many lines of text? (e.g. one tagline + one main line). Count words PER LINE: tagline/headline = X words, main copy/slogan = Y words. The reference ad uses SHORT, punchy text — capture this exactly.
    - Count the EXACT number of words in the main headline/tagline (first line) and in the main copy/slogan (second line or main block) separately.
    - Identify the rhetorical figure used (metaphor, personification, hyperbole, analogy, slogan, motivational, aspirational, etc.)
    - Note the tone (friendly, professional, playful, serious, etc.)
    - Note the style category (corto y persuasivo, humor, irónico, directo, emocional, etc.)

2. **Extract Typography from Reference Ad (CRITICAL for replication):**
    - Describe the typography in a dedicated section: font style/type (e.g. sans-serif bold, serif, display, script), approximate sizes (headline vs body), weights (light, regular, bold, black), text placement (top, center, overlay), alignment (left, center, right), and any effects (shadows, outlines, gradients on text, letter-spacing). This will be used to COPY the same typography in the final ad.

3. **Identify VISUAL STYLE / DESIGN TYPE** (CRITICAL — do not add people or gym if reference has none):
    - Does the reference ad show ANY person, athlete, or human? (yes/no)
    - Does the reference ad show ANY environment like gym, sport setting, or location? (yes/no)
    - **Number of main visual elements:** Does the reference have ONE single hero element (e.g. one cookie, one product item only) or multiple (e.g. product + packaging, two items)? Answer: "one-hero-only" if there is exactly one main focal subject; "multiple" if there are two or more distinct main elements (e.g. packaging + item). This will be used to avoid adding packaging when the reference has only one hero.
    - If NO person and NO gym/environment: the ad is "graphic/product-only" (product + background/graphics only). The adaptation must STAY graphic — do not insert people or gym.
    - If it HAS a person or environment: we may adapt that to the new product context (e.g. creatine → gym) or per user guidelines.

4. **PRODUCT POSE, POSITION AND PLACEMENT (CRITICAL — identify exactly for replication):**
    - **Product pose/orientation:** How is the product displayed? (e.g. **lying down** flat or at an angle, **standing upright**, on its side, **scattered** at various angles, grouped in a row, stacked). Describe precisely: "lying down and slightly angled", "standing upright facing camera", "multiple items scattered with different tilts", etc. This MUST be replicated in the generated ad so the new product appears in the SAME pose — e.g. if the reference shows earplugs lying down and scattered, the new product must also be shown lying down and at similar angles, NOT standing upright.
    - Is the product **inclined/tilted**? Describe the angle (e.g. leaning down and to the right, tilted left, diagonal). Exact orientation matters.
    - Is the product **"submerged" or nestled** among the background elements? (e.g. fruit/objects surrounding the product, wrapping around its base and sides, partially covering its edges, product sitting inside the pile rather than on top). Describe: do the background elements rise around the product, partially obscure it, create depth so the product looks integrated into the scene?
    - Summarize in one clear line: "Product pose: [lying down / standing upright / scattered / etc.]; Position: [inclined/tilted yes/no, direction]; Placement: [submerged/nestled among X / sitting on top of X / floating]." This will be copied into the final prompt.

5. **Generate a DETAILED Prompt** that recreates EVERY visual element:
    - EXACT composition and layout (where every element is positioned: person, product, text, buttons, etc.). Note whether the background/surrounding elements (e.g. fruits, objects, scenery) fill the entire frame edge to edge with the product centered (full-bleed, no blank margins) — describe this so it can be replicated.
    - EXACT colors (background, foreground, text, accents - specific shades, gradients, hex codes if visible)
    - EXACT typography (font styles, sizes, weights, exact text placement, alignment, effects like shadows/outlines) — describe so the same look can be replicated
    - EXACT background (style, colors, gradients, visual elements like silhouettes, blur effects, particles)
    - EXACT product/subject presentation: **position (inclined/tilted? angle/direction?), placement (submerged/nestled in the pile? fruit wrapping around base and sides?),** angles, lighting, shadows, number of products
    - EXACT person/character (if present: pose, expression, clothing, placement, interaction with product)
    - EXACT visual effects (lighting style, shadows, highlights, reflections, gradients, filters)
    - EXACT buttons/CTAs (if present: style, colors, typography, placement)
    - EXACT overall aesthetic and mood

The prompt must be so detailed that it would generate an IDENTICAL image to the reference ad.

Format your response EXACTLY as:
**TYPOGRAPHY (REFERENCE AD):**
- Font style/type: [e.g. bold sans-serif, display, serif]
- Sizes and hierarchy: [headline size, body/copy size, any small text]
- Weights: [e.g. bold headline, regular body]
- Placement and alignment: [where text sits, alignment]
- Effects: [shadows, outlines, gradients on text, letter-spacing if visible]
(Describe everything needed to replicate the exact same typography in another ad.)

**VISUAL STYLE (REFERENCE AD):**
- Has person/character: [yes/no]
- Has gym, sport setting, or location environment: [yes/no]
- Main elements: [one-hero-only OR multiple] — if one-hero-only, the reference has a single main focal subject (e.g. one food item, one product); do not add packaging or a second element when adapting.
- Design type: [graphic-product-only OR has-person OR has-environment]
If "graphic-product-only": the ad is purely product + background/graphics (no people, no gym). The generated prompt must NOT add people or gym/sport imagery — only adapt product and keep the same graphic style. Only add person/gym if the user explicitly requests it in Guidelines.

**COPYWRITING ANALYSIS:**
- Text Structure: [e.g. "Two lines: tagline (X words) + main slogan (Y words)" — describe how many lines and word count per line]
- Headline/Tagline Word Count: [exact number of words in the first/short line, e.g. 3]
- Main Copy Word Count: [exact number of words in the main slogan/second line, e.g. 5]
- Word Count: [total or main line word count]
- Rhetorical Figure: [primary figure: metaphor/personification/hyperbole/analogy/slogan/motivational/aspirational/wordplay/sarcasm/other]
- Tone: [tone: e.g. playful, sarcastic, humorous, serious, professional]
- Style: [style category]
- **Function of Line 2 (CRITICAL):** What does the second line do? (e.g. wordplay on a word like "uninterrupted" → "sleep interrupted", punchline, sarcastic twist, metaphor, benefit with a joke, double meaning). Describe so the generated ad can replicate the SAME function — the second line must NOT become a generic product spec (e.g. "45db noise cancelling") but must fulfill the same rhetorical role (e.g. clever twist, joke, wordplay).
- **Linguistic device of second line:** [wordplay / sarcasm / metaphor / joke / punchline / double meaning / straight benefit / other]. The new copy must use the same kind of device.

**PRODUCT POSE AND ARRANGEMENT (REFERENCE AD) — CRITICAL, OUTPUT THIS BLOCK:**
Write ONE detailed paragraph that describes EXACTLY how the product(s) are positioned and arranged in the reference ad. This block will be used verbatim (with only the product name swapped for "the user's product") so the image generator places the user's product in this SAME pose and order — not in the pose of the user's uploaded image. Include:
- Number of product units visible (e.g. two pairs, four earplugs; or one item).
- Pose: lying down flat / standing upright / on their side / scattered / grouped. All lying horizontally or all standing?
- Orientation: which way do the parts point? (e.g. conical tips pointing outwards left and right, flanged bases toward center; or rounded ends up, narrow tips down).
- Arrangement and order: overlapping (which in front?), clustered left and right, one slightly above the other, angles (gentle upward/downward tilt from horizontal).
- Surface and lighting: on a flat white surface, soft shadows beneath, etc.
Write it so that if we replace "[product type]" with "the user's product from the provided image", the image model can render the user's product in this exact layout. Example style: "Four earplugs lying horizontally on a white surface, arranged as two pairs. Conical tips point outwards to left and right, flanged bases toward center with slight overlap. Left pair: one slightly above the other, both at a gentle upward angle. Right pair: similar, at a gentle downward angle. Soft shadows beneath. No standing upright — all lying flat."

**REFERENCE AD PROMPT:**
[Generate a COMPREHENSIVE, EXTREMELY DETAILED prompt that would recreate this exact static ad. Include ALL visual elements: composition, colors, typography with exact text placement, background, product presentation (especially: **product pose** — lying down / standing upright / scattered / on its side and exact angles; **product position** — inclined/tilted and direction; **product placement** — submerged/nestled among fruits or objects, with those elements wrapping around the product's base and sides, partially obscuring edges; lighting, shadows, reflections), person/character (if present), effects, buttons (if present). The prompt should be ready to use in an AI image generator and would produce an identical image.]`;

    let staticAdAnalysis;
    try {
      staticAdAnalysis = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
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

        // Extract reference prompt, typography, visual style, and copywriting analysis
    let analysisText = '';
    let referencePrompt = '';
    let referenceTypography = '';
    let referenceProductPoseAndArrangement = '';
    let referenceVisualStyle: { hasPerson: boolean; hasEnvironment: boolean; designType: string; oneHeroOnly?: boolean } | null = null;
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
        const typographyMatch = analysisText.match(/\*\*TYPOGRAPHY \(REFERENCE AD\):\*\*\s*([\s\S]*?)(?=\*\*COPYWRITING ANALYSIS:\*\*|\*\*VISUAL STYLE|\*\*REFERENCE AD PROMPT:\*\*|$)/i);
        if (typographyMatch) {
          referenceTypography = typographyMatch[1].trim();
          console.log('\n=== REFERENCE AD TYPOGRAPHY EXTRACTED ===');
          console.log('Typography:', referenceTypography.substring(0, 300) + (referenceTypography.length > 300 ? '...' : ''));
        }

        // Extract visual style (graphic vs person/environment) — do not add gym/person if reference is graphic-only
        const visualStyleMatch = analysisText.match(/\*\*VISUAL STYLE \(REFERENCE AD\):\*\*\s*([\s\S]*?)(?=\*\*COPYWRITING ANALYSIS:\*\*|\*\*REFERENCE AD PROMPT:\*\*|$)/i);
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

        // Extract copywriting analysis
        const copywritingAnalysisMatch = analysisText.match(/\*\*COPYWRITING ANALYSIS:\*\*\s*([\s\S]*?)(?=\*\*REFERENCE AD PROMPT:\*\*|$)/i);
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

        // Extract product pose and arrangement (CRITICAL — used to place user's product in same layout)
        const productPoseMatch = analysisText.match(/\*\*PRODUCT POSE AND ARRANGEMENT \(REFERENCE AD\)[^\n]*\n([\s\S]*?)(?=\n\*\*REFERENCE AD PROMPT:\*\*|\*\*REFERENCE AD PROMPT:\*\*|$)/i);
        if (productPoseMatch) {
          referenceProductPoseAndArrangement = productPoseMatch[1].trim();
          console.log('\n=== REFERENCE PRODUCT POSE AND ARRANGEMENT EXTRACTED ===');
          console.log('Pose block length:', referenceProductPoseAndArrangement.length);
          console.log('Pose block preview:', referenceProductPoseAndArrangement.substring(0, 400) + (referenceProductPoseAndArrangement.length > 400 ? '...' : ''));
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

    // Step 2: Adapt the reference prompt for the new product
    console.log('\n=== STEP 2: ADAPTING REFERENCE PROMPT FOR NEW PRODUCT ===');
    console.log('Input data:');
    console.log('- Reference prompt length:', referencePrompt.length);
    console.log('- Has scraped summary:', !!scrapedSummary);
    console.log('- Has scraped branding:', !!scrapedBranding);
    console.log('- Word count:', copywritingProfile?.wordCount);
    console.log('- Rhetorical figure:', rhetoricalFigures?.primary);
    console.log('- Tone:', copywritingProfile?.tone);
    console.log('- Style:', copywritingProfile?.styleCategory);
    console.log('- Reference typography extracted:', !!referenceTypography);
    const isGraphicOnly = referenceVisualStyle?.designType === 'graphic-product-only';
    const oneHeroOnly = referenceVisualStyle?.oneHeroOnly === true;
    const guidelinesAskSingleHero = guidelinesTrimmed && /main\s*element|as\s*(the\s*)?main\s*element|only\s*one\s*(main\s*)?element|single\s*(main\s*)?element/i.test(guidelinesTrimmed);
    const enforceOneMainElement = oneHeroOnly || guidelinesAskSingleHero;
    console.log('- Reference is graphic/product-only (no person, no gym):', isGraphicOnly);
    console.log('- Reference has one hero only:', oneHeroOnly);
    console.log('- Guidelines ask for single main element:', guidelinesAskSingleHero);
    console.log('- Enforce one main element (no packaging):', enforceOneMainElement);

    if (scrapedBranding) {
      console.log('- Branding colors available:', scrapedBranding.colors ? Object.keys(scrapedBranding.colors).join(', ') : 'none');
      console.log('- Branding typography available:', scrapedBranding.typography ? 'yes' : 'no');
      console.log('- Branding fonts:', scrapedBranding.fonts ? scrapedBranding.fonts.map((f: any) => f.family || f.name).join(', ') : 'none');
    }
    
    if (isUrlScraped && copywriting) {
      console.log('- Scraped data length:', copywriting.length);
      console.log('- Scraped data preview:', copywriting.substring(0, 300) + '...');
    }

    // Build branding integration instructions (include logo when reference shows brand name/logo)
    let brandingIntegration = '';
    if (scrapedBranding) {
      const brandColors = scrapedBranding.colors || {};
      const colorList = Object.entries(brandColors)
        .map(([key, value]: [string, any]) => {
          if (typeof value === 'string') {
            return `${key}: ${value}`;
          } else if (value && typeof value === 'object' && value.value) {
            return `${key}: ${value.value}`;
          }
          return `${key}: ${JSON.stringify(value)}`;
        })
        .filter(Boolean)
        .join(', ');
      
      const typographyInfo = scrapedBranding.typography || {};
      const fontsInfo = scrapedBranding.fonts || [];
      const fontList = fontsInfo
        .map((f: any) => f.family || f.name || f)
        .filter(Boolean)
        .join(', ');

      const logoUrl = (scrapedBranding as any).logo?.url ?? (scrapedBranding as any).logo ?? (scrapedBranding as any).logoUrl ?? null;
      const logoInstruction = logoUrl
        ? `- **Brand logo (CRITICAL):** When the reference ad shows the brand name or a logo, the recreated ad MUST show the product's brand logo in the same position and style. Use the brand logo from the scraped page so it looks personalized. Brand logo URL: ${logoUrl}. In your prompt, specify that the ad should display the product's official brand logo (from the scraped page) in the same placement and style as the reference ad.`
        : `- **Brand name/logo:** When the reference ad shows the brand name or a logo, the recreated ad must show the product's brand logo in the same position and style (use the product's official branding so it looks personalized).`;

      brandingIntegration = `**Brand Integration:**
Use the following branding elements from the product page:
${logoInstruction}
${colorList ? `- Product Brand Colors: ${colorList} (integrate these colors into the design where appropriate, especially for product elements and accents)` : ''}
${typographyInfo.fontFamilies || fontList ? `- Product Brand Typography: ${typographyInfo.fontFamilies || fontList} (consider using these fonts for product text or headlines if they fit the design aesthetic)` : ''}
${typographyInfo.fontSizes ? `- Brand Font Sizes: ${JSON.stringify(typographyInfo.fontSizes)}` : ''}
Integrate these brand elements while maintaining the reference ad's overall design structure and composition.`;
      
      console.log('\n🎨 Branding integration instructions created', logoUrl ? '(with logo URL)' : '');
    }

    // Build copywriting creation instructions — enforce same brevity as reference (short tagline + short main line)
    const headlineWords = copywritingProfile?.headlineWordCount ?? (copywritingProfile?.wordCount != null ? Math.min(5, Math.max(2, Math.floor((copywritingProfile.wordCount || 8) / 2))) : 4);
    const mainCopyWords = copywritingProfile?.mainCopyWordCount ?? (copywritingProfile?.wordCount != null ? Math.min(8, Math.max(3, copywritingProfile.wordCount || 8)) : 6);

    let copywritingInstructions = '';
    if (isUrlScraped && scrapedSummary && copywritingProfile && rhetoricalFigures) {
      // Use scraped data to create copywriting with same rhetorical figure AND same brevity as reference
      copywritingInstructions = `**Copywriting Creation (CRITICAL — SAME BREVITY + CORRECT PHRASING):**
The reference ad uses SHORT, punchy text — your prompt MUST describe copy with the SAME brevity AND with grammatically correct, natural-sounding phrasing:
- **Line 1 (tagline/headline):** MAX ${headlineWords} words. Short phrase like "VALENTINE'S DAY EXCLUSIVE" (3 words). Do NOT use a long sentence.
- **Line 2 (main copy/slogan) — CRITICAL — SAME FUNCTION AS REFERENCE:** MAX ${mainCopyWords} words. The reference's second line has a specific function (e.g. wordplay, punchline, sarcasm, metaphor). Your Line 2 MUST fulfill the SAME function for the new product — e.g. if the reference uses a playful twist like "earplugs that help you sleep interrupted" (wordplay on "uninterrupted"), write an equivalent clever/sarcastic/playful line for the new product. Do NOT replace with generic product specs (e.g. "45db noise cancelling sleep interrupted" is wrong — it is not copy, has no wordplay, and doesn't match the reference's tone). Same linguistic device: ${copywritingProfile.functionOfLine2 ? `Reference function: "${copywritingProfile.functionOfLine2}". Device: ${copywritingProfile.linguisticDeviceLine2 || 'match reference'}.` : 'match reference tone and device (wordplay/sarcasm/metaphor/joke where applicable).'}
- **Phrasing (CRITICAL):** Every phrase MUST be well-written and grammatically correct. Avoid awkward constructions. Keep the same tone, rhetorical figure, and style — only output phrases that read naturally and correctly in English. Line 2 must be proper ad copy with the same effect as the reference, never a feature list or spec dump.
Using the scraped product page information below, DISTILL the key concepts (offer, product benefit, occasion) into these two SHORT, WELL-PHRASED lines. Same rhetorical figure: "${rhetoricalFigures.primary || 'match style'}", tone: "${copywritingProfile.tone || 'professional'}", style: "${copywritingProfile.styleCategory || 'persuasive'}".

**Scraped Product Page Data (distill into brief copy — do not paste long text):**
${scrapedSummary}

Create two short phrases: (1) a brief tagline (${headlineWords} words or fewer), (2) a brief main line (${mainCopyWords} words or fewer). Both must be grammatically correct and natural-sounding. In your final prompt, specify the exact short text to appear, e.g. centered text: "[TAGLINE]" and below "[MAIN COPY]".`;
      
      console.log('\n📝 Creating copywriting from scraped data with brevity:', { headlineWords, mainCopyWords });
    } else if (copywriting && !isUrlScraped) {
      // Manual copywriting provided
      copywritingInstructions = `**Copywriting:**
Use this exact copywriting in the prompt: "${copywriting}"`;
      console.log('\n📝 Using manual copywriting');
    } else {
      copywritingInstructions = `**Copywriting:**
Create copywriting matching the reference style and BREVITY. Every phrase MUST be grammatically correct and natural-sounding — no awkward constructions. Keep tone, rhetorical figure, and style; only output well-phrased copy.
- Line 1 (tagline): max ${headlineWords} words. Line 2 (main copy): max ${mainCopyWords} words. Do NOT use one long headline.
- **Line 2 must fulfill the SAME function as the reference's second line** (e.g. wordplay, punchline, sarcasm, metaphor) — never replace with generic product specs or feature dumps (e.g. "45db noise cancelling" as main copy is wrong). Same linguistic device and effect as reference.
- Rhetorical figure: ${rhetoricalFigures?.primary || 'match reference'}
- Tone: ${copywritingProfile?.tone || 'professional'}
- Style: ${copywritingProfile?.styleCategory || 'persuasive'}`;
      console.log('\n📝 Creating copywriting from profile only');
    }

    const finalPromptGeneration = `You are an expert prompt engineer. You have been given:

1. A DETAILED prompt that recreates the reference static ad design
2. An image of a NEW product that needs to replace the product in the reference ad
${isUrlScraped && scrapedSummary ? '3. Scraped product page information (summary and branding)' : ''}

**Reference Ad Prompt (use this as the base structure - maintain ALL design elements):**
${referencePrompt}
${referenceTypography ? `
**Typography from Reference Ad (COPY this typography into the final prompt):**
${referenceTypography}
You MUST replicate the same typography style, font appearance, sizes, weights, placement and text effects from the reference ad in your output.` : ''}
${referenceProductPoseAndArrangement ? `
**PRODUCT POSE AND ARRANGEMENT (MANDATORY — do not skip):**
The reference ad shows the product in a specific pose and arrangement. The image generator will use your description to COMPOSE the scene; if you describe the product in the reference's pose, it will render the user's product in that pose. If you describe the product as in the user's uploaded image, the result will just add text to that image (wrong).
You MUST include the following product pose and arrangement in your final prompt. Describe the USER'S product (from the provided image) in THIS exact pose and arrangement — not in the pose of the uploaded image:
---
${referenceProductPoseAndArrangement}
---
Adapt only the product name: write "the product from the provided image" or "the user's [product type] from the provided image" so the design/color/branding come from the image but the POSE, ORDER, ANGLE and ARRANGEMENT come from this block. Your final prompt must contain a paragraph or bullet list that replicates this pose/arrangement for the user's product.` : ''}

**Your Task:**
Adapt the reference prompt above to create a NEW prompt for the product in the provided image. The new prompt must:

${enforceOneMainElement ? `**CRITICAL — ONE MAIN ELEMENT ONLY (no packaging):**
The reference ad has only ONE main visual hero (e.g. one cookie, one food item).${guidelinesAskSingleHero ? ' The user\'s Guidelines also specify a single main element (e.g. "gummy as the main element").' : ''} Your prompt MUST describe only that ONE hero as the focal subject — do NOT include product packaging, pouch, bag, or a second product in the scene. The main element is the product item itself (e.g. the gummy, the cookie) as the user requested or as the reference shows — not the packaging. If the product image shows packaging, ignore it for the hero; use only the single main element (e.g. the gummy itself) so the ad matches the reference\'s one-hero composition.` : ''}
${isGraphicOnly ? `**CRITICAL — REFERENCE AD IS GRAPHIC/PRODUCT-ONLY (no people, no gym):**
The reference ad has NO person and NO gym/sport environment — it is purely product + background/graphics (e.g. product, liquid splashes, fruits, gradients). You MUST keep the same style: do NOT add any person, athlete, gym, or sport environment. Do NOT insert "gym in background", "athletic couple", "person training", etc. Only product, background, and graphic elements. The ONLY exception: if the user explicitly asks for it in the Guidelines section below, then follow their request. Otherwise keep it graphic/product-only.` : `**Person/Environment (reference has person or setting):** You may adapt the person/action or environment to match the new product context (e.g. creatine → gym) or follow user Guidelines.`}

1. **Analyze Product Context (CRITICAL):**
   - Analyze the product image to understand: product type, category, purpose, target audience, industry
   ${isGraphicOnly ? '- Keep the ad GRAPHIC: product + background/graphics only. Do NOT add people or gym/sport imagery unless the user requested it in Guidelines.' : `- **Person and Action Adaptation (reference had person/environment):**
     * The person in the image MUST be performing actions or in poses that are coherent with how the NEW product is actually used
     * Example: If product is creatine: person could be in gym/sport setting. If reference showed another sport: you may adapt to gym for creatine, or follow Guidelines
     * **Do NOT copy the person's pose/action from reference if it doesn't match the NEW product's actual use case**`}
   - Always maintain the EXACT same design structure, composition, and layout from reference
   ${isGraphicOnly ? '- Keep background and effects graphic only (e.g. liquid splashes, fruits, gradients) — no gym, no people.' : '- Adapt contextual elements (background setting, person styling, actions/pose) to match the product category and use case, or per Guidelines.'}
   - Keep all visual design principles, effects, and aesthetics consistent

2. **Maintain ALL design elements** from the reference prompt:
   - Keep the EXACT same composition structure
   - **Product POSE AND ARRANGEMENT (CRITICAL — you MUST use the block above):** The reference ad has a specific product pose, order, and arrangement (e.g. lying horizontally, tips out, bases in, two pairs clustered, soft shadows). You MUST describe the user's product in THAT pose/arrangement in your final prompt — use the exact "PRODUCT POSE AND ARRANGEMENT" block provided, adapting only the product name to "the product from the provided image". Do NOT describe the product as it appears in the user's uploaded image (e.g. if their photo shows earplugs standing upright, ignore that — describe them in the reference pose: lying down, same angles and order). The image generator needs this so it composes a NEW scene with the user's product in the reference's layout; otherwise it will just overlay text on the upload.
   - **Product position and placement (CRITICAL — replicate exactly):** Identify in the reference ad how the product is positioned (inclined/tilted? which direction/angle?) and how it is placed relative to the background (e.g. submerged/nestled among fruit, with fruit wrapping around its base and sides, partially covering edges; or sitting on top). Your prompt MUST describe the SAME for the new product: same inclination/tilt and direction, same "submerged/nestled" relationship — background elements (fruits, objects) must surround the product, rise around its base and sides, partially obscure it where the reference does, so the product looks integrated into the scene, not floating or simply on top of a flat layer.
   - **Composition and framing (CRITICAL — match reference):** In the reference ad, background elements (e.g. fruits, objects, textures, scenery) fill the ENTIRE frame edge to edge; the product is centered. There are NO blank margins or empty white space around the edges. Your prompt MUST describe this: background and decorative elements must extend to all sides and fill the frame completely; full-bleed composition; no empty borders or white space.
   - Keep the EXACT same layout and positioning of all elements
   - Keep the EXACT same visual effects (lighting style, shadows, effects)
   ${isGraphicOnly ? '- Do NOT add any person/character or gym — reference ad is product + graphics only.' : '- **Person/Character**: Maintain the same visual style and presentation approach, BUT adapt the person\'s pose, expression, clothing, and actions to be coherent with the NEW product\'s actual use case (see section 4 for details).'}
   - Keep the EXACT same buttons/CTAs design and placement (if applicable)
   - **Typography: COPY the typography from the reference ad** — same font style/type, sizes, weights, text placement, alignment and text effects (shadows, outlines). The headline and copy must look like the reference ad's typography.

3. **Adapt Colors and Typography:**
${scrapedBranding ? brandingIntegration : '- Use reference colors and typography, but adapt product-specific elements'}
${scrapedBranding ? '- Integrate product brand colors from branding data where appropriate (product elements, accents, highlights)' : ''}
${scrapedBranding ? '- Prefer REFERENCE AD typography for headline and main copy; use product brand typography only for small product labels if needed' : ''}
- **Always preserve the reference ad typography** (font style, sizes, weights, placement, effects) so the new ad looks like the reference.
- Maintain reference color palette for background and overall design
- Use brand colors strategically for product elements and accents

4. **Replace/Adapt product references**${isGraphicOnly ? '' : ' AND adapt people/actions to match product context (CRITICAL):'}
   - Analyze the product image: type, category, purpose, colors, branding, shape, characteristics
   ${enforceOneMainElement ? '- **ONE MAIN ELEMENT ONLY:** The reference has one hero (e.g. one cookie). Show ONLY that one element for the new product — e.g. the gummy itself as the hero, NOT the product packaging or pouch. Do not describe or include packaging in the scene; the single focal subject is the product item (the gummy, the cookie, etc.) only.' : ''}
   - Replace product descriptions with the NEW product from the provided image
   - **Product presentation (CRITICAL — match reference style, never change product design):** The USER'S product (packaging, labels, logo, shape) must stay exactly as in the product image — never alter its design. Replicate the reference ad's product PRESENTATION exactly: (1) **Pose:** same orientation as reference — if the reference shows the product lying down, scattered, or at specific angles, the new product MUST be described in the same pose (e.g. "earplugs lying down on a white surface at slight angles" → user's earplugs also lying down at similar angles; never "standing upright" if reference shows lying down); (2) **Position:** same inclination/tilt and direction (e.g. leaning down and to the right, or tilted left); (3) **Placement:** same "submerged/nestled" look — the product must appear partially buried or integrated into the pile of fruits/objects, with those elements wrapping around its base and sides and partially obscuring edges, not sitting on top of a flat layer; (4) shadows, lighting, reflections, texture as in the reference. So: same product design always; pose, position, angle, submerged placement, shadow, light, texture must match the reference ad as closely as possible.
   ${isGraphicOnly ? '- Keep the ad graphic: only product(s), background, and graphic elements (splashes, fruits, etc.). No people, no gym, no sport environment.' : `- **ADAPT PEOPLE AND ACTIONS TO MATCH PRODUCT CONTEXT:**
     * If product is fitness/sports (e.g., creatine, protein): show person in gym/sports setting, working out, athletic clothing and active pose
     * If product is beauty/cosmetics: show person in beauty context, applying product or beauty-focused pose
     * If product is tech/gadgets: show person using product in tech context
     * **CRITICAL**: Adapt the person's pose, expression, clothing, setting, and action to the NEW product's actual use case.
   - If reference shows person holding product: adapt to show person using NEW product in contextually appropriate way
   - Adapt ALL visual context (background, setting, person styling, person actions/pose) to match the NEW product's actual use case and category`}
   - If reference shows multiple products: show multiple instances of NEW product in SAME arrangement
   - Maintain same angles, lighting, shadows as reference but for NEW product (product design unchanged; presentation adapted)

5. **Create Copywriting (SAME TONE + CLEAR, PERFECT COPY — CRITICAL):**
${copywritingInstructions}
**The reference ad has SHORT text.** Match its tone and style exactly, but every phrase MUST be clear, understandable, and effective copywriting — no confusing or vague wordplay (e.g. avoid "GUMMIES YOU CAN BUILD WITH A POP" which is unclear; use clear lines like "TASTES LIKE BERRY", "BOOST YOUR STRENGTH", "5G CREATINE ZERO SUGAR"). Same brevity: short tagline (${headlineWords} words or fewer) and short main line (${mainCopyWords} words or fewer). Grammatically correct and natural in English. The copy must be immediately understandable and conversion-ready while keeping the reference's tone, rhetorical figure, and style. Do NOT describe one long headline. Describe two short, well-phrased lines that read like professional ad copy.
${guidelinesTrimmed ? `
6. **Guidelines from the user (apply these changes):**
${guidelinesTrimmed}
You MUST take these instructions into account when generating the final prompt.` : ''}

**Output:**
Provide ONLY the final, complete, EXTREMELY DETAILED prompt ready for AI image generation. The prompt should:
- Maintain ALL visual design elements from the reference prompt (composition, layout, typography placement, background style, effects)
- **Full-bleed composition (CRITICAL):** Describe the scene so that background and surrounding elements (e.g. fruits, objects, textures, scenery) fill the ENTIRE image edge to edge; the product is centered. There must be NO blank or white margins — the composition must be full-bleed like the reference ad, with elements reaching all sides of the frame.
- **Product pose, position and placement (CRITICAL):** You MUST include the exact product pose and arrangement from the "PRODUCT POSE AND ARRANGEMENT" block above, adapted for "the product from the provided image". Describe the user's product in the REFERENCE pose (lying down, same angles, same order and overlap) — do NOT describe it as it appears in the uploaded image, or the generator will just add text to that image. Same "submerged/nestled" placement where applicable. Same shadows, lighting, reflections. Product design (colors, branding, shape) comes from the provided image; pose, angle, and arrangement come from the reference block.
${scrapedBranding ? '- Where the reference ad shows brand name or logo, specify that the product\'s brand logo (from the scraped page) appears in the same position and style for a personalized look.' : ''}
- **Copy length and phrasing:** Describe the exact SHORT phrases to appear (tagline + main line, each ${headlineWords} and ${mainCopyWords} words or fewer). Same tone as reference; every phrase must be clear, understandable, and effective ad copy. **The second line must fulfill the SAME function as the reference** (wordplay, punchline, sarcasm, metaphor) — never use generic product specs (e.g. "45db noise cancelling") as the main copy; it must read as intentional ad copy with the same rhetorical effect. Grammatically correct and natural. Never one long sentence as the headline.
${enforceOneMainElement ? "- **One main element only:** The scene must have ONE hero (e.g. the gummy or product item only). Do NOT describe product packaging, pouch, or a second element in the image." : ''}
${isGraphicOnly ? '- Keep the ad GRAPHIC: product + background/graphics only. No person, no gym, no sport environment (unless user requested it in Guidelines).' : "- Adapt contextual elements (person styling, actions/pose, setting) to match the NEW product's use case. Ensure the person is in coherent pose/action (e.g. exercising for fitness products)."}
- Feature the NEW product from the provided image in contextually appropriate use
${scrapedBranding ? '- Integrate product brand colors and typography where appropriate' : ''}
- Be ready to copy and paste into Nano Banana Pro or similar AI image generators
- Do NOT include explanations, analysis, or additional text - ONLY the final detailed prompt`;

    let finalPrompt;
    let productAdaptation;
    try {
      productAdaptation = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [
          {
            role: 'user',
            parts: [
              {
                fileData: {
                  fileUri: productFile.uri,
                  mimeType: productFile.mimeType
                }
              },
              {
                text: finalPromptGeneration
              }
            ]
          }
        ]
      });

      // Extract final prompt
      if (productAdaptation.candidates && productAdaptation.candidates[0]?.content?.parts) {
        finalPrompt = productAdaptation.candidates[0].content.parts
          .map((part: any) => part.text || '')
          .join('')
          .trim();

        console.log('\n=== STEP 2 OUTPUT: FINAL PROMPT ===');
        console.log('Final prompt length:', finalPrompt.length);
        console.log('Final prompt preview:', finalPrompt.substring(0, 500) + '...');
      }
    } catch (adaptationError: any) {
      console.error('Error adapting prompt:', adaptationError);
      return NextResponse.json(
        { error: 'Error adapting prompt for product', details: adaptationError.message },
        { status: 500 }
      );
    }

    if (!finalPrompt) {
      return NextResponse.json(
        { error: 'Failed to generate prompt' },
        { status: 500 }
      );
    }

    // Extract usage information for Step 2
    let step2Usage = null;
    let step2Cost = null;
    try {
      const usageMetadata = (productAdaptation as any).usageMetadata;
      if (usageMetadata) {
        const promptTokenCount = usageMetadata.promptTokenCount || 0;
        const candidatesTokenCount = usageMetadata.candidatesTokenCount || 0;
        const totalTokenCount = usageMetadata.totalTokenCount || (promptTokenCount + candidatesTokenCount);

        const inputCostPerMillion = 0.5;
        const outputCostPerMillion = 3.0;

        const inputCost = (promptTokenCount / 1_000_000) * inputCostPerMillion;
        const outputCost = (candidatesTokenCount / 1_000_000) * outputCostPerMillion;
        const totalCost = inputCost + outputCost;

        step2Usage = {
          promptTokenCount,
          candidatesTokenCount,
          totalTokenCount
        };

        step2Cost = {
          inputCost,
          outputCost,
          totalCost,
          inputCostFormatted: `$${inputCost.toFixed(6)}`,
          outputCostFormatted: `$${outputCost.toFixed(6)}`,
          totalCostFormatted: `$${totalCost.toFixed(6)}`
        };

        console.log('\n=== STEP 2 COST ===');
        console.log('Tokens:', step2Usage);
        console.log('Cost:', step2Cost);
      }
    } catch (err) {
      console.error('Error extracting usage information:', err);
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
    console.log('\n=== REQUEST COMPLETE ===\n');

    return NextResponse.json({
      success: true,
      prompt: finalPrompt,
      cost: totalCost,
      // Include intermediate outputs for debugging
      debug: {
        copywritingProfile: copywritingProfile,
        rhetoricalFigures: rhetoricalFigures,
        referenceVisualStyle: referenceVisualStyle,
        referenceTypography: referenceTypography ? referenceTypography.substring(0, 500) + '...' : null,
        referenceProductPoseAndArrangement: referenceProductPoseAndArrangement ? referenceProductPoseAndArrangement.substring(0, 500) + (referenceProductPoseAndArrangement.length > 500 ? '...' : '') : null,
        referencePrompt: referencePrompt.substring(0, 1000) + '...',
        scrapedSummary: scrapedSummary ? scrapedSummary.substring(0, 500) + '...' : null,
        scrapedBranding: scrapedBranding ? {
          colors: scrapedBranding.colors || null,
          typography: scrapedBranding.typography ? {
            fontFamilies: scrapedBranding.typography.fontFamilies || null,
            fontSizes: scrapedBranding.typography.fontSizes || null,
          } : null,
          fonts: scrapedBranding.fonts || null,
        } : null,
      },
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

