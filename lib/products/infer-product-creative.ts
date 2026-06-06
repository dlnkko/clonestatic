
export type ProductCreativeProfile = {
  primaryUseCases: string;
  audience: string;
  tension: string;
  resolution: string;
  proofPoints: string[];
  brandTone: string;
};

const TENSION_RULES: { test: RegExp; profile: Omit<ProductCreativeProfile, 'proofPoints'> & { proofHints?: string[] } }[] = [
  {
    test: /nasal|nose\s*strip|breath|airflow|histrips?|snoring|congestion/i,
    profile: {
      primaryUseCases: 'Better breathing, airflow, recovery, sleep quality',
      audience: 'Athletes, sleepers, performers who need unobstructed nasal breathing',
      tension: 'Blocked or limited airflow holding back performance, recovery, or sleep',
      resolution: 'Nasal strip applied on the nose bridge — instant airflow support you can feel',
      brandTone: 'performance-driven, direct, confident',
      proofHints: ['money-back guarantee', 'clinical airflow', '30-day guarantee'],
    },
  },
  {
    test: /creatine|pre[\s-]?workout|protein|gumm(y|ies)|supplement|vitamin|fitness/i,
    profile: {
      primaryUseCases: 'Strength, recovery, daily performance nutrition',
      audience: 'Gym-goers, athletes, fitness-focused adults',
      tension: 'Plateaued strength, slow recovery, or luck-based results instead of science-backed fuel',
      resolution: 'Daily creatine/supplement ritual that supports measurable performance',
      brandTone: 'bold, athletic, results-oriented',
      proofHints: ['clinical dosing', 'athlete-grade', 'guarantee'],
    },
  },
  {
    test: /pillow|sheet|bedding|sleep|mattress|silk/i,
    profile: {
      primaryUseCases: 'Better sleep, skin/hair protection, bedroom comfort',
      audience: 'Beauty-conscious sleepers, premium bedding buyers',
      tension: 'Restless sleep, frizz, or skin irritation from cheap bedding',
      resolution: 'Luxury bedding that makes sleep feel restorative and skin-safe',
      brandTone: 'soft, premium, aspirational',
    },
  },
  {
    test: /skincare|serum|moistur|retinol|spf|beauty|face/i,
    profile: {
      primaryUseCases: 'Visible skin improvement, daily routine, self-care',
      audience: 'Skincare-conscious consumers',
      tension: 'Skin frustration — dullness, aging, or unreliable results',
      resolution: 'Targeted formula applied in a believable vanity/routine moment',
      brandTone: 'clean, clinical-meets-luxury',
    },
  },
  {
    test: /balance|hormon|women|menopause|cycle|pms/i,
    profile: {
      primaryUseCases: 'Hormonal balance, mood, daily wellness support',
      audience: 'Women seeking hormonal wellness',
      tension: 'Symptoms feel random or hormonal — not luck, not imagination',
      resolution: 'Daily supplement positioned as hormonal support you can feel',
      brandTone: 'empowering, science-backed, feminine premium',
    },
  },
];

function extractProofPoints(description?: string | null, scrapeSummary?: string | null, priceDisplay?: string | null): string[] {
  const proofs: string[] = [];
  const hay = `${description ?? ''} ${scrapeSummary ?? ''} ${priceDisplay ?? ''}`;
  if (/money[\s-]?back|guarantee/i.test(hay)) proofs.push('Money-back guarantee');
  if (/clinical|stud(y|ies)|proven|tested/i.test(hay)) proofs.push('Clinical or tested claims from product page');
  if (/%\s*off|discount|save/i.test(hay)) proofs.push('Promotional offer from product pricing');
  if (priceDisplay?.trim()) proofs.push(`Price: ${priceDisplay.trim()}`);
  return proofs.slice(0, 4);
}

export function inferProductCreativeProfile(
  productName: string,
  description?: string | null,
  targetAudience?: string | null,
  scrapeSummary?: string | null
): ProductCreativeProfile | null {
  const text = [productName, description, targetAudience, scrapeSummary].filter(Boolean).join(' ');
  if (!text.trim()) return null;

  for (const rule of TENSION_RULES) {
    if (rule.test.test(text)) {
      const proofs = [
        ...(rule.profile.proofHints ?? []),
        ...extractProofPoints(description, scrapeSummary, null),
      ];
      return {
        primaryUseCases: rule.profile.primaryUseCases,
        audience: targetAudience?.trim() || rule.profile.audience,
        tension: rule.profile.tension,
        resolution: rule.profile.resolution,
        proofPoints: [...new Set(proofs)].slice(0, 5),
        brandTone: rule.profile.brandTone,
      };
    }
  }

  if (description?.trim() || targetAudience?.trim()) {
    return {
      primaryUseCases: description?.trim().slice(0, 200) || productName,
      audience: targetAudience?.trim() || 'Target buyers for this product',
      tension: `Problem or desire implied by: ${productName}`,
      resolution: description?.trim().slice(0, 160) || `Benefit delivered by ${productName}`,
      proofPoints: extractProofPoints(description, scrapeSummary, null),
      brandTone: 'direct-response, product-native',
    };
  }

  return null;
}
