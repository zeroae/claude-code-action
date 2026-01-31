export type DiscussionPromptContext = {
  discussion: {
    id: string;
    number: number;
    title: string;
    body: string;
    author: { login: string };
    category: { id: string; name: string; slug: string };
    createdAt: string;
  };
  triggerComment: {
    id: string;
    body: string;
    author: { login: string };
  };
  replyChain: Array<{
    id: string;
    body: string;
    author: { login: string };
  }>;
  sessionSummary?: string;
  repository: string;
  botLogin: string;
};

/**
 * Builds a prompt for Claude when triggered from a GitHub Discussion.
 */
export function buildDiscussionPrompt(
  context: DiscussionPromptContext,
): string {
  const { discussion, triggerComment, replyChain, sessionSummary, repository } =
    context;

  // Reply chain is newest-first, reverse for chronological order
  const conversationHistory = replyChain
    .slice()
    .reverse()
    .map((c) => `**${c.author.login}:** ${c.body}`)
    .join("\n\n");

  let prompt = `You are Claude, responding to a GitHub Discussion.

<discussion_info>
Repository: ${repository}
Discussion #${discussion.number}: ${discussion.title}
Category: ${discussion.category.name}
Author: ${discussion.author.login}
</discussion_info>

<discussion_body>
${discussion.body}
</discussion_body>

<conversation_thread>
${conversationHistory}
</conversation_thread>

<current_request comment_id="${triggerComment.id}">
${triggerComment.body}
</current_request>
`;

  if (sessionSummary) {
    prompt += `
<session_context>
Previous session summary: ${sessionSummary}
</session_context>
`;
  }

  // Check if trigger is from a comment (has a different ID than the discussion)
  const isReplyToComment = triggerComment.id !== discussion.id;

  prompt += `
You are responding to the <current_request> above. This is a conversational GitHub Discussion - be helpful and engaging.

Use the mcp__github_discussion__reply_to_discussion tool to post your response:
- "body": Your response text (required)
${isReplyToComment ? `- "reply_to_id": "${triggerComment.id}" (use this to reply in-thread to the comment you're responding to)` : "- No reply_to_id needed for new discussions"}

Key points:
- This is an exploratory discussion, not a task to execute
- Feel free to ask clarifying questions
- Use WebSearch if you need to research external topics
- Reference specific code or docs when helpful
- Keep responses focused and actionable
`;

  return prompt;
}
