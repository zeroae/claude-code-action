export type IssueDraft = {
  title: string;
  body: string;
  labels: string[];
  assignees: string[];
  discussionNumber: number;
};

export type PRDraft = {
  title: string;
  body: string;
  baseBranch: string;
  headBranch: string;
  labels: string[];
  discussionNumber: number;
};

export type DraftType = "issue" | "pr";

export type ParsedDraft = {
  type: DraftType;
  title: string;
  body: string;
  labels: string[];
  assignees?: string[];
  baseBranch?: string;
  headBranch?: string;
};
