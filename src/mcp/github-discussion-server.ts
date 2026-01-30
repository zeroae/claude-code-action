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

server.tool(
  "reply_to_discussion",
  "Reply to a discussion or a specific comment in a discussion",
  {
    body: z.string().describe("The reply content"),
    discussion_id: z.string().describe("The GraphQL node ID of the discussion"),
    reply_to_id: z
      .string()
      .optional()
      .describe("Optional: GraphQL node ID of comment to reply to (for threading)"),
  },
  async ({ body, discussion_id, reply_to_id }) => {
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
          query: ADD_DISCUSSION_COMMENT_MUTATION,
          variables: {
            discussionId: discussion_id,
            body,
            replyToId: reply_to_id || null,
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
            text: JSON.stringify(result.data.addDiscussionComment.comment, null, 2),
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

server.tool(
  "update_discussion_comment",
  "Update an existing discussion comment",
  {
    comment_id: z.string().describe("The GraphQL node ID of the comment to update"),
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
            text: JSON.stringify(result.data.updateDiscussionComment.comment, null, 2),
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
