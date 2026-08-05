import { requireEnv } from "./env-utils.ts";

const REQUEST_TIMEOUT_MS = 30_000;

export async function sendRequest(path: string, options: RequestInit = {}): Promise<string> {
  const apiUrl = requireEnv('REPO_API_URL');
  const apiToken = requireEnv('REPO_API_TOKEN');
  const repo = requireEnv('REPO');
  const url = `${apiUrl}/repos/${repo}/${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `token ${apiToken}`,
    },
    signal: options.signal
      ? AbortSignal.any([options.signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)])
      : AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!res.ok) {
    throw new Error(`Error in request ${url} (${res.status}): ${await res.text()}`);
  }

  return res.text();
}
