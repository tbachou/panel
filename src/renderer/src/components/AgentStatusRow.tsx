import type { AgentStatus } from '@shared/types';

const STATUS_LABEL: Record<AgentStatus, string> = {
  pending: 'Waiting',
  running: 'Reviewing…',
  done: 'Done',
  error: 'Failed',
};

export function AgentStatusRow({ label, status }: { label: string; status: AgentStatus }) {
  return (
    <div className={`agent-pill agent-pill--${status}`}>
      <span className="agent-pill__dot" />
      <span className="agent-pill__label">{label}</span>
      <span className="agent-pill__status">{STATUS_LABEL[status]}</span>
    </div>
  );
}
