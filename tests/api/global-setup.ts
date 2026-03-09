import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const API_HOST = '127.0.0.1';
const API_PORT = 4000;
const HEALTH_URL = `http://${API_HOST}:${API_PORT}/api/health`;
const DB_PATH = path.resolve(process.cwd(), 'backend/data/db.json');

async function waitForHealth(url: string, timeoutMs = 20_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`API health check timeout: ${url}`);
}

function killProcess(child: ChildProcessWithoutNullStreams): Promise<void> {
  return new Promise((resolve) => {
    if (child.killed) {
      resolve();
      return;
    }
    child.once('exit', () => resolve());
    child.kill('SIGTERM');
    setTimeout(() => {
      if (!child.killed) child.kill('SIGKILL');
    }, 2_000);
  });
}

export default async function globalSetup() {
  const dbBackup = fs.existsSync(DB_PATH) ? fs.readFileSync(DB_PATH, 'utf8') : null;
  process.env.TEST_API_BASE_URL = `http://${API_HOST}:${API_PORT}`;

  // Reuse an already running local API if available.
  try {
    await waitForHealth(HEALTH_URL, 1_500);
    return async () => {};
  } catch {
    // fall through and spawn local API server
  }

  const child = spawn(process.execPath, ['backend/server.js'], {
    cwd: process.cwd(),
    stdio: 'pipe',
    env: {
      ...process.env,
      API_HOST,
      API_PORT: String(API_PORT),
    },
  });

  child.stdout.on('data', () => {});
  child.stderr.on('data', () => {});

  await waitForHealth(HEALTH_URL);

  return async () => {
    await killProcess(child);

    if (dbBackup !== null) {
      fs.writeFileSync(DB_PATH, dbBackup, 'utf8');
    }
  };
}
