const GENERIC_TITLES = [
  "question",
  "help",
  "help needed",
  "discussion",
  "issue",
  "problem",
  "bug",
  "feature",
  "request",
  "untitled",
];

const MIN_SPECIFIC_TITLE_LENGTH = 20;

/**
 * Determines if a title is generic enough to warrant a suggestion.
 */
export function shouldSuggestTitle(currentTitle: string): boolean {
  const normalized = currentTitle.toLowerCase().trim();

  // Check against known generic titles
  if (GENERIC_TITLES.includes(normalized)) {
    return true;
  }

  // Very short titles are probably generic
  if (normalized.length < MIN_SPECIFIC_TITLE_LENGTH) {
    return true;
  }

  return false;
}

/**
 * Generates a title suggestion based on discussion content.
 * This is a simple heuristic - in practice, Claude would generate better titles.
 */
export function generateTitleSuggestion(
  discussionBody: string,
  conversationSummary?: string,
): string {
  // Use summary if available, otherwise use first sentence of body
  const source = conversationSummary ?? discussionBody;

  // Extract first meaningful sentence
  const sentences = source.split(/[.!?]+/).filter((s) => s.trim().length > 10);
  const firstSentence = sentences[0]?.trim() ?? source.substring(0, 80);

  // Clean up and truncate
  let title = firstSentence
    .replace(/^(i'm|i am|we're|we are|how do i|how to)\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();

  if (title.length > 80) {
    title = title.substring(0, 77) + "...";
  }

  // Capitalize first letter
  return title.charAt(0).toUpperCase() + title.slice(1);
}

/**
 * Formats a title suggestion as a friendly message.
 */
export function formatTitleSuggestion(suggestedTitle: string): string {
  return `💡 **Suggested title:** ${suggestedTitle}

_Reply with "update title" to apply this suggestion._`;
}
