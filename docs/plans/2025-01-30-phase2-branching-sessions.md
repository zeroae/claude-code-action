# Phase 2: Branching & Session Management Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add fork/rewind support with per-comment session storage and session resume logic for GitHub Discussions.

**Architecture:** Extend the discussion data fetcher to walk reply chains and find the relevant Claude comment. Add session manager to read/write session files on the orphan branch. Integrate session resume into the prepare step.

**Tech Stack:** TypeScript, Bun, GitHub GraphQL API, git (for orphan branch operations)

---

## Task 1: Add Discussion Data Fetcher

**Files:**

- Create: `src/github/data/discussion-fetcher.ts`
- Create: `test/discussion-fetcher.test.ts`

**Step 1: Write the failing test**

Create `test/discussion-fetcher.test.ts`:

```typescript
import { describe, it, expect } from "bun:test";
import {
  findReplyChain,
  findLastClaudeComment,
  type DiscussionComment,
} from "../src/github/data/discussion-fetcher";

describe("Discussion Fetcher", () => {
  const mockComments: DiscussionComment[] = [
    {
      id: "DC_001",
      databaseId: 1,
      body: "User question",
      author: { login: "user1" },
      createdAt: "2025-01-01T10:00:00Z",
      isMinimized: false,
      replyTo: null,
    },
    {
      id: "DC_002",
      databaseId: 2,
      body: "Claude response",
      author: { login: "claude[bot]" },
      createdAt: "2025-01-01T10:01:00Z",
      isMinimized: false,
      replyTo: { id: "DC_001", databaseId: 1 },
    },
    {
      id: "DC_003",
      databaseId: 3,
      body: "User follow-up",
      author: { login: "user1" },
      createdAt: "2025-01-01T10:02:00Z",
      isMinimized: false,
      replyTo: { id: "DC_002", databaseId: 2 },
    },
  ];

  it("finds reply chain from a comment", () => {
    const chain = findReplyChain("DC_003", mockComments);
    expect(chain).toHaveLength(3);
    expect(chain[0].id).toBe("DC_003");
    expect(chain[1].id).toBe("DC_002");
    expect(chain[2].id).toBe("DC_001");
  });

  it("finds last Claude comment in chain", () => {
    const chain = findReplyChain("DC_003", mockComments);
    const claudeComment = findLastClaudeComment(chain, "claude[bot]");
    expect(claudeComment?.id).toBe("DC_002");
  });

  it("returns null when no Claude comment in chain", () => {
    const chain = [mockComments[0]]; // Just user comment
    const claudeComment = findLastClaudeComment(chain, "claude[bot]");
    expect(claudeComment).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx bun test test/discussion-fetcher.test.ts`
Expected: FAIL - module not found

**Step 3: Create the discussion fetcher**

Create `src/github/data/discussion-fetcher.ts`:

