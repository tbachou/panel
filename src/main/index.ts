import 'dotenv/config';
import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { is } from '@electron-toolkit/utils';
import { IPC, type AgentId, type Finding, type ReviewResult } from '@shared/types';
import { getCurrentBranch, getDiff, isGitRepo } from './git';
import { runOrchestrator, runReviewer } from './agents';
import { loadHistory, saveReview } from './store';

type RawFindings = Omit<Finding, 'id' | 'agent'>[];

function createWindow(): void {
  const window = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
    },
  });

  window.on('ready-to-show', () => window.show());
  window.webContents.setWindowOpenHandler((details) => {
    void shell.openExternal(details.url);
    return { action: 'deny' };
  });

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    void window.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(() => {
  registerIpcHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

function registerIpcHandlers(): void {
  ipcMain.handle(IPC.selectRepo, async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
    if (result.canceled || result.filePaths.length === 0) return null;
    const repoPath = result.filePaths[0];
    if (!(await isGitRepo(repoPath))) {
      throw new Error(`${repoPath} is not a git repository.`);
    }
    return repoPath;
  });

  ipcMain.handle(IPC.getDiff, async (_event, repoPath: string) => {
    const [{ raw, files }, branch] = await Promise.all([getDiff(repoPath), getCurrentBranch(repoPath)]);
    return { raw, files: files.map((f) => f.path), branch };
  });

  ipcMain.handle(IPC.runReview, async (event, repoPath: string) => {
    const sender = event.sender;
    const emit = (agent: AgentId, status: 'running' | 'done' | 'error', error?: string) =>
      sender.send(IPC.agentProgress, { agent, status, error });

    const [{ raw, files }, branch] = await Promise.all([getDiff(repoPath), getCurrentBranch(repoPath)]);
    if (!raw.trim()) {
      return { id: randomUUID(), repoPath, branch, createdAt: new Date().toISOString(), files: [], findings: [] } satisfies ReviewResult;
    }

    const agents: AgentId[] = ['security', 'correctness', 'simplification'];
    agents.forEach((agent) => emit(agent, 'running'));

    // Promise.allSettled, not all: one reviewer erroring shouldn't sink the
    // other two, since each is an independent lens on the same diff.
    const settled = await Promise.allSettled(
      agents.map(async (agent) => {
        try {
          const findings = await runReviewer(agent, raw);
          emit(agent, 'done');
          return findings;
        } catch (err) {
          emit(agent, 'error', err instanceof Error ? err.message : String(err));
          throw err;
        }
      }),
    );
    const byAgent: Record<AgentId, RawFindings> = { security: [], correctness: [], simplification: [] };
    settled.forEach((result, i) => {
      if (result.status === 'fulfilled') byAgent[agents[i]] = result.value;
    });

    const findings = await runOrchestrator(byAgent);

    const review: ReviewResult = {
      id: randomUUID(),
      repoPath,
      branch,
      createdAt: new Date().toISOString(),
      files: files.map((f) => f.path),
      findings,
    };
    await saveReview(review);
    return review;
  });

  ipcMain.handle(IPC.reviewHistory, async () => loadHistory());
}
