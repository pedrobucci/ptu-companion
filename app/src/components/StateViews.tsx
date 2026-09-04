/** Small, reusable loading/error/empty states so every screen handles all
 * three consistently (T08: "loading/error/empty/a11y"). */

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <p role="status" aria-live="polite" className="state-loading">
      {label}
    </p>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    <div role="alert" className="state-error">
      <p>Something went wrong: {message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="state-empty">{children}</p>;
}
