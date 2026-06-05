export type ProductInteractionMode =
  | 'wear-on-body'
  | 'apply-on-skin'
  | 'hold-in-hand'
  | 'consume-orally'
  | 'place-in-scene'
  | 'unknown';

export type ProductUseProfile = {
  category: string;
  interactionMode: ProductInteractionMode;
  bodyZone: string | null;
  placementInstruction: string;
  forbiddenPlacements: string[];
  confidence: 'high' | 'medium' | 'low';
};

type UseRule = {
  test: RegExp;
  profile: Omit<ProductUseProfile, 'confidence'>;
  confidence?: ProductUseProfile['confidence'];
};

const USE_RULES: UseRule[] = [
  {
    test: /nasal\s*strip|nose\s*strip|breath(e|ing)?\s*strip|breathe\s*strip|snoring\s*strip|nasal\s*dilator|histrips?|airflow\s*strip/i,
    confidence: 'high',
    profile: {
      category: 'nasal strip',
      interactionMode: 'apply-on-skin',
      bodyZone: 'bridge of nose across both nostrils',
      placementInstruction:
        'Pink/colored strip applied horizontally across the bridge of the nose, adhering over both nostrils — standard nasal-strip placement for airflow and breathing support.',
      forbiddenPlacements: [
        'floating on cheek',
        'on forehead',
        'on chin',
        'near eye without nose contact',
        'decorative sticker placement away from nose',
      ],
    },
  },
  {
    test: /pimple\s*patch|acne\s*patch|blemish\s*patch|hydrocolloid\s*patch/i,
    confidence: 'high',
    profile: {
      category: 'acne patch',
      interactionMode: 'apply-on-skin',
      bodyZone: 'on facial skin over a blemish',
      placementInstruction:
        'Small round/circular patch stuck directly on cheek or forehead skin over a blemish — flat against skin, not floating.',
      forbiddenPlacements: ['floating away from skin', 'on nose bridge unless blemish is there'],
    },
  },
  {
    test: /under[\s-]?eye\s*patch|eye\s*gel\s*patch|depuff/i,
    confidence: 'high',
    profile: {
      category: 'under-eye patch',
      interactionMode: 'apply-on-skin',
      bodyZone: 'under-eye area on lower eyelid/cheekbone',
      placementInstruction:
        'Crescent or gel patches placed under each eye, adhering to skin beneath the lower lash line.',
      forbiddenPlacements: ['on forehead', 'on nose', 'floating above face'],
    },
  },
  {
    test: /lip\s*(mask|balm|gloss|stick|stain|plumper)|lipstick/i,
    confidence: 'high',
    profile: {
      category: 'lip product',
      interactionMode: 'apply-on-skin',
      bodyZone: 'lips',
      placementInstruction:
        'Product applied on or held to lips — color/balm/gloss visible on mouth, not on cheek or nose.',
      forbiddenPlacements: ['on cheek', 'on nose', 'floating near face'],
    },
  },
  {
    test: /mouth\s*tape|lip\s*tape|sleep\s*tape/i,
    confidence: 'high',
    profile: {
      category: 'mouth tape',
      interactionMode: 'apply-on-skin',
      bodyZone: 'lips / mouth',
      placementInstruction:
        'Tape placed horizontally across closed lips for sleep breathing support.',
      forbiddenPlacements: ['on nose', 'on cheek', 'on forehead'],
    },
  },
  {
    test: /whitening\s*strip|teeth\s*strip|dental\s*strip/i,
    confidence: 'high',
    profile: {
      category: 'teeth whitening strip',
      interactionMode: 'apply-on-skin',
      bodyZone: 'teeth',
      placementInstruction:
        'Thin strip applied across front teeth inside a natural smile or open-mouth demo shot.',
      forbiddenPlacements: ['on lips only', 'on cheek', 'floating'],
    },
  },
  {
    test: /sleep\s*mask|eye\s*mask(?!\s*patch)/i,
    confidence: 'high',
    profile: {
      category: 'sleep eye mask',
      interactionMode: 'wear-on-body',
      bodyZone: 'eyes / over face',
      placementInstruction: 'Soft mask worn over eyes, strap or fabric contouring to face.',
      forbiddenPlacements: ['on nose only', 'on cheek as sticker'],
    },
  },
  {
    test: /earplug|ear\s*plug/i,
    confidence: 'high',
    profile: {
      category: 'earplug',
      interactionMode: 'wear-on-body',
      bodyZone: 'ear canal / ear',
      placementInstruction: 'Earplug inserted in ear or held at ear — not on nose or cheek.',
      forbiddenPlacements: ['on nose', 'on cheek'],
    },
  },
  {
    test: /earbud|headphone|headset|airpod/i,
    confidence: 'high',
    profile: {
      category: 'earbuds/headphones',
      interactionMode: 'wear-on-body',
      bodyZone: 'ears / head',
      placementInstruction: 'Worn in ears or on head with correct fit — not placed on nose or cheek.',
      forbiddenPlacements: ['on nose', 'floating on cheek'],
    },
  },
  {
    test: /watch|fitness\s*tracker|smartwatch|whoop/i,
    confidence: 'high',
    profile: {
      category: 'wrist wearable',
      interactionMode: 'wear-on-body',
      bodyZone: 'wrist',
      placementInstruction: 'Device strapped on wrist naturally.',
      forbiddenPlacements: ['on face', 'floating'],
    },
  },
  {
    test: /ring(?!\s*(door|pull|light))/i,
    confidence: 'medium',
    profile: {
      category: 'ring jewelry',
      interactionMode: 'wear-on-body',
      bodyZone: 'finger',
      placementInstruction: 'Ring worn on finger with natural hand pose.',
      forbiddenPlacements: ['on nose', 'on cheek'],
    },
  },
  {
    test: /sunscreen|spf|moisturizer|serum|face\s*cream|skincare|retinol|cleanser/i,
    confidence: 'medium',
    profile: {
      category: 'skincare',
      interactionMode: 'apply-on-skin',
      bodyZone: 'face skin',
      placementInstruction:
        'Product applied to face skin (cheeks, forehead, T-zone) or held near face at vanity — believable skincare application.',
      forbiddenPlacements: ['random floating blob on cheek without application context'],
    },
  },
  {
    test: /pillowcase|pillow\s*case|bedding|sheet set|duvet|silk\s*pillow/i,
    confidence: 'high',
    profile: {
      category: 'bedding',
      interactionMode: 'place-in-scene',
      bodyZone: 'bed / pillow / head resting',
      placementInstruction:
        'Pillowcase on pillow with model head resting on or beside it — bedding context, NOT worn as head wrap.',
      forbiddenPlacements: ['worn turban-style on head', 'floating on cheek'],
    },
  },
  {
    test: /creatine|pre[\s-]?workout|protein|supplement|gumm(y|ies)|vitamin/i,
    confidence: 'medium',
    profile: {
      category: 'supplement / edible',
      interactionMode: 'consume-orally',
      bodyZone: 'hand / mouth',
      placementInstruction:
        'Held in hand near mouth, or visible gummies/capsules in palm — consumption context, not stuck to face.',
      forbiddenPlacements: ['stuck to cheek', 'on nose bridge', 'floating on face'],
    },
  },
  {
    test: /patch(?!work)/i,
    confidence: 'medium',
    profile: {
      category: 'body patch',
      interactionMode: 'apply-on-skin',
      bodyZone: 'arm, shoulder, or torso skin',
      placementInstruction:
        'Adhesive patch applied flat on clean skin (arm, shoulder, back) — not floating.',
      forbiddenPlacements: ['floating away from body', 'on face unless product is a face patch'],
    },
  },
  {
    test: /mask(?!\s*tape)/i,
    confidence: 'low',
    profile: {
      category: 'face mask',
      interactionMode: 'apply-on-skin',
      bodyZone: 'face',
      placementInstruction:
        'Sheet mask or face mask applied conforming to facial contours — eyes/nose/mouth aligned with cutouts when applicable.',
      forbiddenPlacements: ['flat floating on cheek without conforming to face'],
    },
  },
];

