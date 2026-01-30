# Phase 1: Basic Discussion Support Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add basic GitHub Discussions support with category-based triggers, threaded replies, and session storage on an orphan branch.

**Architecture:** Extend existing event handling to support `discussion` and `discussion_comment` events. Add configuration file parsing for discussion categories. Create MCP server for discussion replies. Store sessions on `claude-sessions` orphan branch.

**Tech Stack:** TypeScript, Bun, GitHub GraphQL API, MCP SDK, @octokit/graphql

---

## Task 1: Add Discussion Event Types to Context

**Files:**

- Modify: `src/github/context.ts`
- Create: `test/discussion-context.test.ts`

**Step 1: Write the failing test**

Create `test/discussion-context.test.ts`:

```typescript
import { describe, it, expect, beforeEach, mock } from "bun:test";

// Mock @actions/github before importing context
mock.module("@actions/github", () => ({
  context: {
    eventName: "discussion",
    payload: {
      action: "created",
      discussion: {
        number: 42,
        node_id: "D_kwDOABC123",
        title: "Test Discussion",
        body: "Discussion body",
        category: {
          name: "Claude Q&A",
          slug: "claude-q-a",
        },
        user: {
          login: "testuser",
        },
      },
      repository: {
        name: "test-repo",
        owner: {
          login: "test-owner",
        },
      },
    },
    repo: {
      owner: "test-owner",
      repo: "test-repo",
    },
    actor: "testuser",
  },
}));

import {
  parseGitHubContext,
  isDiscussionEvent,
  isDiscussionCommentEvent,
} from "../src/github/context";

describe("Discussion Context", () => {
  beforeEach(() => {
    process.env.GITHUB_RUN_ID = "12345";
  });

  it("parses discussion event correctly", () => {
    const context = parseGitHubContext();
    expect(context.eventName).toBe("discussion");
    expect(context.entityNumber).toBe(42);
    expect(context.isPR).toBe(false);
    expect(context.isDiscussion).toBe(true);
    expect(context.discussionNodeId).toBe("D_kwDOABC123");
    expect(context.discussionCategory).toBe("Claude Q&A");
  });

  it("isDiscussionEvent returns true for discussion events", () => {
    const context = parseGitHubContext();
    expect(isDiscussionEvent(context)).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd ~/ghq/github.com/zeroae/claude-code-action && bun test test/discussion-context.test.ts`
Expected: FAIL - `isDiscussionEvent` is not exported, `discussion` not in event names

**Step 3: Add DiscussionEvent and DiscussionCommentEvent types**

Modify `src/github/context.ts`. Add import at top:

```typescript
import type {
  IssuesEvent,
  IssuesAssignedEvent,
  IssueCommentEvent,
  PullRequestEvent,
  PullRequestReviewEvent,
  PullRequestReviewCommentEvent,
  WorkflowRunEvent,
  DiscussionEvent,
  DiscussionCommentEvent,
} from "@octokit/webhooks-types";
```

Update `ENTITY_EVENT_NAMES` array:

```typescript
const ENTITY_EVENT_NAMES = [
  "issues",
  "issue_comment",
  "pull_request",
  "pull_request_review",
  "pull_request_review_comment",
  "discussion",
  "discussion_comment",
] as const;
```

Update `ParsedGitHubContext` type:

```typescript
export type ParsedGitHubContext = BaseContext & {
  eventName: EntityEventName;
  payload:
    | IssuesEvent
    | IssueCommentEvent
    | PullRequestEvent
    | PullRequestReviewEvent
    | PullRequestReviewCommentEvent
    | DiscussionEvent
    | DiscussionCommentEvent;
  entityNumber: number;
  isPR: boolean;
  isDiscussion?: boolean;
  discussionNodeId?: string;
  discussionCategory?: string;
};
```

Add case handlers in `parseGitHubContext()` switch statement before `default`:

