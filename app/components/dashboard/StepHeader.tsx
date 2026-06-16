'use client';

export function StepHeader({
  step,
  title,
  badge,
}: {
  step: number | string;
  title: string;
  badge?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-xs font-bold text-white shadow-[0_2px_8px_rgba(99,102,241,0.28)]"
        aria-hidden
      >
        {step}
      </span>
      <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
        <h2 className="dash-section-title">{title}</h2>
        {badge}
      </div>
    </div>
  );
}
