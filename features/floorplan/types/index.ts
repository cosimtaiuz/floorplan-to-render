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
 * Input of the 3D scene step. The description is intentionally absent: the
 * scene only has to reproduce the plan's geometry, style comes in at render time.
 */
export type GenerateRequest = {
  imageDataUrl: string;
  camera?: CameraMarker;
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
