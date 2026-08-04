import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { postPrComment } from '../src/tools/post-pr-comment.ts';

function jsonResponse(body: string, ok = true, status = 200): Response {
  return { ok, status, text: async () => body } as unknown as Response;
}

const runContext = {
  toolCallId: 'test-call',
  signal: new AbortController().signal,
  log: console,
};

describe('postPrComment tool', () => {
  beforeEach(() => {
    vi.stubEnv('REPO_API_URL', 'https://forge.example/api/v1');
    vi.stubEnv('REPO_API_TOKEN', 'token123');
    vi.stubEnv('REPO', 'org/repo');
    vi.stubEnv('PR_NUMBER', '42');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('posta o comentário no endpoint de issues do PR com o token correto', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(''));
    vi.stubGlobal('fetch', fetchMock);

    const result = await postPrComment.run({
      ...runContext,
      data: { body: '# Review\nLooks good.' },
    } as never);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://forge.example/api/v1/repos/org/repo/issues/42/comments',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: 'token token123',
        }),
        body: JSON.stringify({ body: '# Review\nLooks good.' }),
      }),
    );
    expect(result).toEqual({ output: { status: 'success' } });
  });

  it('propaga erro de requisição falha', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse('nope', false, 500)));

    await expect(
      postPrComment.run({ ...runContext, data: { body: 'x' } } as never),
    ).rejects.toThrow(/500/);
  });
});
