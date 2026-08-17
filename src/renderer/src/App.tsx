import { useEffect, useState } from 'react';
import type { AgentId, AgentProgress, AgentStatus, ReviewResult } from '@shared/types';
import { AGENT_LABELS } from '@shared/types';
import { AgentStatusRow } from './components/AgentStatusRow';
import { ApiKeyScreen } from './components/ApiKeyScreen';
import { FindingsList } from './components/FindingsList';
import { HistorySidebar } from './components/HistorySidebar';

type Diff = { raw: string; files: string[]; branch: string };
type KeyStatus = 'checking' | 'missing' | 'present' | 'skipped';

const AGENTS: AgentId[] = ['security', 'correctness', 'simplification'];
const INITIAL_STATUSES: Record<AgentId, AgentStatus> = {
  security: 'pending',
  correctness: 'pending',
  simplification: 'pending',
};

export default function App() {
  const [keyStatus, setKeyStatus] = useState<KeyStatus>('checking');

  useEffect(() => {
    void window.panel.hasApiKey().then((present) => setKeyStatus(present ? 'present' : 'missing'));
  }, []);

  return (
    <div className="app-shell">
      <div className="titlebar" />
      {keyStatus === 'checking' ? null : keyStatus === 'missing' ? (
        <ApiKeyScreen onSaved={() => setKeyStatus('present')} onSkip={() => setKeyStatus('skipped')} />
      ) : (
        <ReviewerApp hasKey={keyStatus === 'present'} onClearKey={() => setKeyStatus('missing')} />
      )}
    </div>
  );
}

function ReviewerApp({ hasKey, onClearKey }: { hasKey: boolean; onClearKey: () => void }) {
  const [repoPath, setRepoPath] = useState<string | null>(null);
  const [diff, setDiff] = useState<Diff | null>(null);
  const [statuses, setStatuses] = useState<Record<AgentId, AgentStatus>>(INITIAL_STATUSES);
  const [result, setResult] = useState<ReviewResult | null>(null);
  const [history, setHistory] = useState<ReviewResult[]>([]);
  const [isReviewing, setIsReviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void window.panel.getHistory().then(setHistory);
    return window.panel.onAgentProgress((progress: AgentProgress) => {
      setStatuses((prev) => ({ ...prev, [progress.agent]: progress.status }));
    });
  }, []);

  async function handleSelectRepo() {
    setError(null);
    try {
      const path = await window.panel.selectRepo();
      if (!path) return;
      setRepoPath(path);
      setResult(null);
      setDiff(await window.panel.getDiff(path));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleRunReview() {
    if (!repoPath) return;
    setError(null);
    setIsReviewing(true);
    setResult(null);
    setStatuses(INITIAL_STATUSES);
    try {
      const review = await window.panel.runReview(repoPath);
      setResult(review);
      setHistory((prev) => [review, ...prev]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsReviewing(false);
    }
  }

  async function handleClearKey() {
    await window.panel.clearApiKey();
    onClearKey();
  }

  async function handleClearHistory() {
    await window.panel.clearHistory();
    setHistory([]);
  }

  return (
    <div className="app">
      <HistorySidebar
        history={history}
        hasKey={hasKey}
        onClearKey={handleClearKey}
        onClearHistory={handleClearHistory}
        onSelect={(review) => {
          setResult(review);
          setRepoPath(review.repoPath);
        }}
      />
      <main className="main">
        <header className="toolbar">
          <button onClick={handleSelectRepo} disabled={isReviewing}>
            {repoPath ? 'Change repo' : 'Select repo'}
          </button>
          {repoPath ? <span className="repo-path">{repoPath}</span> : null}
          {diff ? <span className="branch-tag">{diff.branch}</span> : null}
          <div className="spacer" />
          {!hasKey ? (
            <button className="link-hint" onClick={onClearKey}>
              Add an API key to run reviews →
            </button>
          ) : null}
          <button
            className="primary"
            onClick={handleRunReview}
            disabled={!repoPath || !hasKey || isReviewing}
            title={!hasKey ? 'Add an API key first' : undefined}
          >
            {isReviewing ? 'Reviewing…' : 'Run review'}
          </button>
        </header>

        {error ? <div className="error-banner">{error}</div> : null}

        {diff && diff.files.length === 0 && !isReviewing && !result ? (
          <p className="empty-state">No staged or working-tree changes in this repo right now.</p>
        ) : null}

        {(() => {
          // Once a review has run, its freshly-fetched file list is the
          // source of truth for what was actually reviewed — the diff
          // snapshot from repo selection can be stale (or reflect a
          // different staged/unstaged state) by the time review ran.
          const files = result ? result.files : diff?.files ?? [];
          if (files.length === 0) return null;
          return (
            <p className="diff-summary">
              {files.length} file{files.length === 1 ? '' : 's'} {result ? 'reviewed' : 'changed'}:{' '}
              {files.join(', ')}
            </p>
          );
        })()}

        {isReviewing || result ? (
          <div className="agent-row">
            {AGENTS.map((agent) => (
              <AgentStatusRow key={agent} label={AGENT_LABELS[agent]} status={statuses[agent]} />
            ))}
          </div>
        ) : null}

        {result ? <FindingsList findings={result.findings} /> : null}
      </main>
    </div>
  );
}
