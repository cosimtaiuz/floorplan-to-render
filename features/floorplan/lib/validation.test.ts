import { describe, expect, it } from "vitest";
import {
  MAX_IMAGE_DATA_URL_LENGTH,
  MAX_PROMPT_LENGTH,
  capOnScale,
  decodeImageDataUrl,
  isFiniteNumber,
  isImageDataUrl,
  parseCamera,
  parseClaudeEffort,
  parseOutputSize,
  parseReasoningEffort,
  parseRenderQuality,
} from "./validation";
import { CLAUDE_EFFORTS, REASONING_EFFORTS, RENDER_QUALITIES } from "@/features/floorplan/types";

describe("isFiniteNumber", () => {
  it("accepts ordinary numbers, including zero and negatives", () => {
    expect(isFiniteNumber(0)).toBe(true);
    expect(isFiniteNumber(-3.5)).toBe(true);
  });

  it("rejects the non-finite numbers that would poison scene coordinates", () => {
    expect(isFiniteNumber(NaN)).toBe(false);
    expect(isFiniteNumber(Infinity)).toBe(false);
    expect(isFiniteNumber(-Infinity)).toBe(false);
  });

  it("rejects non-numbers, including numeric strings", () => {
    expect(isFiniteNumber("1")).toBe(false);
    expect(isFiniteNumber(null)).toBe(false);
    expect(isFiniteNumber(undefined)).toBe(false);
    expect(isFiniteNumber({})).toBe(false);
  });
});

describe("isImageDataUrl", () => {
  it("accepts an image data URL", () => {
    expect(isImageDataUrl("data:image/png;base64,AAAA")).toBe(true);
  });

  it("rejects non-image data URLs and remote URLs", () => {
    expect(isImageDataUrl("data:text/html;base64,AAAA")).toBe(false);
    expect(isImageDataUrl("https://example.com/plan.png")).toBe(false);
    // A would-be SSRF vector: the routes must never fetch a URL they were handed.
    expect(isImageDataUrl("file:///etc/passwd")).toBe(false);
  });

  it("rejects non-strings", () => {
    expect(isImageDataUrl(null)).toBe(false);
    expect(isImageDataUrl(123)).toBe(false);
  });
});

describe("parseCamera", () => {
  it("returns undefined when there is no marker, which is a valid request", () => {
    expect(parseCamera(undefined)).toBeUndefined();
    expect(parseCamera(null)).toBeUndefined();
  });

  it("keeps a valid marker as-is", () => {
    expect(parseCamera({ x: 0.25, y: 0.75, angleDeg: 90 })).toEqual({
      x: 0.25,
      y: 0.75,
      angleDeg: 90,
    });
  });

  it("accepts the exact edges of the normalized range", () => {
    expect(parseCamera({ x: 0, y: 0, angleDeg: 0 })).toEqual({ x: 0, y: 0, angleDeg: 0 });
    expect(parseCamera({ x: 1, y: 1, angleDeg: 0 })).toEqual({ x: 1, y: 1, angleDeg: 0 });
  });

  it("rejects coordinates outside the plan", () => {
    expect(parseCamera({ x: -0.01, y: 0.5, angleDeg: 0 })).toBeNull();
    expect(parseCamera({ x: 1.01, y: 0.5, angleDeg: 0 })).toBeNull();
    expect(parseCamera({ x: 0.5, y: 1.5, angleDeg: 0 })).toBeNull();
  });

  it("normalizes any angle into [0, 360)", () => {
    expect(parseCamera({ x: 0.5, y: 0.5, angleDeg: 450 })?.angleDeg).toBe(90);
    expect(parseCamera({ x: 0.5, y: 0.5, angleDeg: -90 })?.angleDeg).toBe(270);
    expect(parseCamera({ x: 0.5, y: 0.5, angleDeg: 360 })?.angleDeg).toBe(0);
    // -0 would serialize as "-0" downstream; it must come back as a plain 0.
    expect(Object.is(parseCamera({ x: 0.5, y: 0.5, angleDeg: -360 })?.angleDeg, 0)).toBe(true);
  });

  it("rejects malformed markers rather than coercing them", () => {
    expect(parseCamera({ x: "0.5", y: 0.5, angleDeg: 0 })).toBeNull();
    expect(parseCamera({ x: 0.5, angleDeg: 0 })).toBeNull();
    expect(parseCamera({ x: NaN, y: 0.5, angleDeg: 0 })).toBeNull();
    expect(parseCamera("nope")).toBeNull();
  });
});

describe("parseReasoningEffort", () => {
  it("keeps every value of the scale", () => {
    for (const effort of REASONING_EFFORTS) {
      expect(parseReasoningEffort(effort)).toBe(effort);
    }
  });

  it("treats anything off the scale as not asked for", () => {
    // These set the price of a model call, so an unknown value must never reach
    // the SDK: the route falls back to its own default instead.
    expect(parseReasoningEffort("extreme")).toBeUndefined();
    expect(parseReasoningEffort("MAX")).toBeUndefined();
    expect(parseReasoningEffort("")).toBeUndefined();
    expect(parseReasoningEffort(undefined)).toBeUndefined();
    expect(parseReasoningEffort(null)).toBeUndefined();
    expect(parseReasoningEffort(3)).toBeUndefined();
    expect(parseReasoningEffort({ effort: "max" })).toBeUndefined();
  });
});

