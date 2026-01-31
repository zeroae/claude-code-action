export type AccessibleRepository = {
  name: string;
  description: string | null;
  language: string | null;
  private: boolean;
};

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
  accessibleRepos?: AccessibleRepository[];
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
  // Include comment IDs for bot comments so Claude can update them if asked
  const conversationHistory = replyChain
    .slice()
    .reverse()
    .map((c) => {
      const isBotComment = c.author.login === context.botLogin;
      const header = isBotComment
        ? `**${c.author.login}** (comment_id: ${c.id}):`
        : `**${c.author.login}:**`;
      return `${header} ${c.body}`;
    })
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

Choose the right tool for responding:

1. **reply_to_discussion** - Use for NEW responses (default):
   - "body": Your response text (required)
   ${isReplyToComment ? `- "reply_to_id": "${triggerComment.id}" (threads under the triggering comment)` : "- No reply_to_id needed for new discussions"}

2. **update_discussion_comment** - Use when asked to EDIT/UPDATE a previous comment:
   - Trigger words: "update", "edit", "revise", "modify", "change", "fix" your previous comment/response
   - "comment_id": The node ID of YOUR comment to update (find it in the conversation thread)
   - "body": The complete updated content (replaces the entire comment)

Key points:
- This is an exploratory discussion, not a task to execute
- Feel free to ask clarifying questions
- Use WebSearch if you need to research external topics
- Reference specific code or docs when helpful
- Keep responses focused and actionable
`;

  // Add accessible repos section if available
  if (context.accessibleRepos && context.accessibleRepos.length > 0) {
    const repoList = context.accessibleRepos
      .map((r) => `- **${r.name}**${r.description ? `: ${r.description}` : ""}${r.language ? ` (${r.language})` : ""}`)
      .join("\n");

    prompt += `
<accessible_repositories>
You have read access to these repositories. When the user asks about any of these projects, PROACTIVELY read the code using Glob/Grep/Read tools to provide accurate answers based on the actual implementation:

${repoList}

IMPORTANT: If a question mentions any of these repos (or related terms like "our implementation", "the codebase", project names), immediately explore that repo's code before answering. Don't ask the user to share code - you already have access.

To read code from these repos, use the GitHub MCP tools:
- mcp__github__get_file_contents: Read files (e.g., owner="zeroae", repo="zae-svdb", path="README.md")
- mcp__github__search_code: Search for code (e.g., q="struct Vector repo:zeroae/zae-svdb")
</accessible_repositories>
`;
  }

  return prompt;
}
