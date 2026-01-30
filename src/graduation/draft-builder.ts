import type { IssueDraft, PRDraft } from "./types";

export type DraftContext = {
  discussionNumber: number;
  discussionTitle: string;
  discussionBody: string;
  conversationSummary: string;
  repository: string;
  defaultBranch: string;
};

export type IssueDraftOptions = {
  title?: string;
  body?: string;
  labels?: string[];
  assignees?: string[];
};

export type PRDraftOptions = {
  title?: string;
  body?: string;
  baseBranch?: string;
  headBranch?: string;
  labels?: string[];
};

/**
 * Generates a slug from a title for use in branch names.
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 50);
}

/**
 * Builds an issue draft from discussion context.
 */
export function buildIssueDraftFromContext(
  context: DraftContext,
  options: IssueDraftOptions,
): IssueDraft {
  const title = options.title ?? context.discussionTitle;

  const body =
    options.body ??
    `## Context

Based on discussion #${context.discussionNumber}: "${context.discussionTitle}"

## Summary

${context.conversationSummary}

## Original Discussion

${context.discussionBody}`;

  return {
    title,
    body,
    labels: options.labels ?? [],
    assignees: options.assignees ?? [],
    discussionNumber: context.discussionNumber,
  };
}

/**
 * Builds a PR draft from discussion context.
 */
export function buildPRDraftFromContext(
  context: DraftContext,
  options: PRDraftOptions,
): PRDraft {
  const title = options.title ?? context.discussionTitle;
  const baseBranch = options.baseBranch ?? context.defaultBranch;
  const headBranch = options.headBranch ?? `feature/${slugify(title)}`;

  const body =
    options.body ??
    `## Summary

${context.conversationSummary}

## Related Discussion

Resolves discussion #${context.discussionNumber}: "${context.discussionTitle}"`;

  return {
    title,
    body,
    baseBranch,
    headBranch,
    labels: options.labels ?? [],
    discussionNumber: context.discussionNumber,
  };
}
