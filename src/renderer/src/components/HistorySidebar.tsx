import type { ReviewResult } from '@shared/types';

export function HistorySidebar({
  history,
  hasKey,
  onSelect,
  onClearKey,
  onClearHistory,
}: {
  history: ReviewResult[];
  hasKey: boolean;
  onSelect: (review: ReviewResult) => void;
  onClearKey: () => void;
  onClearHistory: () => void;
}) {
  return (
    <aside className="sidebar">
      <h1 className="sidebar__title">Panel</h1>
      <p className="sidebar__subtitle">Multi-agent code review</p>
      <div className="sidebar__history">
        <div className="sidebar__history-head">
          <h2>History</h2>
          {history.length > 0 ? (
            <button className="sidebar__clear-history" onClick={onClearHistory}>
              Clear
            </button>
          ) : null}
        </div>
        {history.length === 0 ? (
          <p className="sidebar__empty">No reviews yet.</p>
        ) : (
          <ul>
            {history.map((review) => (
              <li key={review.id}>
                <button onClick={() => onSelect(review)}>
                  <span className="history-repo">{review.repoPath.split('/').pop()}</span>
                  <span className="history-meta">
                    {review.findings.length} finding{review.findings.length === 1 ? '' : 's'} ·{' '}
                    {new Date(review.createdAt).toLocaleString()}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <button className="sidebar__change-key" onClick={onClearKey}>
        {hasKey ? 'Change API key' : 'Add API key'}
      </button>
    </aside>
  );
}
