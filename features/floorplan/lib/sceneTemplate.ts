/**
 * Builds the HTML document that runs inside the sandboxed preview iframe.
 *
 * The iframe has its own copy of Three.js (loaded through an import map from a
 * CDN) and a small harness that creates the renderer, scene and camera. The
 * LLM-generated code is only the *body* of a function receiving those objects,
 * so it never has to deal with setup or imports.
 *
 * The harness owns the camera after the generated code has run. It drives it
 * with first-person controls so the user can move through the model like a
 * visitor:
 *
 * - "walk" mode (default): the camera is a standing person pinned at
 *   `CAMERA_EYE_HEIGHT_M` with the fixed horizontal fov shared with the marker;
 *   dragging looks around, keys / wheel / on-screen buttons move on the floor.
 * - "fly" mode: the height is free and the camera can look straight down, which
 *   gives a dollhouse view of the whole plan. Ceilings are hidden as soon as the
 *   camera rises above them.
 *
 * Exterior walls that come between the camera and what it looks at are faded so
 * the room is never hidden by its own shell. Shadows are set up automatically
 * for every directional light the generated code added.
 *
 * Errors (syntax errors, runtime exceptions, unhandled promise rejections) are
 * reported to the parent window through `postMessage`. The parent can ask for a
 * screenshot (`capture`), press/release movement actions (`input`), switch the
 * view mode (`setMode`), jump to a room (`teleport`), look at the whole plan from
 * above (`topView`) or go back to the start (`resetView`). The iframe reports its
 * mode and floor position (`view`) so the parent can highlight the room the
 * visitor is in.
 */

import { CAMERA_EYE_HEIGHT_M, CAMERA_HORIZONTAL_FOV_DEG } from "./cameraMarkerGeometry";
import type { ScenePose } from "@/features/floorplan/types";

export const THREE_VERSION = "0.185.1";
export const SCENE_MESSAGE_SOURCE = "floorplan-scene";

/** Longest side (px) of the screenshot handed to the image model. */
export const SCREENSHOT_MAX_SIZE = 1536;

/** How the camera moves: pinned at eye height, or free in the air. */
export type ViewMode = "walk" | "fly";

/** Movement actions that can be held down (keyboard or on-screen buttons). */
export const MOVE_ACTIONS = [
  "forward",
  "back",
  "left",
  "right",
  "turnLeft",
  "turnRight",
  "up",
  "down",
  "fast",
] as const;
export type MoveAction = (typeof MOVE_ACTIONS)[number];

/** Messages sent by the iframe to the parent page. */
export type SceneMessage =
  | { source: typeof SCENE_MESSAGE_SOURCE; type: "ready" }
  | { source: typeof SCENE_MESSAGE_SOURCE; type: "error"; message: string }
  | {
      source: typeof SCENE_MESSAGE_SOURCE;
      type: "view";
      mode: ViewMode;
      /** Where the visitor stands and looks (floor plane, plan angle convention). */
      pose: ScenePose;
    }
  | {
      source: typeof SCENE_MESSAGE_SOURCE;
      type: "screenshot";
      requestId: string;
      dataUrl: string;
      width: number;
      height: number;
    };

/** Messages sent by the parent page to the iframe. */
export type SceneCommand =
  | { source: typeof SCENE_MESSAGE_SOURCE; type: "capture"; requestId: string; maxSize: number }
  | { source: typeof SCENE_MESSAGE_SOURCE; type: "input"; action: MoveAction; pressed: boolean }
  | { source: typeof SCENE_MESSAGE_SOURCE; type: "setMode"; mode: ViewMode }
  | { source: typeof SCENE_MESSAGE_SOURCE; type: "resetView" }
  /** Jump to a standing point (used by the room switcher); switches back to walk mode. */
  | { source: typeof SCENE_MESSAGE_SOURCE; type: "teleport"; pose: ScenePose }
  /** Fly above the whole plan and look straight down (dollhouse view). */
  | { source: typeof SCENE_MESSAGE_SOURCE; type: "topView" };

const THREE_CDN = `https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}`;

