import type { NextConfig } from 'next';
import { execSync } from 'child_process';

function getGitInfo() {
  try {
    const hash = execSync('git rev-parse --short HEAD', { stdio: ['pipe', 'pipe', 'ignore'] }).toString().trim();
    const date = execSync('git log -1 --format=%ci HEAD', { stdio: ['pipe', 'pipe', 'ignore'] }).toString().trim().slice(0, 10);
    return { hash, date };
  } catch {
    return { hash: 'unknown', date: new Date().toISOString().slice(0, 10) };
  }
}

const { hash, date } = getGitInfo();

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['better-sqlite3'],
  env: {
    NEXT_PUBLIC_BUILD_DATE: date,
    NEXT_PUBLIC_BUILD_COMMIT: hash,
  },
};

export default nextConfig;
