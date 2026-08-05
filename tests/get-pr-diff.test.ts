import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getPrDiff, loadFilteredDiff } from '../src/tools/get-pr-diff.ts';

const TS_DIFF = [
  'diff --git a/src/App.ts b/src/App.ts',
  'index abc123..def456 100644',
  '--- a/src/App.ts',
  '+++ b/src/App.ts',
  '@@ -1,2 +1,2 @@',
  '-const x = 1;',
  '+const x = 2;',
].join('\n');

const PY_DIFF = [
  'diff --git a/main.py b/main.py',
  'index abc123..def456 100644',
  '--- a/main.py',
  '+++ b/main.py',
  '@@ -1 +1 @@',
  '-print(1)',
  '+print(2)',
].join('\n');

function jsonResponse(body: string, ok = true, status = 200): Response {
  return { ok, status, text: async () => body } as unknown as Response;
}

const runContext = {
  toolCallId: 'test-call',
  signal: new AbortController().signal,
  log: console,
};

describe('loadFilteredDiff', () => {
  beforeEach(() => {
    vi.stubEnv('REPO_API_URL', 'https://forge.example/api/v1');
    vi.stubEnv('REPO_API_TOKEN', 'token123');
    vi.stubEnv('REPO', 'org/repo');
    vi.stubEnv('PR_NUMBER', '42');
    vi.stubEnv('FILE_PATTERNS', '**/*.ts');
    vi.stubEnv('MAX_DIFF_SIZE', '60000');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('busca o diff no endpoint correto de pull requests (github)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(TS_DIFF));
    vi.stubGlobal('fetch', fetchMock);

    const diff = await loadFilteredDiff(42);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://forge.example/api/v1/repos/org/repo/pulls/42',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'token token123',
          Accept: 'application/vnd.github.v3.diff',
        }),
      }),
    );
    expect(diff).toContain('src/App.ts');
  });

  it('busca o diff com sufixo .diff quando repo-api-kind é forgejo', async () => {
    vi.stubEnv('REPO_API_KIND', 'forgejo');
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(TS_DIFF));
    vi.stubGlobal('fetch', fetchMock);

    const diff = await loadFilteredDiff(46);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://forge.example/api/v1/repos/org/repo/pulls/46.diff',
      expect.anything(),
    );
    expect(diff).toContain('src/App.ts');
  });

  it('rejeita REPO_API_KIND inválido', async () => {
    vi.stubEnv('REPO_API_KIND', 'gitlab');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(TS_DIFF)));

    await expect(loadFilteredDiff(47)).rejects.toThrow(/REPO_API_KIND/);
  });

  it('retorna diff vazio quando nenhum arquivo relevante foi alterado', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(PY_DIFF)));

    const diff = await loadFilteredDiff(43);
    expect(diff).toBe('');
  });

  it('trunca o diff respeitando o limite de tamanho', async () => {
    vi.stubEnv('MAX_DIFF_SIZE', '60');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(TS_DIFF)));

    const diff = await loadFilteredDiff(44);
    expect(diff.length).toBeLessThanOrEqual(60 + '[diff truncated at size limit: 60 characters]'.length + 2);
    expect(diff).toContain('diff truncated at size limit: 60 characters');
  });

  it('rejeita MAX_DIFF_SIZE inválido', async () => {
    vi.stubEnv('MAX_DIFF_SIZE', 'abc');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(TS_DIFF)));

    await expect(loadFilteredDiff(45)).rejects.toThrow(/MAX_DIFF_SIZE/);
  });
});

describe('getPrDiff tool', () => {
  beforeEach(() => {
    vi.stubEnv('REPO_API_URL', 'https://forge.example/api/v1');
    vi.stubEnv('REPO_API_TOKEN', 'token123');
    vi.stubEnv('REPO', 'org/repo');
    vi.stubEnv('PR_NUMBER', '100');
    vi.stubEnv('FILE_PATTERNS', '**/*.ts');
    vi.stubEnv('MAX_DIFF_SIZE', '60000');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('usa o número do PR vindo do ambiente (não do modelo)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(TS_DIFF));
    vi.stubGlobal('fetch', fetchMock);

    const result = await getPrDiff.run(runContext as never);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://forge.example/api/v1/repos/org/repo/pulls/100',
      expect.anything(),
    );
    expect(result).toEqual({ output: { diff: expect.stringContaining('src/App.ts') } });
  });
});
