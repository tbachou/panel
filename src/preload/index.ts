import { contextBridge, ipcRenderer } from 'electron';
import { IPC, type AgentProgress, type ReviewResult } from '@shared/types';

const api = {
  selectRepo: (): Promise<string | null> => ipcRenderer.invoke(IPC.selectRepo),
  getDiff: (repoPath: string): Promise<{ raw: string; files: string[]; branch: string }> =>
    ipcRenderer.invoke(IPC.getDiff, repoPath),
  runReview: (repoPath: string): Promise<ReviewResult> => ipcRenderer.invoke(IPC.runReview, repoPath),
  getHistory: (): Promise<ReviewResult[]> => ipcRenderer.invoke(IPC.reviewHistory),
  clearHistory: (): Promise<void> => ipcRenderer.invoke(IPC.clearHistory),
  hasApiKey: (): Promise<boolean> => ipcRenderer.invoke(IPC.hasApiKey),
  setApiKey: (key: string): Promise<void> => ipcRenderer.invoke(IPC.setApiKey, key),
  clearApiKey: (): Promise<boolean> => ipcRenderer.invoke(IPC.clearApiKey),
  onAgentProgress: (callback: (progress: AgentProgress) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, progress: AgentProgress) => callback(progress);
    ipcRenderer.on(IPC.agentProgress, listener);
    return () => ipcRenderer.removeListener(IPC.agentProgress, listener);
  },
};

export type PanelApi = typeof api;

contextBridge.exposeInMainWorld('panel', api);
