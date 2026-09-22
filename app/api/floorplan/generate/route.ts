import OpenAI from "openai";
import type { ResponseInputContent } from "openai/resources/responses/responses";
import { describeOpenAIError } from "@/features/floorplan/server/openaiError";
import { DEVELOPER_INSTRUCTIONS, buildUserMessage } from "@/features/floorplan/server/scenePrompt";
import {
  DEFAULT_REASONING_EFFORT,
  REASONING_EFFORTS,
  type GenerateRequest,
  type GenerateResponse,
  type GenerateSuccess,
  type ReasoningEffort,
  type RoomSpot,
  type ScenePose,
} from "@/features/floorplan/types";
import {
  MAX_IMAGE_DATA_URL_LENGTH,
  capOnScale,
  isFiniteNumber,
  isImageDataUrl,
  parseCamera,
  parseReasoningEffort,
} from "@/features/floorplan/lib/validation";

// Reasoning models can take a while on complex scenes; give the platform room.
export const maxDuration = 300;

const MODEL = "gpt-6-astra";

const POSE_PROPERTIES = {
  x: { type: "number", description: "World X in meters (image left-to-right)." },
  z: { type: "number", description: "World Z in meters (image top-to-bottom)." },
  angleDeg: {
    type: "number",
    description: "Facing direction in degrees: 0 = towards +X, 90 = towards +Z.",
  },
} as const;

const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    code: {
      type: "string",
      description:
        "Body of buildScene(THREE, scene, camera, renderer, controls). Plain JavaScript, no Markdown fences.",
    },
    summary: {
      type: "string",
      description: "1-3 sentences describing the scene and assumptions.",
    },
    camera: {
      type: "object",
      description:
        "Standing point of the user's camera marker in scene coordinates (or the default spot when there is no marker). Must be inside a room, clear of walls and furniture.",
      properties: POSE_PROPERTIES,
      required: ["x", "z", "angleDeg"],
      additionalProperties: false,
    },
    rooms: {
      type: "array",
      description:
        "Every room on the plan, in reading order (top-left to bottom-right), each with a standing point inside it and a facing direction that shows the room well.",
      items: {
        type: "object",
        properties: {
          name: { type: "string", description: 'Short label, e.g. "Living room", "Bedroom 2".' },
          ...POSE_PROPERTIES,
        },
        required: ["name", "x", "z", "angleDeg"],
        additionalProperties: false,
      },
    },
  },
  required: ["code", "summary", "camera", "rooms"],
  additionalProperties: false,
} as const;

const MAX_ROOMS = 40;
const MAX_ROOM_NAME_LENGTH = 40;

function json(body: GenerateResponse, status = 200): Response {
  return Response.json(body, { status });
}

type ParsedRequest = { ok: true; value: GenerateRequest } | { ok: false; error: string };

function parseRequest(body: unknown): ParsedRequest {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Request body must be a JSON object." };
  }
  const { imageDataUrl, camera, reasoningEffort } = body as Record<string, unknown>;

  if (!isImageDataUrl(imageDataUrl)) {
    return { ok: false, error: "`imageDataUrl` must be an image data URL." };
  }
  if (imageDataUrl.length > MAX_IMAGE_DATA_URL_LENGTH) {
    return { ok: false, error: "The image is too large. Please use a smaller floorplan." };
  }

  const parsedCamera = parseCamera(camera);
  if (parsedCamera === null) {
    return { ok: false, error: "`camera` must contain numeric x, y (0..1) and angleDeg." };
  }

  // An unusable effort is not worth failing a slow, expensive request over: the
  // server settles on its own default instead.
  const parsedEffort = parseReasoningEffort(reasoningEffort);

  return {
    ok: true,
    value: {
      imageDataUrl,
      ...(parsedCamera ? { camera: parsedCamera } : {}),
      ...(parsedEffort ? { reasoningEffort: parsedEffort } : {}),
    },
  };
}

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

function parsePose(value: unknown): ScenePose | null {
  if (typeof value !== "object" || value === null) return null;
  const { x, z, angleDeg } = value as Record<string, unknown>;
  if (!isFiniteNumber(x) || !isFiniteNumber(z) || !isFiniteNumber(angleDeg)) return null;
  return { x, z, angleDeg: ((angleDeg % 360) + 360) % 360 };
}

/** Rooms are optional extras: malformed entries are dropped rather than failing the request. */
function parseRooms(value: unknown): RoomSpot[] {
  if (!Array.isArray(value)) return [];
  const rooms: RoomSpot[] = [];
  for (const entry of value) {
    const pose = parsePose(entry);
    const name = (entry as Record<string, unknown> | null)?.name;
    if (!pose || typeof name !== "string" || name.trim() === "") continue;
    rooms.push({ name: name.trim().slice(0, MAX_ROOM_NAME_LENGTH), ...pose });
    if (rooms.length >= MAX_ROOMS) break;
  }
  return rooms;
}

function parseModelOutput(text: string): GenerateSuccess | null {
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    if (typeof parsed.code !== "string" || typeof parsed.summary !== "string") return null;
    const rooms = parseRooms(parsed.rooms);
    // Without a usable camera, stand in the first room (the harness falls back to
    // the camera the code set up when there is none at all).
    const camera = parsePose(parsed.camera) ?? rooms[0] ?? null;
    if (!camera) return null;
    return {
      code: parsed.code,
      summary: parsed.summary,
      camera: { x: camera.x, z: camera.z, angleDeg: camera.angleDeg },
      rooms,
    };
  } catch {
    return null;
  }
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

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return json({ error: "Request body is not valid JSON." }, 400);
  }

  const parsed = parseRequest(rawBody);
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
          schema: OUTPUT_SCHEMA,
        },
      },
    });

    const result = parseModelOutput(response.output_text);
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
