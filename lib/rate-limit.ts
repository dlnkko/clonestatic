import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { NextRequest } from 'next/server';

class InMemoryRateLimit {
  private requests: Map<string, number[]> = new Map();

  async limit(identifier: string, limit: number, window: number): Promise<{ success: boolean; limit: number; remaining: number; reset: number }> {
    const now = Date.now();
    const key = identifier;
    if (!this.requests.has(key)) this.requests.set(key, []);
    const timestamps = this.requests.get(key)!;
    const cutoff = now - window * 1000;
    const validTimestamps = timestamps.filter(ts => ts > cutoff);
    this.requests.set(key, validTimestamps);

    if (validTimestamps.length >= limit) {
      const oldestTimestamp = Math.min(...validTimestamps);
      const reset = Math.ceil((oldestTimestamp + window * 1000 - now) / 1000);
      return { success: false, limit, remaining: 0, reset };
    }
    validTimestamps.push(now);
    return { success: true, limit, remaining: limit - validTimestamps.length, reset: window };
  }
}

let rateLimiter: Record<string, { limit: (id: string) => Promise<{ success: boolean; limit: number; remaining: number; reset: number }> }>;

function getRateLimiter() {
  if (rateLimiter) return rateLimiter;
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (redisUrl && redisToken) {
    const redis = new Redis({ url: redisUrl, token: redisToken });
    rateLimiter = {
      generateStaticAd: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(15, '1 h'), analytics: true }),
      scrapeUrl: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(50, '1 h'), analytics: true }),
    } as unknown as Record<string, { limit: (id: string) => Promise<{ success: boolean; limit: number; remaining: number; reset: number }> }>;
  } else {
    const inMemory = new InMemoryRateLimit();
    rateLimiter = {
      generateStaticAd: { limit: (id: string) => inMemory.limit(id, 15, 3600) },
      scrapeUrl: { limit: (id: string) => inMemory.limit(id, 50, 3600) },
    };
  }
  return rateLimiter;
}

function getIdentifier(request: Request | NextRequest): string {
  const headers = request instanceof Request ? request.headers : (request as any).headers || new Headers();
  const forwarded = headers.get('x-forwarded-for');
  const realIp = headers.get('x-real-ip');
  return forwarded?.split(',')[0]?.trim() || realIp || 'unknown';
}

export async function checkRateLimit(
  endpoint: 'generateStaticAd' | 'scrapeUrl',
  request: Request | NextRequest
): Promise<{ success: boolean; limit?: number; remaining?: number; reset?: number; error?: string }> {
  try {
    const limiter = getRateLimiter();
    const identifier = getIdentifier(request);
    const result = await limiter[endpoint].limit(identifier);
    if (!result.success) {
      const resetSeconds = typeof result.reset === 'number' ? result.reset : 3600;
      return {
        success: false,
        limit: result.limit,
        remaining: 0,
        reset: resetSeconds,
        error: `Rate limit exceeded. Try again in ${resetSeconds}s.`,
      };
    }
    return { success: true, limit: result.limit, remaining: result.remaining, reset: result.reset };
  } catch (e) {
    return { success: true, error: 'Rate limit check failed' };
  }
}