function haystack(name: string, description?: string | null, audience?: string | null): string {
  return [name, description, audience].filter(Boolean).join(' ').toLowerCase();
}

export function inferProductUseProfile(
  productName: string,
  productDescription?: string | null,
  targetAudience?: string | null
): ProductUseProfile | null {
  const text = haystack(productName, productDescription, targetAudience);
  if (!text.trim()) return null;

  for (const rule of USE_RULES) {
    if (rule.test.test(text)) {
      return {
        ...rule.profile,
        confidence: rule.confidence ?? 'high',
      };
    }
  }

  if (/\b(wear|worn|fit|size)\b/.test(text) && /\b(shirt|dress|bra|sock|shoe|apparel|clothing|legging|shorts|jacket|hoodie)\b/.test(text)) {
    return {
      category: 'apparel',
      interactionMode: 'wear-on-body',
      bodyZone: 'body as designed',
      placementInstruction: 'Garment worn correctly on body with natural fit and pose.',
      forbiddenPlacements: ['floating on face', 'used as face sticker'],
      confidence: 'medium',
    };
  }

  return null;
}

export function authenticProductPlacementBlock(input: {
  hasPersonInReference: boolean;
  productUseProfile: ProductUseProfile | null;
  productName?: string | null;
}): string {
  if (!input.hasPersonInReference) return '';

  const profile = input.productUseProfile;
  if (!profile) {
    return `**AUTHENTIC PRODUCT PLACEMENT ON MODEL (CRITICAL):**
The reference includes a person. Analyze the user's product (${input.productName ? `"${input.productName}"` : 'from catalog'}) and describe **correct real-world usage** on the body.
- Infer whether the product is worn, applied to skin, held, consumed, or placed in scene
- Place on the **correct anatomical zone** (nasal strips on nose bridge, lip products on lips, patches on skin, wearables on wrist/ears, bedding on bed — not random floating placement)
- Do NOT copy competitor product placement if it is wrong for this product category
- Do NOT float the product decoratively on cheek/forehead unless that is authentic for this category`;
  }

  const forbidden =
    profile.forbiddenPlacements.length > 0
      ? `\n**FORBIDDEN PLACEMENTS:** ${profile.forbiddenPlacements.join('; ')}.`
      : '';

  return `**AUTHENTIC PRODUCT PLACEMENT ON MODEL (CRITICAL — non-negotiable):**
Product category: **${profile.category}**
Required body zone: **${profile.bodyZone ?? 'correct anatomical zone for this product'}**
Correct usage: ${profile.placementInstruction}
Interaction type: **${profile.interactionMode}**${forbidden}

Keep reference **shot type, model count, framing, mood, and text layout** — but the product MUST be placed in authentic **${profile.category}** usage on the model. Explicitly describe anatomical placement in the final image prompt (e.g. "strip adhered across bridge of nose"). Never substitute decorative floating placement.`;
}
