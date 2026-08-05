import { beforeAll, describe, expect, it, vi } from 'vitest';

type ReviewWasPosted = (toolCalls: readonly { tool: string; isError: boolean }[]) => boolean;

let CodeReviewer: (() => string) | undefined;
let reviewWasPostedFn: ReviewWasPosted | undefined;

beforeAll(async () => {
  vi.stubEnv('MODEL', 'gpt-4o-mini');
  vi.stubEnv('OPENAI_API_URL', 'https://api.example.com/v1');
  vi.stubEnv('OPENAI_API_KEY', 'sk-test');

  ({ CodeReviewer, reviewWasPosted: reviewWasPostedFn } = await import('../src/agent.ts'));
});

describe('agent module', () => {
  it('loads without errors and exports the agent', () => {
    expect(typeof CodeReviewer).toBe('function');
  });
});

describe('reviewWasPosted', () => {
  it('returns false when post_review was never called', () => {
    expect(reviewWasPostedFn!([])).toBe(false);
    expect(reviewWasPostedFn!([{ tool: 'get_pr_diff', isError: false }])).toBe(false);
  });

  it('returns true when a post_review call succeeded', () => {
    expect(reviewWasPostedFn!([{ tool: 'post_review', isError: false }])).toBe(true);
  });

  it('returns false when the post_review call errored', () => {
    expect(reviewWasPostedFn!([{ tool: 'post_review', isError: true }])).toBe(false);
  });

  it('returns true when post_review succeeded among other calls', () => {
    expect(
      reviewWasPostedFn!([
        { tool: 'get_pr_diff', isError: false },
        { tool: 'post_review', isError: false },
      ]),
    ).toBe(true);
  });
});
