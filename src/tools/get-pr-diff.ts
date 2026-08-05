import { defineTool } from '@flue/runtime';
import { filterDiffByPatterns } from '../utils/glob-utils.ts';
import { requireEnv, requirePrNumber } from "../utils/env-utils.ts";
import { sendRequest } from "../utils/fetch-utils.ts";

const diffCache = new Map<number, string>();

export async function loadFilteredDiff(prNumber: number): Promise<string> {
  const cached = diffCache.get(prNumber);
  if (cached !== undefined) return cached;

  const filePatterns = requireEnv('FILE_PATTERNS')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);

  const rawDiff = repoApiKind() === 'github'
    ? await sendRequest(`pulls/${prNumber}`, {
        headers: { Accept: 'application/vnd.github.v3.diff' },
      })
    : await sendRequest(`pulls/${prNumber}.diff`);
  const filteredDiff = filterDiffByPatterns(rawDiff, filePatterns);

  if (!filteredDiff.trim()) {
    diffCache.set(prNumber, '');
    return '';
  }

  const maxDiffSize = parseMaxDiffSize();
  const truncatedDiff = filteredDiff.length > maxDiffSize
    ? `${filteredDiff.slice(0, maxDiffSize)}\n\n[diff truncado por limite de tamanho: ${maxDiffSize} caracteres]`
    : filteredDiff;

  diffCache.set(prNumber, truncatedDiff);
  return truncatedDiff;
}

function repoApiKind(): 'github' | 'forgejo' {
  const kind = process.env.REPO_API_KIND ?? 'github';
  if (kind !== 'github' && kind !== 'forgejo') {
    throw new Error(`REPO_API_KIND inválido: "${kind}" (esperado "github" ou "forgejo")`);
  }
  return kind;
}

function parseMaxDiffSize(): number {
  const raw = requireEnv('MAX_DIFF_SIZE');
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`MAX_DIFF_SIZE inválido: "${raw}"`);
  }
  return parsed;
}

export const getPrDiff = defineTool({
  name: 'get_pr_diff',
  description: 'Get the diff of the pull request under review, filtered by the configured file patterns.',
  async run() {
    const diff = await loadFilteredDiff(requirePrNumber());
    return { output: { diff } };
  },
});
