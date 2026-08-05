
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Required environment variable is missing: ${name}`);
  }
  return value;
}

export function requirePrNumber(): number {
  const raw = requireEnv('PR_NUMBER');
  const pr = Number.parseInt(raw, 10);
  if (!Number.isInteger(pr) || pr < 0) {
    throw new Error(`PR_NUMBER is invalid: "${raw}"`);
  }
  return pr;
}
