import { NextRequest, NextResponse } from 'next/server';
import { runStaticLibraryIngest } from '@/lib/static-library/ingest';
import { INGEST_INTERVAL_DAYS, shouldRunScheduledIngest } from '@/lib/static-library/schedule';
import type { IngestMode } from '@/lib/static-library/types';

export const maxDuration = 300;

function authorizeCron(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = request.headers.get('authorization');
  if (auth === `Bearer ${secret}`) return true;
  const header = request.headers.get('x-cron-secret');
  return header === secret;
}

export async function POST(request: NextRequest) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const force = url.searchParams.get('force') === '1';

    const body = await request.json().catch(() => ({}));
    const explicitMode =
      body.mode === 'bootstrap' ||
      body.mode === 'refresh' ||
      body.mode === 'brand_bootstrap' ||
      body.mode === 'brand_refresh'
        ? body.mode
        : null;

    if (!explicitMode && !force) {
      const schedule = await shouldRunScheduledIngest();
      if (!schedule.run) {
        return NextResponse.json({
          success: true,
          skipped: true,
          reason: schedule.reason,
          lastRunAt: schedule.lastRunAt,
          intervalDays: INGEST_INTERVAL_DAYS,
        });
      }
    }

    const mode = (explicitMode ?? 'refresh') as IngestMode;
    const maxCredits =
      typeof body.maxCredits === 'number' ? body.maxCredits : undefined;
    const maxPagesPerSeed =
      typeof body.maxPagesPerSeed === 'number' ? body.maxPagesPerSeed : undefined;

    const result = await runStaticLibraryIngest({
      mode,
      maxCredits,
      maxPagesPerSeed,
    });

    return NextResponse.json({ success: result.status === 'completed', skipped: false, ...result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Ingest failed';
    console.error('ingest-static-library error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Vercel Cron (daily): runs refresh only if last completed ingest was ≥28 days ago. */
export async function GET(request: NextRequest) {
  return POST(request);
}
