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
  let inHunk = false;

  const pushBlock = () => {
    if (current.length > 0) {
      blocks.push({ path: currentPath, content: current.join('\n') });
    }
  };

  for (const line of lines) {
    if (line.startsWith('diff --git ')) {
      pushBlock();
      current = [line];
      // Fallback for blocks without ---/+++ headers (binary files, pure renames).
      currentPath = parseDiffGitPath(line);
      inHunk = false;
    } else {
      current.push(line);
      if (inHunk) continue;
      if (line.startsWith('@@')) {
        inHunk = true;
        continue;
      }
      const path = parseHeaderPath(line);
      if (path) currentPath = path;
    }
  }

  pushBlock();
  return blocks;
}

/**
 * Extract the changed path from a `---`/`+++` header line, which is the
 * authoritative source for the file path (the `diff --git` line can be
 * ambiguous for paths containing spaces or ` b/`). Handles git's C-style
 * quoting of unusual paths (e.g. non-ASCII names) and the trailing tab git
 * appends to paths containing spaces.
 */
function parseHeaderPath(line: string): string {
  const trimmed = line.replace(/\t$/, '');
  if (trimmed.startsWith('+++ ')) {
    if (trimmed === '+++ /dev/null') return '';
    return stripSidePrefix(trimmed.slice('+++ '.length), 'b');
  }
  if (trimmed.startsWith('--- ')) {
    if (trimmed === '--- /dev/null') return '';
    return stripSidePrefix(trimmed.slice('--- '.length), 'a');
  }
  return '';
}

function stripSidePrefix(path: string, side: 'a' | 'b'): string {
  const quoted = path.startsWith('"') && path.endsWith('"');
  const inner = quoted ? path.slice(1, -1) : path;
  if (!inner.startsWith(`${side}/`)) return '';
  return unquoteGitPath(inner.slice(side.length + 1));
}

/**
 * Parse the b/ (new) path from a `diff --git` line, anchoring at the end of
 * the line so paths containing ` b/` or spaces parse correctly.
 */
function parseDiffGitPath(line: string): string {
  const match = line.match(/^diff --git (.*) (?:\")?b\/(.+?)(?:\")?$/);
  if (!match) return '';
  return unquoteGitPath(match[2]);
}

/** Unescape git's C-style path quoting (octal bytes, \\n, \\t, \\" etc.). */
function unquoteGitPath(path: string): string {
  if (!path.includes('\\')) return path;
  const bytes: number[] = [];
  const escapes: Record<string, number> = {
    '\\': 0x5c,
    '"': 0x22,
    n: 0x0a,
    t: 0x09,
    r: 0x0d,
    a: 0x07,
    b: 0x08,
    f: 0x0c,
    v: 0x0b,
  };
  for (let i = 0; i < path.length; i++) {
    const ch = path[i];
    if (ch !== '\\') {
      bytes.push(ch.codePointAt(0)!);
      continue;
    }
    const next = path[i + 1];
    if (next !== undefined && next >= '0' && next <= '7') {
      let octal = next;
      let j = i + 2;
      while (octal.length < 3 && j < path.length && path[j] >= '0' && path[j] <= '7') {
        octal += path[j];
        j++;
      }
      bytes.push(Number.parseInt(octal, 8));
      i = j - 1;
    } else {
      const code = escapes[next ?? ''];
      if (code !== undefined) bytes.push(code);
      i += 1;
    }
  }
  return Buffer.from(bytes).toString('utf8');
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
