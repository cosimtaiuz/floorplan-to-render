import { describe, expect, it } from "vitest";
import {
  MAX_IMAGE_DATA_URL_LENGTH,
  MAX_PROMPT_LENGTH,
  decodeImageDataUrl,
  isFiniteNumber,
  isImageDataUrl,
  parseCamera,
} from "./validation";

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
