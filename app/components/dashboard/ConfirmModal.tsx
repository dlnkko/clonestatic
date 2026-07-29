'use client';

type Props = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  busy = false,
  danger = true,
  onConfirm,
  onClose,
}: Props) {
  if (!open) return null;

  return (
    <div className="dash-modal-root dash-modal-root--center" role="dialog" aria-modal="true" aria-labelledby="confirm-modal-title">
      <button type="button" className="dash-modal-backdrop" aria-label="Close" onClick={onClose} disabled={busy} />
      <div className="dash-modal dash-animate-scale max-w-sm">
        <div className="dash-modal-header">
          <div>
            <h2 id="confirm-modal-title" className="text-base font-semibold tracking-tight text-[var(--dash-fg)]">
              {title}
            </h2>
            {description ? (
              <p className="mt-1.5 text-sm leading-relaxed text-[var(--dash-muted)]">{description}</p>
            ) : null}
          </div>
          <button type="button" onClick={onClose} disabled={busy} className="dash-icon-btn shrink-0" aria-label="Close">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="dash-modal-footer gap-2">
          <button type="button" onClick={onClose} disabled={busy} className="dash-btn dash-btn-secondary text-sm">
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className={
              danger
                ? 'dash-btn text-sm bg-red-600 text-white hover:bg-red-700 border-transparent'
                : 'dash-btn dash-btn-primary text-sm'
            }
          >
            {busy ? '…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
