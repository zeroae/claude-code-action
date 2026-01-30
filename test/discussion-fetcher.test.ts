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
    expect(chain[0]?.id).toBe("DC_003");
    expect(chain[1]?.id).toBe("DC_002");
    expect(chain[2]?.id).toBe("DC_001");
  });

  it("finds last Claude comment in chain", () => {
    const chain = findReplyChain("DC_003", mockComments);
    const claudeComment = findLastClaudeComment(chain, "claude[bot]");
    expect(claudeComment?.id).toBe("DC_002");
  });

  it("returns null when no Claude comment in chain", () => {
    const chain = [mockComments[0]!]; // Just user comment
    const claudeComment = findLastClaudeComment(chain, "claude[bot]");
    expect(claudeComment).toBeNull();
  });
});
