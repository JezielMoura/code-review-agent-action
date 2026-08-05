import { defineTool } from '@flue/runtime';
import * as v from 'valibot';
import { requirePrNumber } from "../utils/env-utils.ts";
import { sendRequest } from "../utils/fetch-utils.ts";

export const postReview = defineTool({
  name: 'post_review',
  description: 'Post the review on the pull request under review.',
  input: v.object({ body: v.string() }),
  async run({ data }) {
    await sendRequest(`issues/${requirePrNumber()}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ body: data.body }),
    });
    return { output: { status: 'success' } };
  },
});
