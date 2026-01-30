# Phase 4: Polish Features Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add polish features to complete the discussions-as-sessions implementation: smart quoting, title suggestions, per-category capabilities, and commit gating.

**Architecture:** Add utility functions for smart quoting and title generation. Integrate category capabilities into the prepare step. Add commit gating based on labels and category config.

**Tech Stack:** TypeScript, Bun, GitHub GraphQL API

---

## Task 1: Add Smart Quoting Logic

**Files:**

- Create: `src/discussions/smart-quote.ts`
- Create: `test/discussions/smart-quote.test.ts`

**Step 1: Write the failing test**

Create `test/discussions/smart-quote.test.ts`:

```typescript
import { describe, it, expect } from "bun:test";
import {
  shouldQuoteMessage,
  formatQuotedMessage,
  type QuoteContext,
} from "../../src/discussions/smart-quote";

describe("Smart Quoting", () => {
  it("returns false for short threads (<=5 messages)", () => {
    const context: QuoteContext = {
      threadLength: 3,
      triggerMessageLength: 100,
      timeSinceLastMessage: 60000, // 1 minute
    };
    expect(shouldQuoteMessage(context)).toBe(false);
  });

  it("returns true for long threads (>5 messages)", () => {
    const context: QuoteContext = {
      threadLength: 7,
      triggerMessageLength: 100,
      timeSinceLastMessage: 60000,
    };
    expect(shouldQuoteMessage(context)).toBe(true);
  });

  it("returns true for short messages in any thread", () => {
    const context: QuoteContext = {
      threadLength: 2,
      triggerMessageLength: 20, // Very short, might be ambiguous
      timeSinceLastMessage: 60000,
    };
    expect(shouldQuoteMessage(context)).toBe(true);
  });

  it("returns true for messages after long gaps", () => {
    const context: QuoteContext = {
      threadLength: 3,
      triggerMessageLength: 100,
      timeSinceLastMessage: 3600000 * 24, // 24 hours
    };
    expect(shouldQuoteMessage(context)).toBe(true);
  });

  it("formats quoted message correctly", () => {
    const quoted = formatQuotedMessage("What about JWT?", "user1");
    expect(quoted).toContain("> What about JWT?");
    expect(quoted).toContain("@user1");
  });

  it("truncates long messages when quoting", () => {
    const longMessage = "A".repeat(500);
    const quoted = formatQuotedMessage(longMessage, "user1");
    expect(quoted.length).toBeLessThan(400);
    expect(quoted).toContain("...");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx bun test test/discussions/smart-quote.test.ts`
Expected: FAIL - module not found

**Step 3: Create the smart quote module**

Create `src/discussions/smart-quote.ts`:

```typescript
export type QuoteContext = {
  threadLength: number;
  triggerMessageLength: number;
  timeSinceLastMessage: number; // milliseconds
};

const LONG_THREAD_THRESHOLD = 5;
const SHORT_MESSAGE_THRESHOLD = 50;
const LONG_GAP_THRESHOLD = 3600000; // 1 hour in ms
const MAX_QUOTE_LENGTH = 200;

/**
 * Determines if Claude should quote the triggering message in the response.
 *
 * Quoting is helpful when:
 * - Thread is long (>5 messages) - context might be lost
 * - Trigger message is very short - might be ambiguous
 * - Long time gap since last message - reader might need reminder
 */
export function shouldQuoteMessage(context: QuoteContext): boolean {
  // Long threads benefit from quoting
  if (context.threadLength > LONG_THREAD_THRESHOLD) {
    return true;
  }

  // Short/ambiguous messages should be quoted
  if (context.triggerMessageLength < SHORT_MESSAGE_THRESHOLD) {
    return true;
  }

  // Long time gaps suggest quoting for context
  if (context.timeSinceLastMessage > LONG_GAP_THRESHOLD) {
    return true;
  }

  return false;
}

/**
 * Formats a message as a blockquote with attribution.
 */
export function formatQuotedMessage(message: string, author: string): string {
  let truncated = message;

  if (message.length > MAX_QUOTE_LENGTH) {
    truncated = message.substring(0, MAX_QUOTE_LENGTH - 3) + "...";
  }

  // Convert to blockquote format
  const quoted = truncated
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n");

  return `@${author} wrote:\n${quoted}`;
}
```

**Step 4: Run test to verify it passes**

Run: `npx bun test test/discussions/smart-quote.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
cd ~/ghq/github.com/zeroae/claude-code-action
git add src/discussions/smart-quote.ts test/discussions/smart-quote.test.ts
git commit -m "feat: add smart quoting logic for discussions"
```

---

## Task 2: Add Title Suggestion Logic

**Files:**

- Create: `src/discussions/title-suggestion.ts`
- Create: `test/discussions/title-suggestion.test.ts`

**Step 1: Write the failing test**