```typescript
import type { Octokits } from "../api/client";
import { DISCUSSION_QUERY } from "../api/queries/github";
import type {
  GitHubDiscussion,
  GitHubDiscussionComment,
  DiscussionQueryResponse,
} from "../types";

export type DiscussionComment = {
  id: string;
  databaseId: number;
  body: string;
  author: { login: string };
  createdAt: string;
  updatedAt?: string;
  isMinimized: boolean;
  replyTo: { id: string; databaseId: number } | null;
};

/**
 * Flattens nested discussion comments into a flat array.
 * Discussion comments can have nested replies, this flattens them.
 */
export function flattenDiscussionComments(
  comments: GitHubDiscussionComment[],
): DiscussionComment[] {
  const result: DiscussionComment[] = [];

  function flatten(comment: GitHubDiscussionComment) {
    result.push({
      id: comment.id,
      databaseId: comment.databaseId,
      body: comment.body,
      author: comment.author,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      isMinimized: comment.isMinimized,
      replyTo: comment.replyTo ?? null,
    });

    if (comment.replies?.nodes) {
      for (const reply of comment.replies.nodes) {
        flatten(reply);
      }
    }
  }

  for (const comment of comments) {
    flatten(comment);
  }

  return result;
}

/**
 * Walks up the reply chain from a given comment ID.
 * Returns an array starting with the given comment, then its parent, etc.
 */
export function findReplyChain(
  commentId: string,
  allComments: DiscussionComment[],
): DiscussionComment[] {
  const commentMap = new Map(allComments.map((c) => [c.id, c]));
  const chain: DiscussionComment[] = [];

  let current = commentMap.get(commentId);
  while (current) {
    chain.push(current);
    if (current.replyTo) {
      current = commentMap.get(current.replyTo.id);
    } else {
      break;
    }
  }

  return chain;
}

/**
 * Finds the most recent Claude comment in a reply chain.
 * The chain should be ordered from newest to oldest.
 */
export function findLastClaudeComment(
  chain: DiscussionComment[],
  botLogin: string,
): DiscussionComment | null {
  for (const comment of chain) {
    if (comment.author.login === botLogin) {
      return comment;
    }
  }
  return null;
}

/**
 * Fetches discussion data from GitHub GraphQL API.
 */
export async function fetchDiscussionData(
  octokits: Octokits,
  owner: string,
  repo: string,
  discussionNumber: number,
): Promise<GitHubDiscussion | null> {
  const result = await octokits.graphql<DiscussionQueryResponse>(
    DISCUSSION_QUERY,
    {
      owner,
      repo,
      number: discussionNumber,
    },
  );

  return result.repository.discussion;
}

export type DiscussionContext = {
  discussion: GitHubDiscussion;
  allComments: DiscussionComment[];
  replyChain: DiscussionComment[];
  lastClaudeComment: DiscussionComment | null;
};

/**
 * Builds full discussion context for a triggered comment.
 */
export async function buildDiscussionContext(
  octokits: Octokits,
  owner: string,
  repo: string,
  discussionNumber: number,
  triggerCommentId: string,
  botLogin: string,
): Promise<DiscussionContext | null> {
  const discussion = await fetchDiscussionData(
    octokits,
    owner,
    repo,
    discussionNumber,
  );

  if (!discussion) {
    return null;
  }

  const allComments = flattenDiscussionComments(
    discussion.comments?.nodes ?? [],
  );
  const replyChain = findReplyChain(triggerCommentId, allComments);
  const lastClaudeComment = findLastClaudeComment(replyChain, botLogin);

  return {
    discussion,
    allComments,
    replyChain,
    lastClaudeComment,
  };
}
```

**Step 4: Run test to verify it passes**

Run: `npx bun test test/discussion-fetcher.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
cd ~/ghq/github.com/zeroae/claude-code-action
git add src/github/data/discussion-fetcher.ts test/discussion-fetcher.test.ts
git commit -m "feat: add discussion data fetcher with reply chain support"
```

---

## Task 2: Add Session Manager for Orphan Branch

**Files:**

- Create: `src/sessions/manager.ts`
- Create: `test/sessions/manager.test.ts`

**Step 1: Write the failing test**

Create `test/sessions/manager.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm, mkdir, writeFile, readFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import {
  SessionManager,
  type SessionManagerOptions,
} from "../../src/sessions/manager";

describe("Session Manager", () => {
  let tempDir: string;
  let manager: SessionManager;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "session-test-"));
    manager = new SessionManager({
      workDir: tempDir,
      sessionBranch: "claude-sessions",
      // Skip git operations in tests
      skipGit: true,
    });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("saves and loads session", async () => {
    const session = {
      comment_id: "DC_abc123",
      parent_comment_id: null,
      session_id: "sess_xyz",
      created_at: "2025-01-29T10:00:00Z",
      updated_at: "2025-01-29T10:00:00Z",
      summary: "Test summary",
    };

    await manager.saveSession(42, session);
    const loaded = await manager.loadSession(42, "DC_abc123");

    expect(loaded?.comment_id).toBe("DC_abc123");
    expect(loaded?.session_id).toBe("sess_xyz");
  });

  it("returns null for non-existent session", async () => {
    const loaded = await manager.loadSession(42, "DC_nonexistent");
    expect(loaded).toBeNull();
  });

  it("finds session for comment in chain", async () => {
    // Save a session for a Claude comment
    const session = {
      comment_id: "DC_claude",
      parent_comment_id: "DC_user1",
      session_id: "sess_xyz",
      created_at: "2025-01-29T10:00:00Z",
      updated_at: "2025-01-29T10:00:00Z",
      summary: "Test summary",
    };
    await manager.saveSession(42, session);

    // Find session when triggered from a reply to Claude's comment
    const chain = ["DC_user2", "DC_claude", "DC_user1"];
    const found = await manager.findSessionInChain(42, chain);

    expect(found?.comment_id).toBe("DC_claude");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx bun test test/sessions/manager.test.ts`
