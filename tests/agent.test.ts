import { beforeAll, describe, expect, it, vi } from 'vitest';

let CodeReviewer: (() => string) | undefined;

beforeAll(async () => {
  vi.stubEnv('MODEL', 'gpt-4o-mini');
  vi.stubEnv('OPENAI_API_URL', 'https://api.example.com/v1');
  vi.stubEnv('OPENAI_API_KEY', 'sk-test');

  ({ CodeReviewer } = await import('../src/agent.ts'));
});

describe('agent module', () => {
  it('loads without errors and exports the agent', () => {
    expect(typeof CodeReviewer).toBe('function');
  });
});
