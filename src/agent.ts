import { createProvider, envApiKeyAuth } from '@earendil-works/pi-ai';
import { openAICompletionsApi } from '@earendil-works/pi-ai/api/openai-completions.lazy';
import { setProvider, useModel, useSandbox, useTool } from '@flue/runtime';
import { local } from '@flue/runtime/node';
import { requireEnv } from "./utils/env-utils.ts";
import { getWorkspacePath } from './utils/workspace-utils.ts';
import { getPrDiff } from './tools/get-pr-diff.ts';
import { postPrComment } from './tools/post-pr-comment.ts';

const PROVIDER_ID = 'openai-compatible';
const modelId = requireEnv('MODEL');
const baseUrl = requireEnv('OPENAI_API_URL');

setProvider(
  createProvider({
    id: PROVIDER_ID,
    auth: { apiKey: envApiKeyAuth('OpenAI-compatible API key', ['OPENAI_API_KEY']) },
    models: [
      {
        id: modelId,
        name: modelId,
        api: 'openai-completions',
        provider: PROVIDER_ID,
        baseUrl,
        reasoning: true,
        input: ['text'],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 128000,
        maxTokens: 8192,
      },
    ],
    api: openAICompletionsApi(),
  }),
);

export function CodeReviewer() {
  useModel(`${PROVIDER_ID}/${modelId}`);
  useTool(getPrDiff);
  useTool(postPrComment);
  useSandbox(local({ cwd: getWorkspacePath() }));
	return `
    You are a senior code reviewer specialist.
    Your working directory is the root of the repository under review, with the full source code available.

    Use the file tools (read, grep, glob, bash) to inspect the changed files and related
    code (definitions, callers, tests, existing patterns, AGENTS.md) before
    concluding — the diff alone doesn't always reveal impact, security, and consistency.

    If the provided diff has content, produce an objective review in Markdown, in English, and
    generate a comment using post_pr_comment with the structure below:

    ## Review

    **Summary** — what this PR changes, in 1-2 sentences.

    **Findings**
    - **Issue title** — why it matters and a concrete suggestion or code snippet.
    - Only list real issues; fold security/performance/edge-case concerns into the relevant finding.
    - If nothing relevant: "No significant issues found."

    **Questions** — only if something genuinely needs clarification.

    **Verdict** — ✅ Approve | 💬 Approve with suggestions | ❌ Request changes

    Keep it tight: no filler, no empty sections, no repetition.

    If you don't find any relevant issues, say so explicitly instead of inventing
    trivial observations. Be direct, technical, and avoid beating around the bush.
    If the diff is empty, respond with "No changes detected in the pull request." and do not generate a comment.
  `;
}
