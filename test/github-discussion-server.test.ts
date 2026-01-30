import { describe, it, expect } from "bun:test";
import { existsSync } from "fs";

describe("GitHub Discussion Server", () => {
  it("server file exists", () => {
    expect(existsSync("src/mcp/github-discussion-server.ts")).toBe(true);
  });
});
