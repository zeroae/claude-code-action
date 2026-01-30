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
    expect(params.body).toContain("discussion #42");
  });

  it("builds create PR params from draft", () => {
    const params = buildCreatePRParams(
      "owner",
      "repo",
      {
        type: "pr",
        title: "Add JWT",
        body: "Implements JWT",
        labels: [],
        baseBranch: "main",
        headBranch: "feature/jwt",
      },
    );

    expect(params.base).toBe("main");
    expect(params.head).toBe("feature/jwt");
    expect(params.title).toBe("Add JWT");
  });

  it("formats created issue comment", () => {
    const comment = formatCreatedIssueComment(123, "Implement JWT", 42);
    expect(comment).toContain("✅");
    expect(comment).toContain("Issue #123");
    expect(comment).toContain("discussion #42");
  });

  it("formats created PR comment", () => {
    const comment = formatCreatedPRComment(456, "Add JWT", 42);
    expect(comment).toContain("✅");
    expect(comment).toContain("Pull Request #456");
  });

  it("handles missing assignees", () => {
    const params = buildCreateIssueParams(
      "owner",
      "repo",
      {
        type: "issue",
        title: "Test",
        body: "Body",
        labels: [],
      },
      1,
    );

    expect(params.assignees).toEqual([]);
  });
});
