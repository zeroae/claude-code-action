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

  it("includes repository information", () => {
    const prompt = buildDiscussionPrompt(mockContext);
    expect(prompt).toContain("owner/repo");
  });

  it("includes discussion category", () => {
    const prompt = buildDiscussionPrompt(mockContext);
    expect(prompt).toContain("Claude Q&A");
  });

  it("includes discussion number", () => {
    const prompt = buildDiscussionPrompt(mockContext);
    expect(prompt).toContain("#42");
  });

  it("includes trigger comment as current request", () => {
    const prompt = buildDiscussionPrompt(mockContext);
    expect(prompt).toContain("<current_request>");
    expect(prompt).toContain("What about JWT?");
  });

  it("instructs to use reply_to_discussion tool", () => {
    const prompt = buildDiscussionPrompt(mockContext);
    expect(prompt).toContain("mcp__github_discussion__reply_to_discussion");
  });

  it("omits session summary when not provided", () => {
    const contextWithoutSummary: DiscussionPromptContext = {
      ...mockContext,
      sessionSummary: undefined,
    };
    const prompt = buildDiscussionPrompt(contextWithoutSummary);
    expect(prompt).not.toContain("<session_context>");
    expect(prompt).not.toContain("Previous session summary");
  });

  it("formats conversation history in chronological order", () => {
    const prompt = buildDiscussionPrompt(mockContext);
    // The reply chain is newest-first, but should be formatted oldest-first
    const helpIndex = prompt.indexOf("I need help with auth");
    const approachesIndex = prompt.indexOf("Here are 3 approaches...");
    const jwtIndex = prompt.indexOf("What about JWT?");

    // Oldest should appear first in the conversation thread
    expect(helpIndex).toBeLessThan(approachesIndex);
    expect(approachesIndex).toBeLessThan(jwtIndex);
  });

  it("includes author attribution in conversation history", () => {
    const prompt = buildDiscussionPrompt(mockContext);
    expect(prompt).toContain("user1");
    expect(prompt).toContain("claude[bot]");
  });
});
