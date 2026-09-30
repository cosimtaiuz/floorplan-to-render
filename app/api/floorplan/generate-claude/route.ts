import Anthropic from "@anthropic-ai/sdk";
import type { Base64ImageSource } from "@anthropic-ai/sdk/resources/messages";
import { describeAnthropicError } from "@/features/floorplan/server/anthropicError";
import { DEVELOPER_INSTRUCTIONS, buildUserMessage } from "@/features/floorplan/server/scenePrompt";
import {
  SCENE_OUTPUT_SCHEMA,
  parseSceneOutput,
  parseSceneRequest,
  readJsonBody,
  sceneJson as json,
} from "@/features/floorplan/server/sceneGeneration";
import {
  CLAUDE_EFFORTS,
  DEFAULT_CLAUDE_EFFORT,
  type ClaudeEffort,
} from "@/features/floorplan/types";
import { capOnScale, parseClaudeEffort } from "@/features/floorplan/lib/validation";

// Same budget as the OpenAI route: high efforts on a large plan take minutes.
export const maxDuration = 300;

const MODEL = "claude-fable-5-1";

/**
 * Room for adaptive thinking plus a 250-450 line scene. The call is streamed,
 * which the SDK requires for a budget this large, so it is not cut off by the
 * non-streaming request timeout.
 */
const MAX_TOKENS = 64_000;

/**
 * Same rule as the OpenAI route: the client picks the effort, and
 * FLOORPLAN_REASONING_EFFORT is the deployment's ceiling for either provider.
 */
function resolveEffort(requested: ClaudeEffort | undefined): ClaudeEffort {
  return capOnScale(
    CLAUDE_EFFORTS,
    requested,
    DEFAULT_CLAUDE_EFFORT,
    process.env.FLOORPLAN_REASONING_EFFORT,
  );
}

/** Splits the data URL into what the Messages API takes; `null` for a type it does not read. */
function toImageSource(dataUrl: string): Base64ImageSource | null {
  const match = /^data:(image\/(?:jpeg|png|gif|webp));base64,(.+)$/.exec(dataUrl);
  if (!match) return null;
  return {
    type: "base64",
    media_type: match[1] as Base64ImageSource["media_type"],
    data: match[2],
  };
}

export async function POST(request: Request): Promise<Response> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return json(
      {
        error:
          "ANTHROPIC_API_KEY is not configured on the server. Add it to .env.local and restart.",
      },
      500,
    );
  }

  const rawBody = await readJsonBody(request);
  if (rawBody === null) return json({ error: "Request body is not valid JSON." }, 400);

  const parsed = parseSceneRequest(rawBody, parseClaudeEffort);
  if (!parsed.ok) return json({ error: parsed.error }, 400);
  const { imageDataUrl, camera, reasoningEffort } = parsed.value;

  const image = toImageSource(imageDataUrl);
  if (!image) {
    return json({ error: "Claude reads PNG, JPEG, GIF or WebP floorplans only." }, 400);
  }

  const anthropic = new Anthropic();

  try {
    const stream = anthropic.messages.stream({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      thinking: { type: "adaptive" },
      output_config: {
        effort: resolveEffort(reasoningEffort),
        format: { type: "json_schema", schema: SCENE_OUTPUT_SCHEMA },
      },
      // The instructions never change between requests, so they are cached.
      system: [
        { type: "text", text: DEVELOPER_INSTRUCTIONS, cache_control: { type: "ephemeral" } },
      ],
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: buildUserMessage({ camera }) },
            { type: "image", source: image },
          ],
        },
      ],
    });
    const message = await stream.finalMessage();

    if (message.stop_reason !== "end_turn") {
      console.error("Scene generation stopped early:", message.stop_reason);
      return json({ error: "The model did not finish the scene. Please try again." }, 502);
    }

    const text = message.content
      .flatMap((block) => (block.type === "text" ? [block.text] : []))
      .join("");
    const result = parseSceneOutput(text);
    if (!result) {
      return json({ error: "The model returned an unexpected response. Please try again." }, 502);
    }
    return json(result);
  } catch (err) {
    // Upstream text can carry account, org and quota details, so it stays in the
    // server log; the client only learns that the call failed.
    console.error("Scene generation failed:", describeAnthropicError(err));
    return json({ error: "The scene could not be generated. Please try again." }, 502);
  }
}