/**
 * Embeds arbitrary text as a JS string literal that is also safe inside a
 * <script> tag: JSON.stringify escapes quotes/newlines, and replacing "</"
 * prevents a "</script>" inside the code from closing the tag early.
 */
function toScriptSafeStringLiteral(text: string): string {
  return JSON.stringify(text).replace(/<\//g, "<\\/");
}

export type SceneHtmlOptions = {
  /**
   * Where the camera starts and where "Reset view" goes (the user's marker in
   * scene coordinates). Without it the harness keeps whatever camera the
   * generated code set up.
   */
  start?: ScenePose | null;
  /** Where the visitor was the last time this scene was shown; used instead of `start` for the first frame. */
  resume?: ScenePose | null;
};

function poseLiteral(pose: ScenePose | null | undefined): string {
  return JSON.stringify(pose ? { x: pose.x, z: pose.z, angleDeg: pose.angleDeg } : null);
}

/** @param generatedCode Body of `buildScene(...)` written by the model. */
export function buildSceneHtml(generatedCode: string, options: SceneHtmlOptions = {}): string {
  const codeLiteral = toScriptSafeStringLiteral(generatedCode);
  const sourceLiteral = JSON.stringify(SCENE_MESSAGE_SOURCE);
  const actionsLiteral = JSON.stringify(MOVE_ACTIONS);
  const startLiteral = poseLiteral(options.start);
  const resumeLiteral = poseLiteral(options.resume);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  html, body { margin: 0; height: 100%; overflow: hidden; background: #0f0f10; }
  canvas { display: block; outline: none; touch-action: none; cursor: grab; }
  canvas.dragging { cursor: grabbing; }
</style>
<script>
  // Registered before the module script so parse/load errors are still caught.
  var __report = function (type, message) {
    parent.postMessage({ source: ${sourceLiteral}, type: type, message: message }, "*");
  };
  window.addEventListener("error", function (e) {
    __report("error", e.message || "Unknown error while loading the scene.");
  });
  window.addEventListener("unhandledrejection", function (e) {
    __report("error", (e.reason && e.reason.message) || String(e.reason));
  });
</script>
<script type="importmap">
{
  "imports": {
    "three": "${THREE_CDN}/build/three.module.js",
    "three/addons/": "${THREE_CDN}/examples/jsm/"
  }
}
</script>
</head>
<body>
<script type="module">
  import * as THREE from "three";
  import { OrbitControls } from "three/addons/controls/OrbitControls.js";

  const SOURCE = ${sourceLiteral};
  const MOVE_ACTIONS = new Set(${actionsLiteral});

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  document.body.appendChild(renderer.domElement);
  const canvas = renderer.domElement;
  canvas.tabIndex = 0;

  const scene = new THREE.Scene();
  // A soft daylight tone: this is what shows through windows and doors.
  scene.background = new THREE.Color(0xaebdcf);

  // Three.js takes a vertical fov; derive it so the horizontal fov matches the
  // cone drawn on the floorplan whatever the viewport aspect is.
  const HORIZONTAL_FOV_DEG = ${CAMERA_HORIZONTAL_FOV_DEG};
  function verticalFovFor(aspect) {
    const halfH = (HORIZONTAL_FOV_DEG * Math.PI) / 360;
    return (2 * Math.atan(Math.tan(halfH) / aspect) * 180) / Math.PI;
  }

  const EYE_HEIGHT = ${CAMERA_EYE_HEIGHT_M};

  const aspect = window.innerWidth / window.innerHeight;
  const camera = new THREE.PerspectiveCamera(verticalFovFor(aspect), aspect, 0.05, 500);
  camera.position.set(0, EYE_HEIGHT, 4);
  camera.lookAt(0, EYE_HEIGHT, 0);

  // Kept for the generated code, whose contract is "set controls.target and call
  // controls.update()". It never reacts to user input: the first-person
  // controller below drives the camera.
  const controls = new OrbitControls(camera, canvas);
  controls.enabled = false;
  controls.target.set(0, EYE_HEIGHT, 0);

  // ---------------------------------------------------------------------------
  // First-person controller
  // ---------------------------------------------------------------------------
  const WALK_SPEED = 2.0;      // m/s
  const FLY_SPEED = 3.5;       // m/s
  const FAST_FACTOR = 2.5;     // with Shift
  const TURN_SPEED = 1.4;      // rad/s for Q/E, arrows and the turn buttons
  const LOOK_PER_PX = 0.0035;  // rad per dragged pixel
  const PAN_PER_PX = 0.012;    // m per dragged pixel (right/middle button, two fingers)
  const WHEEL_PER_PX = 0.004;  // m per wheel pixel
  const LOOK_DISTANCE = 3;     // where controls.target sits ahead of the camera
  const WALK_MAX_PITCH = THREE.MathUtils.degToRad(70);
  const FLY_MAX_PITCH = THREE.MathUtils.degToRad(89);
  const FLY_MIN_Y = 0.3;
  const FLY_MAX_Y = 80;

  let mode = "walk";
  // yaw: rotation around +Y (0 looks towards -Z, positive turns left);
  // pitch: positive looks up.
  const pose = { yaw: 0, pitch: 0 };
  const home = { position: new THREE.Vector3(0, EYE_HEIGHT, 4), yaw: 0, pitch: 0 };
  const held = new Set();

  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();
  const move = new THREE.Vector3();
  const lookTarget = new THREE.Vector3();

  function forwardVector(out, yaw, pitch) {
    const c = Math.cos(pitch);
    return out.set(-Math.sin(yaw) * c, Math.sin(pitch), -Math.cos(yaw) * c);
  }
  function floorForward(out, yaw) {
    return out.set(-Math.sin(yaw), 0, -Math.cos(yaw));
  }
  function rightVector(out, yaw) {
    return out.set(Math.cos(yaw), 0, -Math.sin(yaw));
  }
  // Direction of travel for "forward": on the floor when walking, along the gaze when flying.
  function travelForward(out) {
    return mode === "walk" ? floorForward(out, pose.yaw) : forwardVector(out, pose.yaw, pose.pitch);
  }

  function applyPose() {
    const maxPitch = mode === "walk" ? WALK_MAX_PITCH : FLY_MAX_PITCH;
    pose.pitch = THREE.MathUtils.clamp(pose.pitch, -maxPitch, maxPitch);
    if (mode === "walk") camera.position.y = EYE_HEIGHT;
    else camera.position.y = THREE.MathUtils.clamp(camera.position.y, FLY_MIN_Y, FLY_MAX_Y);
    forwardVector(forward, pose.yaw, pose.pitch);
    lookTarget.copy(camera.position).addScaledVector(forward, LOOK_DISTANCE);
    camera.lookAt(lookTarget);
    controls.target.copy(lookTarget);
  }

  // The parent learns about the mode and where the visitor stands and looks (to
  // highlight the current room and to resume the view later). Sent on every
  // change, throttled by distance and angle.
  const reported = { mode: null, x: NaN, z: NaN, yaw: NaN };
  function postView(force) {
    const moved = Math.hypot(camera.position.x - reported.x, camera.position.z - reported.z);
    const turned = Math.abs(pose.yaw - reported.yaw);
    if (!force && reported.mode === mode && moved < 0.25 && turned < 0.03) return;
    reported.mode = mode;
    reported.x = camera.position.x;
    reported.z = camera.position.z;
    reported.yaw = pose.yaw;
    parent.postMessage({
      source: SOURCE,
      type: "view",
      mode: mode,
      pose: { x: reported.x, z: reported.z, angleDeg: planAngleFromYaw(pose.yaw) },
    }, "*");
  }

  function setMode(next) {
    if ((next !== "walk" && next !== "fly") || next === mode) return;
    mode = next;
    applyPose();
  }

  // Plan angles: 0 deg looks towards +X, 90 deg towards +Z (see cameraMarkerGeometry).
  function yawFromPlanAngle(angleDeg) {
    const rad = (angleDeg * Math.PI) / 180;
    return Math.atan2(-Math.cos(rad), -Math.sin(rad));
  }
  function planAngleFromYaw(yaw) {
    const deg = (Math.atan2(-Math.cos(yaw), -Math.sin(yaw)) * 180) / Math.PI;
    return ((deg % 360) + 360) % 360;
  }

  function isPose(p) {
    return p && Number.isFinite(p.x) && Number.isFinite(p.z) && Number.isFinite(p.angleDeg);
  }

  /** Stands the camera at a plan position, looking horizontally in the given direction. */
  function standAt(p) {
    camera.position.set(p.x, EYE_HEIGHT, p.z);
    pose.yaw = yawFromPlanAngle(p.angleDeg);
    pose.pitch = 0;
    mode = "walk";
    applyPose();
  }

  function resetView() {
    camera.position.copy(home.position);
    pose.yaw = home.yaw;
    pose.pitch = home.pitch;
    mode = "walk";
    applyPose();
  }

  /**
   * Dollhouse view: high enough above the building's centre to fit the whole
   * plan in the vertical fov, looking straight down with the plan oriented like
   * the image (image top = -Z at the top of the screen).
   */
  function topView() {
    const bounds = buildingBounds();
    if (bounds.isEmpty()) return;
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const halfVertical = (camera.fov * Math.PI) / 360;
    const halfHorizontal = Math.atan(Math.tan(halfVertical) * camera.aspect);
    const height = Math.max(
      size.z / 2 / Math.tan(halfVertical),
      size.x / 2 / Math.tan(halfHorizontal),
    ) * 1.15 + size.y;
    mode = "fly";
    camera.position.set(center.x, Math.min(FLY_MAX_Y, height), center.z);
    pose.yaw = 0;
    pose.pitch = -FLY_MAX_PITCH;
    applyPose();
  }

  /**
   * Takes over the camera after the generated code ran. When the parent gave a
   * start pose (the user's marker), it wins and becomes "home"; a resume pose
   * (where the visitor was last time) only sets the first frame. Otherwise the
   * camera's orientation is the truth (both camera.lookAt and controls.update()
   * set it); if the code put it somewhere off the ground it is brought to eye
   * height, gaze levelled.
   */
  function adoptGeneratedCamera(start, resume) {
    if (isPose(start)) {
      standAt(start);
    } else {
      camera.getWorldDirection(forward);
      pose.yaw = Math.atan2(-forward.x, -forward.z);
      pose.pitch = Math.asin(THREE.MathUtils.clamp(forward.y, -1, 1));
      if (Math.abs(camera.position.y - EYE_HEIGHT) > 1e-3) pose.pitch = 0;
      mode = "walk";
      applyPose();
    }
    home.position.copy(camera.position);
    home.yaw = pose.yaw;
    home.pitch = pose.pitch;
    if (isPose(resume)) standAt(resume);
  }

  function pan(dx, dy) {
    // "Grab the floor": dragging right slides the world right (camera goes
    // left), dragging down pulls the floor towards you (camera goes forward).
    rightVector(right, pose.yaw);
    floorForward(forward, pose.yaw);
    camera.position.addScaledVector(right, -dx * PAN_PER_PX);
    camera.position.addScaledVector(forward, dy * PAN_PER_PX);
  }

  function advance(distance) {
    camera.position.addScaledVector(travelForward(forward), distance);
  }

  let lastFrame = performance.now();
  function stepMovement() {
    const now = performance.now();
    // Capped so a tab that was in the background does not teleport the visitor.
    const dt = Math.min((now - lastFrame) / 1000, 0.1);
    lastFrame = now;
    if (held.size === 0) return;
    const speed = (mode === "walk" ? WALK_SPEED : FLY_SPEED) * (held.has("fast") ? FAST_FACTOR : 1) * dt;
    const turn = TURN_SPEED * dt;
    if (held.has("turnLeft")) pose.yaw += turn;
    if (held.has("turnRight")) pose.yaw -= turn;

    travelForward(forward);
    rightVector(right, pose.yaw);
    move.set(0, 0, 0);
    if (held.has("forward")) move.add(forward);
    if (held.has("back")) move.sub(forward);
    if (held.has("right")) move.add(right);
    if (held.has("left")) move.sub(right);
    if (mode === "fly") {
      if (held.has("up")) move.y += 1;
      if (held.has("down")) move.y -= 1;
    }
    if (move.lengthSq() > 0) camera.position.addScaledVector(move.normalize(), speed);
    applyPose();
  }

  // Pointer input: left button / one finger looks around, right or middle button
  // slides across the floor, two fingers slide and pinch to move forward/back.
  const pointers = new Map();
  let lastPinch = 0;

  function pinchDistance() {
    const [a, b] = Array.from(pointers.values());
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  canvas.addEventListener("pointerdown", (e) => {
    canvas.focus({ preventScroll: true });
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, button: e.button });
    if (pointers.size === 2) lastPinch = pinchDistance();
    canvas.classList.add("dragging");
  });
  canvas.addEventListener("pointermove", (e) => {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;
    if (pointers.size === 1) {
      if (p.button === 0) {
        pose.yaw += dx * LOOK_PER_PX;
        pose.pitch += dy * LOOK_PER_PX;
      } else {
        pan(dx, dy);
      }
    } else if (pointers.size === 2) {
      pan(dx / 2, dy / 2);
      const pinch = pinchDistance();
      advance((pinch - lastPinch) * PAN_PER_PX);
      lastPinch = pinch;
    }
    applyPose();
  });
  function releasePointer(e) {
    pointers.delete(e.pointerId);
    if (pointers.size === 0) canvas.classList.remove("dragging");
    else if (pointers.size === 2) lastPinch = pinchDistance();
  }
  canvas.addEventListener("pointerup", releasePointer);
  canvas.addEventListener("pointercancel", releasePointer);
  canvas.addEventListener("lostpointercapture", releasePointer);

  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    const scale = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1;
    advance(-e.deltaY * scale * WHEEL_PER_PX);
    applyPose();
  }, { passive: false });

  const KEY_ACTIONS = {
    KeyW: "forward", ArrowUp: "forward",
    KeyS: "back", ArrowDown: "back",
    KeyA: "left", KeyD: "right",
    ArrowLeft: "turnLeft", ArrowRight: "turnRight",
    KeyQ: "turnLeft", KeyE: "turnRight",
    KeyR: "up", PageUp: "up",
    KeyF: "down", PageDown: "down",
    ShiftLeft: "fast", ShiftRight: "fast",
  };
  window.addEventListener("keydown", (e) => {
    if (e.code === "KeyV") { setMode(mode === "walk" ? "fly" : "walk"); return; }
    if (e.code === "KeyH") { resetView(); return; }
    if (e.code === "KeyT") { topView(); return; }
    const action = KEY_ACTIONS[e.code];
    if (!action) return;
    e.preventDefault();
    held.add(action);
  });
  window.addEventListener("keyup", (e) => {
    const action = KEY_ACTIONS[e.code];
    if (action) held.delete(action);
  });
  window.addEventListener("blur", () => held.clear());

  // ---------------------------------------------------------------------------
  // Scene post-processing: see-through shell, ceilings, shadows
  // ---------------------------------------------------------------------------

  // Exterior walls that stand between the camera and the point it looks at are
  // faded so the room stays visible from outside or when backing into a wall.
  const GHOST_OPACITY = 0.12;
  const WALL_PROBE_DISTANCE = 3.5;
  // [yaw, pitch] offsets in radians from the view direction (fov is 90 deg wide).
  const WALL_PROBE_RAYS = [
    [0, 0], [-0.45, 0], [0.45, 0], [0, -0.3], [0, 0.3], [-0.45, -0.3], [0.45, -0.3],
  ];
  const raycaster = new THREE.Raycaster();
  const viewDir = new THREE.Vector3();
  const probeDir = new THREE.Vector3();
  const probeRight = new THREE.Vector3();
  const worldBox = new THREE.Box3();
  const meshBox = new THREE.Box3();
  let exteriorWalls = [];
  let ceilings = [];

  function collectMeshes(predicate) {
    const out = [];
    scene.traverse((obj) => {
      if (obj.isMesh && obj.geometry && predicate(obj)) out.push(obj);
    });
    return out;
  }

  function collectExteriorWalls() {
    const tagged = collectMeshes((m) => m.userData && m.userData.wall === "exterior");
    if (tagged.length > 0) return tagged;

    // Fallback when the generated code did not tag walls: tall meshes touching
    // the outer bounding box of the whole model are treated as exterior walls.
    const candidates = collectMeshes((m) => !m.userData || m.userData.wall === undefined);
    worldBox.makeEmpty();
    for (const mesh of candidates) worldBox.expandByObject(mesh);
    const tolerance = 0.3;
    return candidates.filter((mesh) => {
      meshBox.setFromObject(mesh);
      const height = meshBox.max.y - meshBox.min.y;
      if (height < 1) return false;
      return (
        Math.abs(meshBox.min.x - worldBox.min.x) < tolerance ||
        Math.abs(meshBox.max.x - worldBox.max.x) < tolerance ||
        Math.abs(meshBox.min.z - worldBox.min.z) < tolerance ||
        Math.abs(meshBox.max.z - worldBox.max.z) < tolerance
      );
    });
  }

  function collectCeilings() {
    const found = collectMeshes((m) => m.userData && m.userData.ceiling);
    for (const mesh of found) {
      meshBox.setFromObject(mesh);
      mesh.userData.__ceilingBottom = meshBox.min.y;
    }
    return found;
  }

  function ghostMaterialFor(mesh) {
    if (!mesh.userData.__ghostMaterial) {
      const solid = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
      const ghost = solid.clone();
      ghost.transparent = true;
      ghost.opacity = GHOST_OPACITY;
      ghost.depthWrite = false;
      mesh.userData.__solidMaterial = mesh.material;
      mesh.userData.__ghostMaterial = ghost;
      mesh.userData.__castShadow = mesh.castShadow;
    }
    return mesh.userData.__ghostMaterial;
  }

  function updateWallVisibility() {
    if (exteriorWalls.length === 0) return;
    const blocking = new Set();
    viewDir.subVectors(lookTarget, camera.position).normalize();
    raycaster.far = WALL_PROBE_DISTANCE;

    // Several rays across the field of view so a wall clipping one side fades too.
    for (const [yaw, pitch] of WALL_PROBE_RAYS) {
      probeDir.copy(viewDir).applyAxisAngle(camera.up, yaw);
      probeRight.crossVectors(probeDir, camera.up).normalize();
      probeDir.applyAxisAngle(probeRight, pitch);
      raycaster.set(camera.position, probeDir);
      for (const hit of raycaster.intersectObjects(exteriorWalls, false)) blocking.add(hit.object);
    }
    // Walls the camera is standing in or right against.
    for (const wall of exteriorWalls) {
      meshBox.setFromObject(wall).expandByScalar(0.35);
      if (meshBox.containsPoint(camera.position)) blocking.add(wall);
    }

    for (const wall of exteriorWalls) {
      const wantGhost = blocking.has(wall);
      const isGhost = wall.material === wall.userData.__ghostMaterial;
      if (wantGhost && !isGhost) {
        wall.material = ghostMaterialFor(wall);
        wall.castShadow = false;
      } else if (!wantGhost && isGhost) {
        wall.material = wall.userData.__solidMaterial;
        wall.castShadow = wall.userData.__castShadow;
      }
    }
  }

  // Ceilings disappear once the camera rises above them (fly mode), which turns
  // the model into a dollhouse without hiding anything from a standing visitor.
  function updateCeilingVisibility() {
    for (const ceiling of ceilings) {
      ceiling.visible = camera.position.y < ceiling.userData.__ceilingBottom - 0.05;
    }
  }

  // Shadows give the flat mock-up depth. Every directional light gets a shadow
  // camera fitted to the building; every opaque mesh casts and receives, except
  // ceilings: the light comes from above and would otherwise leave every room in
  // the dark.
  // Bounding box of the building: its walls when tagged, everything otherwise
  // (a big ground slab would make the box useless, so walls are preferred).
  function buildingBounds() {
    const walls = collectMeshes((m) => m.userData && m.userData.wall);
    worldBox.makeEmpty();
    for (const mesh of walls.length > 0 ? walls : collectMeshes(() => true)) worldBox.expandByObject(mesh);
    return worldBox;
  }

  function setupShadows() {
    const bounds = buildingBounds();
    if (bounds.isEmpty()) return;
    const sphere = bounds.getBoundingSphere(new THREE.Sphere());
    const radius = sphere.radius + 2;

    scene.traverse((obj) => {
      if (obj.isMesh) {
        const material = Array.isArray(obj.material) ? obj.material[0] : obj.material;
        const isCeiling = Boolean(obj.userData && obj.userData.ceiling);
        obj.castShadow = !isCeiling && !(material && material.transparent);
        obj.receiveShadow = true;
      } else if (obj.isDirectionalLight) {
        obj.castShadow = true;
        obj.target.updateMatrixWorld();
        const distance = obj.position.distanceTo(sphere.center);
        const cam = obj.shadow.camera;
        cam.left = -radius;
        cam.right = radius;
        cam.top = radius;
        cam.bottom = -radius;
        cam.near = Math.max(0.1, distance - radius);
        cam.far = distance + radius;
        cam.updateProjectionMatrix();
        obj.shadow.mapSize.set(2048, 2048);
        obj.shadow.bias = -0.0004;
        obj.shadow.normalBias = 0.02;
      }
    });
  }

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.fov = verticalFovFor(camera.aspect);
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  let sceneReady = false;
  renderer.setAnimationLoop(() => {
    stepMovement();
    updateWallVisibility();
    updateCeilingVisibility();
    renderer.render(scene, camera);
    if (sceneReady) postView(false);
  });

  // Screenshot on demand. The WebGL buffer is cleared after each frame unless
  // preserveDrawingBuffer is on (which slows every frame), so we render one
  // frame and read it back synchronously in the same tick instead.
  function captureScreenshot(maxSize) {
    renderer.render(scene, camera);
    const source = renderer.domElement;
    const scale = Math.min(1, maxSize / Math.max(source.width, source.height));
    const width = Math.max(1, Math.round(source.width * scale));
    const height = Math.max(1, Math.round(source.height * scale));
    const target = document.createElement("canvas");
    target.width = width;
    target.height = height;
    const ctx = target.getContext("2d");
    ctx.drawImage(source, 0, 0, width, height);
    return { dataUrl: target.toDataURL("image/jpeg", 0.92), width: width, height: height };
  }

  window.addEventListener("message", (event) => {
    const data = event.data;
    if (!data || data.source !== SOURCE) return;
    switch (data.type) {
      case "capture":
        try {
          const shot = captureScreenshot(Number(data.maxSize) || ${SCREENSHOT_MAX_SIZE});
          parent.postMessage({
            source: SOURCE,
            type: "screenshot",
            requestId: data.requestId,
            dataUrl: shot.dataUrl,
            width: shot.width,
            height: shot.height,
          }, "*");
        } catch (err) {
          __report("error", "Screenshot failed: " + ((err && err.message) || String(err)));
        }
        break;
      case "input":
        if (!MOVE_ACTIONS.has(data.action)) return;
        if (data.pressed) held.add(data.action);
        else held.delete(data.action);
        break;
      case "setMode":
        setMode(data.mode);
        break;
      case "resetView":
        resetView();
        break;
      case "teleport":
        if (isPose(data.pose)) standAt(data.pose);
        break;
      case "topView":
        topView();
        break;
    }
  });

  const generatedCode = ${codeLiteral};
  const startPose = ${startLiteral};
  const resumePose = ${resumeLiteral};

  // Wrapping the generated code in a function created at runtime means a
  // syntax error becomes a catchable exception instead of breaking this module.
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  try {
    const buildScene = new AsyncFunction(
      "THREE", "scene", "camera", "renderer", "controls",
      generatedCode,
    );
    await buildScene(THREE, scene, camera, renderer, controls);
    adoptGeneratedCamera(startPose, resumePose);
    exteriorWalls = collectExteriorWalls();
    ceilings = collectCeilings();
    setupShadows();
    updateWallVisibility();
    updateCeilingVisibility();
    sceneReady = true;
    postView(true);
    __report("ready");
  } catch (err) {
    __report("error", (err && err.message) || String(err));
  }
</script>
</body>
</html>`;
}
