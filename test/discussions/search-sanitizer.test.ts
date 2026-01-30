import { describe, it, expect } from "bun:test";
import {
  sanitizeSearchQuery,
  containsCredentialPatterns,
} from "../../src/discussions/search-sanitizer";

describe("Search Sanitizer", () => {
  it("removes API keys from queries", () => {
    const query = "how to use sk-1234567890abcdef1234 in my app";
    const sanitized = sanitizeSearchQuery(query);
    expect(sanitized).not.toContain("sk-1234567890abcdef1234");
    expect(sanitized).toContain("how to use");
  });

  it("removes Bearer tokens", () => {
    const query =
      "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abc authentication";
    const sanitized = sanitizeSearchQuery(query);
    expect(sanitized).not.toContain("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9");
  });

  it("removes GitHub tokens", () => {
    const query = "ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx usage";
    const sanitized = sanitizeSearchQuery(query);
    expect(sanitized).not.toContain("ghp_");
  });

  it("detects credential patterns", () => {
    expect(containsCredentialPatterns("normal search query")).toBe(false);
    expect(containsCredentialPatterns("sk-1234567890abcdef1234")).toBe(true);
    expect(
      containsCredentialPatterns("ghp_abcdef1234567890abcdef1234567890abcd"),
    ).toBe(true);
    expect(containsCredentialPatterns("password=secret123")).toBe(true);
  });

  it("preserves safe queries", () => {
    const query = "how to implement JWT authentication in Node.js";
    const sanitized = sanitizeSearchQuery(query);
    expect(sanitized).toBe(query);
  });

  it("handles AWS keys", () => {
    const query = "configure AKIAIOSFODNN7EXAMPLE for S3";
    const sanitized = sanitizeSearchQuery(query);
    expect(sanitized).not.toContain("AKIAIOSFODNN7EXAMPLE");
  });
});