Create `test/discussions/title-suggestion.test.ts`:

```typescript
import { describe, it, expect } from "bun:test";
import {
  shouldSuggestTitle,
  generateTitleSuggestion,
  formatTitleSuggestion,
} from "../../src/discussions/title-suggestion";

describe("Title Suggestion", () => {
  it("suggests title for generic titles", () => {
    expect(shouldSuggestTitle("Question")).toBe(true);
    expect(shouldSuggestTitle("Help needed")).toBe(true);
    expect(shouldSuggestTitle("Discussion")).toBe(true);
  });

  it("does not suggest for specific titles", () => {
    expect(shouldSuggestTitle("How to implement JWT authentication?")).toBe(
      false,
    );
    expect(
      shouldSuggestTitle("Best practices for error handling in React"),
    ).toBe(false);
  });

  it("generates title from discussion content", () => {
    const title = generateTitleSuggestion(
      "I'm trying to implement authentication in my app. Should I use JWT or session-based auth?",
      "Decided to use JWT with RS256 algorithm and 15-minute expiry.",
    );
    expect(title).toBeTruthy();
    expect(title.length).toBeLessThan(100);
  });

  it("formats title suggestion as markdown", () => {
    const formatted = formatTitleSuggestion(
      "JWT Authentication Implementation",
    );
    expect(formatted).toContain("💡");
    expect(formatted).toContain("JWT Authentication Implementation");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx bun test test/discussions/title-suggestion.test.ts`
Expected: FAIL - module not found

**Step 3: Create the title suggestion module**

Create `src/discussions/title-suggestion.ts`:

```typescript
const GENERIC_TITLES = [
  "question",
  "help",
  "help needed",
  "discussion",
  "issue",
  "problem",
  "bug",
  "feature",
  "request",
  "untitled",
];

const MIN_SPECIFIC_TITLE_LENGTH = 20;

/**
 * Determines if a title is generic enough to warrant a suggestion.
 */
export function shouldSuggestTitle(currentTitle: string): boolean {
  const normalized = currentTitle.toLowerCase().trim();

  // Check against known generic titles
  if (GENERIC_TITLES.includes(normalized)) {
    return true;
  }

  // Very short titles are probably generic
  if (normalized.length < MIN_SPECIFIC_TITLE_LENGTH) {
    return true;
  }

  return false;
}

/**
 * Generates a title suggestion based on discussion content.
 * This is a simple heuristic - in practice, Claude would generate better titles.
 */
export function generateTitleSuggestion(
  discussionBody: string,
  conversationSummary?: string,
): string {
  // Use summary if available, otherwise use first sentence of body
  const source = conversationSummary ?? discussionBody;

  // Extract first meaningful sentence
  const sentences = source.split(/[.!?]+/).filter((s) => s.trim().length > 10);
  const firstSentence = sentences[0]?.trim() ?? source.substring(0, 80);

  // Clean up and truncate
  let title = firstSentence
    .replace(/^(i'm|i am|we're|we are|how do i|how to)\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();

  if (title.length > 80) {
    title = title.substring(0, 77) + "...";
  }

  // Capitalize first letter
  return title.charAt(0).toUpperCase() + title.slice(1);
}

/**
 * Formats a title suggestion as a friendly message.
 */
export function formatTitleSuggestion(suggestedTitle: string): string {
  return `💡 **Suggested title:** ${suggestedTitle}

_Reply with "update title" to apply this suggestion._`;
}
```

**Step 4: Run test to verify it passes**

Run: `npx bun test test/discussions/title-suggestion.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
cd ~/ghq/github.com/zeroae/claude-code-action
git add src/discussions/title-suggestion.ts test/discussions/title-suggestion.test.ts
git commit -m "feat: add title suggestion logic for discussions"
```

---

## Task 3: Add Capability Resolver

**Files:**

- Create: `src/discussions/capability-resolver.ts`
- Create: `test/discussions/capability-resolver.test.ts`

**Step 1: Write the failing test**

Create `test/discussions/capability-resolver.test.ts`:

```typescript
import { describe, it, expect } from "bun:test";
import {
  resolveCapabilities,
  canCommit,
  canEditFiles,
  canWebSearch,
  type ResolvedCapabilities,
  type CapabilityContext,
} from "../../src/discussions/capability-resolver";

describe("Capability Resolver", () => {
  const defaultConfig = {
    categories: [
      {
        name: "Claude Q&A",
        capabilities: {
          web_search: true,
          edit_files: false,
          can_commit: false,
        },
      },
      {
        name: "AI Prototyping",
        capabilities: {
          web_search: true,
          edit_files: true,
          can_commit: false,
        },
      },
      {
        name: "Claude Dev",
        capabilities: {
          web_search: true,
          edit_files: true,
          can_commit: true,
        },
      },
    ],
    session_branch: "claude-sessions",
  };

  it("resolves capabilities from category config", () => {
    const context: CapabilityContext = {
      categoryName: "Claude Q&A",
      config: defaultConfig,
      labels: [],
    };

    const caps = resolveCapabilities(context);
    expect(caps.webSearch).toBe(true);
    expect(caps.editFiles).toBe(false);
    expect(caps.canCommit).toBe(false);
  });

  it("allows commit with claude-can-commit label", () => {
    const context: CapabilityContext = {
      categoryName: "Claude Q&A",
      config: defaultConfig,
      labels: ["claude-can-commit"],
    };

    const caps = resolveCapabilities(context);
    expect(caps.canCommit).toBe(true);
  });

  it("uses default restrictive caps for unknown category", () => {
    const context: CapabilityContext = {
      categoryName: "Unknown Category",
      config: defaultConfig,
      labels: [],
    };

    const caps = resolveCapabilities(context);
    expect(caps.webSearch).toBe(false);
    expect(caps.editFiles).toBe(false);
    expect(caps.canCommit).toBe(false);
  });

  it("provides helper functions", () => {
    const caps: ResolvedCapabilities = {
      webSearch: true,
      editFiles: true,
      canCommit: false,
    };

    expect(canWebSearch(caps)).toBe(true);
    expect(canEditFiles(caps)).toBe(true);
    expect(canCommit(caps)).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx bun test test/discussions/capability-resolver.test.ts`
Expected: FAIL - module not found

**Step 3: Create the capability resolver**

Create `src/discussions/capability-resolver.ts`:

```typescript
import type { DiscussionConfig } from "../config/discussion-config";

export type ResolvedCapabilities = {
  webSearch: boolean;
  editFiles: boolean;
  canCommit: boolean;
};

export type CapabilityContext = {
  categoryName: string;
  config: DiscussionConfig;
  labels: string[];
};

const COMMIT_OVERRIDE_LABEL = "claude-can-commit";

const DEFAULT_CAPABILITIES: ResolvedCapabilities = {
  webSearch: false,
  editFiles: false,
  canCommit: false,
};

/**
 * Resolves the effective capabilities for a discussion based on:
 * 1. Category configuration
 * 2. Label overrides
 */
export function resolveCapabilities(
  context: CapabilityContext,
): ResolvedCapabilities {
  const { categoryName, config, labels } = context;

  // Find category config
  const categoryConfig = config.categories.find((c) => c.name === categoryName);

  if (!categoryConfig) {
    // Unknown category - use restrictive defaults
    return { ...DEFAULT_CAPABILITIES };
  }

  const caps = categoryConfig.capabilities;

  // Start with category capabilities
  const resolved: ResolvedCapabilities = {
    webSearch: caps.web_search ?? false,
    editFiles: caps.edit_files ?? false,
    canCommit: caps.can_commit ?? false,
  };

  // Check for label overrides
  if (labels.includes(COMMIT_OVERRIDE_LABEL)) {
    resolved.canCommit = true;
  }

  return resolved;
}

/**
 * Helper to check if web search is allowed.
 */
export function canWebSearch(caps: ResolvedCapabilities): boolean {
  return caps.webSearch;
}

/**
 * Helper to check if file editing is allowed.
 */
export function canEditFiles(caps: ResolvedCapabilities): boolean {
  return caps.editFiles;
}

/**
 * Helper to check if commits are allowed.
 */
export function canCommit(caps: ResolvedCapabilities): boolean {
  return caps.canCommit;
}
```

**Step 4: Run test to verify it passes**

Run: `npx bun test test/discussions/capability-resolver.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
cd ~/ghq/github.com/zeroae/claude-code-action
git add src/discussions/capability-resolver.ts test/discussions/capability-resolver.test.ts
git commit -m "feat: add capability resolver for per-category permissions"
```

---

## Task 4: Add Credential Sanitizer for Web Search

**Files:**

- Create: `src/discussions/search-sanitizer.ts`
- Create: `test/discussions/search-sanitizer.test.ts`

**Step 1: Write the failing test**

Create `test/discussions/search-sanitizer.test.ts`:

