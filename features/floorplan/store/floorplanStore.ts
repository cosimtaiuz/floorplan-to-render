import { create } from "zustand";
import { readAndDownscaleImage } from "@/features/floorplan/lib/imageUtils";
import type {
  CameraMarker,
  FlowStep,
  GenerateRequest,
  GenerateResponse,
  RenderRequest,
  RenderResponse,
  RoomSpot,
  ScenePose,
  SceneScreenshot,
  Timing,
} from "@/features/floorplan/types";

export type GenerationStatus = "idle" | "loading" | "success" | "error";

/** Provided by the 3D preview while it is mounted; captures its current view. */
export type SceneCapture = () => Promise<SceneScreenshot>;

export type FloorplanState = {
  step: FlowStep;

  imageDataUrl: string | null;
  /** width / height of the uploaded image, used to size the marker overlay. */
  imageAspect: number | null;
  isReadingImage: boolean;
  imageError: string | null;

  camera: CameraMarker | null;

  /** 3D scene step (the reasoning model writes Three.js code). */
  status: GenerationStatus;
  sceneTiming: Timing;
  generatedCode: string | null;
  summary: string | null;
  /** Where the 3D camera starts: the user's marker mapped into the scene by the model. */
  startCamera: ScenePose | null;
  /** Rooms identified by the model, each with a standing point for the room switcher. */
  rooms: RoomSpot[];
  /** Error coming from the API call (network, OpenAI, validation). */
  errorMessage: string | null;
  /** Error thrown by the generated code while running inside the preview iframe. */
  runtimeError: string | null;
  /** True once the preview iframe has executed the current code without errors. */
  isSceneReady: boolean;
  /** Screenshot function registered by the mounted preview, null when unmounted. */
  sceneCapture: SceneCapture | null;
  /** Where the visitor last stood in the 3D view; the preview resumes there when it comes back. */
  lastView: ScenePose | null;
  /**
   * The framing frozen when leaving the 3D scene for the render step (the 3D view
   * is not shown there). This is the image the render is made from.
   */
  sceneScreenshot: SceneScreenshot | null;
  screenshotError: string | null;

  /** Render step (the image model turns a preview screenshot into a photo). */
  prompt: string;
  renderStatus: GenerationStatus;
  renderTiming: Timing;
  renderImageDataUrl: string | null;
  renderErrorMessage: string | null;

  setStep: (step: FlowStep) => void;
  /** Reads, downsizes and stores a floorplan file; moves on to the camera step. */
  loadImageFile: (file: File) => Promise<void>;
  clearImage: () => void;
  setCamera: (camera: CameraMarker) => void;
  clearCamera: () => void;
  setPrompt: (prompt: string) => void;
  setRuntimeError: (message: string | null) => void;
  setSceneReady: (ready: boolean) => void;
  setSceneCapture: (capture: SceneCapture | null) => void;
  setLastView: (pose: ScenePose) => void;
  /** Sends floorplan + camera to the API and stores the generated Three.js code. */
  generate: () => Promise<void>;
  /**
   * Turns the frozen screenshot of the 3D view into a photorealistic render. The
   * plain floorplan and the description go along as context.
   */
  generateRender: () => Promise<void>;
  reset: () => void;
};

const NO_TIMING: Timing = { startedAt: null, durationMs: null };

/** Furthest step the user is allowed to open given what has been produced so far. */
export function maxReachableStep(
  state: Pick<FloorplanState, "imageDataUrl" | "generatedCode">,
): FlowStep {
  if (!state.imageDataUrl) return 1;
  return state.generatedCode ? 4 : 3;
}

const initialRenderState = {
  renderStatus: "idle" as GenerationStatus,
  renderTiming: NO_TIMING,
  renderImageDataUrl: null,
  renderErrorMessage: null,
};

const initialSceneState = {
  status: "idle" as GenerationStatus,
  sceneTiming: NO_TIMING,
  generatedCode: null,
  summary: null,
  startCamera: null,
  rooms: [],
  errorMessage: null,
  runtimeError: null,
  isSceneReady: false,
  lastView: null,
  sceneScreenshot: null,
  screenshotError: null,
};

const initialState = {
  step: 1 as FlowStep,
  imageDataUrl: null,
  imageAspect: null,
  isReadingImage: false,
  imageError: null,
  camera: null,
  prompt: "",
  sceneCapture: null,
  ...initialSceneState,
  ...initialRenderState,
};

async function readError(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { error?: unknown };
    if (typeof data.error === "string") return data.error;
  } catch {
    // Body was not JSON; fall through to the status code.
  }
  return `Request failed with status ${response.status}`;
}

