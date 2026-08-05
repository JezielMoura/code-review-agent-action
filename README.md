# Code review action

GitHub Action that reviews pull requests using **any endpoint compatible with the OpenAI chat completions API** (OpenCode, OpenAI, vLLM, Ollama, etc.).

The PR diff is fetched from the repository API — **GitHub** or **Forgejo** — filtered by the configured file patterns, and sent to the model together with the repository context. The action checks out the head of the PR and runs the agent **at the repository root**, with access to the full source code (`read`, `grep`, `glob`, and `bash` tools over the checkout, plus the project's `AGENTS.md` when it exists). The resulting review is posted as a comment on the PR itself.

## Usage

```yaml
name: AI Review

on:
  pull_request:

jobs:
  review:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      issues: write
    steps:
      - uses: https://codeberg.org/jezielmoura/code-review-action@v1
        with:
          openai-api-url: ${{ secrets.OPENAI_API_URL }}
          openai-api-key: ${{ secrets.OPENAI_API_KEY }}
          model: deepseek-v4-flash
```

On GitHub nothing else is needed: `repo-api-url` defaults to `https://api.github.com` and `repo-api-token` defaults to `${{ github.token }}`. The `permissions` block above is important:

- The review is posted via `issues/{n}/comments`, which requires the **`issues: write`** permission — `pull-requests: write` alone is not enough for that endpoint. Without an explicit block, repositories/organizations with **restricted default token permissions** give the token read-only access and comment posting fails with 403.
- **Fork pull requests**: on `pull_request` events from forks, the `GITHUB_TOKEN` is **read-only regardless of the `permissions` block** (GitHub does not grant write access to code from forks). To review fork contributions, pass a PAT with `issues: write` (or repo scope) via `repo-api-token`:

```yaml
        with:
          repo-api-token: ${{ secrets.REPO_API_TOKEN }}
```

For Forgejo, set `repo-api-kind: forgejo`, `repo-api-url` and `repo-api-token` with a token scoped `read:repository` + `write:issue`.

The action only runs the review on `pull_request` events — on any other event the step is skipped automatically. The `actions/checkout` of the PR head is done by the action itself; there's no need to add it to your workflow.

The model provider is configured inside the action: it registers an OpenAI-compatible provider with the supplied URL and token, so **any endpoint** implementing `/v1/chat/completions` works (OpenAI, OpenCode, vLLM, Ollama, proxies, etc.).

## Inputs

| Input | Required | Default | Description |
| --- | --- | --- | --- |
| `repo-api-url` | ❌ | `https://api.github.com` | Base URL of the repository API: `https://api.github.com` for GitHub, or the Forgejo API base (e.g. `https://forge.example.com/api/v1`). |
| `repo-api-token` | ❌ | `${{ github.token }}` | Token with permission to read the PR diff and post comments (`issues: write`). On GitHub, the default works for same-repo PRs; fork PRs need a PAT (the `GITHUB_TOKEN` is read-only for forks). On Forgejo, pass a token with scopes `read:repository` + `write:issue`. |
| `repo-api-kind` | ❌ | `github` | Repository API flavor: `github` (default) or `forgejo`. |
| `openai-api-url` | ✅ | — | Base URL compatible with the OpenAI chat completions API (e.g. `https://api.openai.com/v1`). |
| `openai-api-key` | ✅ | — | Authentication token for the endpoint. |
| `model` | ✅ | — | Model name (e.g. `gpt-4o-mini`). |
| `file-patterns` | ❌ | `**/*.py,**/*.js,**/*.jsx,**/*.mjs,**/*.cjs,**/*.ts,**/*.tsx,**/*.cs,**/*.java,**/*.c,**/*.h,**/*.cpp,**/*.cc,**/*.hpp,**/*.go,**/*.rs,**/*.kt,**/*.kts,**/*.swift,**/*.php,**/*.rb,**/*.html,**/*.css,**/*.scss,**/*.vue,**/*.svelte,**/*.sql,**/*.sh,**/*.yaml,**/*.yml,**/*.toml,**/*.json,**/*.md` | Glob patterns (comma-separated). Prefix a pattern with `!` to exclude (e.g. `**/*.ts,!**/*.spec.ts`). |
| `max-diff-size` | ❌ | `300000` | Maximum size (in characters) of the diff sent to the model (300 KB, the GitHub API diff limit). |

## Prerequisites

- **Repository token**: on GitHub, none needed for same-repo PRs — the built-in `${{ github.token }}` is the default, as long as the workflow grants `issues: write`. Fork PRs require a PAT (the `GITHUB_TOKEN` is read-only for `pull_request` events from forks). On Forgejo, create one at `Settings → Applications → Generate New Token` with repository read and comment write scope (e.g. `read:repository`, `write:issue`).
- **Model endpoint**: the given URL must respond at `<base-url>/chat/completions` in the OpenAI API format (streaming).

## Behavior

- The action checks out the **head of the PR** and runs the agent with the workspace at the **repository root**: the agent reads the checkout's source code (not just the diff) to review with context — definitions, callers, tests, existing patterns, and the project's `AGENTS.md`, if any.
- Only files matching `file-patterns` are sent to the model; when no relevant file is changed, **no comment is posted**.
- Diffs larger than `max-diff-size` are truncated with an explicit notice (on GitHub, the API caps the diff at 300 files / 300 KB).
- The comment is compact: a one-line `Summary`, a `Findings` list (each item combining the issue, why it matters, and a concrete suggestion), optional `Questions`, and a one-line `Verdict`.

## Development

```bash
npm ci
npm test   # runs the test suite (Vitest)
```
