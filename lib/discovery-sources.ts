export const DISCOVERY_SOURCES = [
  { id: 'ads', label: 'Ads' },
  { id: 'x', label: 'X (Twitter)' },
  { id: 'reddit', label: 'Reddit' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'tiktok', label: 'TikTok' },
  { id: 'google', label: 'Google' },
  { id: 'referral', label: 'Referral' },
] as const;

export type DiscoverySourceId = (typeof DISCOVERY_SOURCES)[number]['id'];

export const DISCOVERY_SOURCE_IDS: DiscoverySourceId[] = DISCOVERY_SOURCES.map((s) => s.id);

export const POST_PURCHASE_ONBOARDING_KEY = 'admirror_post_purchase_onboarding';

/** Dedicated post-purchase URL so analytics can treat this pageview as a paid conversion. */
export const POST_PURCHASE_ONBOARDING_PATH = '/-onboarding-';
