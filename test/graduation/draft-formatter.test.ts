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

  it("returns null for non-draft comment", () => {
    const comment = "Just a regular comment";
    const draft = parseDraftFromComment(comment);
    expect(draft).toBeNull();
  });
});
