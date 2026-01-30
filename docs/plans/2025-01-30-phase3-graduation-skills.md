# Phase 3: Graduation Skills Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add `/create-issue` and `/create-pr` skills that allow users to graduate discussion conversations into actionable GitHub Issues or Pull Requests with a draft-in-place workflow.

**Architecture:** Create draft builders that parse discussion context and generate structured drafts. Add MCP tools for creating and updating drafts, then finalizing them into real Issues/PRs. Track draft state in discussion comments.

**Tech Stack:** TypeScript, Bun, GitHub GraphQL/REST API, MCP servers

---

## Task 1: Add Draft Types and Utilities

**Files:**

- Create: `src/graduation/types.ts`
- Create: `src/graduation/draft-formatter.ts`
- Create: `test/graduation/draft-formatter.test.ts`

**Step 1: Write the failing test**

Create `test/graduation/draft-formatter.test.ts`:

```typescript
import { describe, it, expect } from "bun:test";
import {
  formatIssueDraft,
  formatPRDraft,
  parseDraftFromComment,
  type IssueDraft,
  type PRDraft,
} from "../../src/graduation/draft-formatter";

describe("Draft Formatter", () => {
  it("formats issue draft as markdown", () => {
    const draft: IssueDraft = {
      title: "Implement JWT authentication",
      body: "Based on our discussion:\n- Use RS256\n- 15min expiry",
      labels: ["enhancement", "auth"],
      assignees: [],
      discussionNumber: 42,
    };

    const markdown = formatIssueDraft(draft);
    expect(markdown).toContain("📝 **Draft Issue**");
    expect(markdown).toContain("**Title:** Implement JWT authentication");
    expect(markdown).toContain("`enhancement`");
    expect(markdown).toContain("Resolves discussion #42");
  });

  it("formats PR draft as markdown", () => {
    const draft: PRDraft = {
      title: "Add JWT authentication",
      body: "Implements JWT auth as discussed",
      baseBranch: "main",
      headBranch: "feature/jwt-auth",
      labels: ["enhancement"],
      discussionNumber: 42,
    };

    const markdown = formatPRDraft(draft);
    expect(markdown).toContain("📝 **Draft Pull Request**");
    expect(markdown).toContain("**Title:** Add JWT authentication");
    expect(markdown).toContain("**Base:** main");
    expect(markdown).toContain("**Head:** feature/jwt-auth");
  });

  it("parses draft from comment body", () => {
    const comment = `📝 **Draft Issue**

**Title:** Implement JWT authentication

**Labels:** \`enhancement\`, \`auth\`

**Assignees:** (none)

**Body:**
Based on our discussion:
- Use RS256
- 15min expiry

Resolves discussion #42.

---

💬 Reply to refine this draft, or say "create it" to publish.`;

    const draft = parseDraftFromComment(comment);
    expect(draft?.type).toBe("issue");
    expect(draft?.title).toBe("Implement JWT authentication");
    expect(draft?.labels).toContain("enhancement");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx bun test test/graduation/draft-formatter.test.ts`
Expected: FAIL - module not found

**Step 3: Create the types and formatter**

Create `src/graduation/types.ts`:

```typescript
export type IssueDraft = {
  title: string;
  body: string;
  labels: string[];
  assignees: string[];
  discussionNumber: number;
};

export type PRDraft = {
  title: string;
  body: string;
  baseBranch: string;
  headBranch: string;
  labels: string[];
  discussionNumber: number;
};

export type DraftType = "issue" | "pr";

export type ParsedDraft = {
  type: DraftType;
  title: string;
  body: string;
  labels: string[];
  assignees?: string[];
  baseBranch?: string;
  headBranch?: string;
};
```

Create `src/graduation/draft-formatter.ts`:

```typescript
import type { IssueDraft, PRDraft, ParsedDraft } from "./types";

export type { IssueDraft, PRDraft, ParsedDraft };

/**
 * Formats an issue draft as a structured markdown comment.
 */
