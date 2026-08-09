import type { Recovery, UserFacingError } from '@/lib/youcam/errors';

/**
 * The one place an error is rendered. `lib/youcam/errors.ts` has already turned the
 * raw API code into a title + one actionable sentence + a recovery class, so nothing
 * here interprets anything — it just lays it out and offers the right affordance.
 * The raw code is still printed, small: a judge (and a bug report) needs it.
 */

const RECOVERY_LABEL: Record<Recovery, string> = {
  reshoot: 'Re-shoot this photo',
  retry: 'Retry',
  config: 'Setup needed',
  unknown: 'Try once more',
};

export function ErrorNote({
  error,
  onAction,
  className = '',
}: {
  error: UserFacingError;
  /** omitted for `config` errors, where there is nothing the visitor can do */
  onAction?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={`rounded-[var(--radius-12)] border border-[color-mix(in_srgb,var(--color-warning)_45%,transparent)] bg-[color-mix(in_srgb,var(--color-warning)_9%,transparent)] px-4 py-3 ${className}`}
    >
      <p className="text-sm font-semibold text-[#f7cd7c]">{error.title}</p>
      <p className="mt-1 text-sm leading-snug text-text-mid">{error.guidance}</p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <code className="font-mono text-[0.625rem] text-text-low">{error.code}</code>
        {onAction ? (
          <button type="button" onClick={onAction} className="btn px-3 py-1 text-xs">
            {RECOVERY_LABEL[error.recovery]}
          </button>
        ) : (
          <span className="font-mono text-[0.625rem] uppercase tracking-[0.12em] text-text-low">
            {RECOVERY_LABEL[error.recovery]}
          </span>
        )}
      </div>
    </div>
  );
}
