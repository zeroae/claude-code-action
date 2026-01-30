import { describe, it, expect } from "bun:test";
import {
  shouldQuoteMessage,
  formatQuotedMessage,
  type QuoteContext,
} from "../../src/discussions/smart-quote";

describe("Smart Quoting", () => {
  it("returns false for short threads (<=5 messages)", () => {
    const context: QuoteContext = {
      threadLength: 3,
      triggerMessageLength: 100,
      timeSinceLastMessage: 60000, // 1 minute
    };
    expect(shouldQuoteMessage(context)).toBe(false);
  });

  it("returns true for long threads (>5 messages)", () => {
    const context: QuoteContext = {
      threadLength: 7,
      triggerMessageLength: 100,
      timeSinceLastMessage: 60000,
    };
    expect(shouldQuoteMessage(context)).toBe(true);
  });

  it("returns true for short messages in any thread", () => {
    const context: QuoteContext = {
      threadLength: 2,
      triggerMessageLength: 20, // Very short, might be ambiguous
      timeSinceLastMessage: 60000,
    };
    expect(shouldQuoteMessage(context)).toBe(true);
  });

  it("returns true for messages after long gaps", () => {
    const context: QuoteContext = {
      threadLength: 3,
      triggerMessageLength: 100,
      timeSinceLastMessage: 3600000 * 24, // 24 hours
    };
    expect(shouldQuoteMessage(context)).toBe(true);
  });

  it("formats quoted message correctly", () => {
    const quoted = formatQuotedMessage("What about JWT?", "user1");
    expect(quoted).toContain("> What about JWT?");
    expect(quoted).toContain("@user1");
  });

  it("truncates long messages when quoting", () => {
    const longMessage = "A".repeat(500);
    const quoted = formatQuotedMessage(longMessage, "user1");
    expect(quoted.length).toBeLessThan(400);
    expect(quoted).toContain("...");
  });
});
