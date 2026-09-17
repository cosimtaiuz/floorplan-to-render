import "server-only";

import OpenAI from "openai";

/**
 * Turns an OpenAI SDK error into a message for the server log.
 *
 * The result is deliberately never sent to the client: upstream text can name
 * the organization, quota state, billing status or model access of whoever owns
 * the key. Routes log this and answer with a generic message instead, the same
 * way the rest of the app treats third-party failures.
 */
export function describeOpenAIError(err: unknown): string {
  if (err instanceof OpenAI.APIError) {
    return `OpenAI error (${err.status ?? "unknown"}): ${err.message}`;
  }
  if (err instanceof Error) return err.message;
  return "Unexpected error while contacting OpenAI.";
}
