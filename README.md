# AI Review Action

GitHub Action that reviews pull requests using **any endpoint compatible with the OpenAI chat completions API** (OpenCode, OpenAI, vLLM, Ollama, etc.).

The PR diff is fetched from the **Forgejo** API, filtered by the configured file patterns, and sent to the model together with the repository context. The action checks out the head of the PR and runs the agent **at the repository root**, with access to the full source code (`read`, `grep`, `glob`, and `bash` tools over the checkout, plus the project's `AGENTS.md` when it exists). The resulting review is posted as a comment on the PR itself.

## Usage

```yaml
name: AI Review

on:
  pull_request:

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: https://codeberg.org/jezielmoura/code-review-action@v1
        with:
          repo-api-url: ${{ secrets.REPO_API_URL }}
          repo-api-token: ${{ secrets.REPO_API_TOKEN }}
          openai-api-url: ${{ secrets.OPENAI_API_URL }}
          openai-api-key: ${{ secrets.OPENAI_API_KEY }}
          model: deepseek-v4-flash
```

The action only runs the review on `pull_request` events — on any other event the step is skipped automatically. The `actions/checkout` of the PR head is done by the action itself; there's no need to add it to your workflow.

The model provider is configured inside the action: it registers an OpenAI-compatible provider with the supplied URL and token, so **any endpoint** implementing `/v1/chat/completions` works (OpenAI, OpenCode, vLLM, Ollama, proxies, etc.).

## Inputs

| Input | Required | Default | Description |
| --- | --- | --- | --- |
| `repo-api-url` | ✅ | — | Base URL of the Forgejo API (e.g. `https://forge.example.com/api/v1`). |
| `repo-api-token` | ✅ | — | Forgejo token with permission to read the PR diff and post comments (scopes `read:repository` + `write:issue`). |
| `openai-api-url` | ✅ | — | Base URL compatible with the OpenAI chat completions API (e.g. `https://api.openai.com/v1`). |
| `openai-api-key` | ✅ | — | Authentication token for the endpoint. |
| `model` | ✅ | — | Model name (e.g. `gpt-4o-mini`). |
| `file-patterns` | ❌ | `**/*.cs,**/*.ts,**/*.tsx,**/*.html,**/*.css,*.json,*.md` | Glob patterns (comma-separated). Prefix a pattern with `!` to exclude (e.g. `**/*.ts,!**/*.spec.ts`). |
| `max-diff-size` | ❌ | `60000` | Maximum size (in characters) of the diff sent to the model. |

## Prerequisites

- **Forgejo token**: create it at `Settings → Applications → Generate New Token` with repository read and comment write scope (e.g. `read:repository`, `write:issue`).
- **Model endpoint**: the given URL must respond at `<base-url>/chat/completions` in the OpenAI API format (streaming).

## Behavior

- The action checks out the **head of the PR** and runs the agent with the workspace at the **repository root**: the agent reads the checkout's source code (not just the diff) to review with context — definitions, callers, tests, existing patterns, and the project's `AGENTS.md`, if any.
- Only files matching `file-patterns` are sent to the model; when no relevant file is changed, **no comment is posted**.
- Diffs larger than `max-diff-size` are truncated with an explicit notice.
- The comment is compact: a one-line `Summary`, a `Findings` list (each item combining the issue, why it matters, and a concrete suggestion), optional `Questions`, and a one-line `Verdict`.

## Development

```bash
npm ci
npm test   # runs the test suite (Vitest)
```