```typescript
    case "discussion": {
      const payload = context.payload as DiscussionEvent;
      return {
        ...commonFields,
        eventName: "discussion",
        payload,
        entityNumber: payload.discussion.number,
        isPR: false,
        isDiscussion: true,
        discussionNodeId: payload.discussion.node_id,
        discussionCategory: payload.discussion.category.name,
      };
    }
    case "discussion_comment": {
      const payload = context.payload as DiscussionCommentEvent;
      return {
        ...commonFields,
        eventName: "discussion_comment",
        payload,
        entityNumber: payload.discussion.number,
        isPR: false,
        isDiscussion: true,
        discussionNodeId: payload.discussion.node_id,
        discussionCategory: payload.discussion.category.name,
      };
    }
```

Add type guard functions at the end of the file:

```typescript
export function isDiscussionEvent(
  context: GitHubContext,
): context is ParsedGitHubContext & { payload: DiscussionEvent } {
  return context.eventName === "discussion";
}

export function isDiscussionCommentEvent(
  context: GitHubContext,
): context is ParsedGitHubContext & { payload: DiscussionCommentEvent } {
  return context.eventName === "discussion_comment";
}
```

**Step 4: Run test to verify it passes**

Run: `cd ~/ghq/github.com/zeroae/claude-code-action && bun test test/discussion-context.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
cd ~/ghq/github.com/zeroae/claude-code-action
git add src/github/context.ts test/discussion-context.test.ts
git commit -m "feat: add discussion and discussion_comment event types"
```

---

## Task 2: Add Discussion Configuration Parser

**Files:**

- Create: `src/config/discussion-config.ts`
- Create: `test/discussion-config.test.ts`

**Step 1: Write the failing test**

Create `test/discussion-config.test.ts`:

```typescript
import { describe, it, expect } from "bun:test";
import {
  parseDiscussionConfig,
  isClaudeCategory,
  getCategoryCapabilities,
  type DiscussionConfig,
} from "../src/config/discussion-config";

const sampleConfig = `
session_branch: claude-sessions

categories:
  - name: "Claude Q&A"
    capabilities:
      web_search: true
      edit_files: false
      can_commit: false

  - name: "AI Prototyping"
    capabilities:
      web_search: true
      edit_files: true
      can_commit: false
`;

describe("Discussion Config", () => {
  it("parses valid YAML config", () => {
    const config = parseDiscussionConfig(sampleConfig);
    expect(config.session_branch).toBe("claude-sessions");
    expect(config.categories).toHaveLength(2);
    expect(config.categories[0].name).toBe("Claude Q&A");
  });

  it("identifies Claude categories", () => {
    const config = parseDiscussionConfig(sampleConfig);
    expect(isClaudeCategory("Claude Q&A", config)).toBe(true);
    expect(isClaudeCategory("General", config)).toBe(false);
  });

  it("returns capabilities for category", () => {
    const config = parseDiscussionConfig(sampleConfig);
    const caps = getCategoryCapabilities("Claude Q&A", config);
    expect(caps?.web_search).toBe(true);
    expect(caps?.edit_files).toBe(false);
    expect(caps?.can_commit).toBe(false);
  });

  it("returns undefined for unknown category", () => {
    const config = parseDiscussionConfig(sampleConfig);
    const caps = getCategoryCapabilities("Unknown", config);
    expect(caps).toBeUndefined();
  });

  it("uses default session_branch if not specified", () => {
    const minimalConfig = `
categories:
  - name: "Claude Q&A"
    capabilities:
      web_search: true
`;
    const config = parseDiscussionConfig(minimalConfig);
    expect(config.session_branch).toBe("claude-sessions");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd ~/ghq/github.com/zeroae/claude-code-action && bun test test/discussion-config.test.ts`
Expected: FAIL - module not found

**Step 3: Create discussion config parser**

Create directory: `mkdir -p ~/ghq/github.com/zeroae/claude-code-action/src/config`

Create `src/config/discussion-config.ts`:

