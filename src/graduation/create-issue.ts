import type { ParsedDraft } from "./types";

export type CreateIssueParams = {
  owner: string;
  repo: string;
  title: string;
  body: string;
  labels: string[];
  assignees: string[];
};

export type CreatePRParams = {
  owner: string;
  repo: string;
  title: string;
  body: string;
  base: string;
  head: string;
};

/**
 * Builds parameters for creating a GitHub Issue from a parsed draft.
 */
export function buildCreateIssueParams(
  owner: string,
  repo: string,
  draft: ParsedDraft,
  discussionNumber: number,
): CreateIssueParams {
  const body = `${draft.body}

---
_Created from [discussion #${discussionNumber}](https://github.com/${owner}/${repo}/discussions/${discussionNumber})_`;

  return {
    owner,
    repo,
    title: draft.title,
    body,
    labels: draft.labels,
    assignees: draft.assignees ?? [],
  };
}

/**
 * Builds parameters for creating a GitHub PR from a parsed draft.
 */
export function buildCreatePRParams(
  owner: string,
  repo: string,
  draft: ParsedDraft,
): CreatePRParams {
  return {
    owner,
    repo,
    title: draft.title,
    body: draft.body,
    base: draft.baseBranch ?? "main",
    head: draft.headBranch ?? "",
  };
}

/**
 * Formats a comment announcing the created issue.
 */
export function formatCreatedIssueComment(
  issueNumber: number,
  issueTitle: string,
  discussionNumber: number,
): string {
  return `✅ **Issue #${issueNumber} created:** ${issueTitle}

This issue was graduated from discussion #${discussionNumber}.

[View Issue →](#${issueNumber})`;
}

/**
 * Formats a comment announcing the created PR.
 */
export function formatCreatedPRComment(
  prNumber: number,
  prTitle: string,
  discussionNumber: number,
): string {
  return `✅ **Pull Request #${prNumber} created:** ${prTitle}

This PR was graduated from discussion #${discussionNumber}.

[View Pull Request →](#${prNumber})`;
}
