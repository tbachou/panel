import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { lstat, readFile, realpath } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
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
 *
 * Neither `git diff` nor `git diff --staged` ever shows a file that's never
 * been `git add`ed at all — git considers that "untracked," not a diff, no
 * matter which mode you're in. Left alone, that means a brand-new file is
 * completely invisible to review. We union in a synthetic "new file" diff
 * chunk per untracked file so nothing silently drops out.
 */
export async function getDiff(repoPath: string): Promise<{ raw: string; files: DiffFile[] }> {
  const staged = await git(repoPath, ['diff', '--staged']);
  const tracked = staged.trim().length > 0 ? staged : await git(repoPath, ['diff']);
  const untracked = await getUntrackedDiff(repoPath);
  const raw = [tracked, untracked].filter((chunk) => chunk.trim().length > 0).join('\n');
  return { raw, files: splitByFile(raw) };
}

const MAX_UNTRACKED_FILE_BYTES = 512 * 1024;

async function getUntrackedDiff(repoPath: string): Promise<string> {
  const status = await git(repoPath, ['status', '--porcelain', '--untracked-files=all']);
  const paths = status
    .split('\n')
    .filter((line) => line.startsWith('?? '))
    .map((line) => line.slice(3).trim())
    .filter(Boolean);

  const repoRealPath = await realpath(repoPath).catch(() => repoPath);

  const chunks = await Promise.all(
    paths.map(async (path) => {
      try {
        const fullPath = join(repoPath, path);

        // An untracked path can be a symlink (git reports the link itself
        // without following it, e.g. "?? leak -> /etc/passwd"). readFile
        // below *does* follow symlinks, so a maliciously crafted repo could
        // otherwise trick us into reading and exfiltrating (into the LLM
        // prompt, the UI, and disk history) any file the OS user can read.
        // Skip anything that isn't a plain regular file, and independently
        // confirm the resolved real path never leaves the repo directory.
        const stat = await lstat(fullPath);
        if (!stat.isFile()) {
          return `diff --git a/${path} b/${path}\nnew file (not a regular file; skipped)\n`;
        }
        const realTarget = await realpath(fullPath);
        const rel = relative(repoRealPath, realTarget);
        if (rel.startsWith('..') || rel.split(sep).includes('..')) {
          return `diff --git a/${path} b/${path}\nnew file (resolves outside the repo; skipped)\n`;
        }

        const content = await readFile(fullPath);
        if (content.includes(0) || content.byteLength > MAX_UNTRACKED_FILE_BYTES) {
          // Binary or too large to usefully review inline; note its
          // existence without dumping unreadable/oversized content.
          return `diff --git a/${path} b/${path}\nnew file (binary or too large to include content)\n`;
        }
        const lines = content.toString('utf-8').split('\n');
        const body = lines.map((line) => `+${line}`).join('\n');
        return `diff --git a/${path} b/${path}\nnew file mode 100644\n--- /dev/null\n+++ b/${path}\n@@ -0,0 +1,${lines.length} @@\n${body}\n`;
      } catch {
        return '';
      }
    }),
  );
  return chunks.filter(Boolean).join('\n');
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
