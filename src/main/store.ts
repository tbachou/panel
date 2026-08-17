import { app } from 'electron';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ReviewResult } from '@shared/types';

const MAX_HISTORY = 50;

function historyPath(): string {
  return join(app.getPath('userData'), 'review-history.json');
}

export async function loadHistory(): Promise<ReviewResult[]> {
  try {
    const raw = await readFile(historyPath(), 'utf-8');
    return JSON.parse(raw) as ReviewResult[];
  } catch {
    return [];
  }
}

export async function saveReview(review: ReviewResult): Promise<ReviewResult[]> {
  const history = await loadHistory();
  const next = [review, ...history].slice(0, MAX_HISTORY);
  await mkdir(app.getPath('userData'), { recursive: true });
  await writeFile(historyPath(), JSON.stringify(next, null, 2), 'utf-8');
  return next;
}

export async function clearHistory(): Promise<void> {
  await rm(historyPath(), { force: true });
}
