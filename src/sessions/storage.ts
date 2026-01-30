import * as yaml from "yaml";

export type SessionData = {
  comment_id: string;
  parent_comment_id: string | null;
  session_id: string;
  created_at: string;
  updated_at: string;
  summary: string;
};

export type DiscussionSummary = {
  discussion_id: number;
  title: string;
  last_updated: string;
  key_decisions: string[];
  branches: Array<{
    root: string;
    latest: string;
    topic: string;
  }>;
};

export function formatSessionPath(
  discussionNumber: number,
  commentId: string,
): string {
  return `discussions/${discussionNumber}/${commentId}.yaml`;
}

export function formatSummaryPath(discussionNumber: number): string {
  return `discussions/${discussionNumber}/_summary.yaml`;
}

export function serializeSession(session: SessionData): string {
  return yaml.stringify(session);
}

export function parseSessionFile(content: string): SessionData {
  return yaml.parse(content) as SessionData;
}

export function serializeSummary(summary: DiscussionSummary): string {
  return yaml.stringify(summary);
}

export function parseSummaryFile(content: string): DiscussionSummary {
  return yaml.parse(content) as DiscussionSummary;
}

export function createSession(
  commentId: string,
  parentCommentId: string | null,
  sessionId: string,
  summary: string,
): SessionData {
  const now = new Date().toISOString();
  return {
    comment_id: commentId,
    parent_comment_id: parentCommentId,
    session_id: sessionId,
    created_at: now,
    updated_at: now,
    summary,
  };
}