describe("parseClaudeEffort", () => {
  it("keeps every value of the scale", () => {
    for (const effort of CLAUDE_EFFORTS) {
      expect(parseClaudeEffort(effort)).toBe(effort);
    }
  });

  it("treats anything off the scale as not asked for", () => {
    // Not an effort the Messages API accepts, so it must never reach the SDK.
    expect(parseClaudeEffort("ultracode")).toBeUndefined();
    expect(parseClaudeEffort("MAX")).toBeUndefined();
    expect(parseClaudeEffort(undefined)).toBeUndefined();
    expect(parseClaudeEffort(2)).toBeUndefined();
  });
});

describe("parseRenderQuality", () => {
  it("keeps every value of the scale", () => {
    for (const quality of RENDER_QUALITIES) {
      expect(parseRenderQuality(quality)).toBe(quality);
    }
  });

  it("treats anything off the scale as not asked for", () => {
    expect(parseRenderQuality("ultra")).toBeUndefined();
    // Valid for the image API, but not on the scale this app allows.
    expect(parseRenderQuality("auto")).toBeUndefined();
    expect(parseRenderQuality(null)).toBeUndefined();
    expect(parseRenderQuality(1)).toBeUndefined();
  });
});

describe("parseOutputSize", () => {
  it("returns undefined when no size is asked for, which means 'match the 3D view'", () => {
    expect(parseOutputSize(undefined)).toBeUndefined();
    expect(parseOutputSize(null)).toBeUndefined();
  });

  it("keeps a well-formed size", () => {
    expect(parseOutputSize({ width: 1536, height: 1024 })).toEqual({ width: 1536, height: 1024 });
  });

  it("rejects sizes that could not produce an image", () => {
    expect(parseOutputSize({ width: 0, height: 1024 })).toBeNull();
    expect(parseOutputSize({ width: -1536, height: 1024 })).toBeNull();
    expect(parseOutputSize({ width: NaN, height: 1024 })).toBeNull();
    expect(parseOutputSize({ width: Infinity, height: 1024 })).toBeNull();
  });

  it("rejects malformed sizes rather than coercing them", () => {
    expect(parseOutputSize({ width: "1536", height: 1024 })).toBeNull();
    expect(parseOutputSize({ width: 1536 })).toBeNull();
    expect(parseOutputSize("1536x1024")).toBeNull();
  });
});

describe("capOnScale", () => {
  const scale = ["low", "medium", "high"] as const;

  it("gives the client what it asked for when nothing caps it", () => {
    expect(capOnScale(scale, "high", "medium", undefined)).toBe("high");
    expect(capOnScale(scale, "low", "medium", undefined)).toBe("low");
  });

  it("falls back to the default when the client asked for nothing", () => {
    expect(capOnScale(scale, undefined, "medium", undefined)).toBe("medium");
  });

  it("clamps a request down to the ceiling the deployment set", () => {
    expect(capOnScale(scale, "high", "medium", "low")).toBe("low");
    expect(capOnScale(scale, "high", "medium", "high")).toBe("high");
  });

  it("leaves a request below the ceiling alone", () => {
    expect(capOnScale(scale, "low", "medium", "high")).toBe("low");
  });

  it("caps the default itself, so a low ceiling is never exceeded", () => {
    expect(capOnScale(scale, undefined, "medium", "low")).toBe("low");
  });

  it("treats an unusable ceiling as the default, so a typo cannot widen spending", () => {
    expect(capOnScale(scale, "high", "medium", "hgih")).toBe("medium");
    expect(capOnScale(scale, "high", "medium", "")).toBe("medium");
  });
});

describe("decodeImageDataUrl", () => {
  it("round-trips the bytes of a base64 payload", () => {
    const bytes = Buffer.from("hello floorplan");
    const decoded = decodeImageDataUrl(`data:image/png;base64,${bytes.toString("base64")}`);
    expect(decoded?.mimeType).toBe("image/png");
    expect(decoded?.buffer.equals(bytes)).toBe(true);
  });

  it("reads the MIME type the route maps to a file extension", () => {
    expect(decodeImageDataUrl("data:image/jpeg;base64,QUJD")?.mimeType).toBe("image/jpeg");
    expect(decodeImageDataUrl("data:image/webp;base64,QUJD")?.mimeType).toBe("image/webp");
  });

  it("rejects anything that is not a base64 image data URL", () => {
    expect(decodeImageDataUrl("data:text/plain;base64,QUJD")).toBeNull();
    expect(decodeImageDataUrl("data:image/png,not-base64")).toBeNull();
    expect(decodeImageDataUrl("https://example.com/a.png")).toBeNull();
    expect(decodeImageDataUrl("")).toBeNull();
  });
});

describe("size limits", () => {
  it("keeps the caps the routes rely on to bound request cost", () => {
    expect(MAX_IMAGE_DATA_URL_LENGTH).toBeGreaterThan(0);
    expect(MAX_PROMPT_LENGTH).toBeGreaterThan(0);
  });
});
