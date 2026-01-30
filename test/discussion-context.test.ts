import { describe, it, expect, beforeEach, mock } from "bun:test";

// Mock @actions/github before importing context
mock.module("@actions/github", () => ({
  context: {
    eventName: "discussion",
    payload: {
      action: "created",
      discussion: {
        number: 42,
        node_id: "D_kwDOABC123",
        title: "Test Discussion",
        body: "Discussion body",
        category: {
          name: "Claude Q&A",
          slug: "claude-q-a",
        },
        user: {
          login: "testuser",
        },
      },
      repository: {
        name: "test-repo",
        owner: {
          login: "test-owner",
        },
      },
    },
    repo: {
      owner: "test-owner",
      repo: "test-repo",
    },
    actor: "testuser",
  },
}));

import {
  parseGitHubContext,
  isDiscussionEvent,
  isDiscussionCommentEvent,
} from "../src/github/context";

describe("Discussion Context", () => {
  beforeEach(() => {
    process.env.GITHUB_RUN_ID = "12345";
  });

  it("parses discussion event correctly", () => {
    const context = parseGitHubContext();
    expect(context.eventName).toBe("discussion");
    // Use type guard to access entity-specific properties
    if (isDiscussionEvent(context)) {
      expect(context.entityNumber).toBe(42);
      expect(context.isPR).toBe(false);
      expect(context.isDiscussion).toBe(true);
      expect(context.discussionNodeId).toBe("D_kwDOABC123");
      expect(context.discussionCategory).toBe("Claude Q&A");
    } else {
      throw new Error("Expected discussion event");
    }
  });

  it("isDiscussionEvent returns true for discussion events", () => {
    const context = parseGitHubContext();
    expect(isDiscussionEvent(context)).toBe(true);
  });

  it("isDiscussionCommentEvent returns false for discussion events", () => {
    const context = parseGitHubContext();
    expect(isDiscussionCommentEvent(context)).toBe(false);
  });
});
