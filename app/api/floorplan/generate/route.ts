import OpenAI from "openai";
import type { ResponseInputContent } from "openai/resources/responses/responses";
import { describeOpenAIError } from "@/features/floorplan/server/openaiError";
import { DEVELOPER_INSTRUCTIONS, buildUserMessage } from "@/features/floorplan/server/scenePrompt";
import {
  SCENE_OUTPUT_SCHEMA,
  parseSceneOutput,
  parseSceneRequest,
  readJsonBody,
  sceneJson as json,
} from "@/features/floorplan/server/sceneGeneration";
import {
  DEFAULT_REASONING_EFFORT,
  REASONING_EFFORTS,
  type ReasoningEffort,
} from "@/features/floorplan/types";
import { capOnScale, parseReasoningEffort } from "@/features/floorplan/lib/validation";

// Reasoning models can take a while on complex scenes; give the platform room.
export const maxDuration = 300;

const MODEL = "gpt-6-astra";

/**
 * The client picks the effort; FLOORPLAN_REASONING_EFFORT is the ceiling the
 * deployment allows, not the setting, so whoever owns the API key keeps a lid on
 * what a single request can cost.
 */
function resolveReasoningEffort(requested: ReasoningEffort | undefined): ReasoningEffort {
  return capOnScale(
    REASONING_EFFORTS,
    requested,
    DEFAULT_REASONING_EFFORT,
    process.env.FLOORPLAN_REASONING_EFFORT,
  );
}

export async function POST(request: Request): Promise<Response> {
  if (!process.env.OPENAI_API_KEY) {
    return json(
      {
        error: "OPENAI_API_KEY is not configured on the server. Add it to .env.local and restart.",
      },
      500,
    );
  }

  const rawBody = await readJsonBody(request);
  if (rawBody === null) return json({ error: "Request body is not valid JSON." }, 400);

  const parsed = parseSceneRequest(rawBody, parseReasoningEffort);
  if (!parsed.ok) return json({ error: parsed.error }, 400);
  const { imageDataUrl, camera, reasoningEffort } = parsed.value;

  const content: ResponseInputContent[] = [
    { type: "input_text", text: buildUserMessage({ camera }) },
    { type: "input_image", image_url: imageDataUrl, detail: "high" },
  ];

  const openai = new OpenAI();

  try {
    const response = await openai.responses.create({
      model: MODEL,
      reasoning: { effort: resolveReasoningEffort(reasoningEffort) },
      instructions: DEVELOPER_INSTRUCTIONS,
      input: [{ role: "user", content }],
      text: {
        format: {
          type: "json_schema",
          name: "threejs_scene",
          strict: true,
          schema: SCENE_OUTPUT_SCHEMA,
        },
      },
    });

    const result = parseSceneOutput(response.output_text);
    if (!result) {
      return json({ error: "The model returned an unexpected response. Please try again." }, 502);
    }
    return json(result);
  } catch (err) {
    // Upstream text can carry account, org and quota details, so it stays in the
    // server log; the client only learns that the call failed.
    console.error("Scene generation failed:", describeOpenAIError(err));
    return json({ error: "The scene could not be generated. Please try again." }, 502);
  }
}
