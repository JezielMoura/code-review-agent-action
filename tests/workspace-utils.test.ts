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
  it('usa WORKSPACE_PATH quando definido (caminho absoluto)', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'ws-test-'));
    process.env.WORKSPACE_PATH = tempDir;
    expect(getWorkspacePath()).toBe(tempDir);
  });

  it('resolve WORKSPACE_PATH relativo contra o cwd', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'ws-test-'));
    const target = join(tempDir, 'repos', 'app');
    mkdirSync(target, { recursive: true });
    vi.spyOn(process, 'cwd').mockReturnValue(tempDir);
    process.env.WORKSPACE_PATH = 'repos/app';
    expect(getWorkspacePath()).toBe(target);
  });

  it('cai para o cwd quando WORKSPACE_PATH não está definido', () => {
    delete process.env.WORKSPACE_PATH;
    const cwd = process.cwd();
    expect(getWorkspacePath()).toBe(cwd);
  });

  it('lança erro quando WORKSPACE_PATH não é um diretório', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'ws-test-'));
    process.env.WORKSPACE_PATH = join(tempDir, 'nao-existe');
    expect(() => getWorkspacePath()).toThrow(/WORKSPACE_PATH is not a valid directory/);
  });
});