export function formatIssueDraft(draft: IssueDraft): string {
  const labelsStr =
    draft.labels.length > 0
      ? draft.labels.map((l) => `\`${l}\``).join(", ")
      : "(none)";

  const assigneesStr =
    draft.assignees.length > 0 ? draft.assignees.join(", ") : "(none)";

  return `📝 **Draft Issue**

**Title:** ${draft.title}

**Labels:** ${labelsStr}

**Assignees:** ${assigneesStr}

**Body:**
${draft.body}

Resolves discussion #${draft.discussionNumber}.

---

💬 Reply to refine this draft, or say "create it" to publish.`;
}

/**
 * Formats a PR draft as a structured markdown comment.
 */
export function formatPRDraft(draft: PRDraft): string {
  const labelsStr =
    draft.labels.length > 0
      ? draft.labels.map((l) => `\`${l}\``).join(", ")
      : "(none)";

  return `📝 **Draft Pull Request**

**Title:** ${draft.title}

**Base:** ${draft.baseBranch}

**Head:** ${draft.headBranch}

**Labels:** ${labelsStr}

**Body:**
${draft.body}

Resolves discussion #${draft.discussionNumber}.

---

💬 Reply to refine this draft, or say "create it" to publish.`;
}

/**
 * Parses a draft from a comment body.
 * Returns null if the comment is not a draft.
 */
export function parseDraftFromComment(commentBody: string): ParsedDraft | null {
  if (!commentBody.includes("📝 **Draft")) {
    return null;
  }

  const isIssue = commentBody.includes("**Draft Issue**");
  const isPR = commentBody.includes("**Draft Pull Request**");

  if (!isIssue && !isPR) {
    return null;
  }

  // Parse title
  const titleMatch = commentBody.match(/\*\*Title:\*\*\s*(.+)/);
  const title = titleMatch?.[1]?.trim() ?? "";

  // Parse labels
  const labelsMatch = commentBody.match(/\*\*Labels:\*\*\s*(.+)/);
  const labelsStr = labelsMatch?.[1]?.trim() ?? "";
  const labels =
    labelsStr === "(none)"
      ? []
      : (labelsStr.match(/`([^`]+)`/g)?.map((l) => l.replace(/`/g, "")) ?? []);

  // Parse body
  const bodyMatch = commentBody.match(
    /\*\*Body:\*\*\n([\s\S]*?)\n\nResolves discussion/,
  );
  const body = bodyMatch?.[1]?.trim() ?? "";

  if (isIssue) {
    // Parse assignees
    const assigneesMatch = commentBody.match(/\*\*Assignees:\*\*\s*(.+)/);
    const assigneesStr = assigneesMatch?.[1]?.trim() ?? "";
    const assignees =
      assigneesStr === "(none)"
        ? []
        : assigneesStr.split(",").map((a) => a.trim());

    return {
      type: "issue",
      title,
      body,
      labels,
      assignees,
    };
  }

  if (isPR) {
    // Parse base and head branches
    const baseMatch = commentBody.match(/\*\*Base:\*\*\s*(.+)/);
    const headMatch = commentBody.match(/\*\*Head:\*\*\s*(.+)/);

    return {
      type: "pr",
      title,
      body,
      labels,
      baseBranch: baseMatch?.[1]?.trim(),
      headBranch: headMatch?.[1]?.trim(),
    };
  }

  return null;
}
```

**Step 4: Run test to verify it passes**

Run: `npx bun test test/graduation/draft-formatter.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
cd ~/ghq/github.com/zeroae/claude-code-action
git add src/graduation/types.ts src/graduation/draft-formatter.ts test/graduation/draft-formatter.test.ts
git commit -m "feat: add draft types and formatter for graduation skills"
```

---

## Task 2: Add Draft Builder from Discussion Context

**Files:**

- Create: `src/graduation/draft-builder.ts`
- Create: `test/graduation/draft-builder.test.ts`

**Step 1: Write the failing test**

Create `test/graduation/draft-builder.test.ts`:

```typescript
import { describe, it, expect } from "bun:test";
import {
  buildIssueDraftFromContext,
  buildPRDraftFromContext,
  type DraftContext,
} from "../../src/graduation/draft-builder";

