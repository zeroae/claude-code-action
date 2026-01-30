import { describe, it, expect } from "bun:test";
import { checkDiscussionTrigger } from "../src/github/validation/trigger";

describe("Discussion Trigger Validation", () => {
  it("returns true for discussion in configured category", () => {
    const result = checkDiscussionTrigger(
      "Claude Q&A",
      ["Claude Q&A", "AI Chat"],
      "@claude",
      "Hello world",
    );
    expect(result).toBe(true);
  });

  it("returns false for discussion not in configured category without trigger", () => {
    const result = checkDiscussionTrigger(
      "General",
      ["Claude Q&A"],
      "@claude",
      "Hello world",
    );
    expect(result).toBe(false);
  });

  it("returns true for non-configured category with trigger phrase", () => {
    const result = checkDiscussionTrigger(
      "General",
      ["Claude Q&A"],
      "@claude",
      "Hey @claude, help me",
    );
    expect(result).toBe(true);
  });
});
