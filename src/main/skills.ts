import { app } from 'electron';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { AgentId } from '@shared/types';

const SKILL_FILE: Record<AgentId, string> = {
  security: 'security.md',
  correctness: 'correctness.md',
  simplification: 'simplification.md',
};

const cache = new Map<string, string>();

/**
 * Dev mode: app.getAppPath() is the project root, so `skills/` sits right
 * next to it. Packaged builds need `skills/` shipped as an extraResource
 * (see electron-builder.yml) pointing at the same relative layout.
 */
async function loadFile(relativePath: string): Promise<string> {
  const cached = cache.get(relativePath);
  if (cached) return cached;
  const fullPath = app.isPackaged
    ? join(process.resourcesPath, 'skills', relativePath)
    : join(app.getAppPath(), 'skills', relativePath);
  const content = await readFile(fullPath, 'utf-8');
  cache.set(relativePath, content);
  return content;
}

export function loadReviewerSkill(agent: AgentId): Promise<string> {
  return loadFile(SKILL_FILE[agent]);
}

export function loadOrchestratorSkill(): Promise<string> {
  return loadFile('orchestrator.md');
}
