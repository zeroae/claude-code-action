import type { DiscussionConfig } from "../config/discussion-config";

export type ResolvedCapabilities = {
  webSearch: boolean;
  editFiles: boolean;
  canCommit: boolean;
};

export type CapabilityContext = {
  categoryName: string;
  config: DiscussionConfig;
  labels: string[];
};

const COMMIT_OVERRIDE_LABEL = "claude-can-commit";

const DEFAULT_CAPABILITIES: ResolvedCapabilities = {
  webSearch: false,
  editFiles: false,
  canCommit: false,
};

/**
 * Resolves the effective capabilities for a discussion based on:
 * 1. Category configuration
 * 2. Label overrides
 */
export function resolveCapabilities(
  context: CapabilityContext,
): ResolvedCapabilities {
  const { categoryName, config, labels } = context;

  // Find category config
  const categoryConfig = config.categories.find(
    (c) => c.name === categoryName,
  );

  if (!categoryConfig) {
    // Unknown category - use restrictive defaults
    return { ...DEFAULT_CAPABILITIES };
  }

  const caps = categoryConfig.capabilities;

  // Start with category capabilities
  const resolved: ResolvedCapabilities = {
    webSearch: caps.web_search ?? false,
    editFiles: caps.edit_files ?? false,
    canCommit: caps.can_commit ?? false,
  };

  // Check for label overrides
  if (labels.includes(COMMIT_OVERRIDE_LABEL)) {
    resolved.canCommit = true;
  }

  return resolved;
}

/**
 * Helper to check if web search is allowed.
 */
export function canWebSearch(caps: ResolvedCapabilities): boolean {
  return caps.webSearch;
}

/**
 * Helper to check if file editing is allowed.
 */
export function canEditFiles(caps: ResolvedCapabilities): boolean {
  return caps.editFiles;
}

/**
 * Helper to check if commits are allowed.
 */
export function canCommit(caps: ResolvedCapabilities): boolean {
  return caps.canCommit;
}
