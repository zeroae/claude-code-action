#!/usr/bin/env node
// GitHub Discussion MCP Server - Provides discussion reply functionality
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { GITHUB_API_URL } from "../github/api/config";

// Get repository information from environment variables
const REPO_OWNER = process.env.REPO_OWNER;
const REPO_NAME = process.env.REPO_NAME;

if (!REPO_OWNER || !REPO_NAME) {
  console.error(
    "Error: REPO_OWNER and REPO_NAME environment variables are required",
  );
  process.exit(1);
}

const server = new McpServer({
  name: "GitHub Discussion Server",
  version: "0.0.1",
});

// GraphQL mutation for adding a discussion comment
const ADD_DISCUSSION_COMMENT_MUTATION = `
  mutation($discussionId: ID!, $body: String!, $replyToId: ID) {
    addDiscussionComment(input: {
      discussionId: $discussionId,
      body: $body,
      replyToId: $replyToId
    }) {
      comment {
        id
        databaseId
        body
        url
      }
    }
  }
`;

// GraphQL mutation for updating a discussion comment
const UPDATE_DISCUSSION_COMMENT_MUTATION = `
  mutation($commentId: ID!, $body: String!) {
    updateDiscussionComment(input: {
      commentId: $commentId,
      body: $body
    }) {
      comment {
        id
        databaseId
        body
        url
      }
    }
  }
`;

// Query to get the parent comment ID for proper threading
const GET_COMMENT_PARENT_QUERY = `
  query($commentId: ID!) {
    node(id: $commentId) {
      ... on DiscussionComment {
        id
        replyTo {
          id
        }
      }
    }
  }
`;

server.tool(
  "reply_to_discussion",
  "Reply to the current discussion. Automatically threads under the triggering comment if applicable.",
  {
    body: z.string().describe("The reply content"),
    discussion_id: z
      .string()
      .optional()
      .describe(
        "The GraphQL node ID of the discussion (defaults to current discussion)",
      ),
    reply_to_id: z
      .string()
      .optional()
      .describe(
        "GraphQL node ID of comment to reply to (defaults to triggering comment for threading)",
      ),
  },
  async ({ body, discussion_id, reply_to_id }) => {
    // Use environment variables as defaults
    const targetDiscussionId = discussion_id || process.env.DISCUSSION_NODE_ID;
    // Auto-thread under the triggering comment if available
    let targetReplyToId = reply_to_id || process.env.TRIGGER_COMMENT_ID || null;
    try {
      const githubToken = process.env.GITHUB_TOKEN;

      if (!githubToken) {
        throw new Error("GITHUB_TOKEN environment variable is required");
      }

      if (!targetDiscussionId) {
        throw new Error(
          "discussion_id is required (either as parameter or DISCUSSION_NODE_ID env var)",
        );
      }

      // Log for debugging
      console.error(`[reply_to_discussion] Starting with discussionId=${targetDiscussionId}, replyToId=${targetReplyToId}`);

      // GitHub Discussions only support one level of nesting.
      // If targetReplyToId is a nested comment (already has a parent), we need to
      // use the parent's ID instead to stay in the same thread.
      if (targetReplyToId) {
        console.error(`[reply_to_discussion] Checking if comment ${targetReplyToId} is a nested reply...`);
        const parentCheckResponse = await fetch(`${GITHUB_API_URL}/graphql`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${githubToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query: GET_COMMENT_PARENT_QUERY,
            variables: { commentId: targetReplyToId },
          }),
        });

        const parentCheckResult = (await parentCheckResponse.json()) as any;
        console.error(`[reply_to_discussion] Parent check result: ${JSON.stringify(parentCheckResult)}`);

        if (parentCheckResult.data?.node?.replyTo?.id) {
          // The target comment is a nested reply - use its parent instead
          const parentId = parentCheckResult.data.node.replyTo.id;
          console.error(`[reply_to_discussion] Comment is nested, using parent ${parentId} for threading`);
          targetReplyToId = parentId;
        }
      }

      console.error(`[reply_to_discussion] Posting comment with final replyToId=${targetReplyToId}`);

      const response = await fetch(`${GITHUB_API_URL}/graphql`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${githubToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: ADD_DISCUSSION_COMMENT_MUTATION,
          variables: {
            discussionId: targetDiscussionId,
            body,
            replyToId: targetReplyToId,
          },
        }),
      });

      const result = (await response.json()) as any;
      console.error(`[reply_to_discussion] Mutation result: ${JSON.stringify(result)}`);

      if (result.errors) {
        throw new Error(result.errors[0].message);
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              result.data.addDiscussionComment.comment,
              null,
              2,
            ),
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(`[reply_to_discussion] Error: ${errorMessage}`);
      return {
        content: [
          {
            type: "text" as const,
            text: `Error: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  },
);

server.tool(
  "list_accessible_repositories",
  "List all repositories that this GitHub App installation has access to. Use this to discover what repos you can read, search, or reference.",
  {},
  async () => {
    try {
      const githubToken = process.env.GITHUB_TOKEN;

      if (!githubToken) {
        throw new Error("GITHUB_TOKEN environment variable is required");
      }

      // Use REST API to list installation repositories
      const response = await fetch(`${GITHUB_API_URL}/installation/repositories`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      });

      const result = (await response.json()) as any;

      if (result.message) {
        throw new Error(result.message);
      }

      const repos = result.repositories?.map((repo: any) => ({
        name: repo.full_name,
        private: repo.private,
        description: repo.description,
        default_branch: repo.default_branch,
        language: repo.language,
      })) || [];

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                total_count: result.total_count,
                repositories: repos,
              },
              null,
              2,
            ),
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(`[list_accessible_repositories] Error: ${errorMessage}`);
      return {
        content: [
          {
            type: "text" as const,
            text: `Error: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  },
);

server.tool(
  "update_discussion_comment",
  "Update an existing discussion comment",
  {
    comment_id: z
      .string()
      .describe("The GraphQL node ID of the comment to update"),
    body: z.string().describe("The updated comment content"),
  },
  async ({ comment_id, body }) => {
    try {
      const githubToken = process.env.GITHUB_TOKEN;

      if (!githubToken) {
        throw new Error("GITHUB_TOKEN environment variable is required");
      }

      const response = await fetch(`${GITHUB_API_URL}/graphql`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${githubToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: UPDATE_DISCUSSION_COMMENT_MUTATION,
          variables: {
            commentId: comment_id,
            body,
          },
        }),
      });

      const result = (await response.json()) as any;

      if (result.errors) {
        throw new Error(result.errors[0].message);
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              result.data.updateDiscussionComment.comment,
              null,
              2,
            ),
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text" as const,
            text: `Error: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  },
);

async function runServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.on("exit", () => {
    server.close();
  });
}

runServer().catch(console.error);
