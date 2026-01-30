import { describe, it, expect } from "bun:test";
import {
  parseDiscussionConfig,
  isClaudeCategory,
  getCategoryCapabilities,
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
    expect(config.categories[0]?.name).toBe("Claude Q&A");
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