```typescript
import * as yaml from "yaml";

export type CategoryCapabilities = {
  web_search: boolean;
  edit_files: boolean;
  can_commit: boolean;
};

export type CategoryConfig = {
  name: string;
  capabilities: CategoryCapabilities;
};

export type DiscussionConfig = {
  session_branch: string;
  categories: CategoryConfig[];
};

const DEFAULT_CONFIG: DiscussionConfig = {
  session_branch: "claude-sessions",
  categories: [],
};

export function parseDiscussionConfig(content: string): DiscussionConfig {
  const parsed = yaml.parse(content);

  if (!parsed) {
    return DEFAULT_CONFIG;
  }

  return {
    session_branch: parsed.session_branch ?? "claude-sessions",
    categories: (parsed.categories ?? []).map((cat: any) => ({
      name: cat.name,
      capabilities: {
        web_search: cat.capabilities?.web_search ?? false,
        edit_files: cat.capabilities?.edit_files ?? false,
        can_commit: cat.capabilities?.can_commit ?? false,
      },
    })),
  };
}

export function isClaudeCategory(
  categoryName: string,
  config: DiscussionConfig,
): boolean {
  return config.categories.some((cat) => cat.name === categoryName);
}

export function getCategoryCapabilities(
  categoryName: string,
  config: DiscussionConfig,
): CategoryCapabilities | undefined {
  const category = config.categories.find((cat) => cat.name === categoryName);
  return category?.capabilities;
}
```

**Step 4: Add yaml dependency**

Run: `cd ~/ghq/github.com/zeroae/claude-code-action && bun add yaml`

**Step 5: Run test to verify it passes**

Run: `cd ~/ghq/github.com/zeroae/claude-code-action && bun test test/discussion-config.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
cd ~/ghq/github.com/zeroae/claude-code-action
git add src/config/discussion-config.ts test/discussion-config.test.ts package.json bun.lock
git commit -m "feat: add discussion configuration parser"
```

---

## Task 3: Add Discussion GraphQL Query

**Files:**

- Modify: `src/github/api/queries/github.ts`
- Create: `test/discussion-query.test.ts`

**Step 1: Write the failing test**

Create `test/discussion-query.test.ts`:

```typescript
import { describe, it, expect } from "bun:test";
import { DISCUSSION_QUERY } from "../src/github/api/queries/github";

describe("Discussion Query", () => {
  it("exports DISCUSSION_QUERY", () => {
    expect(DISCUSSION_QUERY).toBeDefined();
    expect(typeof DISCUSSION_QUERY).toBe("string");
  });

  it("queries discussion fields", () => {
    expect(DISCUSSION_QUERY).toContain("discussion(number: $number)");
    expect(DISCUSSION_QUERY).toContain("title");
    expect(DISCUSSION_QUERY).toContain("body");
    expect(DISCUSSION_QUERY).toContain("category");
  });

  it("queries discussion comments", () => {
    expect(DISCUSSION_QUERY).toContain("comments");
    expect(DISCUSSION_QUERY).toContain("replies");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd ~/ghq/github.com/zeroae/claude-code-action && bun test test/discussion-query.test.ts`
Expected: FAIL - DISCUSSION_QUERY not exported

**Step 3: Add DISCUSSION_QUERY to queries file**

Add to end of `src/github/api/queries/github.ts`:

```typescript
export const DISCUSSION_QUERY = `
  query($owner: String!, $repo: String!, $number: Int!) {
    repository(owner: $owner, name: $repo) {
      discussion(number: $number) {
        id
        number
        title
        body
        author {
          login
        }
        category {
          id
          name
          slug
        }
        createdAt
        updatedAt
        comments(first: 100) {
          nodes {
            id
            databaseId
            body
            author {
              login
            }
            createdAt
            updatedAt
            isMinimized
            replyTo {
              id
              databaseId
            }
            replies(first: 100) {
              nodes {
                id
                databaseId
                body
                author {
                  login
                }
                createdAt
                updatedAt
                isMinimized
                replyTo {
                  id
                  databaseId
                }
              }
            }
          }
        }
      }
    }
  }
`;
```

