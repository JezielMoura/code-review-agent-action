import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getWorkspacePath } from '../src/utils/workspace-utils.ts';

const originalEnv = { ...process.env };
let tempDir: string | undefined;

afterEach(() => {
  process.env = { ...originalEnv };
  if (tempDir) {
    rmSync(tempDir, { recursive: true, force: true });
    tempDir = undefined;
  }
  vi.restoreAllMocks();
});

describe('getWorkspacePath', () => {
  it('uses WORKSPACE_PATH when defined (absolute path)', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'ws-test-'));
    process.env.WORKSPACE_PATH = tempDir;
    expect(getWorkspacePath()).toBe(tempDir);
  });

  it('resolves a relative WORKSPACE_PATH against cwd', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'ws-test-'));
    const target = join(tempDir, 'repos', 'app');
    mkdirSync(target, { recursive: true });
    vi.spyOn(process, 'cwd').mockReturnValue(tempDir);
    process.env.WORKSPACE_PATH = 'repos/app';
    expect(getWorkspacePath()).toBe(target);
  });

  it('falls back to cwd when WORKSPACE_PATH is not set', () => {
    delete process.env.WORKSPACE_PATH;
    const cwd = process.cwd();
    expect(getWorkspacePath()).toBe(cwd);
  });

  it('throws when WORKSPACE_PATH is not a directory', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'ws-test-'));
    process.env.WORKSPACE_PATH = join(tempDir, 'does-not-exist');
    expect(() => getWorkspacePath()).toThrow(/WORKSPACE_PATH is not a valid directory/);
  });
});
