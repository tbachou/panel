import { useEffect, useState } from 'react';
import type { AgentId, AgentProgress, AgentStatus, ReviewResult } from '@shared/types';
import { AGENT_LABELS } from '@shared/types';
import { AgentStatusRow } from './components/AgentStatusRow';
import { FindingsList } from './components/FindingsList';
import { HistorySidebar } from './components/HistorySidebar';

type Diff = { raw: string; files: string[]; branch: string };

const AGENTS: AgentId[] = ['security', 'correctness', 'simplification'];
const INITIAL_STATUSES: Record<AgentId, AgentStatus> = {
  security: 'pending',
  correctness: 'pending',
  simplification: 'pending',
};

export default function App() {
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

  return (
    <div className="app">
      <HistorySidebar
        history={history}
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
          <button className="primary" onClick={handleRunReview} disabled={!repoPath || isReviewing}>
            {isReviewing ? 'Reviewing…' : 'Run review'}
          </button>
        </header>

        {error ? <div className="error-banner">{error}</div> : null}

        {diff && diff.files.length === 0 && !isReviewing ? (
          <p className="empty-state">No staged or working-tree changes in this repo right now.</p>
        ) : null}

        {diff && diff.files.length > 0 ? (
          <p className="diff-summary">
            {diff.files.length} file{diff.files.length === 1 ? '' : 's'} changed: {diff.files.join(', ')}
          </p>
        ) : null}

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
