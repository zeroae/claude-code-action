/**
 * Tool schema type compatible with Anthropic SDK.
 */
export type GraduationTool = {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
};

export const CREATE_ISSUE_DRAFT_TOOL: GraduationTool = {
  name: "create_issue_draft",
  description:
    "Create a draft issue from a discussion. Posts a structured draft comment " +
    "that the user can review and refine before finalizing.",
  input_schema: {
    type: "object" as const,
    properties: {
      discussion_number: {
        type: "number",
        description: "The discussion number to create an issue from",
      },
      title: {
        type: "string",
        description: "The title for the issue",
      },
      body: {
        type: "string",
        description: "The body content for the issue",
      },
      labels: {
        type: "array",
        items: { type: "string" },
        description: "Labels to apply to the issue",
      },
      assignees: {
        type: "array",
        items: { type: "string" },
        description: "GitHub usernames to assign to the issue",
      },
    },
    required: ["discussion_number", "title", "body"],
  },
};

export const CREATE_PR_DRAFT_TOOL: GraduationTool = {
  name: "create_pr_draft",
  description:
    "Create a draft pull request from a discussion. Posts a structured draft " +
    "comment that the user can review and refine before finalizing.",
  input_schema: {
    type: "object" as const,
    properties: {
      discussion_number: {
        type: "number",
        description: "The discussion number to create a PR from",
      },
      title: {
        type: "string",
        description: "The title for the PR",
      },
      body: {
        type: "string",
        description: "The body content for the PR",
      },
      base_branch: {
        type: "string",
        description: "The base branch for the PR (default: main)",
      },
      head_branch: {
        type: "string",
        description: "The head branch containing the changes",
      },
      labels: {
        type: "array",
        items: { type: "string" },
        description: "Labels to apply to the PR",
      },
    },
    required: ["discussion_number", "title", "body", "head_branch"],
  },
};

export const FINALIZE_ISSUE_TOOL: GraduationTool = {
  name: "finalize_issue",
  description:
    "Finalize a draft issue by creating the actual GitHub Issue. " +
    "Call this when the user approves the draft (says 'create it' or similar).",
  input_schema: {
    type: "object" as const,
    properties: {
      draft_comment_id: {
        type: "string",
        description: "The ID of the comment containing the draft",
      },
      discussion_number: {
        type: "number",
        description: "The discussion number",
      },
    },
    required: ["draft_comment_id", "discussion_number"],
  },
};

export const FINALIZE_PR_TOOL: GraduationTool = {
  name: "finalize_pr",
  description:
    "Finalize a draft PR by creating the actual GitHub Pull Request. " +
    "Call this when the user approves the draft (says 'create it' or similar).",
  input_schema: {
    type: "object" as const,
    properties: {
      draft_comment_id: {
        type: "string",
        description: "The ID of the comment containing the draft",
      },
      discussion_number: {
        type: "number",
        description: "The discussion number",
      },
    },
    required: ["draft_comment_id", "discussion_number"],
  },
};

export const UPDATE_DRAFT_TOOL: GraduationTool = {
  name: "update_draft",
  description:
    "Update an existing draft comment with refined content. " +
    "Use this when the user requests changes to a draft.",
  input_schema: {
    type: "object" as const,
    properties: {
      draft_comment_id: {
        type: "string",
        description: "The ID of the comment containing the draft to update",
      },
      updated_content: {
        type: "string",
        description: "The full updated draft content (markdown formatted)",
      },
    },
    required: ["draft_comment_id", "updated_content"],
  },
};

export function getGraduationTools(): GraduationTool[] {
  return [
    CREATE_ISSUE_DRAFT_TOOL,
    CREATE_PR_DRAFT_TOOL,
    FINALIZE_ISSUE_TOOL,
    FINALIZE_PR_TOOL,
    UPDATE_DRAFT_TOOL,
  ];
}
