import Anthropic from '@anthropic-ai/sdk';
import { randomUUID } from 'node:crypto';
import type { AgentId, Finding, Severity } from '@shared/types';
import { loadOrchestratorSkill, loadReviewerSkill } from './skills';
import { resolveApiKey } from './keystore';

const MODEL = 'claude-sonnet-4-5';

let client: Anthropic | null = null;
let cachedKey: string | null = null;

/** Re-checks the resolved key each call (cheap) so a key entered mid-session takes effect without a restart. */
async function getClient(): Promise<Anthropic> {
  const apiKey = await resolveApiKey();
  if (!apiKey) throw new Error('No Anthropic API key set. Add one in Panel\'s settings.');
  if (!client || apiKey !== cachedKey) {
    client = new Anthropic({ apiKey });
    cachedKey = apiKey;
  }
  return client;
}

interface RawFinding {
  file: string;
  line: number | null;
  severity: Severity;
  summary: string;
  detail: string;
}

const REVIEWER_TOOL: Anthropic.Tool = {
  name: 'report_findings',
  description: 'Report the findings from reviewing this diff, in your assigned lens only.',
  input_schema: {
    type: 'object',
    properties: {
      findings: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            file: { type: 'string', description: 'File path exactly as it appears in the diff.' },
            line: { type: ['integer', 'null'], description: 'Line number in the new file version, or null if not line-specific.' },
            severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
            summary: { type: 'string', description: 'One-sentence statement of the issue.' },
            detail: { type: 'string', description: 'The concrete failure scenario: what triggers it and what breaks.' },
          },
          required: ['file', 'line', 'severity', 'summary', 'detail'],
        },
      },
    },
    required: ['findings'],
  },
};

async function callTool(system: string, userContent: string, tool: Anthropic.Tool): Promise<RawFinding[]> {
  const client = await getClient();
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system,
    tools: [tool],
    tool_choice: { type: 'tool', name: tool.name },
    messages: [{ role: 'user', content: userContent }],
  });

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
  );
  if (!toolUse) return [];
  const input = toolUse.input as { findings?: RawFinding[] };
  return input.findings ?? [];
}

/** Runs one specialist reviewer against the diff. Findings come back without id/agent — the caller stamps those on. */
export async function runReviewer(agent: AgentId, diff: string): Promise<RawFinding[]> {
  const skill = await loadReviewerSkill(agent);
  return callTool(skill, `Review this diff:\n\n${diff}`, REVIEWER_TOOL);
}

/** Merges the three specialists' raw output into one ranked, deduped list via a fourth orchestrator call. */
export async function runOrchestrator(
  byAgent: Record<AgentId, RawFinding[]>,
): Promise<Finding[]> {
  const skill = await loadOrchestratorSkill();
  const payload = JSON.stringify(byAgent, null, 2);
  const merged = await callTool(
    skill,
    `Here are the three reviewers' raw findings, keyed by agent:\n\n${payload}`,
    REVIEWER_TOOL,
  );

  // The orchestrator doesn't know which agent originated a merged finding, so
  // attribute it to whichever specialist's raw output the file+summary most
  // closely matches; default to correctness if none match cleanly.
  return merged.map((f) => ({
    id: randomUUID(),
    agent: attributeAgent(f, byAgent),
    file: f.file,
    line: f.line,
    severity: f.severity,
    summary: f.summary,
    detail: f.detail,
  }));
}

function attributeAgent(finding: RawFinding, byAgent: Record<AgentId, RawFinding[]>): AgentId {
  for (const agent of Object.keys(byAgent) as AgentId[]) {
    if (byAgent[agent].some((raw) => raw.file === finding.file)) return agent;
  }
  return 'correctness';
}

/** Runs all three specialists concurrently — this is the "multiple agents at once" step. */
export async function runAllReviewers(diff: string): Promise<Record<AgentId, RawFinding[]>> {
  const agents: AgentId[] = ['security', 'correctness', 'simplification'];
  const results = await Promise.all(agents.map((agent) => runReviewer(agent, diff)));
  return {
    security: results[0],
    correctness: results[1],
    simplification: results[2],
  };
}
