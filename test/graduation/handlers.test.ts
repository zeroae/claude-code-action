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

  it("parses draft for finalization", () => {
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

  it("returns null for non-draft comment", () => {
    const result = handleFinalizeDraft("Regular comment");
    expect(result).toBeNull();
  });
});
