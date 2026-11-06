import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { MONOREPO_ROOT, loadEnv } from './env.js';

describe('loadEnv monorepo .env resolution', () => {
  it('points MONOREPO_ROOT to the repository root containing package.json and loads defaults/env cleanly', () => {
    expect(fs.existsSync(path.join(MONOREPO_ROOT, 'pnpm-workspace.yaml'))).toBe(
      true,
    );

    const loaded = loadEnv({ NODE_ENV: 'development' });
    expect(loaded.PORT).toBeGreaterThan(0);
    expect(loaded.COOKIE_SECRET.length).toBeGreaterThanOrEqual(32);
    expect(loaded.LOCAL_STORAGE_PATH.startsWith(MONOREPO_ROOT)).toBe(true);
    expect(loaded.DATABASE_URL).toContain(MONOREPO_ROOT);
  });
});
