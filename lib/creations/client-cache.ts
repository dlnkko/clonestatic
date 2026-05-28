export type CachedCreation = {
  id: string;
  image_url: string | null;
  aspect_ratio: string | null;
  created_at: string;
  status?: 'generating' | 'completed' | 'failed';
};

const CACHE_VERSION = 1;

type CachePayload = {
  v: number;
  userId: string;
  updatedAt: number;
  creations: CachedCreation[];
};

function cacheKey(userId: string): string {
  return `adcreations:v${CACHE_VERSION}:${userId}`;
}

export function readCreationsCache(userId: string): CachedCreation[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(cacheKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachePayload;
    if (parsed.v !== CACHE_VERSION || parsed.userId !== userId) return null;
    if (!Array.isArray(parsed.creations)) return null;
    return parsed.creations;
  } catch {
    return null;
  }
}

export function writeCreationsCache(userId: string, creations: CachedCreation[]): void {
  if (typeof window === 'undefined') return;
  try {
    const payload: CachePayload = {
      v: CACHE_VERSION,
      userId,
      updatedAt: Date.now(),
      creations,
    };
    localStorage.setItem(cacheKey(userId), JSON.stringify(payload));
  } catch {
    // quota / private mode
  }
}

/** Warm browser image cache for instant grid display. */
export function prefetchCreationImages(creations: CachedCreation[]): void {
  if (typeof window === 'undefined') return;
  for (const c of creations) {
    if (!c.image_url || c.status === 'generating' || c.status === 'failed') continue;
    const img = new Image();
    img.decoding = 'async';
    img.fetchPriority = 'low';
    img.src = c.image_url;
  }
}
