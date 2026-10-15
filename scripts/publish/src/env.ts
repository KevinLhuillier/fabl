import { config } from 'dotenv';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Repo root (scripts/publish/src → ../../..). */
export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

config({ path: path.join(REPO_ROOT, '.env'), quiet: true });

/**
 * npm runs workspace scripts from the workspace folder; INIT_CWD is where the
 * user actually typed the command, so CLI paths are resolved against it.
 */
export function resolveUserPath(p: string): string {
  return path.resolve(process.env.INIT_CWD ?? process.cwd(), p);
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}. Copy .env.example to .env at the repo root and fill it in.`);
  }
  return value;
}

/**
 * Python executable: PYTHON_BIN if set (relative paths resolved from the repo
 * root), else the project venv in scripts/publish/.venv, else `python`.
 */
export function pythonBin(): string {
  const bin = process.env.PYTHON_BIN;
  if (bin) return bin.includes('/') || bin.includes('\\') ? path.resolve(REPO_ROOT, bin) : bin;

  const venv = path.join(REPO_ROOT, 'scripts/publish/.venv');
  const venvPython =
    process.platform === 'win32'
      ? path.join(venv, 'Scripts/python.exe')
      : path.join(venv, 'bin/python');
  return existsSync(venvPython) ? venvPython : 'python';
}
