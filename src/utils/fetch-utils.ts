import { requireEnv } from "./env-utils.ts";

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
  });

  if (!res.ok) {
    throw new Error(`Error in request ${url} (${res.status}): ${await res.text()}`);
  }

  return res.text();
}
