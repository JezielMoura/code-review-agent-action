import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getPrDiff, loadFilteredDiff } from '../src/tools/get-pr-diff.ts';

const runContext = {
  toolCallId: 'test-call',
  signal: new AbortController().signal,
  log: console,
};

interface TestRepo {
  dir: string;
  write(path: string, content: string): void;
  git(args: string[]): string;
  teardown(): void;
}

function createGitRepo(): TestRepo {
  const dir = mkdtempSync(join(tmpdir(), 'pr-diff-test-'));
  const git = (args: string[]) =>
    execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

  git(['init', '-b', 'main']);
  git(['config', 'user.email', 'test@example.com']);
  git(['config', 'user.name', 'Test']);
  git(['config', 'commit.gpgsign', 'false']);
  git(['config', 'tag.gpgsign', 'false']);

  const write = (path: string, content: string) => {
    const segments = path.split('/');
    if (segments.length > 1) {
      mkdirSync(join(dir, ...segments.slice(0, -1)), { recursive: true });
    }
    writeFileSync(join(dir, ...segments), content);
  };

  return { dir, write, git, teardown: () => rmSync(dir, { recursive: true, force: true }) };
}

let repo: TestRepo;

beforeEach(() => {
  repo = createGitRepo();

  repo.write('src/App.ts', 'const x = 1;\n');
  repo.write('main.py', 'print(1)\n');
  repo.git(['add', '.']);
  repo.git(['commit', '-m', 'base']);

  repo.git(['checkout', '-b', 'feature']);
  repo.write('src/App.ts', 'const x = 2;\n');
  repo.write('main.py', 'print(2)\n');
  repo.git(['add', '.']);
  repo.git(['commit', '-m', 'changes']);

  vi.stubEnv('WORKSPACE_PATH', repo.dir);
  vi.stubEnv('BASE_REF', 'main');
  vi.stubEnv('PR_NUMBER', '42');
  vi.stubEnv('FILE_PATTERNS', '**/*.ts');
  vi.stubEnv('MAX_DIFF_SIZE', '60000');
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  repo.teardown();
});

describe('loadFilteredDiff', () => {
  it('calcula o diff localmente via git diff (merge-base vs head)', async () => {
    const diff = await loadFilteredDiff(42);

    expect(diff).toContain('diff --git a/src/App.ts b/src/App.ts');
    expect(diff).toContain('-const x = 1;');
    expect(diff).toContain('+const x = 2;');
  });

  it('mantém apenas os arquivos que casam com os padrões', async () => {
    const diff = await loadFilteredDiff(43);

    expect(diff).toContain('src/App.ts');
    expect(diff).not.toContain('main.py');
    expect(diff).not.toContain('print(');
  });

  it('retorna diff vazio quando nenhum arquivo relevante foi alterado', async () => {
    vi.stubEnv('FILE_PATTERNS', '**/*.cs');

    const diff = await loadFilteredDiff(44);
    expect(diff).toBe('');
  });

  it('detecta renames e usa o caminho novo no filtro de padrões', async () => {
    repo.git(['checkout', 'main']);
    repo.git(['branch', '-D', 'feature']);
    repo.git(['checkout', '-b', 'feature']);
    repo.git(['mv', 'src/App.ts', 'src/AppComponent.ts']);
    repo.git(['commit', '-m', 'rename']);

    const diff = await loadFilteredDiff(45);
    expect(diff).toContain('diff --git a/src/App.ts b/src/AppComponent.ts');
    expect(diff).toContain('rename from src/App.ts');
    expect(diff).toContain('rename to src/AppComponent.ts');
    expect(diff).not.toContain('main.py');
  });

  it('mantém arquivos com nomes não-ASCII (caminhos citados pelo git)', async () => {
    repo.git(['checkout', 'main']);
    repo.git(['branch', '-D', 'feature']);
    repo.git(['checkout', '-b', 'feature']);
    repo.write('src/Café.ts', 'const café = 1;\n');
    repo.git(['add', '.']);
    repo.git(['commit', '-m', 'accented']);

    const diff = await loadFilteredDiff(50);
    expect(diff).not.toBe('');
    expect(diff).toContain('café');
  });

  it('mantém arquivos cujo caminho contém a sequência " b/"', async () => {
    repo.git(['checkout', 'main']);
    repo.git(['branch', '-D', 'feature']);
    repo.git(['checkout', '-b', 'feature']);
    repo.write('a b/c.ts', 'x = 1;\n');
    repo.git(['add', '.']);
    repo.git(['commit', '-m', 'space']);

    const diff = await loadFilteredDiff(51);
    expect(diff).toContain('a b/c.ts');
  });

  it('mantém arquivos deletados no diff filtrado', async () => {
    repo.git(['checkout', 'main']);
    repo.git(['branch', '-D', 'feature']);
    repo.git(['checkout', '-b', 'feature']);
    repo.git(['rm', 'src/App.ts']);
    repo.git(['commit', '-m', 'delete']);

    const diff = await loadFilteredDiff(52);
    expect(diff).toContain('diff --git a/src/App.ts b/src/App.ts');
    expect(diff).toContain('-const x = 1;');
  });

  it('trunca o diff respeitando o limite de tamanho', async () => {
    vi.stubEnv('MAX_DIFF_SIZE', '60');

    const diff = await loadFilteredDiff(46);
    expect(diff.length).toBeLessThanOrEqual(60 + '[diff truncated at size limit: 60 characters]'.length + 2);
    expect(diff).toContain('diff truncated at size limit: 60 characters');
  });

  it('rejeita MAX_DIFF_SIZE inválido', async () => {
    vi.stubEnv('MAX_DIFF_SIZE', 'abc');

    await expect(loadFilteredDiff(47)).rejects.toThrow(/MAX_DIFF_SIZE/);
  });

  it('rejeita MAX_DIFF_SIZE com sufixo não numérico', async () => {
    vi.stubEnv('MAX_DIFF_SIZE', '60px');

    await expect(loadFilteredDiff(53)).rejects.toThrow(/MAX_DIFF_SIZE/);
  });

  it('rejeita falta de BASE_REF', async () => {
    vi.stubEnv('BASE_REF', '');

    await expect(loadFilteredDiff(48)).rejects.toThrow(/BASE_REF/);
  });

  it('falha com mensagem clara quando o ref base não existe', async () => {
    vi.stubEnv('BASE_REF', 'nao-existe');

    await expect(loadFilteredDiff(49)).rejects.toThrow(/git diff falhou/);
  });
});

describe('getPrDiff tool', () => {
  it('usa o número do PR vindo do ambiente (não do modelo)', async () => {
    vi.stubEnv('PR_NUMBER', '100');

    const result = await getPrDiff.run(runContext as never);

    expect(result).toEqual({ output: { diff: expect.stringContaining('src/App.ts') } });
  });
});
