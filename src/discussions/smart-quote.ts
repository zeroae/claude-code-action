export type QuoteContext = {
  threadLength: number;
  triggerMessageLength: number;
  timeSinceLastMessage: number; // milliseconds
};

const LONG_THREAD_THRESHOLD = 5;
const SHORT_MESSAGE_THRESHOLD = 50;
const LONG_GAP_THRESHOLD = 3600000; // 1 hour in ms
const MAX_QUOTE_LENGTH = 200;

/**
 * Determines if Claude should quote the triggering message in the response.
 *
 * Quoting is helpful when:
 * - Thread is long (>5 messages) - context might be lost
 * - Trigger message is very short - might be ambiguous
 * - Long time gap since last message - reader might need reminder
 */
export function shouldQuoteMessage(context: QuoteContext): boolean {
  // Long threads benefit from quoting
  if (context.threadLength > LONG_THREAD_THRESHOLD) {
    return true;
  }

  // Short/ambiguous messages should be quoted
  if (context.triggerMessageLength < SHORT_MESSAGE_THRESHOLD) {
    return true;
  }

  // Long time gaps suggest quoting for context
  if (context.timeSinceLastMessage > LONG_GAP_THRESHOLD) {
    return true;
  }

  return false;
}

/**
 * Formats a message as a blockquote with attribution.
 */
export function formatQuotedMessage(message: string, author: string): string {
  let truncated = message;

  if (message.length > MAX_QUOTE_LENGTH) {
    truncated = message.substring(0, MAX_QUOTE_LENGTH - 3) + "...";
  }

  // Convert to blockquote format
  const quoted = truncated
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n");

  return `@${author} wrote:\n${quoted}`;
}
