import "server-only";

import Anthropic from "@anthropic-ai/sdk";

/**
 * Turns an Anthropic SDK error into a message for the server log.
 *
 * Same contract as `describeOpenAIError`: the result is never sent to the
 * client, because upstream text can name the organization, rate limits or
 * model access of whoever owns the key.
 */
export function describeAnthropicError(err: unknown): string {
  if (err instanceof Anthropic.APIError) {
    return `Anthropic error (${err.status ?? "unknown"}): ${err.message}`;
  }
  if (err instanceof Error) return err.message;
  return "Unexpected error while contacting Anthropic.";
}
