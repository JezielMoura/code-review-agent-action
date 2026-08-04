import { describe, expect, it } from 'vitest';
import {
  filterDiffByPatterns,
  matchesAnyGlob,
  matchesPatternList,
} from '../src/utils/glob-utils.ts';

describe('matchesAnyGlob', () => {
  const cases: [string, string[], boolean][] = [
    ['Program.cs', ['**/*.cs'], true],
    ['src/Deep/Foo.cs', ['**/*.cs'], true],
    ['src/Foo.ts', ['**/*.cs', '**/*.ts'], true],
    ['package.json', ['*.json'], true],
    ['src/config.json', ['*.json'], false],
    ['README.md', ['*.md'], true],
    ['docs/README.md', ['*.md'], false],
    ['docs/README.md', ['**/*.md'], true],
    ['src/a/b/c.ts', ['src/**/*.ts'], true],
    ['src/a.ts', ['src/**/*.ts'], true],
    ['src/a/b/c.ts', ['src/**'], true],
    ['lib/a.ts', ['src/**/*.ts'], false],
    ['file1.cs', ['file?.cs'], true],
    ['file10.cs', ['file?.cs'], false],
    ['a.txt', ['*.{cs,txt}'], true],
    ['a.cs', ['*.{cs,txt}'], true],
    ['a.js', ['*.{cs,txt}'], false],
    ['src/b.ts', ['**/*.{ts,tsx}'], true],
    ['Foo[1].cs', ['**/*.cs'], true],
    ['src/x.ts', ['src/[ab]/x.ts'], false],
    ['src/a/x.ts', ['src/[ab]/x.ts'], true],
  ];

  it.each(cases)('caso: %s ~ %j => %s', (path, patterns, expected) => {
    expect(matchesAnyGlob(path, patterns)).toBe(expected);
  });
});

describe('matchesPatternList (negação)', () => {
  it('exclui arquivos cobertos por um padrão negado', () => {
    expect(matchesPatternList('src/Foo.cs', ['**/*.cs', '!**/*.min.cs'])).toBe(true);
    expect(matchesPatternList('src/Foo.min.cs', ['**/*.cs', '!**/*.min.cs'])).toBe(false);
  });

  it('exige pelo menos um padrão positivo', () => {
    expect(matchesPatternList('src/Foo.cs', ['!**/*.min.cs'])).toBe(false);
    expect(matchesPatternList('a.min.js', ['!**/*.min.js'])).toBe(false);
  });

  it('aplica negação junto de padrões positivos múltiplos', () => {
    expect(matchesPatternList('src/App.tsx', ['**/*.{ts,tsx}', '!**/*.spec.tsx'])).toBe(true);
    expect(matchesPatternList('src/App.spec.tsx', ['**/*.{ts,tsx}', '!**/*.spec.tsx'])).toBe(false);
  });

  it('negação com subdiretórios', () => {
    expect(matchesPatternList('src/generated/models.ts', ['**/*.ts', '!src/generated/**'])).toBe(false);
    expect(matchesPatternList('src/hand/models.ts', ['**/*.ts', '!src/generated/**'])).toBe(true);
  });
});

describe('filterDiffByPatterns', () => {
  const diff = [
    'diff --git a/src/Program.cs b/src/Program.cs',
    'index abc123..def456 100644',
    '--- a/src/Program.cs',
    '+++ b/src/Program.cs',
    '@@ -1,3 +1,3 @@',
    ' public class Program {',
    '-    Console.WriteLine("oi");',
    '+    Console.WriteLine("olá");',
    ' }',
    'diff --git a/src/Foo.min.cs b/src/Foo.min.cs',
    'index 111..222 100644',
    '--- a/src/Foo.min.cs',
    '+++ b/src/Foo.min.cs',
    '@@ -1 +1 @@',
    '-a',
    '+b',
    'diff --git a/package.json b/package.json',
    'index 333..444 100644',
    '--- a/package.json',
    '+++ b/package.json',
    '@@ -1,2 +1,2 @@',
    '-  "version": "1.0.0"',
    '+  "version": "1.0.1"',
  ].join('\n');

  it('mantém apenas os arquivos que casam com os padrões', () => {
    const result = filterDiffByPatterns(diff, ['**/*.cs']);
    expect(result).toContain('src/Program.cs');
    expect(result).toContain('src/Foo.min.cs');
    expect(result).not.toContain('package.json');
  });

  it('aplica padrões de exclusão', () => {
    const result = filterDiffByPatterns(diff, ['**/*.cs', '!**/*.min.cs']);
    expect(result).toContain('src/Program.cs');
    expect(result).not.toContain('src/Foo.min.cs');
  });

  it('retorna string vazia quando nenhum arquivo casa', () => {
    expect(filterDiffByPatterns(diff, ['**/*.py'])).toBe('');
  });

  it('retorna string vazia quando só existem padrões negados', () => {
    expect(filterDiffByPatterns(diff, ['!**/*.cs'])).toBe('');
  });
});
