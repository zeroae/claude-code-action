import { describe, it, expect } from "bun:test";
import {
  determineSessionResume,
  buildResumeArgs,
  type SessionResumeResult,
} from "../src/prepare/discussion-prepare";

describe("Discussion Prepare", () => {
  it("returns resume with session_id when session exists", () => {
    const result = determineSessionResume({
      sessionId: "sess_abc123",
      summary: "Previous discussion about auth",
    });

    expect(result.shouldResume).toBe(true);
    expect(result.sessionId).toBe("sess_abc123");
    expect(result.fallbackContext).toBeUndefined();
  });

  it("returns fallback context when session_id is null", () => {
    const result = determineSessionResume({
      sessionId: null,
      summary: "Previous discussion about auth",
    });

    expect(result.shouldResume).toBe(false);
    expect(result.sessionId).toBeUndefined();
    expect(result.fallbackContext).toBe("Previous discussion about auth");
  });

  it("returns fresh start when no session data", () => {
    const result = determineSessionResume({
      sessionId: null,
      summary: null,
    });

    expect(result.shouldResume).toBe(false);
    expect(result.sessionId).toBeUndefined();
    expect(result.fallbackContext).toBeUndefined();
  });

  it("builds resume args with session_id", () => {
    const result: SessionResumeResult = {
      shouldResume: true,
      sessionId: "sess_abc123",
    };
    const args = buildResumeArgs(result);
    expect(args).toEqual(["--resume", "sess_abc123"]);
  });

  it("builds empty args when not resuming", () => {
    const result: SessionResumeResult = {
      shouldResume: false,
      fallbackContext: "Some context",
    };
    const args = buildResumeArgs(result);
    expect(args).toEqual([]);
  });
});