**Step 4: Run test to verify it passes**

Run: `cd ~/ghq/github.com/zeroae/claude-code-action && bun test test/discussion-query.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
cd ~/ghq/github.com/zeroae/claude-code-action
git add src/github/api/queries/github.ts test/discussion-query.test.ts
git commit -m "feat: add GraphQL query for discussions"
```

---

## Task 4: Add Discussion Types

**Files:**

- Modify: `src/github/types.ts`

**Step 1: Read existing types file**

Run: `cat ~/ghq/github.com/zeroae/claude-code-action/src/github/types.ts`

**Step 2: Add discussion types**

Add to `src/github/types.ts`:

```typescript
// Discussion types
export type GitHubDiscussionComment = {
  id: string;
  databaseId: number;
  body: string;
  author: {
    login: string;
  };
  createdAt: string;
  updatedAt?: string;
  isMinimized: boolean;
  replyTo?: {
    id: string;
    databaseId: number;
  };
  replies?: {
    nodes: GitHubDiscussionComment[];
  };
};

export type GitHubDiscussion = {
  id: string;
  number: number;
  title: string;
  body: string;
  author: {
    login: string;
  };
  category: {
    id: string;
    name: string;
    slug: string;
  };
  createdAt: string;
  updatedAt?: string;
  comments?: {
    nodes: GitHubDiscussionComment[];
  };
};

export type DiscussionQueryResponse = {
  repository: {
    discussion: GitHubDiscussion | null;
  };
};
```

**Step 3: Commit**

```bash
cd ~/ghq/github.com/zeroae/claude-code-action
git add src/github/types.ts
git commit -m "feat: add discussion type definitions"
```

---

## Task 5: Create Discussion Comment MCP Server

**Files:**

- Create: `src/mcp/github-discussion-server.ts`
- Create: `test/github-discussion-server.test.ts`

**Step 1: Write the failing test**

Create `test/github-discussion-server.test.ts`:

```typescript
import { describe, it, expect } from "bun:test";
import { existsSync } from "fs";

describe("GitHub Discussion Server", () => {
  it("server file exists", () => {
    expect(existsSync("src/mcp/github-discussion-server.ts")).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd ~/ghq/github.com/zeroae/claude-code-action && bun test test/github-discussion-server.test.ts`
Expected: FAIL - file doesn't exist

**Step 3: Create the MCP server**

Create `src/mcp/github-discussion-server.ts`:

```typescript
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
      .describe(
        "Optional: GraphQL node ID of comment to reply to (for threading)",
      ),
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

      const result = await response.json();

      if (result.errors) {
        throw new Error(result.errors[0].message);
      }

      return {
        content: [
          {
            type: "text",
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
      return {
        content: [
          {
            type: "text",
            text: `Error: ${errorMessage}`,
          },
        ],
        error: errorMessage,
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

      const result = await response.json();

      if (result.errors) {
        throw new Error(result.errors[0].message);
      }

      return {
        content: [
          {
            type: "text",
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
            type: "text",
            text: `Error: ${errorMessage}`,
          },
        ],
        error: errorMessage,
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
```

**Step 4: Run test to verify it passes**

Run: `cd ~/ghq/github.com/zeroae/claude-code-action && bun test test/github-discussion-server.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
cd ~/ghq/github.com/zeroae/claude-code-action
git add src/mcp/github-discussion-server.ts test/github-discussion-server.test.ts
git commit -m "feat: add MCP server for discussion replies"
```

---

## Task 6: Add Discussion Mode Detection

**Files:**

- Modify: `src/modes/detector.ts`
- Modify: `test/modes/detector.test.ts`

**Step 1: Write the failing test**

Add to `test/modes/detector.test.ts`:

