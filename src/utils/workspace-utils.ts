import { existsSync, statSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';

export function getWorkspacePath(): string {
  const raw = process.env.WORKSPACE_PATH;
  const workspace = raw
    ? isAbsolute(raw)
      ? raw
      : resolve(process.cwd(), raw)
    : process.cwd();

  if (!existsSync(workspace) || !statSync(workspace).isDirectory()) {
    throw new Error(`WORKSPACE_PATH is not a valid directory: "${workspace}"`);
  }

  return workspace;
}
