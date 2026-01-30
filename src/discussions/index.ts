// Smart quoting
export {
  shouldQuoteMessage,
  formatQuotedMessage,
  type QuoteContext,
} from "./smart-quote";

// Title suggestions
export {
  shouldSuggestTitle,
  generateTitleSuggestion,
  formatTitleSuggestion,
} from "./title-suggestion";

// Capability resolution
export {
  resolveCapabilities,
  canCommit,
  canEditFiles,
  canWebSearch,
  type ResolvedCapabilities,
  type CapabilityContext,
} from "./capability-resolver";

// Search sanitization
export {
  sanitizeSearchQuery,
  containsCredentialPatterns,
} from "./search-sanitizer";
