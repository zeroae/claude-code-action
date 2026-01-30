import { describe, it, expect } from "bun:test";
import {
  shouldSuggestTitle,
  generateTitleSuggestion,
  formatTitleSuggestion,
} from "../../src/discussions/title-suggestion";

describe("Title Suggestion", () => {
  it("suggests title for generic titles", () => {
    expect(shouldSuggestTitle("Question")).toBe(true);
    expect(shouldSuggestTitle("Help needed")).toBe(true);
    expect(shouldSuggestTitle("Discussion")).toBe(true);
  });

  it("does not suggest for specific titles", () => {
    expect(shouldSuggestTitle("How to implement JWT authentication?")).toBe(false);
    expect(shouldSuggestTitle("Best practices for error handling in React")).toBe(false);
  });

  it("generates title from discussion content", () => {
    const title = generateTitleSuggestion(
      "I'm trying to implement authentication in my app. Should I use JWT or session-based auth?",
      "Decided to use JWT with RS256 algorithm and 15-minute expiry."
    );
    expect(title).toBeTruthy();
    expect(title.length).toBeLessThan(100);
  });

  it("formats title suggestion as markdown", () => {
    const formatted = formatTitleSuggestion("JWT Authentication Implementation");
    expect(formatted).toContain("💡");
    expect(formatted).toContain("JWT Authentication Implementation");
  });

  it("handles empty summary gracefully", () => {
    const title = generateTitleSuggestion(
      "How do I configure webpack for production builds?",
      undefined
    );
    expect(title).toBeTruthy();
  });
});
