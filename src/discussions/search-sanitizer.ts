// Patterns that might indicate credentials
const CREDENTIAL_PATTERNS = [
  // OpenAI/Anthropic API keys
  /sk-[a-zA-Z0-9]{20,}/gi,
  // GitHub tokens
  /gh[pousr]_[a-zA-Z0-9]{36,}/gi,
  // Generic API keys
  /api[_-]?key[=:]\s*[a-zA-Z0-9]{16,}/gi,
  // Bearer tokens
  /Bearer\s+[a-zA-Z0-9._-]{20,}/gi,
  // JWT tokens (simplified)
  /eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/gi,
  // Password patterns
  /password[=:]\s*\S+/gi,
  // Secret patterns
  /secret[=:]\s*\S+/gi,
  // AWS keys
  /AKIA[0-9A-Z]{16}/gi,
];

/**
 * Checks if a string contains patterns that look like credentials.
 */
export function containsCredentialPatterns(text: string): boolean {
  for (const pattern of CREDENTIAL_PATTERNS) {
    // Reset lastIndex for global patterns
    pattern.lastIndex = 0;
    if (pattern.test(text)) {
      return true;
    }
  }
  return false;
}

/**
 * Sanitizes a search query by removing potential credential patterns.
 */
export function sanitizeSearchQuery(query: string): string {
  let sanitized = query;

  for (const pattern of CREDENTIAL_PATTERNS) {
    // Reset lastIndex for global patterns
    pattern.lastIndex = 0;
    sanitized = sanitized.replace(pattern, "[REDACTED]");
  }

  // Clean up multiple [REDACTED] and extra spaces
  sanitized = sanitized
    .replace(/\[REDACTED\]\s*\[REDACTED\]/g, "[REDACTED]")
    .replace(/\s+/g, " ")
    .trim();

  // If the query is mostly redacted, return empty
  if (sanitized === "[REDACTED]" || sanitized.length < 5) {
    return "";
  }

  // Remove [REDACTED] markers from final output
  sanitized = sanitized.replace(/\[REDACTED\]\s*/g, "").trim();

  return sanitized;
}
