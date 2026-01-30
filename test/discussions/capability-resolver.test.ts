import { describe, it, expect } from "bun:test";
import {
  resolveCapabilities,
  canCommit,
  canEditFiles,
  canWebSearch,
  type ResolvedCapabilities,
  type CapabilityContext,
} from "../../src/discussions/capability-resolver";

describe("Capability Resolver", () => {
  const defaultConfig = {
    categories: [
      {
        name: "Claude Q&A",
        capabilities: {
          web_search: true,
          edit_files: false,
          can_commit: false,
        },
      },
      {
        name: "AI Prototyping",
        capabilities: {
          web_search: true,
          edit_files: true,
          can_commit: false,
        },
      },
      {
        name: "Claude Dev",
        capabilities: {
          web_search: true,
          edit_files: true,
          can_commit: true,
        },
      },
    ],
    session_branch: "claude-sessions",
  };

  it("resolves capabilities from category config", () => {
    const context: CapabilityContext = {
      categoryName: "Claude Q&A",
      config: defaultConfig,
      labels: [],
    };

    const caps = resolveCapabilities(context);
    expect(caps.webSearch).toBe(true);
    expect(caps.editFiles).toBe(false);
    expect(caps.canCommit).toBe(false);
  });

  it("allows commit with claude-can-commit label", () => {
    const context: CapabilityContext = {
      categoryName: "Claude Q&A",
      config: defaultConfig,
      labels: ["claude-can-commit"],
    };

    const caps = resolveCapabilities(context);
    expect(caps.canCommit).toBe(true);
  });

  it("uses default restrictive caps for unknown category", () => {
    const context: CapabilityContext = {
      categoryName: "Unknown Category",
      config: defaultConfig,
      labels: [],
    };

    const caps = resolveCapabilities(context);
    expect(caps.webSearch).toBe(false);
    expect(caps.editFiles).toBe(false);
    expect(caps.canCommit).toBe(false);
  });

  it("provides helper functions", () => {
    const caps: ResolvedCapabilities = {
      webSearch: true,
      editFiles: true,
      canCommit: false,
    };

    expect(canWebSearch(caps)).toBe(true);
    expect(canEditFiles(caps)).toBe(true);
    expect(canCommit(caps)).toBe(false);
  });

  it("resolves full capabilities for Claude Dev category", () => {
    const context: CapabilityContext = {
      categoryName: "Claude Dev",
      config: defaultConfig,
      labels: [],
    };

    const caps = resolveCapabilities(context);
    expect(caps.webSearch).toBe(true);
    expect(caps.editFiles).toBe(true);
    expect(caps.canCommit).toBe(true);
  });
});
