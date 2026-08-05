import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { defineTool } from '@flue/runtime';
import { filterDiffByPatterns } from '../utils/glob-utils.ts';
import { requireEnv, requirePrNumber } from "../utils/env-utils.ts";
import { getWorkspacePath } from '../utils/workspace-utils.ts';

const execFileAsync = promisify(execFile);
const MAX_GIT_BUFFER = 64 * 1024 * 1024;

const diffCache = new Map<number, string>();

export async function loadFilteredDiff(prNumber: number): Promise<string> {
  const cached = diffCache.get(prNumber);
  if (cached !== undefined) return cached;

  const filePatterns = requireEnv('FILE_PATTERNS')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);

  const rawDiff = await gitPrDiff();
  const filteredDiff = filterDiffByPatterns(rawDiff, filePatterns);

  if (!filteredDiff.trim()) {
    diffCache.set(prNumber, '');
    return '';
  }

  console.log(`diff size: ${filteredDiff.length} chars`);

  const maxDiffSize = parseMaxDiffSize();
  const truncatedDiff = filteredDiff.length > maxDiffSize
    ? `${filteredDiff.slice(0, maxDiffSize)}\n\n[diff truncated at size limit: ${maxDiffSize} characters]`
    : filteredDiff;

  diffCache.set(prNumber, truncatedDiff);
  return truncatedDiff;
}

async function gitPrDiff(): Promise<string> {
  const workspace = getWorkspacePath();
  const baseRef = requireEnv('BASE_REF');

  try {
    const { stdout } = await execFileAsync('git', [
      'diff',
      '--no-color',
      '--no-ext-diff',
      '--find-renames',
      `${baseRef}...HEAD`,
    ], {
      cwd: workspace,
      encoding: 'utf8',
      maxBuffer: MAX_GIT_BUFFER,
    });
    return stdout;
  } catch (err) {
    const stderr = (err as { stderr?: unknown }).stderr?.toString() ?? '';
    const detail = stderr.trim() ? `: ${stderr.trim()}` : '';
    throw new Error(`git diff falhou em "${workspace}" (${baseRef}...HEAD)${detail}`);
  }
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