Expected: FAIL - module not found

**Step 3: Create the session manager**

Create `src/sessions/manager.ts`:

```typescript
import { mkdir, readFile, writeFile } from "fs/promises";
import { join, dirname } from "path";
import { existsSync } from "fs";
import {
  formatSessionPath,
  formatSummaryPath,
  serializeSession,
  parseSessionFile,
  serializeSummary,
  parseSummaryFile,
  type SessionData,
  type DiscussionSummary,
} from "./storage";

export type SessionManagerOptions = {
  workDir: string;
  sessionBranch: string;
  skipGit?: boolean;
};

export class SessionManager {
  private workDir: string;
  private sessionBranch: string;
  private skipGit: boolean;

  constructor(options: SessionManagerOptions) {
    this.workDir = options.workDir;
    this.sessionBranch = options.sessionBranch;
    this.skipGit = options.skipGit ?? false;
  }

  private getSessionFilePath(
    discussionNumber: number,
    commentId: string,
  ): string {
    return join(this.workDir, formatSessionPath(discussionNumber, commentId));
  }

  private getSummaryFilePath(discussionNumber: number): string {
    return join(this.workDir, formatSummaryPath(discussionNumber));
  }

  /**
   * Saves a session to the file system.
   */
  async saveSession(
    discussionNumber: number,
    session: SessionData,
  ): Promise<void> {
    const filePath = this.getSessionFilePath(
      discussionNumber,
      session.comment_id,
    );
    const dir = dirname(filePath);

    await mkdir(dir, { recursive: true });
    await writeFile(filePath, serializeSession(session));
  }

  /**
   * Loads a session from the file system.
   */
  async loadSession(
    discussionNumber: number,
    commentId: string,
  ): Promise<SessionData | null> {
    const filePath = this.getSessionFilePath(discussionNumber, commentId);

    if (!existsSync(filePath)) {
      return null;
    }

    const content = await readFile(filePath, "utf-8");
    return parseSessionFile(content);
  }

  /**
   * Finds a session for any comment in the given chain.
   * Chain should be ordered from newest to oldest (trigger comment first).
   */
  async findSessionInChain(
    discussionNumber: number,
    commentIds: string[],
  ): Promise<SessionData | null> {
    for (const commentId of commentIds) {
      const session = await this.loadSession(discussionNumber, commentId);
      if (session) {
        return session;
      }
    }
    return null;
  }

  /**
   * Saves discussion summary.
   */
  async saveSummary(
    discussionNumber: number,
    summary: DiscussionSummary,
  ): Promise<void> {
    const filePath = this.getSummaryFilePath(discussionNumber);
    const dir = dirname(filePath);

    await mkdir(dir, { recursive: true });
    await writeFile(filePath, serializeSummary(summary));
  }

  /**
   * Loads discussion summary.
   */
  async loadSummary(
    discussionNumber: number,
  ): Promise<DiscussionSummary | null> {
    const filePath = this.getSummaryFilePath(discussionNumber);

    if (!existsSync(filePath)) {
      return null;
    }

    const content = await readFile(filePath, "utf-8");
    return parseSummaryFile(content);
  }

  /**
   * Gets the session branch name.
   */
  getSessionBranch(): string {
    return this.sessionBranch;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npx bun test test/sessions/manager.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
cd ~/ghq/github.com/zeroae/claude-code-action
git add src/sessions/manager.ts test/sessions/manager.test.ts
git commit -m "feat: add session manager for reading/writing session files"
```

---

## Task 3: Add Discussion Trigger Validation

**Files:**

- Modify: `src/github/validation/trigger.ts`
- Create: `test/discussion-trigger.test.ts`

**Step 1: Write the failing test**

Create `test/discussion-trigger.test.ts`:

```typescript
import { describe, it, expect, mock, beforeEach } from "bun:test";
import { checkDiscussionTrigger } from "../src/github/validation/trigger";

describe("Discussion Trigger Validation", () => {
  it("returns true for discussion in configured category", () => {
    const result = checkDiscussionTrigger(
      "Claude Q&A",
      ["Claude Q&A", "AI Chat"],
      "@claude",
      "Hello world",
    );
    expect(result).toBe(true);
  });

  it("returns false for discussion not in configured category without trigger", () => {
    const result = checkDiscussionTrigger(
      "General",
      ["Claude Q&A"],
      "@claude",
      "Hello world",
    );
    expect(result).toBe(false);
  });

  it("returns true for non-configured category with trigger phrase", () => {
    const result = checkDiscussionTrigger(
      "General",
      ["Claude Q&A"],
      "@claude",
      "Hey @claude, help me",
    );
    expect(result).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx bun test test/discussion-trigger.test.ts`
Expected: FAIL - function not exported

**Step 3: Read and modify trigger.ts**

First read the existing file:

```bash
cat src/github/validation/trigger.ts
```

Add this function to `src/github/validation/trigger.ts`:

```typescript
/**
 * Checks if a discussion event should trigger Claude.
 * Returns true if:
 * - The discussion category is in the configured categories list, OR
 * - The comment body contains the trigger phrase
 */
export function checkDiscussionTrigger(
  categoryName: string,
  configuredCategories: string[],
  triggerPhrase: string,
  commentBody: string,
): boolean {
  // Check if in configured category
  if (configuredCategories.includes(categoryName)) {
    return true;
  }

  // Check for trigger phrase
  if (commentBody.toLowerCase().includes(triggerPhrase.toLowerCase())) {
    return true;
  }

  return false;
}
```

**Step 4: Run test to verify it passes**

Run: `npx bun test test/discussion-trigger.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
cd ~/ghq/github.com/zeroae/claude-code-action
git add src/github/validation/trigger.ts test/discussion-trigger.test.ts
git commit -m "feat: add discussion trigger validation with category support"
```

---

## Task 4: Add Discussion Prompt Builder

**Files:**

- Create: `src/create-prompt/discussion-prompt.ts`
- Create: `test/discussion-prompt.test.ts`

**Step 1: Write the failing test**

Create `test/discussion-prompt.test.ts`:

```typescript
import { describe, it, expect } from "bun:test";
import {
  buildDiscussionPrompt,
  type DiscussionPromptContext,
} from "../src/create-prompt/discussion-prompt";

describe("Discussion Prompt Builder", () => {
  const mockContext: DiscussionPromptContext = {
    discussion: {
      id: "D_123",
      number: 42,
      title: "How to implement auth?",
      body: "I need help with authentication",
      author: { login: "user1" },
      category: { id: "cat_1", name: "Claude Q&A", slug: "claude-qa" },
      createdAt: "2025-01-01T10:00:00Z",
    },
    triggerComment: {
      id: "DC_003",
      body: "What about JWT?",
      author: { login: "user1" },
    },
    replyChain: [
      { id: "DC_003", body: "What about JWT?", author: { login: "user1" } },
      {
        id: "DC_002",
        body: "Here are 3 approaches...",
        author: { login: "claude[bot]" },
      },
      {
        id: "DC_001",
        body: "I need help with auth",
        author: { login: "user1" },
      },
    ],
    sessionSummary: "Previously discussed OAuth and session-based auth.",
    repository: "owner/repo",
    botLogin: "claude[bot]",
  };

  it("includes discussion title and body", () => {
    const prompt = buildDiscussionPrompt(mockContext);
    expect(prompt).toContain("How to implement auth?");
    expect(prompt).toContain("I need help with authentication");
  });

  it("includes conversation history", () => {
    const prompt = buildDiscussionPrompt(mockContext);
    expect(prompt).toContain("What about JWT?");
    expect(prompt).toContain("Here are 3 approaches...");
  });

  it("includes session summary when provided", () => {
    const prompt = buildDiscussionPrompt(mockContext);
    expect(prompt).toContain("Previously discussed OAuth");
  });

  it("indicates this is a discussion context", () => {
    const prompt = buildDiscussionPrompt(mockContext);
    expect(prompt).toContain("GitHub Discussion");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx bun test test/discussion-prompt.test.ts`
