import type { ReviewResult } from '@shared/types';

export function HistorySidebar({
  history,
  onSelect,
}: {
  history: ReviewResult[];
  onSelect: (review: ReviewResult) => void;
}) {
  return (
    <aside className="sidebar">
      <h1 className="sidebar__title">Panel</h1>
      <p className="sidebar__subtitle">Multi-agent code review</p>
      <div className="sidebar__history">
        <h2>History</h2>
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
    </aside>
  );
}
