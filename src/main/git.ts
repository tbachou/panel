import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { DiffFile } from '@shared/types';

const execFileAsync = promisify(execFile);

async function git(repoPath: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', args, { cwd: repoPath, maxBuffer: 1024 * 1024 * 32 });
  return stdout;
}

export async function isGitRepo(repoPath: string): Promise<boolean> {
  try {
    await git(repoPath, ['rev-parse', '--is-inside-work-tree']);
    return true;
  } catch {
    return false;
  }
}

export async function getCurrentBranch(repoPath: string): Promise<string> {
  const out = await git(repoPath, ['rev-parse', '--abbrev-ref', 'HEAD']);
  return out.trim();
}

/**
 * Staged changes if any exist, otherwise the working-tree diff against HEAD.
 * That order matches how a developer actually uses this: review what you're
 * about to commit if you've staged something, otherwise review what you've
 * touched so far.
 */
export async function getDiff(repoPath: string): Promise<{ raw: string; files: DiffFile[] }> {
  const staged = await git(repoPath, ['diff', '--staged']);
  const raw = staged.trim().length > 0 ? staged : await git(repoPath, ['diff']);
  return { raw, files: splitByFile(raw) };
}

function splitByFile(raw: string): DiffFile[] {
  if (!raw.trim()) return [];
  const chunks = raw.split(/^diff --git /m).filter(Boolean);
  return chunks.map((chunk) => {
    const header = chunk.split('\n')[0] ?? '';
    const match = header.match(/a\/(.+?) b\/(.+)/);
    const path = match ? match[2] : header.trim();
    return { path, hunks: [`diff --git ${chunk}`] };
  });
}