```typescript
describe("Discussion mode detection", () => {
  it("detects tag mode for discussion_comment with trigger phrase", () => {
    // Mock a discussion_comment context
    const context = createMockContext({
      eventName: "discussion_comment",
      isDiscussion: true,
      discussionCategory: "Claude Q&A",
    });
    // Set up trigger phrase check
    process.env.TRIGGER_PHRASE = "@claude";

    const mode = detectMode(context);
    expect(mode).toBe("tag");
  });

  it("detects tag mode for discussion event in Claude category", () => {
    const context = createMockContext({
      eventName: "discussion",
      isDiscussion: true,
      discussionCategory: "Claude Q&A",
    });

    const mode = detectMode(context);
    expect(mode).toBe("tag");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd ~/ghq/github.com/zeroae/claude-code-action && bun test test/modes/detector.test.ts`
Expected: FAIL - discussion events not handled

**Step 3: Update detector to handle discussions**

Add import at top of `src/modes/detector.ts`:

```typescript
import {
  isEntityContext,
  isIssueCommentEvent,
  isPullRequestReviewCommentEvent,
  isPullRequestEvent,
  isIssuesEvent,
  isPullRequestReviewEvent,
  isDiscussionEvent,
  isDiscussionCommentEvent,
} from "../github/context";
```

Add discussion handling in `detectMode()` function, before the default return:

```typescript
// Discussion events
if (
  isEntityContext(context) &&
  (isDiscussionEvent(context) || isDiscussionCommentEvent(context))
) {
  // For discussions, use tag mode if in a Claude category or has trigger phrase
  // Category checking will be done in the prepare step
  if (context.inputs.prompt) {
    return "agent";
  }
  if (checkContainsTrigger(context)) {
    return "tag";
  }
  // For new discussions in Claude categories, default to tag mode
  if (isDiscussionEvent(context)) {
    return "tag";
  }
}
```

Update `validateTrackProgressEvent` to include discussion events:

```typescript
const validEvents = [
  "pull_request",
  "issues",
  "issue_comment",
  "pull_request_review_comment",
  "pull_request_review",
  "discussion",
  "discussion_comment",
];
```

**Step 4: Run test to verify it passes**

Run: `cd ~/ghq/github.com/zeroae/claude-code-action && bun test test/modes/detector.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
cd ~/ghq/github.com/zeroae/claude-code-action
git add src/modes/detector.ts test/modes/detector.test.ts
git commit -m "feat: add discussion mode detection"
```

---

## Task 7: Create Session Storage Utilities

**Files:**

- Create: `src/sessions/storage.ts`
- Create: `test/sessions/storage.test.ts`

**Step 1: Write the failing test**

Create `test/sessions/storage.test.ts`:

```typescript
import { describe, it, expect } from "bun:test";
import {
  formatSessionPath,
  parseSessionFile,
  serializeSession,
  type SessionData,
} from "../src/sessions/storage";

describe("Session Storage", () => {
  it("formats session path correctly", () => {
    const path = formatSessionPath(42, "DC_abc123");
    expect(path).toBe("discussions/42/DC_abc123.yaml");
  });

  it("serializes session to YAML", () => {
    const session: SessionData = {
      comment_id: "DC_abc123",
      parent_comment_id: null,
      session_id: "sess_xyz",
      created_at: "2025-01-29T10:00:00Z",
      updated_at: "2025-01-29T10:00:00Z",
      summary: "Test summary",
    };
    const yaml = serializeSession(session);
    expect(yaml).toContain("comment_id: DC_abc123");
    expect(yaml).toContain("session_id: sess_xyz");
  });

  it("parses session from YAML", () => {
    const yaml = `
comment_id: DC_abc123
parent_comment_id: null
session_id: sess_xyz
created_at: "2025-01-29T10:00:00Z"
updated_at: "2025-01-29T10:00:00Z"
summary: Test summary
`;
    const session = parseSessionFile(yaml);
    expect(session.comment_id).toBe("DC_abc123");
    expect(session.session_id).toBe("sess_xyz");
    expect(session.summary).toBe("Test summary");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd ~/ghq/github.com/zeroae/claude-code-action && bun test test/sessions/storage.test.ts`
Expected: FAIL - module not found

**Step 3: Create session storage module**