```typescript
import { describe, it, expect } from "bun:test";
import {
  sanitizeSearchQuery,
  containsCredentialPatterns,
} from "../../src/discussions/search-sanitizer";

describe("Search Sanitizer", () => {
  it("removes API keys from queries", () => {
    const query = "how to use sk-1234567890abcdef in my app";
    const sanitized = sanitizeSearchQuery(query);
    expect(sanitized).not.toContain("sk-1234567890abcdef");
    expect(sanitized).toContain("how to use");
  });

  it("removes Bearer tokens", () => {
    const query = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9 authentication";
    const sanitized = sanitizeSearchQuery(query);
    expect(sanitized).not.toContain("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9");
  });

  it("removes GitHub tokens", () => {
    const query = "ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx usage";
    const sanitized = sanitizeSearchQuery(query);
    expect(sanitized).not.toContain("ghp_");
  });

  it("detects credential patterns", () => {
    expect(containsCredentialPatterns("normal search query")).toBe(false);
    expect(containsCredentialPatterns("sk-1234567890")).toBe(true);
    expect(containsCredentialPatterns("ghp_abcdef123456")).toBe(true);
    expect(containsCredentialPatterns("password=secret123")).toBe(true);
  });

  it("preserves safe queries", () => {
    const query = "how to implement JWT authentication in Node.js";
    const sanitized = sanitizeSearchQuery(query);
    expect(sanitized).toBe(query);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx bun test test/discussions/search-sanitizer.test.ts`
Expected: FAIL - module not found

**Step 3: Create the search sanitizer**

Create `src/discussions/search-sanitizer.ts`:

```typescript
// Patterns that might indicate credentials
const CREDENTIAL_PATTERNS = [
  // OpenAI/Anthropic API keys
  /sk-[a-zA-Z0-9]{20,}/gi,
  // GitHub tokens
  /gh[pousr]_[a-zA-Z0-9]{36,}/gi,
  // Generic API keys
  /api[_-]?key[=:]\s*[a-zA-Z0-9]{16,}/gi,
  // Bearer tokens
  /Bearer\s+[a-zA-Z0-9._-]{20,}/gi,
  // JWT tokens (simplified)
  /eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/gi,
  // Password patterns
  /password[=:]\s*\S+/gi,
  // Secret patterns
  /secret[=:]\s*\S+/gi,
  // AWS keys
  /AKIA[0-9A-Z]{16}/gi,
  // Generic long hex/base64 strings that might be tokens
  /[a-f0-9]{32,}/gi,
];

/**
 * Checks if a string contains patterns that look like credentials.
 */
export function containsCredentialPatterns(text: string): boolean {
  return CREDENTIAL_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * Sanitizes a search query by removing potential credential patterns.
 */
export function sanitizeSearchQuery(query: string): string {
  let sanitized = query;

  for (const pattern of CREDENTIAL_PATTERNS) {
    // Reset lastIndex for global patterns
    pattern.lastIndex = 0;
    sanitized = sanitized.replace(pattern, "[REDACTED]");
  }

  // Clean up multiple [REDACTED] and extra spaces
  sanitized = sanitized
    .replace(/\[REDACTED\]\s*\[REDACTED\]/g, "[REDACTED]")
    .replace(/\s+/g, " ")
    .trim();

  // If the query is mostly redacted, return empty
  if (sanitized === "[REDACTED]" || sanitized.length < 5) {
    return "";
  }

  // Remove [REDACTED] markers from final output
  sanitized = sanitized.replace(/\[REDACTED\]\s*/g, "").trim();

  return sanitized;
}
```

**Step 4: Run test to verify it passes**

Run: `npx bun test test/discussions/search-sanitizer.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
cd ~/ghq/github.com/zeroae/claude-code-action
git add src/discussions/search-sanitizer.ts test/discussions/search-sanitizer.test.ts
git commit -m "feat: add credential sanitizer for web search queries"
```

---

## Task 5: Add Discussion Index Module (barrel export)

**Files:**

- Create: `src/discussions/index.ts`

**Step 1: Create the index file**

Create `src/discussions/index.ts`:

```typescript
// Smart quoting
export {
  shouldQuoteMessage,
  formatQuotedMessage,
  type QuoteContext,
} from "./smart-quote";

// Title suggestions
export {
  shouldSuggestTitle,
  generateTitleSuggestion,
  formatTitleSuggestion,
} from "./title-suggestion";

// Capability resolution
export {
  resolveCapabilities,
  canCommit,
  canEditFiles,
  canWebSearch,
  type ResolvedCapabilities,
  type CapabilityContext,
} from "./capability-resolver";

// Search sanitization
export {
  sanitizeSearchQuery,
  containsCredentialPatterns,
} from "./search-sanitizer";
```

**Step 2: Commit**

```bash
cd ~/ghq/github.com/zeroae/claude-code-action
git add src/discussions/index.ts
git commit -m "feat: add discussions module barrel export"
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

Phase 4 adds:

1. Smart quoting logic - quotes messages when context might be lost
2. Title suggestion - suggests better titles for generic discussion titles
3. Capability resolver - resolves per-category permissions with label overrides
4. Search sanitizer - removes credentials from web search queries
5. Discussions module barrel export

**Implementation Complete:** All four phases are now done. The discussions-as-sessions feature includes:

- Phase 1: Basic discussion support with category-based triggers
- Phase 2: Branching & session management with reply chain walking
- Phase 3: Graduation skills to create Issues/PRs from discussions
- Phase 4: Polish features for a complete user experience
