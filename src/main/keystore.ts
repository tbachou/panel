import { app, safeStorage } from 'electron';
import { readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * safeStorage encrypts with an OS-managed key (Keychain on macOS, DPAPI on
 * Windows, libsecret on Linux) that never touches our code — the ciphertext
 * on disk is only decryptable by this same OS user account on this same
 * machine. That's why this file, unlike review-history.json, is safe to
 * leave unencrypted-at-rest as far as *this app* is concerned: the OS layer
 * is doing the real protection.
 */
function keyPath(): string {
  return join(app.getPath('userData'), 'apikey.enc');
}

export async function getStoredApiKey(): Promise<string | null> {
  if (!safeStorage.isEncryptionAvailable()) return null;
  try {
    const encrypted = await readFile(keyPath());
    return safeStorage.decryptString(encrypted);
  } catch {
    return null;
  }
}

export async function hasStoredApiKey(): Promise<boolean> {
  return (await getStoredApiKey()) !== null;
}

export async function setStoredApiKey(key: string): Promise<void> {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error(
      'This OS has no available credential store (Keychain/DPAPI/libsecret) for Electron to encrypt with.',
    );
  }
  const encrypted = safeStorage.encryptString(key.trim());
  await writeFile(keyPath(), encrypted);
}

export async function clearStoredApiKey(): Promise<void> {
  await rm(keyPath(), { force: true });
}

/** Persisted key wins if set; falls back to ANTHROPIC_API_KEY (e.g. from .env) for local dev convenience. */
export async function resolveApiKey(): Promise<string | null> {
  const stored = await getStoredApiKey();
  if (stored) return stored;
  return process.env.ANTHROPIC_API_KEY ?? null;
}
