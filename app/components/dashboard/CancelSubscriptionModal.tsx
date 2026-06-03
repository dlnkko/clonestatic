'use client';

import { useEffect, useState } from 'react';

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
  submitting: boolean;
  error: string | null;
};

const MIN_REASON_LENGTH = 5;

export function CancelSubscriptionModal({ open, onClose, onConfirm, submitting, error }: Props) {
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (open) setReason('');
  }, [open]);

  if (!open) return null;

  const trimmed = reason.trim();
  const canSubmit = trimmed.length >= MIN_REASON_LENGTH && !submitting;

  return (
    <div className="dash-modal-root" role="dialog" aria-modal="true" aria-labelledby="cancel-sub-title">
      <button type="button" className="dash-modal-backdrop" aria-label="Close" onClick={onClose} />
      <div className="dash-modal dash-animate-scale">
        <div className="dash-modal-header">
          <div>
            <h2 id="cancel-sub-title" className="text-base font-semibold tracking-tight text-[var(--dash-fg)]">
              Cancel subscription
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-[var(--dash-muted)]">
              You keep access and credits until the end of your billing period.
            </p>
          </div>
          <button type="button" onClick={onClose} className="dash-icon-btn shrink-0" aria-label="Close">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="dash-modal-body">
          <label htmlFor="cancel-reason" className="block text-xs font-medium text-[var(--dash-fg)]">
            Why are you cancelling?
          </label>
          <textarea
            id="cancel-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            maxLength={1000}
            placeholder="Tell us what we could improve…"
            className="dash-textarea mt-2 w-full text-sm"
            disabled={submitting}
          />
          <p className="mt-1.5 text-[11px] text-[var(--dash-muted)]">
            {trimmed.length < MIN_REASON_LENGTH
              ? `At least ${MIN_REASON_LENGTH} characters`
              : `${trimmed.length}/1000`}
          </p>
          {error && (
            <p className="mt-3 rounded-lg border border-red-200/80 bg-red-50/90 px-3 py-2 text-xs text-red-800">
              {error}
            </p>
          )}
        </div>

        <div className="dash-modal-footer gap-2">
          <button type="button" onClick={onClose} disabled={submitting} className="dash-btn dash-btn-secondary text-sm">
            Keep subscription
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => void onConfirm(trimmed)}
            className="dash-btn dash-btn-danger text-sm"
          >
            {submitting ? 'Cancelling…' : 'Confirm cancellation'}
          </button>
        </div>
      </div>
    </div>
  );
}
