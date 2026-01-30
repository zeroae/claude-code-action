import type { IssueDraft, PRDraft, ParsedDraft } from "./types";

export type { IssueDraft, PRDraft, ParsedDraft };

/**
 * Formats an issue draft as a structured markdown comment.
 */
export function formatIssueDraft(draft: IssueDraft): string {
  const labelsStr =
    draft.labels.length > 0
      ? draft.labels.map((l) => `\`${l}\``).join(", ")
      : "(none)";

  const assigneesStr =
    draft.assignees.length > 0 ? draft.assignees.join(", ") : "(none)";

  return `📝 **Draft Issue**

**Title:** ${draft.title}

**Labels:** ${labelsStr}

**Assignees:** ${assigneesStr}

**Body:**
${draft.body}

Resolves discussion #${draft.discussionNumber}.

---

💬 Reply to refine this draft, or say "create it" to publish.`;
}

/**
 * Formats a PR draft as a structured markdown comment.
 */
export function formatPRDraft(draft: PRDraft): string {
  const labelsStr =
    draft.labels.length > 0
      ? draft.labels.map((l) => `\`${l}\``).join(", ")
      : "(none)";

  return `📝 **Draft Pull Request**

**Title:** ${draft.title}

**Base:** ${draft.baseBranch}

**Head:** ${draft.headBranch}

**Labels:** ${labelsStr}

**Body:**
${draft.body}

Resolves discussion #${draft.discussionNumber}.

---

💬 Reply to refine this draft, or say "create it" to publish.`;
}

/**
 * Parses a draft from a comment body.
 * Returns null if the comment is not a draft.
 */
export function parseDraftFromComment(commentBody: string): ParsedDraft | null {
  if (!commentBody.includes("📝 **Draft")) {
    return null;
  }

  const isIssue = commentBody.includes("**Draft Issue**");
  const isPR = commentBody.includes("**Draft Pull Request**");

  if (!isIssue && !isPR) {
    return null;
  }

  // Parse title
  const titleMatch = commentBody.match(/\*\*Title:\*\*\s*(.+)/);
  const title = titleMatch?.[1]?.trim() ?? "";

  // Parse labels
  const labelsMatch = commentBody.match(/\*\*Labels:\*\*\s*(.+)/);
  const labelsStr = labelsMatch?.[1]?.trim() ?? "";
  const labels =
    labelsStr === "(none)"
      ? []
      : labelsStr.match(/`([^`]+)`/g)?.map((l) => l.replace(/`/g, "")) ?? [];

  // Parse body
  const bodyMatch = commentBody.match(
    /\*\*Body:\*\*\n([\s\S]*?)\n\nResolves discussion/,
  );
  const body = bodyMatch?.[1]?.trim() ?? "";

  if (isIssue) {
    // Parse assignees
    const assigneesMatch = commentBody.match(/\*\*Assignees:\*\*\s*(.+)/);
    const assigneesStr = assigneesMatch?.[1]?.trim() ?? "";
    const assignees =
      assigneesStr === "(none)"
        ? []
        : assigneesStr.split(",").map((a) => a.trim());

    return {
      type: "issue",
      title,
      body,
      labels,
      assignees,
    };
  }

  if (isPR) {
    // Parse base and head branches
    const baseMatch = commentBody.match(/\*\*Base:\*\*\s*(.+)/);
    const headMatch = commentBody.match(/\*\*Head:\*\*\s*(.+)/);

    return {
      type: "pr",
      title,
      body,
      labels,
      baseBranch: baseMatch?.[1]?.trim(),
      headBranch: headMatch?.[1]?.trim(),
    };
  }

  return null;
}
