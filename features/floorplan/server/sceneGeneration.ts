import "server-only";

import type {
  CameraMarker,
  GenerateResponse,
  GenerateSuccess,
  RoomSpot,
  ScenePose,
} from "@/features/floorplan/types";
import {
  MAX_IMAGE_DATA_URL_LENGTH,
  isFiniteNumber,
  isImageDataUrl,
  parseCamera,
} from "@/features/floorplan/lib/validation";

/**
 * What both scene routes share: the request they accept, the JSON schema the
 * model must answer with, and how that answer is checked. Only the SDK call
 * (and the effort scale it takes) differs between OpenAI and Claude.
 */

const POSE_PROPERTIES = {
  x: { type: "number", description: "World X in meters (image left-to-right)." },
  z: { type: "number", description: "World Z in meters (image top-to-bottom)." },
  angleDeg: {
    type: "number",
    description: "Facing direction in degrees: 0 = towards +X, 90 = towards +Z.",
  },
} as const;

export const SCENE_OUTPUT_SCHEMA = {
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

export function sceneJson(body: GenerateResponse, status = 200): Response {
  return Response.json(body, { status });
}

export type SceneRequest<E extends string> = {
  imageDataUrl: string;
  camera?: CameraMarker;
  reasoningEffort?: E;
};

type ParsedRequest<E extends string> =
  { ok: true; value: SceneRequest<E> } | { ok: false; error: string };

/**
 * Validates a scene request. `parseEffort` is the provider's own scale: an
 * effort that is not on it is dropped rather than failing the request.
 */
export function parseSceneRequest<E extends string>(
  body: unknown,
  parseEffort: (value: unknown) => E | undefined,
): ParsedRequest<E> {
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
  const parsedEffort = parseEffort(reasoningEffort);

  return {
    ok: true,
    value: {
      imageDataUrl,
      ...(parsedCamera ? { camera: parsedCamera } : {}),
      ...(parsedEffort ? { reasoningEffort: parsedEffort } : {}),
    },
  };
}

/** Reads the request body; `null` when it is not JSON. */
export async function readJsonBody(request: Request): Promise<unknown | null> {
  try {
    return (await request.json()) as unknown;
  } catch {
    return null;
  }
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

/** Checks the model's JSON answer; `null` when it is not usable. */
export function parseSceneOutput(text: string): GenerateSuccess | null {
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
