import type { NextRequest } from 'next/server';

export const INTERNAL_JOB_HEADER = 'x-internal-job-secret';

export function internalJobSecret(): string | null {
  const secret = process.env.INTERNAL_JOB_SECRET?.trim();
  return secret && secret.length > 0 ? secret : null;
}

export function isInternalServerJob(request: NextRequest): boolean {
  const secret = internalJobSecret();
  if (!secret) return false;
  return request.headers.get(INTERNAL_JOB_HEADER) === secret;
}

export function internalJobHeaders(): Record<string, string> {
  const secret = internalJobSecret();
  if (!secret) return {};
  return { [INTERNAL_JOB_HEADER]: secret };
}
