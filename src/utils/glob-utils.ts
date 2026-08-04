interface DiffFileBlock {
  path: string;
  content: string;
}

export function filterDiffByPatterns(diff: string, patterns: string[]): string {
  const blocks = splitDiffByFile(diff);
  const matched = blocks.filter((block) => matchesPatternList(block.path, patterns));
  return matched.map((b) => b.content).join('\n');
}

function splitDiffByFile(diff: string): DiffFileBlock[] {
  const lines = diff.split('\n');
  const blocks: DiffFileBlock[] = [];
  let current: string[] = [];
  let currentPath = '';

  for (const line of lines) {
    if (line.startsWith('diff --git ')) {
      if (current.length > 0) {
        blocks.push({ path: currentPath, content: current.join('\n') });
      }
      current = [line];
      const match = line.match(/^diff --git a\/(.+?) b\/(.+)$/);
      currentPath = match ? match[2] : '';
    } else {
      current.push(line);
    }
  }

  if (current.length > 0) {
    blocks.push({ path: currentPath, content: current.join('\n') });
  }

  return blocks;
}

function escapeRegExp(ch: string): string {
  return /[.+^${}()|[\]\\]/.test(ch) ? '\\' + ch : ch;
}

function globToRegExp(pattern: string): RegExp {
  let re = '';
  let i = 0;
  const n = pattern.length;

  while (i < n) {
    const c = pattern[i];

    if (c === '*') {
      if (pattern[i + 1] === '*') {
        i += 2;
        if (pattern[i] === '/') {
          re += '(?:[^/]+/)*';
          i += 1;
        } else {
          re += '.*';
        }
      } else {
        re += '[^/]*';
        i += 1;
      }
    } else if (c === '?') {
      re += '[^/]';
      i += 1;
    } else if (c === '[') {
      let j = i + 1;
      if (pattern[j] === '!' || pattern[j] === '^') j++;
      if (pattern[j] === ']') j++;
      while (j < n && pattern[j] !== ']') j++;
      if (j >= n) {
        re += '\\[';
        i += 1;
      } else {
        let cls = pattern.slice(i + 1, j);
        if (cls.startsWith('!')) cls = '^' + cls.slice(1);
        re += '[' + cls + ']';
        i = j + 1;
      }
    } else if (c === '\\') {
      i += 1;
      if (i < n) re += escapeRegExp(pattern[i] === '\\' ? '/' : pattern[i]);
      i += 1;
    } else {
      re += escapeRegExp(c);
      i += 1;
    }
  }

  return new RegExp(`^${re}$`);
}

function expandBraces(pattern: string): string[] {
  const start = pattern.indexOf('{');
  if (start === -1) return [pattern];

  let depth = 0;
  let end = -1;
  for (let i = start; i < pattern.length; i++) {
    if (pattern[i] === '{') depth++;
    else if (pattern[i] === '}') {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end === -1) return [pattern];

  const prefix = pattern.slice(0, start);
  const suffix = pattern.slice(end + 1);
  const options = pattern.slice(start + 1, end).split(',');
  return options.flatMap((opt) => expandBraces(prefix + opt + suffix));
}

export function matchesAnyGlob(path: string, patterns: string[]): boolean {
  return patterns.some((pattern) =>
    expandBraces(pattern).some((p) => globToRegExp(p).test(path)),
  );
}

/**
 * Match a path against a list of glob patterns supporting negation:
 * a pattern prefixed with `!` excludes files, otherwise at least one
 * positive pattern must match. A list made only of negations matches
 * nothing (there is nothing to include).
 */
export function matchesPatternList(path: string, patterns: string[]): boolean {
  const includes: string[] = [];
  const excludes: string[] = [];

  for (const pattern of patterns) {
    if (pattern.startsWith('!')) {
      excludes.push(pattern.slice(1));
    } else {
      includes.push(pattern);
    }
  }

  if (includes.length === 0) return false;
  return matchesAnyGlob(path, includes) && !matchesAnyGlob(path, excludes);
}
