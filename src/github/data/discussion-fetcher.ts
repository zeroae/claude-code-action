import type { Octokits } from "../api/client";
import { DISCUSSION_QUERY } from "../api/queries/github";
import type {
  GitHubDiscussion,
  GitHubDiscussionComment,
  DiscussionQueryResponse,
} from "../types";

export type DiscussionComment = {
  id: string;
  databaseId: number;
  body: string;
  author: { login: string };
  createdAt: string;
  updatedAt?: string;
  isMinimized: boolean;
  replyTo: { id: string; databaseId: number } | null;
};

/**
 * Flattens nested discussion comments into a flat array.
 */
export function flattenDiscussionComments(
  comments: GitHubDiscussionComment[],
): DiscussionComment[] {
  const result: DiscussionComment[] = [];

  function flatten(comment: GitHubDiscussionComment) {
    result.push({
      id: comment.id,
      databaseId: comment.databaseId,
      body: comment.body,
      author: comment.author,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      isMinimized: comment.isMinimized,
      replyTo: comment.replyTo ?? null,
    });

    if (comment.replies?.nodes) {
      for (const reply of comment.replies.nodes) {
        flatten(reply);
      }
    }
  }

  for (const comment of comments) {
    flatten(comment);
  }

  return result;
}

/**
 * Walks up the reply chain from a given comment ID.
 * Returns an array starting with the given comment, then its parent, etc.
 */
export function findReplyChain(
  commentId: string,
  allComments: DiscussionComment[],
): DiscussionComment[] {
  const commentMap = new Map(allComments.map((c) => [c.id, c]));
  const chain: DiscussionComment[] = [];

  let current = commentMap.get(commentId);
  while (current) {
    chain.push(current);
    if (current.replyTo) {
      current = commentMap.get(current.replyTo.id);
    } else {
      break;
    }
  }

  return chain;
}

/**
 * Finds the most recent Claude comment in a reply chain.
 * The chain should be ordered from newest to oldest.
 */
export function findLastClaudeComment(
  chain: DiscussionComment[],
  botLogin: string,
): DiscussionComment | null {
  for (const comment of chain) {
    if (comment.author.login === botLogin) {
      return comment;
    }
  }
  return null;
}

/**
 * Fetches discussion data from GitHub GraphQL API.
 */
export async function fetchDiscussionData(
  octokits: Octokits,
  owner: string,
  repo: string,
  discussionNumber: number,
): Promise<GitHubDiscussion | null> {
  const result = await octokits.graphql<DiscussionQueryResponse>(
    DISCUSSION_QUERY,
    {
      owner,
      repo,
      number: discussionNumber,
    },
  );

  return result.repository.discussion;
}

export type DiscussionContext = {
  discussion: GitHubDiscussion;
  allComments: DiscussionComment[];
  replyChain: DiscussionComment[];
  lastClaudeComment: DiscussionComment | null;
};

/**
 * Builds full discussion context for a triggered comment.
 */
export async function buildDiscussionContext(
  octokits: Octokits,
  owner: string,
  repo: string,
  discussionNumber: number,
  triggerCommentId: string,
  botLogin: string,
): Promise<DiscussionContext | null> {
  const discussion = await fetchDiscussionData(
    octokits,
    owner,
    repo,
    discussionNumber,
  );

  if (!discussion) {
    return null;
  }

  const allComments = flattenDiscussionComments(
    discussion.comments?.nodes ?? [],
  );
  const replyChain = findReplyChain(triggerCommentId, allComments);
  const lastClaudeComment = findLastClaudeComment(replyChain, botLogin);

  return {
    discussion,
    allComments,
    replyChain,
    lastClaudeComment,
  };
}
