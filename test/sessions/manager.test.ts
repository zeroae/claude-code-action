import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { SessionManager } from "../../src/sessions/manager";

describe("Session Manager", () => {
  let tempDir: string;
  let manager: SessionManager;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "session-test-"));
    manager = new SessionManager({
      workDir: tempDir,
      sessionBranch: "claude-sessions",
      skipGit: true,
    });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("saves and loads session", async () => {
    const session = {
      comment_id: "DC_abc123",
      parent_comment_id: null,
      session_id: "sess_xyz",
      created_at: "2025-01-29T10:00:00Z",
      updated_at: "2025-01-29T10:00:00Z",
      summary: "Test summary",
    };

    await manager.saveSession(42, session);
    const loaded = await manager.loadSession(42, "DC_abc123");

    expect(loaded?.comment_id).toBe("DC_abc123");
    expect(loaded?.session_id).toBe("sess_xyz");
  });

  it("returns null for non-existent session", async () => {
    const loaded = await manager.loadSession(42, "DC_nonexistent");
    expect(loaded).toBeNull();
  });

  it("finds session for comment in chain", async () => {
    const session = {
      comment_id: "DC_claude",
      parent_comment_id: "DC_user1",
      session_id: "sess_xyz",
      created_at: "2025-01-29T10:00:00Z",
      updated_at: "2025-01-29T10:00:00Z",
      summary: "Test summary",
    };
    await manager.saveSession(42, session);

    const chain = ["DC_user2", "DC_claude", "DC_user1"];
    const found = await manager.findSessionInChain(42, chain);

    expect(found?.comment_id).toBe("DC_claude");
  });
});
