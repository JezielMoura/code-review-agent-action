
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variável de ambiente obrigatória ausente: ${name}`);
  }
  return value;
}

export function requirePrNumber(): number {
  const raw = requireEnv('PR_NUMBER');
  const pr = Number.parseInt(raw, 10);
  if (!Number.isInteger(pr) || pr <= 0) {
    throw new Error(`PR_NUMBER inválido: "${raw}"`);
  }
  return pr;
}