Create directory: `mkdir -p ~/ghq/github.com/zeroae/claude-code-action/src/sessions`
Create directory: `mkdir -p ~/ghq/github.com/zeroae/claude-code-action/test/sessions`

Create `src/sessions/storage.ts`:

```typescript
import * as yaml from "yaml";

export type SessionData = {
  comment_id: string;
  parent_comment_id: string | null;
  session_id: string;
  created_at: string;
  updated_at: string;
  summary: string;
};

export type DiscussionSummary = {
  discussion_id: number;
  title: string;
  last_updated: string;
  key_decisions: string[];
  branches: Array<{
    root: string;
    latest: string;
    topic: string;
  }>;
};

export function formatSessionPath(
  discussionNumber: number,
  commentId: string,
): string {
  return `discussions/${discussionNumber}/${commentId}.yaml`;
}

export function formatSummaryPath(discussionNumber: number): string {
  return `discussions/${discussionNumber}/_summary.yaml`;
}

export function serializeSession(session: SessionData): string {
  return yaml.stringify(session);
}

export function parseSessionFile(content: string): SessionData {
  return yaml.parse(content) as SessionData;
}

export function serializeSummary(summary: DiscussionSummary): string {
  return yaml.stringify(summary);
}

export function parseSummaryFile(content: string): DiscussionSummary {
  return yaml.parse(content) as DiscussionSummary;
}

export function createSession(
  commentId: string,
  parentCommentId: string | null,
  sessionId: string,
  summary: string,
): SessionData {
  const now = new Date().toISOString();
  return {
    comment_id: commentId,
    parent_comment_id: parentCommentId,
    session_id: sessionId,
    created_at: now,
    updated_at: now,
    summary,
  };
}
```

**Step 4: Run test to verify it passes**

Run: `cd ~/ghq/github.com/zeroae/claude-code-action && bun test test/sessions/storage.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
cd ~/ghq/github.com/zeroae/claude-code-action
git add src/sessions/storage.ts test/sessions/storage.test.ts
git commit -m "feat: add session storage utilities"
```

---

## Task 8: Update action.yml for Discussion Events

**Files:**

- Modify: `action.yml`

**Step 1: Add discussion_categories input**

Add to `action.yml` in the inputs section (after `label_trigger`):

```yaml
discussion_categories_file:
  description: "Path to discussion categories config file (default: .github/claude-discussions.yml)"
  required: false
  default: ".github/claude-discussions.yml"
```

**Step 2: Commit**

```bash
cd ~/ghq/github.com/zeroae/claude-code-action
git add action.yml
git commit -m "feat: add discussion_categories_file input"
```

---

## Task 9: Run Full Test Suite and Type Check

**Step 1: Run all tests**

Run: `cd ~/ghq/github.com/zeroae/claude-code-action && bun test`
Expected: All tests PASS

**Step 2: Run type check**

Run: `cd ~/ghq/github.com/zeroae/claude-code-action && bun run typecheck`
Expected: No errors

**Step 3: Run format check**

Run: `cd ~/ghq/github.com/zeroae/claude-code-action && bun run format`
Expected: Files formatted

**Step 4: Commit any formatting changes**

```bash
cd ~/ghq/github.com/zeroae/claude-code-action
git add -A
git commit -m "style: format code" || echo "No formatting changes"
```

---

## Task 10: Push and Create PR

**Step 1: Push to fork**

Run: `cd ~/ghq/github.com/zeroae/claude-code-action && git push origin main`

**Step 2: Verify on GitHub**

Visit: https://github.com/zeroae/claude-code-action

---

## Summary

Phase 1 adds:

1. Discussion event type support in context parsing
2. Configuration file parser for discussion categories
3. GraphQL query for fetching discussion data
4. Type definitions for discussions
5. MCP server for posting/updating discussion comments
6. Mode detection for discussion events
7. Session storage utilities
8. action.yml input for config file path

**Next Phase:** Phase 2 will add branching support, per-comment sessions, and resume logic.