describe("Draft Builder", () => {
  const mockContext: DraftContext = {
    discussionNumber: 42,
    discussionTitle: "How to implement auth?",
    discussionBody: "I need help with authentication",
    conversationSummary:
      "Decided on JWT with RS256, 15min expiry, refresh tokens",
    repository: "owner/repo",
    defaultBranch: "main",
  };

  it("builds issue draft from context", () => {
    const draft = buildIssueDraftFromContext(mockContext, {
      title: "Implement JWT authentication",
      labels: ["enhancement"],
    });

    expect(draft.title).toBe("Implement JWT authentication");
    expect(draft.discussionNumber).toBe(42);
    expect(draft.labels).toContain("enhancement");
    expect(draft.body).toContain("JWT with RS256");
  });

  it("builds PR draft from context", () => {
    const draft = buildPRDraftFromContext(mockContext, {
      title: "Add JWT authentication",
      headBranch: "feature/jwt-auth",
    });

    expect(draft.title).toBe("Add JWT authentication");
    expect(draft.baseBranch).toBe("main");
    expect(draft.headBranch).toBe("feature/jwt-auth");
    expect(draft.discussionNumber).toBe(42);
  });

  it("uses discussion title as default issue title", () => {
    const draft = buildIssueDraftFromContext(mockContext, {});
    expect(draft.title).toBe("How to implement auth?");
  });

  it("generates branch name from title for PR", () => {
    const draft = buildPRDraftFromContext(mockContext, {
      title: "Add JWT Authentication",
    });
    expect(draft.headBranch).toMatch(/add-jwt-authentication/i);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx bun test test/graduation/draft-builder.test.ts`
Expected: FAIL - module not found

**Step 3: Create the draft builder**

Create `src/graduation/draft-builder.ts`:

```typescript
import type { IssueDraft, PRDraft } from "./types";

export type DraftContext = {
  discussionNumber: number;
  discussionTitle: string;
  discussionBody: string;
  conversationSummary: string;
  repository: string;
  defaultBranch: string;
};

export type IssueDraftOptions = {
  title?: string;
  body?: string;
  labels?: string[];
  assignees?: string[];
};

export type PRDraftOptions = {
  title?: string;
  body?: string;
  baseBranch?: string;
  headBranch?: string;
  labels?: string[];
};

/**
 * Generates a slug from a title for use in branch names.
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 50);
}

/**
 * Builds an issue draft from discussion context.
 */
export function buildIssueDraftFromContext(
  context: DraftContext,
  options: IssueDraftOptions,
): IssueDraft {
  const title = options.title ?? context.discussionTitle;

  const body =
    options.body ??
    `## Context

Based on discussion #${context.discussionNumber}: "${context.discussionTitle}"

## Summary

${context.conversationSummary}

## Original Discussion

${context.discussionBody}`;

  return {
    title,
    body,
    labels: options.labels ?? [],
    assignees: options.assignees ?? [],
    discussionNumber: context.discussionNumber,
  };
}

/**
 * Builds a PR draft from discussion context.
 */
export function buildPRDraftFromContext(
  context: DraftContext,
  options: PRDraftOptions,
): PRDraft {
  const title = options.title ?? context.discussionTitle;
  const baseBranch = options.baseBranch ?? context.defaultBranch;
  const headBranch = options.headBranch ?? `feature/${slugify(title)}`;

  const body =
    options.body ??
    `## Summary

${context.conversationSummary}

## Related Discussion

Resolves discussion #${context.discussionNumber}: "${context.discussionTitle}"`;

  return {
    title,
    body,
    baseBranch,
    headBranch,
    labels: options.labels ?? [],
    discussionNumber: context.discussionNumber,
  };
}
```

**Step 4: Run test to verify it passes**

Run: `npx bun test test/graduation/draft-builder.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
cd ~/ghq/github.com/zeroae/claude-code-action
git add src/graduation/draft-builder.ts test/graduation/draft-builder.test.ts
git commit -m "feat: add draft builder from discussion context"
```

---

## Task 3: Add MCP Server for Graduation Skills

**Files:**

- Create: `src/mcp/github-graduation-server.ts`
- Create: `test/github-graduation-server.test.ts`

**Step 1: Write the failing test**

Create `test/github-graduation-server.test.ts`:

```typescript
import { describe, it, expect } from "bun:test";
import {
  getGraduationTools,
  CREATE_ISSUE_DRAFT_TOOL,
  CREATE_PR_DRAFT_TOOL,
  FINALIZE_ISSUE_TOOL,
  FINALIZE_PR_TOOL,
} from "../src/mcp/github-graduation-server";

describe("GitHub Graduation Server", () => {
  it("exports graduation tools", () => {
    const tools = getGraduationTools();
    expect(tools.length).toBeGreaterThanOrEqual(4);
  });

  it("has create_issue_draft tool", () => {
    expect(CREATE_ISSUE_DRAFT_TOOL.name).toBe("create_issue_draft");
    expect(CREATE_ISSUE_DRAFT_TOOL.inputSchema.properties).toHaveProperty(
      "discussion_number",
    );
    expect(CREATE_ISSUE_DRAFT_TOOL.inputSchema.properties).toHaveProperty(
      "title",
    );
  });

  it("has create_pr_draft tool", () => {
    expect(CREATE_PR_DRAFT_TOOL.name).toBe("create_pr_draft");
    expect(CREATE_PR_DRAFT_TOOL.inputSchema.properties).toHaveProperty(
      "head_branch",
    );
  });

  it("has finalize_issue tool", () => {
    expect(FINALIZE_ISSUE_TOOL.name).toBe("finalize_issue");
    expect(FINALIZE_ISSUE_TOOL.inputSchema.properties).toHaveProperty(
      "draft_comment_id",
    );
  });

  it("has finalize_pr tool", () => {
    expect(FINALIZE_PR_TOOL.name).toBe("finalize_pr");
    expect(FINALIZE_PR_TOOL.inputSchema.properties).toHaveProperty(
      "draft_comment_id",
    );
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx bun test test/github-graduation-server.test.ts`
Expected: FAIL - module not found

**Step 3: Create the graduation MCP server**

Create `src/mcp/github-graduation-server.ts`:

```typescript
import type { Tool } from "@anthropic-ai/sdk/resources/messages";

export const CREATE_ISSUE_DRAFT_TOOL: Tool = {
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

export const CREATE_PR_DRAFT_TOOL: Tool = {
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

export const FINALIZE_ISSUE_TOOL: Tool = {
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

export const FINALIZE_PR_TOOL: Tool = {
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

export const UPDATE_DRAFT_TOOL: Tool = {
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

export function getGraduationTools(): Tool[] {
  return [
    CREATE_ISSUE_DRAFT_TOOL,
    CREATE_PR_DRAFT_TOOL,
    FINALIZE_ISSUE_TOOL,
    FINALIZE_PR_TOOL,
    UPDATE_DRAFT_TOOL,
  ];
}
```

**Step 4: Run test to verify it passes**

Run: `npx bun test test/github-graduation-server.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
cd ~/ghq/github.com/zeroae/claude-code-action
git add src/mcp/github-graduation-server.ts test/github-graduation-server.test.ts
git commit -m "feat: add MCP server for graduation skills"
```

---

## Task 4: Add Graduation Handlers

**Files:**

- Create: `src/graduation/handlers.ts`
- Create: `test/graduation/handlers.test.ts`

**Step 1: Write the failing test**

Create `test/graduation/handlers.test.ts`:

```typescript
import { describe, it, expect } from "bun:test";
import {
  handleCreateIssueDraft,
  handleCreatePRDraft,
  handleFinalizeDraft,
  type GraduationContext,
} from "../../src/graduation/handlers";

describe("Graduation Handlers", () => {
  const mockContext: GraduationContext = {
    owner: "test-owner",
    repo: "test-repo",
    discussionNumber: 42,
    discussionTitle: "How to implement auth?",
    discussionBody: "I need help with authentication",
    conversationSummary: "Decided on JWT",
    defaultBranch: "main",
  };

  it("creates issue draft response", async () => {
    const result = await handleCreateIssueDraft(mockContext, {
      title: "Implement JWT",
      body: "Based on discussion",
      labels: ["enhancement"],
      assignees: [],
    });

    expect(result.draftMarkdown).toContain("📝 **Draft Issue**");
    expect(result.draftMarkdown).toContain("Implement JWT");
    expect(result.draft.title).toBe("Implement JWT");
  });

  it("creates PR draft response", async () => {
    const result = await handleCreatePRDraft(mockContext, {
      title: "Add JWT auth",
      body: "Implements JWT",
      headBranch: "feature/jwt",
      labels: [],
    });

    expect(result.draftMarkdown).toContain("📝 **Draft Pull Request**");
    expect(result.draftMarkdown).toContain("feature/jwt");
    expect(result.draft.headBranch).toBe("feature/jwt");
  });

  it("parses draft for finalization", async () => {
    const draftComment = `📝 **Draft Issue**

**Title:** Implement JWT

**Labels:** \`enhancement\`

**Assignees:** (none)

**Body:**
Based on discussion

Resolves discussion #42.

---

💬 Reply to refine this draft, or say "create it" to publish.`;

    const result = handleFinalizeDraft(draftComment);
    expect(result?.type).toBe("issue");
    expect(result?.title).toBe("Implement JWT");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx bun test test/graduation/handlers.test.ts`
Expected: FAIL - module not found

**Step 3: Create the handlers**

Create `src/graduation/handlers.ts`:

```typescript
import type { IssueDraft, PRDraft, ParsedDraft } from "./types";
import {
  formatIssueDraft,
  formatPRDraft,
  parseDraftFromComment,
} from "./draft-formatter";

export type GraduationContext = {
  owner: string;
  repo: string;
  discussionNumber: number;
  discussionTitle: string;
  discussionBody: string;
  conversationSummary: string;
  defaultBranch: string;
};

export type CreateIssueDraftInput = {
  title: string;
  body: string;
  labels: string[];
  assignees: string[];
};

export type CreatePRDraftInput = {
  title: string;
  body: string;
  headBranch: string;
  baseBranch?: string;
  labels: string[];
};

export type DraftResult<T> = {
  draft: T;
  draftMarkdown: string;
};

/**
 * Handles creating an issue draft.
 */
export async function handleCreateIssueDraft(
  context: GraduationContext,
  input: CreateIssueDraftInput,
): Promise<DraftResult<IssueDraft>> {
  const draft: IssueDraft = {
    title: input.title,
    body: input.body,
    labels: input.labels,
    assignees: input.assignees,
    discussionNumber: context.discussionNumber,
  };

  const draftMarkdown = formatIssueDraft(draft);

  return {
    draft,
    draftMarkdown,
  };
}

/**
 * Handles creating a PR draft.
 */
export async function handleCreatePRDraft(
  context: GraduationContext,
  input: CreatePRDraftInput,
): Promise<DraftResult<PRDraft>> {
  const draft: PRDraft = {
    title: input.title,
    body: input.body,
    baseBranch: input.baseBranch ?? context.defaultBranch,
    headBranch: input.headBranch,
    labels: input.labels,
    discussionNumber: context.discussionNumber,
  };

  const draftMarkdown = formatPRDraft(draft);

  return {
    draft,
    draftMarkdown,
  };
}

/**
 * Parses a draft comment for finalization.
 */
export function handleFinalizeDraft(commentBody: string): ParsedDraft | null {
  return parseDraftFromComment(commentBody);
}
```

**Step 4: Run test to verify it passes**

Run: `npx bun test test/graduation/handlers.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
cd ~/ghq/github.com/zeroae/claude-code-action
git add src/graduation/handlers.ts test/graduation/handlers.test.ts
git commit -m "feat: add graduation handlers for draft creation"
```

---

## Task 5: Add Issue/PR Creation Functions

**Files:**

- Create: `src/graduation/create-issue.ts`
- Create: `src/graduation/create-pr.ts`
- Create: `test/graduation/create-issue.test.ts`

**Step 1: Write the failing test**

Create `test/graduation/create-issue.test.ts`:

```typescript
import { describe, it, expect } from "bun:test";
import {
  buildCreateIssueParams,
  buildCreatePRParams,
  formatCreatedIssueComment,
  formatCreatedPRComment,
} from "../../src/graduation/create-issue";

describe("Create Issue/PR", () => {
  it("builds create issue params from draft", () => {
    const params = buildCreateIssueParams(
      "owner",
      "repo",
      {
        type: "issue",
        title: "Implement JWT",
        body: "Based on discussion",
        labels: ["enhancement"],
        assignees: ["user1"],
      },
      42,
    );

    expect(params.owner).toBe("owner");
    expect(params.repo).toBe("repo");
    expect(params.title).toBe("Implement JWT");
    expect(params.labels).toContain("enhancement");
  });

  it("builds create PR params from draft", () => {
    const params = buildCreatePRParams("owner", "repo", {
      type: "pr",
      title: "Add JWT",
      body: "Implements JWT",
      labels: [],
      baseBranch: "main",
      headBranch: "feature/jwt",
    });

    expect(params.base).toBe("main");
    expect(params.head).toBe("feature/jwt");
  });

  it("formats created issue comment", () => {
    const comment = formatCreatedIssueComment(123, "Implement JWT", 42);
    expect(comment).toContain("✅ Issue #123 created");
    expect(comment).toContain("discussion #42");
  });

  it("formats created PR comment", () => {
    const comment = formatCreatedPRComment(456, "Add JWT", 42);
    expect(comment).toContain("✅ Pull Request #456 created");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx bun test test/graduation/create-issue.test.ts`
Expected: FAIL - module not found

**Step 3: Create the issue/PR creation functions**

Create `src/graduation/create-issue.ts`:

```typescript
import type { ParsedDraft } from "./types";

export type CreateIssueParams = {
  owner: string;
  repo: string;
  title: string;
  body: string;
  labels?: string[];
  assignees?: string[];
};

export type CreatePRParams = {
  owner: string;
  repo: string;
  title: string;
  body: string;
  base: string;
  head: string;
};

/**
 * Builds parameters for creating a GitHub Issue from a parsed draft.
 */
export function buildCreateIssueParams(
  owner: string,
  repo: string,
  draft: ParsedDraft,
  discussionNumber: number,
): CreateIssueParams {
  const body = `${draft.body}

---
_Created from [discussion #${discussionNumber}](https://github.com/${owner}/${repo}/discussions/${discussionNumber})_`;

  return {
    owner,
    repo,
    title: draft.title,
    body,
    labels: draft.labels,
    assignees: draft.assignees,
  };
}

/**
 * Builds parameters for creating a GitHub PR from a parsed draft.
 */
export function buildCreatePRParams(
  owner: string,
  repo: string,
  draft: ParsedDraft,
): CreatePRParams {
  return {
    owner,
    repo,
    title: draft.title,
    body: draft.body,
    base: draft.baseBranch ?? "main",
    head: draft.headBranch ?? "",
  };
}

/**
 * Formats a comment announcing the created issue.
 */
export function formatCreatedIssueComment(
  issueNumber: number,
  issueTitle: string,
  discussionNumber: number,
): string {
  return `✅ **Issue #${issueNumber} created:** ${issueTitle}

This issue was graduated from discussion #${discussionNumber}.

[View Issue →](#${issueNumber})`;
}

/**
 * Formats a comment announcing the created PR.
 */
export function formatCreatedPRComment(
  prNumber: number,
  prTitle: string,
  discussionNumber: number,
): string {
  return `✅ **Pull Request #${prNumber} created:** ${prTitle}

This PR was graduated from discussion #${discussionNumber}.

[View Pull Request →](#${prNumber})`;
}
```

**Step 4: Run test to verify it passes**

Run: `npx bun test test/graduation/create-issue.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
cd ~/ghq/github.com/zeroae/claude-code-action
git add src/graduation/create-issue.ts test/graduation/create-issue.test.ts
git commit -m "feat: add issue/PR creation functions for graduation"
```

---

## Task 6: Run Full Test Suite and Type Check

**Step 1: Run all tests**

Run: `npx bun test`
Expected: All tests should pass

**Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Run format**

Run: `npx bun run format`

**Step 4: Commit any formatting changes**

```bash
cd ~/ghq/github.com/zeroae/claude-code-action
git add -A
git commit -m "style: format code" || echo "No formatting changes"
```

---

## Task 7: Push to Fork

**Step 1: Push to fork**

Run: `git push origin main`

---

## Summary

Phase 3 adds:

1. Draft types and formatting utilities
2. Draft builder from discussion context
3. MCP server with graduation tools (create_issue_draft, create_pr_draft, finalize_issue, finalize_pr, update_draft)
4. Graduation handlers for creating and parsing drafts
5. Issue/PR creation functions with bidirectional linking

**Next Phase:** Phase 4 will add polish features (smart quoting, title suggestions, per-category capabilities, web search protection, commit gating).
