/**
 * Camera marker placed by the user on the floorplan image.
 * `x` and `y` are normalized (0..1) relative to the image, origin top-left.
 * `angleDeg` is the look direction in degrees: 0 = pointing right (+x on the image),
 * positive values rotate clockwise (because the image y axis points down).
 */
export type CameraMarker = {
  x: number;
  y: number;
  angleDeg: number;
};

/**
 * Who writes the 3D scene. Only the scene step is affected: the render step
 * always goes to OpenAI, because Claude does not generate images.
 */
export const SCENE_PROVIDERS = ["openai", "anthropic"] as const;
export type SceneProvider = (typeof SCENE_PROVIDERS)[number];
export const DEFAULT_SCENE_PROVIDER: SceneProvider = "openai";

/**
 * Reasoning effort of the OpenAI scene model, cheapest first. The order is the
 * scale: the server clamps a request to the ceiling the deployment allows, so
 * entries must stay sorted from least to most expensive.
 */
export const REASONING_EFFORTS = ["low", "medium", "high", "xhigh", "max"] as const;
export type ReasoningEffort = (typeof REASONING_EFFORTS)[number];
export const DEFAULT_REASONING_EFFORT: ReasoningEffort = "medium";

/**
 * Effort of the Claude scene model (`output_config.effort`), cheapest first,
 * same scale contract as above. Kept apart from the OpenAI scale because the
 * two APIs evolve independently, even where the values currently coincide.
 */
export const CLAUDE_EFFORTS = ["low", "medium", "high", "xhigh", "max"] as const;
export type ClaudeEffort = (typeof CLAUDE_EFFORTS)[number];
export const DEFAULT_CLAUDE_EFFORT: ClaudeEffort = "medium";

/** Output quality of the image model, cheapest first (same scale contract as above). */
export const RENDER_QUALITIES = ["low", "medium", "high"] as const;
export type RenderQuality = (typeof RENDER_QUALITIES)[number];
export const DEFAULT_RENDER_QUALITY: RenderQuality = "medium";

/** Explicit render resolution in pixels, before the API's own constraints are applied. */
export type OutputSize = {
  width: number;
  height: number;
};

/**
 * Input of the 3D scene step. The description is intentionally absent: the
 * scene only has to reproduce the plan's geometry, style comes in at render time.
 */
export type GenerateRequest = {
  imageDataUrl: string;
  camera?: CameraMarker;
  /**
   * Chosen in the UI, on the scale of the provider whose route receives the
   * request. Absent (or above the server's ceiling) falls back on the server.
   */
  reasoningEffort?: ReasoningEffort | ClaudeEffort;
};

/**
 * A standing point in the 3D scene: `x`/`z` in meters (world coordinates of the
 * generated scene, floor plane) and `angleDeg` in the plan convention shared with
 * `CameraMarker` (0 = towards image right / +X, 90 = towards image bottom / +Z).
 */
export type ScenePose = {
  x: number;
  z: number;
  angleDeg: number;
};

/** A room of the plan with a good spot to stand in it. */
export type RoomSpot = ScenePose & {
  name: string;
};

export type GenerateSuccess = {
  code: string;
  summary: string;
  /** Where the user's camera marker lands in the scene (or the default spot without a marker). */
  camera: ScenePose;
  /** Every room the model identified on the plan, in reading order. */
  rooms: RoomSpot[];
};

export type GenerateFailure = {
  error: string;
};

export type GenerateResponse = GenerateSuccess | GenerateFailure;

/** Screenshot of the Three.js preview captured from the sandboxed iframe. */
export type SceneScreenshot = {
  dataUrl: string;
  width: number;
  height: number;
};

export type RenderRequest = {
  prompt: string;
  /** Main image: screenshot of the 3D preview the render must follow. */
  screenshotDataUrl: string;
  screenshotWidth: number;
  screenshotHeight: number;
  /**
   * Optional context image: the plain floorplan (no marker: the user may have
   * walked anywhere since placing it, the screenshot is the only truth about the view).
   */
  floorplanDataUrl?: string;
  /** Chosen in the UI. Absent (or above the server's ceiling) falls back on the server. */
  quality?: RenderQuality;
  /** Explicit output size. Absent means "match the framing of the 3D view". */
  size?: OutputSize;
};

export type RenderSuccess = {
  imageDataUrl: string;
};

export type RenderResponse = RenderSuccess | GenerateFailure;

/** The four screens of the flow, in order. */
export type FlowStep = 1 | 2 | 3 | 4;

/**
 * Wall clock of one model call. `startedAt` is set when the request begins,
 * `durationMs` when it ends (successfully or not); both null = never started.
 */
export type Timing = {
  startedAt: number | null;
  durationMs: number | null;
};
