import { spawn } from 'node:child_process';
import path from 'node:path';

import { pythonBin, REPO_ROOT } from './env.js';

/** Runs scripts/publish/<script> with `input` as JSON on stdin; resolves its JSON stdout. */
export function runPythonScript<T>(script: string, input: unknown): Promise<T> {
  const file = path.join(REPO_ROOT, 'scripts/publish', script);
  return new Promise((resolve, reject) => {
    const child = spawn(pythonBin(), [file], {
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8').on('data', (d: string) => (stdout += d));
    child.stderr.setEncoding('utf8').on('data', (d: string) => (stderr += d));
    child.on('error', (e) =>
      reject(new Error(`Cannot start Python (${pythonBin()}): ${e.message}. Check PYTHON_BIN.`)),
    );
    child.on('close', (code) => {
      if (code !== 0) return reject(new Error(`${script} failed (exit ${code}):\n${stderr}`));
      try {
        resolve(JSON.parse(stdout) as T);
      } catch {
        reject(new Error(`${script} returned invalid JSON:\n${stdout.slice(0, 500)}`));
      }
    });
    child.stdin.end(JSON.stringify(input), 'utf8');
  });
}
