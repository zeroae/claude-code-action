import { describe, it, expect } from "bun:test";
import {
  getGraduationTools,
  CREATE_ISSUE_DRAFT_TOOL,
  CREATE_PR_DRAFT_TOOL,
  FINALIZE_ISSUE_TOOL,
  FINALIZE_PR_TOOL,
  UPDATE_DRAFT_TOOL,
} from "../src/mcp/github-graduation-server";

describe("GitHub Graduation Server", () => {
  it("exports graduation tools", () => {
    const tools = getGraduationTools();
    expect(tools.length).toBeGreaterThanOrEqual(4);
  });

  it("has create_issue_draft tool", () => {
    expect(CREATE_ISSUE_DRAFT_TOOL.name).toBe("create_issue_draft");
    expect(CREATE_ISSUE_DRAFT_TOOL.input_schema.properties).toHaveProperty(
      "discussion_number",
    );
    expect(CREATE_ISSUE_DRAFT_TOOL.input_schema.properties).toHaveProperty("title");
  });

  it("has create_pr_draft tool", () => {
    expect(CREATE_PR_DRAFT_TOOL.name).toBe("create_pr_draft");
    expect(CREATE_PR_DRAFT_TOOL.input_schema.properties).toHaveProperty(
      "head_branch",
    );
  });

  it("has finalize_issue tool", () => {
    expect(FINALIZE_ISSUE_TOOL.name).toBe("finalize_issue");
    expect(FINALIZE_ISSUE_TOOL.input_schema.properties).toHaveProperty(
      "draft_comment_id",
    );
  });

  it("has finalize_pr tool", () => {
    expect(FINALIZE_PR_TOOL.name).toBe("finalize_pr");
    expect(FINALIZE_PR_TOOL.input_schema.properties).toHaveProperty(
      "draft_comment_id",
    );
  });

  it("has update_draft tool", () => {
    expect(UPDATE_DRAFT_TOOL.name).toBe("update_draft");
    expect(UPDATE_DRAFT_TOOL.input_schema.properties).toHaveProperty(
      "updated_content",
    );
  });
});
