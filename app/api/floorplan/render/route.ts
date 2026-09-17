import OpenAI, { toFile } from "openai";
import type { Uploadable } from "openai";
import { resolveOutputSize } from "@/features/floorplan/lib/outputSize";
import { describeOpenAIError } from "@/features/floorplan/server/openaiError";
import { buildRenderPrompt } from "@/features/floorplan/server/renderPrompt";
import type { RenderRequest, RenderResponse } from "@/features/floorplan/types";
import {
  MAX_IMAGE_DATA_URL_LENGTH,
  MAX_PROMPT_LENGTH,
  decodeImageDataUrl,
  isFiniteNumber,
  isImageDataUrl,
} from "@/features/floorplan/lib/validation";

// Image generation can take up to ~2 minutes on complex prompts.
export const maxDuration = 300;

const MODEL = "gpt-image-2.5-sunburst";
type RenderQuality = "low" | "medium" | "high";
const DEFAULT_QUALITY: RenderQuality = "medium";
const ALLOWED_QUALITIES: ReadonlySet<string> = new Set<RenderQuality>(["low", "medium", "high"]);

function json(body: RenderResponse, status = 200): Response {
  return Response.json(body, { status });
}

type ParsedRequest = { ok: true; value: RenderRequest } | { ok: false; error: string };

function parseRequest(body: unknown): ParsedRequest {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Request body must be a JSON object." };
  }
  const { prompt, screenshotDataUrl, screenshotWidth, screenshotHeight, floorplanDataUrl } =
    body as Record<string, unknown>;

  if (typeof prompt !== "string") return { ok: false, error: "`prompt` must be a string." };
  if (prompt.length > MAX_PROMPT_LENGTH) {
    return { ok: false, error: `\`prompt\` must be under ${MAX_PROMPT_LENGTH} characters.` };
  }

  if (!isImageDataUrl(screenshotDataUrl)) {
    return { ok: false, error: "`screenshotDataUrl` must be an image data URL." };
  }
  if (screenshotDataUrl.length > MAX_IMAGE_DATA_URL_LENGTH) {
    return { ok: false, error: "The screenshot is too large." };
  }
  if (
    !isFiniteNumber(screenshotWidth) ||
    !isFiniteNumber(screenshotHeight) ||
    screenshotWidth <= 0 ||
    screenshotHeight <= 0
  ) {
    return {
      ok: false,
      error: "`screenshotWidth` and `screenshotHeight` must be positive numbers.",
    };
  }

  if (floorplanDataUrl !== undefined) {
    if (!isImageDataUrl(floorplanDataUrl)) {
      return { ok: false, error: "`floorplanDataUrl` must be an image data URL." };
    }
    if (floorplanDataUrl.length > MAX_IMAGE_DATA_URL_LENGTH) {
      return {
        ok: false,
        error: "The floorplan image is too large. Please use a smaller floorplan.",
      };
    }
  }

  return {
    ok: true,
    value: {
      prompt,
      screenshotDataUrl,
      screenshotWidth,
      screenshotHeight,
      ...(floorplanDataUrl ? { floorplanDataUrl } : {}),
    },
  };
}

function resolveQuality(): RenderQuality {
  const fromEnv = process.env.FLOORPLAN_RENDER_QUALITY;
  return fromEnv && ALLOWED_QUALITIES.has(fromEnv) ? (fromEnv as RenderQuality) : DEFAULT_QUALITY;
}

const MIME_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

async function dataUrlToUploadable(dataUrl: string, baseName: string): Promise<Uploadable | null> {
  const decoded = decodeImageDataUrl(dataUrl);
  if (!decoded) return null;
  const extension = MIME_EXTENSIONS[decoded.mimeType];
  if (!extension) return null;
  return toFile(decoded.buffer, `${baseName}.${extension}`, { type: decoded.mimeType });
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
  const { prompt, screenshotDataUrl, screenshotWidth, screenshotHeight, floorplanDataUrl } =
    parsed.value;

  const screenshot = await dataUrlToUploadable(screenshotDataUrl, "scene-screenshot");
  if (!screenshot) {
    return json({ error: "The screenshot must be a base64 PNG, JPEG or WebP data URL." }, 400);
  }

  // Order matters: the first image is the one the model edits; the rest are references.
  const images: Uploadable[] = [screenshot];
  if (floorplanDataUrl) {
    const floorplan = await dataUrlToUploadable(floorplanDataUrl, "floorplan");
    if (!floorplan) {
      return json({ error: "The floorplan must be a base64 PNG, JPEG or WebP data URL." }, 400);
    }
    images.push(floorplan);
  }

  const openai = new OpenAI();

  try {
    const response = await openai.images.edit({
      model: MODEL,
      image: images,
      prompt: buildRenderPrompt({ prompt, hasFloorplan: Boolean(floorplanDataUrl) }),
      size: resolveOutputSize(screenshotWidth, screenshotHeight),
      quality: resolveQuality(),
      output_format: "jpeg",
      output_compression: 85,
    });

    const b64 = response.data?.[0]?.b64_json;
    if (!b64) {
      return json({ error: "The model returned no image. Please try again." }, 502);
    }
    return json({ imageDataUrl: `data:image/jpeg;base64,${b64}` });
  } catch (err) {
    // Upstream text can carry account, org and quota details, so it stays in the
    // server log; the client only learns that the call failed.
    console.error("Render failed:", describeOpenAIError(err));
    return json({ error: "The render could not be generated. Please try again." }, 502);
  }
}
