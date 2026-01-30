import { describe, it, expect } from "bun:test";
import { DISCUSSION_QUERY } from "../src/github/api/queries/github";

describe("Discussion Query", () => {
  it("exports DISCUSSION_QUERY", () => {
    expect(DISCUSSION_QUERY).toBeDefined();
    expect(typeof DISCUSSION_QUERY).toBe("string");
  });

  it("queries discussion fields", () => {
    expect(DISCUSSION_QUERY).toContain("discussion(number: $number)");
    expect(DISCUSSION_QUERY).toContain("title");
    expect(DISCUSSION_QUERY).toContain("body");
    expect(DISCUSSION_QUERY).toContain("category");
  });

  it("queries discussion comments", () => {
    expect(DISCUSSION_QUERY).toContain("comments");
    expect(DISCUSSION_QUERY).toContain("replies");
  });
});
