import { describe, it, expect } from "bun:test";
import {
  formatSessionPath,
  parseSessionFile,
  serializeSession,
  type SessionData,
} from "../../src/sessions/storage";

describe("Session Storage", () => {
  it("formats session path correctly", () => {
    const path = formatSessionPath(42, "DC_abc123");
    expect(path).toBe("discussions/42/DC_abc123.yaml");
  });

  it("serializes session to YAML", () => {
    const session: SessionData = {
      comment_id: "DC_abc123",
      parent_comment_id: null,
      session_id: "sess_xyz",
      created_at: "2025-01-29T10:00:00Z",
      updated_at: "2025-01-29T10:00:00Z",
      summary: "Test summary",
    };
    const yaml = serializeSession(session);
    expect(yaml).toContain("comment_id: DC_abc123");
    expect(yaml).toContain("session_id: sess_xyz");
  });

  it("parses session from YAML", () => {
    const yaml = `
comment_id: DC_abc123
parent_comment_id: null
session_id: sess_xyz
created_at: "2025-01-29T10:00:00Z"
updated_at: "2025-01-29T10:00:00Z"
summary: Test summary
`;
    const session = parseSessionFile(yaml);
    expect(session.comment_id).toBe("DC_abc123");
    expect(session.session_id).toBe("sess_xyz");
    expect(session.summary).toBe("Test summary");
  });
});