Expected: FAIL - module not found

**Step 3: Create the discussion prompt builder**

Create `src/create-prompt/discussion-prompt.ts`:

```typescript
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

<current_request>
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

  prompt += `
You are responding to the <current_request> above. This is a conversational GitHub Discussion - be helpful and engaging.

Use the mcp__github_discussion__reply_to_discussion tool to post your response.

Key points:
- This is an exploratory discussion, not a task to execute
- Feel free to ask clarifying questions
- Reference specific code or docs when helpful
- Keep responses focused and actionable
`;

  return prompt;
}
```

**Step 4: Run test to verify it passes**

Run: `npx bun test test/discussion-prompt.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
cd ~/ghq/github.com/zeroae/claude-code-action
git add src/create-prompt/discussion-prompt.ts test/discussion-prompt.test.ts
git commit -m "feat: add discussion prompt builder"
```

---

## Task 5: Integrate Session Resume into Prepare Step

**Files:**

- Create: `src/prepare/discussion-prepare.ts`
- Create: `test/discussion-prepare.test.ts`

**Step 1: Write the failing test**

Create `test/discussion-prepare.test.ts`:

```typescript
import { describe, it, expect } from "bun:test";
import {
  determineSessionResume,
  type SessionResumeResult,
} from "../src/prepare/discussion-prepare";

describe("Discussion Prepare", () => {
  it("returns resume with session_id when session exists", () => {
    const result = determineSessionResume({
      sessionId: "sess_abc123",
      summary: "Previous discussion about auth",
    });

    expect(result.shouldResume).toBe(true);
    expect(result.sessionId).toBe("sess_abc123");
    expect(result.fallbackContext).toBeUndefined();
  });

  it("returns fallback context when session_id is null", () => {
    const result = determineSessionResume({
      sessionId: null,
      summary: "Previous discussion about auth",
    });

    expect(result.shouldResume).toBe(false);
    expect(result.sessionId).toBeUndefined();
    expect(result.fallbackContext).toBe("Previous discussion about auth");
  });

  it("returns fresh start when no session data", () => {
    const result = determineSessionResume({
      sessionId: null,
      summary: null,
    });

    expect(result.shouldResume).toBe(false);
    expect(result.sessionId).toBeUndefined();
    expect(result.fallbackContext).toBeUndefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx bun test test/discussion-prepare.test.ts`
Expected: FAIL - module not found

**Step 3: Create the discussion prepare module**

Create `src/prepare/discussion-prepare.ts`:

```typescript
export type SessionResumeInput = {
  sessionId: string | null;
  summary: string | null;
};

export type SessionResumeResult = {
  shouldResume: boolean;
  sessionId?: string;
  fallbackContext?: string;
};

/**
 * Determines how to handle session resume for a discussion.
 *
 * Logic:
 * 1. If sessionId exists, try to resume that session
 * 2. If no sessionId but summary exists, use summary as context
 * 3. If nothing exists, start fresh
 */
export function determineSessionResume(
  input: SessionResumeInput,
): SessionResumeResult {
  if (input.sessionId) {
    return {
      shouldResume: true,
      sessionId: input.sessionId,
    };
  }

  if (input.summary) {
    return {
      shouldResume: false,
      fallbackContext: input.summary,
    };
  }

  return {
    shouldResume: false,
  };
}

/**
 * Builds Claude CLI arguments for session resume.
 */
export function buildResumeArgs(result: SessionResumeResult): string[] {
  const args: string[] = [];

  if (result.shouldResume && result.sessionId) {
    args.push("--resume", result.sessionId);
  }

  return args;
}
```

**Step 4: Run test to verify it passes**

Run: `npx bun test test/discussion-prepare.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
cd ~/ghq/github.com/zeroae/claude-code-action
git add src/prepare/discussion-prepare.ts test/discussion-prepare.test.ts
git commit -m "feat: add session resume logic for discussions"
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

Phase 2 adds:

1. Discussion data fetcher with reply chain walking
2. Session manager for reading/writing session files
3. Discussion trigger validation with category support
4. Discussion-specific prompt builder
5. Session resume logic for the prepare step

**Next Phase:** Phase 3 will add `/create-issue` and `/create-pr` graduation skills with draft-in-place workflow.
