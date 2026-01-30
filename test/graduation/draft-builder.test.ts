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
    conversationSummary: "Decided on JWT with RS256, 15min expiry, refresh tokens",
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

  it("uses default branch as base for PR", () => {
    const draft = buildPRDraftFromContext(mockContext, {
      title: "Test PR",
    });
    expect(draft.baseBranch).toBe("main");
  });
});
