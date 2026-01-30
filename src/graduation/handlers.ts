import type { IssueDraft, PRDraft, ParsedDraft } from "./types";
import {
  formatIssueDraft,
  formatPRDraft,
  parseDraftFromComment,
} from "./draft-formatter";

export type GraduationContext = {
  owner: string;
  repo: string;
  discussionNumber: number;
  discussionTitle: string;
  discussionBody: string;
  conversationSummary: string;
  defaultBranch: string;
};

export type CreateIssueDraftInput = {
  title: string;
  body: string;
  labels: string[];
  assignees: string[];
};

export type CreatePRDraftInput = {
  title: string;
  body: string;
  headBranch: string;
  baseBranch?: string;
  labels: string[];
};

export type DraftResult<T> = {
  draft: T;
  draftMarkdown: string;
};

/**
 * Handles creating an issue draft.
 */
export async function handleCreateIssueDraft(
  context: GraduationContext,
  input: CreateIssueDraftInput,
): Promise<DraftResult<IssueDraft>> {
  const draft: IssueDraft = {
    title: input.title,
    body: input.body,
    labels: input.labels,
    assignees: input.assignees,
    discussionNumber: context.discussionNumber,
  };

  const draftMarkdown = formatIssueDraft(draft);

  return {
    draft,
    draftMarkdown,
  };
}

/**
 * Handles creating a PR draft.
 */
export async function handleCreatePRDraft(
  context: GraduationContext,
  input: CreatePRDraftInput,
): Promise<DraftResult<PRDraft>> {
  const draft: PRDraft = {
    title: input.title,
    body: input.body,
    baseBranch: input.baseBranch ?? context.defaultBranch,
    headBranch: input.headBranch,
    labels: input.labels,
    discussionNumber: context.discussionNumber,
  };

  const draftMarkdown = formatPRDraft(draft);

  return {
    draft,
    draftMarkdown,
  };
}

/**
 * Parses a draft comment for finalization.
 */
export function handleFinalizeDraft(commentBody: string): ParsedDraft | null {
  return parseDraftFromComment(commentBody);
}
