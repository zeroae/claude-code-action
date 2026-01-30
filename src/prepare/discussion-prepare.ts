export type SessionResumeInput = {
  sessionId: string | null;
  summary: string | null;
};

export type SessionResumeResult = {
  shouldResume: boolean;
  sessionId?: string;
  fallbackContext?: string;
};

/**
 * Determines how to handle session resume for a discussion.
 *
 * Logic:
 * 1. If sessionId exists, try to resume that session
 * 2. If no sessionId but summary exists, use summary as context
 * 3. If nothing exists, start fresh
 */
export function determineSessionResume(
  input: SessionResumeInput,
): SessionResumeResult {
  if (input.sessionId) {
    return {
      shouldResume: true,
      sessionId: input.sessionId,
    };
  }

  if (input.summary) {
    return {
      shouldResume: false,
      fallbackContext: input.summary,
    };
  }

  return {
    shouldResume: false,
  };
}

/**
 * Builds Claude CLI arguments for session resume.
 */
export function buildResumeArgs(result: SessionResumeResult): string[] {
  const args: string[] = [];

  if (result.shouldResume && result.sessionId) {
    args.push("--resume", result.sessionId);
  }

  return args;
}
