export type AgentId = 'security' | 'correctness' | 'simplification';

export const AGENT_LABELS: Record<AgentId, string> = {
  security: 'Security',
  correctness: 'Correctness',
  simplification: 'Simplification',
};

export type Severity = 'critical' | 'high' | 'medium' | 'low';

export interface Finding {
  id: string;
  agent: AgentId;
  file: string;
  line: number | null;
  severity: Severity;
  summary: string;
  detail: string;
}

export type AgentStatus = 'pending' | 'running' | 'done' | 'error';

export interface AgentProgress {
  agent: AgentId;
  status: AgentStatus;
  error?: string;
}

export interface DiffFile {
  path: string;
  hunks: string[];
}

export interface ReviewResult {
  id: string;
  repoPath: string;
  branch: string;
  createdAt: string;
  files: string[];
  findings: Finding[];
}

/** Renderer -> main -> renderer event names, kept in one place so both sides stay in sync. */
export const IPC = {
  selectRepo: 'panel:selectRepo',
  getDiff: 'panel:getDiff',
  runReview: 'panel:runReview',
  agentProgress: 'panel:agentProgress',
  reviewHistory: 'panel:reviewHistory',
} as const;
