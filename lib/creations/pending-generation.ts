/** Tracks in-flight server-side image jobs so mobile can resume UI after screen off. */
const STORAGE_KEY = 'admirror_pending_image_job';

export type PendingImageJob = {
  creationId: string;
  startedAt: number;
};

export function setPendingImageJob(creationId: string): void {
  if (typeof window === 'undefined') return;
  try {
    const payload: PendingImageJob = { creationId, startedAt: Date.now() };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // ignore quota / private mode
  }
}

export function clearPendingImageJob(creationId?: string): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    if (creationId) {
      const parsed = JSON.parse(raw) as PendingImageJob;
      if (parsed.creationId !== creationId) return;
    }
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    sessionStorage.removeItem(STORAGE_KEY);
  }
}

export function readPendingImageJob(): PendingImageJob | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingImageJob;
    if (!parsed?.creationId) return null;
    // Drop stale entries (> 2 h)
    if (Date.now() - (parsed.startedAt ?? 0) > 2 * 60 * 60 * 1000) {
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
