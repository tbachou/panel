import { useState } from 'react';
import type { Finding } from '@shared/types';
import { AGENT_LABELS } from '@shared/types';

const SEVERITY_ORDER: Finding['severity'][] = ['critical', 'high', 'medium', 'low'];

export function FindingsList({ findings }: { findings: Finding[] }) {
  if (findings.length === 0) {
    return <p className="empty-state">No findings. Clean diff.</p>;
  }

  const sorted = [...findings].sort(
    (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity),
  );

  return (
    <ul className="findings-list">
      {sorted.map((finding) => (
        <FindingRow key={finding.id} finding={finding} />
      ))}
    </ul>
  );
}

function FindingRow({ finding }: { finding: Finding }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <li className="finding">
      <button className="finding__header" onClick={() => setExpanded((e) => !e)}>
        <span className={`severity-badge severity-badge--${finding.severity}`}>{finding.severity}</span>
        <span className="finding__location">
          {finding.file}
          {finding.line !== null ? `:${finding.line}` : ''}
        </span>
        <span className="finding__summary">{finding.summary}</span>
        <span className="agent-tag">{AGENT_LABELS[finding.agent]}</span>
      </button>
      {expanded ? <p className="finding__detail">{finding.detail}</p> : null}
    </li>
  );
}