export const useFloorplanStore = create<FloorplanState>()((set, get) => ({
  ...initialState,

  setStep: (step) => {
    const state = get();
    const max = maxReachableStep(state);
    const target = step > max ? max : step;
    // The render step does not show the 3D view, so the framing is frozen as a
    // screenshot on the way there; the render is made from that image.
    if (target === 4 && state.step !== 4 && state.sceneCapture) {
      state.sceneCapture().then(
        (shot) => set({ sceneScreenshot: shot, screenshotError: null, step: 4 }),
        (err: unknown) =>
          set({
            sceneScreenshot: null,
            screenshotError: err instanceof Error ? err.message : "Could not capture the 3D view.",
            step: 4,
          }),
      );
      return;
    }
    set({ step: target });
  },

  loadImageFile: async (file) => {
    if (!file.type.startsWith("image/")) {
      set({ imageError: "Please choose an image file (PNG, JPG or WebP)." });
      return;
    }
    set({ isReadingImage: true, imageError: null });
    try {
      const { dataUrl, width, height } = await readAndDownscaleImage(file);
      // A new plan invalidates the camera, the scene and the render made for the old one.
      set({
        imageDataUrl: dataUrl,
        imageAspect: width / height,
        camera: null,
        step: 2,
        ...initialSceneState,
        ...initialRenderState,
      });
    } catch (err) {
      set({ imageError: err instanceof Error ? err.message : "Could not read the image." });
    } finally {
      set({ isReadingImage: false });
    }
  },

  clearImage: () =>
    set({
      imageDataUrl: null,
      imageAspect: null,
      imageError: null,
      camera: null,
      step: 1,
      ...initialSceneState,
      ...initialRenderState,
    }),

  setCamera: (camera) => set({ camera }),

  clearCamera: () => set({ camera: null }),

  setPrompt: (prompt) => set({ prompt }),

  setRuntimeError: (message) => set({ runtimeError: message }),

  setSceneReady: (ready) => {
    if (get().isSceneReady !== ready) set({ isSceneReady: ready });
  },

  setSceneCapture: (capture) => set({ sceneCapture: capture }),

  setLastView: (pose) => set({ lastView: pose }),

  generate: async () => {
    const { status, imageDataUrl, camera } = get();
    if (status === "loading") return;
    if (!imageDataUrl) {
      set({ status: "error", errorMessage: "Upload a floorplan first." });
      return;
    }

    const startedAt = Date.now();
    // A new scene invalidates any render made from the previous one.
    set({
      status: "loading",
      sceneTiming: { startedAt, durationMs: null },
      errorMessage: null,
      runtimeError: null,
      isSceneReady: false,
      ...initialRenderState,
    });

    const body: GenerateRequest = { imageDataUrl, ...(camera ? { camera } : {}) };
    const finish = () => ({ startedAt, durationMs: Date.now() - startedAt });

    try {
      const response = await fetch("/api/floorplan/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        set({ status: "error", errorMessage: await readError(response), sceneTiming: finish() });
        return;
      }

      const data = (await response.json()) as GenerateResponse;
      if ("error" in data) {
        set({ status: "error", errorMessage: data.error, sceneTiming: finish() });
        return;
      }

      set({
        status: "success",
        sceneTiming: finish(),
        generatedCode: data.code,
        summary: data.summary,
        startCamera: data.camera,
        rooms: data.rooms,
        errorMessage: null,
        runtimeError: null,
        // A different scene: the old position and framing mean nothing in it.
        lastView: null,
        sceneScreenshot: null,
        screenshotError: null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unexpected error";
      set({ status: "error", errorMessage: message, sceneTiming: finish() });
    }
  },

  generateRender: async () => {
    const { renderStatus, prompt, imageDataUrl, sceneScreenshot } = get();
    if (renderStatus === "loading") return;
    if (!sceneScreenshot) {
      set({
        renderStatus: "error",
        renderErrorMessage:
          "No view of the 3D scene was captured. Go back to the 3D scene and continue again.",
      });
      return;
    }

    const startedAt = Date.now();
    set({
      renderStatus: "loading",
      renderTiming: { startedAt, durationMs: null },
      renderErrorMessage: null,
    });
    const finish = () => ({ startedAt, durationMs: Date.now() - startedAt });

    try {
      // The plain plan goes along as layout context. No marker is drawn on it:
      // the user may have walked or switched rooms since placing it.
      const body: RenderRequest = {
        prompt: prompt.trim(),
        screenshotDataUrl: sceneScreenshot.dataUrl,
        screenshotWidth: sceneScreenshot.width,
        screenshotHeight: sceneScreenshot.height,
        ...(imageDataUrl ? { floorplanDataUrl: imageDataUrl } : {}),
      };

      const response = await fetch("/api/floorplan/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        set({
          renderStatus: "error",
          renderErrorMessage: await readError(response),
          renderTiming: finish(),
        });
        return;
      }

      const data = (await response.json()) as RenderResponse;
      if ("error" in data) {
        set({ renderStatus: "error", renderErrorMessage: data.error, renderTiming: finish() });
        return;
      }

      set({
        renderStatus: "success",
        renderTiming: finish(),
        renderImageDataUrl: data.imageDataUrl,
        renderErrorMessage: null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unexpected error";
      set({ renderStatus: "error", renderErrorMessage: message, renderTiming: finish() });
    }
  },

  reset: () => set({ ...initialState, sceneCapture: get().sceneCapture }),
}));
