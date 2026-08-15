import type { AskSource } from '../../types/ai';

/**
 * The AI answer panel: what the ask agent found, and the rows it read to find it.
 *
 * Presentational only. Every source here was resolved server-side from a row a tool actually
 * returned, so each one is a real record the nurse can open — this component never has to decide
 * whether a citation is trustworthy.
 *
 * Sits where the command dropdown sits, so AI mode answers in place rather than navigating the
 * nurse away from whatever they were reading.
 */

const SOURCE_ICONS: Record<AskSource['kind'], string> = {
  patient: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 20a7.5 7.5 0 0 1 15 0',
  order: 'M6 2h9l5 5v15H6V2Zm9 0v5h5M9 13h7M9 17h5',
  offer: 'M3 9h18M3 9l1.5 11h15L21 9M3 9l2-5h14l2 5M9 13v3M15 13v3',
};

export function AskAnswer({
  answer,
  sources,
  onPick,
  onDismiss,
}: {
  answer: string;
  sources: AskSource[];
  onPick: (source: AskSource) => void;
  onDismiss: () => void;
}) {
  return (
    <div
      className="profile-menu-panel absolute left-0 top-[calc(100%+8px)] z-30 max-h-[min(70vh,460px)] w-full overflow-y-auto rounded-panel border border-line bg-surface p-3 shadow-lg"
      data-testid="ask-answer"
    >
      <div className="flex items-start gap-2">
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
          className="mt-0.5 shrink-0 text-ai-ink"
        >
          <path d="M12 4l1.7 4.7L18.5 10l-4.8 1.6L12 16.5l-1.7-4.9L5.5 10l4.8-1.3L12 4Z" />
        </svg>
        <p className="min-w-0 flex-1 text-[12.5px] leading-relaxed text-ink">{answer}</p>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss answer"
          className="shrink-0 rounded-control p-1 text-ink-3 transition-colors hover:bg-hover hover:text-ink-2"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
            <path d="M5 5l14 14M19 5 5 19" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {sources.length > 0 ? (
        <div className="mt-2 border-t border-line pt-1.5">
          <p className="px-1 pb-1 text-[10px] uppercase tracking-[0.09em] text-ink-3">
            From these records
          </p>
          {sources.map((source) => (
            <button
              key={`${source.kind}:${source.id}`}
              type="button"
              onClick={() => onPick(source)}
              className="flex w-full items-center gap-2.5 rounded-control px-1.5 py-2 text-left transition-colors hover:bg-hover"
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
                className="shrink-0 text-ink-3"
                aria-hidden="true"
              >
                <path d={SOURCE_ICONS[source.kind]} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] text-ink">{source.label}</span>
                <span className="block truncate text-[11px] text-ink-3">{source.meta}</span>
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
