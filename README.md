# Risenroom

**Turn a floorplan into a 3D scene and a photorealistic render.**

Upload a floorplan image, mark where a person would stand, and a reasoning model
writes the Three.js code for the whole home — every room, wall, door, window and
piece of furniture. Walk through it in first person, pick your framing, and an
image model turns that view into a photorealistic render.

Nothing is stored: refreshing the page clears everything.

## How it works

1. **Scene** — the floorplan and the camera marker go to the OpenAI Responses API
   with Structured Outputs. The model returns the body of a `buildScene()`
   function, a summary, the start camera and one standing point per room.
2. **Walkthrough** — that code runs in a sandboxed `<iframe>` with its own
   first-person controller, so model-written code can never touch the app.
3. **Render** — the 3D view is frozen as a screenshot and sent to the OpenAI
   Image API together with the plain floorplan and your description.

## Requirements

- **Node.js 20.9+** (Next.js 16 requirement)
- **pnpm** — this repo is pnpm-only: it has a `pnpm-lock.yaml`, a
  `pnpm-workspace.yaml` and a pinned `packageManager` field. npm, yarn and bun
  will either fail or silently resolve a different dependency tree.
- An **OpenAI API key** with access to the models named in
  `app/api/floorplan/generate/route.ts` and `app/api/floorplan/render/route.ts`.
  GPT Image models may require
  [API Organization Verification](https://platform.openai.com/settings/organization/general)
  on your OpenAI account first.
- A browser with **internet access** for the 3D step — see
  [Third-party runtime dependency](#third-party-runtime-dependency).

## Getting started

```bash
pnpm install
cp .env.example .env.local   # then set OPENAI_API_KEY
pnpm dev
```

Open <http://localhost:3000> and the tool is right there.

### Scripts

| Command             | What it does                       |
| ------------------- | ---------------------------------- |
| `pnpm dev`          | Development server                 |
| `pnpm build`        | Production build                   |
| `pnpm start`        | Serve a production build           |
| `pnpm test`         | Run the test suite once            |
| `pnpm test:watch`   | Tests in watch mode                |
| `pnpm lint`         | ESLint                             |
| `pnpm typecheck`    | Route typegen, then `tsc --noEmit` |
| `pnpm format`       | Format with Prettier               |
| `pnpm format:check` | Check formatting without writing   |

CI runs format:check, lint, typecheck, test and build on every pull request.

## Configuration

All values live in `.env.local`, which is git-ignored. See `.env.example`.

| Variable                     | Required | Default    | Purpose                                                     |
| ---------------------------- | -------- | ---------- | ----------------------------------------------------------- |
| `OPENAI_API_KEY`             | yes      | —          | Both floorplan routes                                       |
| `FLOORPLAN_REASONING_EFFORT` | no       | no ceiling | Highest effort a request may ask for (`low`…`max`)          |
| `FLOORPLAN_RENDER_QUALITY`   | no       | no ceiling | Highest render quality a request may ask for (`low`…`high`) |

The key is read at request time, not at build time, so `pnpm build` and the
whole test suite work without it.

**The two scale variables are ceilings, not settings.** Reasoning effort and
render quality are chosen in the UI, per generation (they default to `medium`
there), because comparing `low` against `high` on the same plan is the point of
the tool and a restart in between loses the scene you were looking at. Setting
one of these variables caps what the browser can ask for: a request above the
ceiling is clamped down to it rather than refused, so the app keeps working.
Leave them unset and the whole scale is available; a value the app does not
recognise caps at `medium`, so a typo cannot widen what a visitor may spend.

## Costs and abuse

This project is **built to be self-hosted**: it assumes whoever deploys it owns
the OpenAI key and controls who can reach the app. On that assumption the API
routes are deliberately unauthenticated, and there is no rate limiting,
per-IP throttle or captcha in this repository.

That assumption breaks the moment a deployment is reachable from the public
internet. `POST /api/floorplan/generate` and `POST /api/floorplan/render` each
cost real money per call, and both are slow enough (`maxDuration = 300`) to tie
up a function while they run. They cap request size — 6 MB images, 4000-character
prompts — but nothing stops one visitor calling them in a loop.

The parameters that set the price of a call (reasoning effort, render quality,
output size) come from the browser, so they are treated as untrusted input:
effort and quality are checked against fixed scales and clamped to the ceilings
above, and a requested size goes through the same constraints as the automatic
one (`features/floorplan/lib/outputSize.ts`), which also keeps it inside the
pixel budget. That bounds what a single call costs; it does not bound how many
calls anyone makes.

**If you put this on a public URL, put authentication, a rate limiter or a
private network in front of it first.**

## Testing

```bash
pnpm test
```

[Vitest](https://vitest.dev), with tests next to the code as `*.test.ts`. The
suite covers the framework-free modules in `features/floorplan/lib/`: request
validation, camera marker geometry, image downscaling and render output sizing.

That is a deliberate boundary. Those modules are where a silent bug costs the
most — bad geometry or a malformed image size is otherwise discovered only by
spending a real API call. Components and the 3D harness need a real browser to
tell you anything true, so they are verified by hand rather than against a
mocked DOM.

## Third-party runtime dependency

The generated scene loads **Three.js from jsDelivr at runtime**, pinned to an
exact version in `features/floorplan/lib/sceneTemplate.ts`:

```
https://cdn.jsdelivr.net/npm/three@0.185.1
```

Two consequences worth knowing:

- **The 3D step needs public internet from the browser.** It will not work
  offline, on an air-gapped network, or behind a proxy that blocks jsDelivr.
- **It is a third-party script**, so a CDN compromise would run code in the
  preview. The blast radius is limited by design: that iframe has
  `sandbox="allow-scripts"` and no `allow-same-origin`, giving it an opaque
  origin with no access to the app's DOM, storage or cookies. The version is
  pinned rather than floating, so the URL cannot silently change under you.

Serving Three.js from the app itself would remove the third party, but the
sandboxed iframe has an opaque origin, so it would need CORS headers on the
served file. That trade-off has not been made here.

## Using the tool

The flow is four steps, laid out as a single row that fills the window: the step
panel on the left, the stage (plan, 3D view or render) on the right, exactly as
tall as the panel. **Back** / **Continue** at the bottom of the panel move
between steps.

1. **Floorplan** — drop or pick a PNG/JPG/WebP plan.
2. **Camera** — click on the plan to drop a camera icon where a person would
   stand; drag the icon to move it and drag the round handle to aim it. The
   shaded cone is the camera's 90° horizontal field of view, which is exactly
   what the 3D camera uses. Optional: without a camera the model stands in the
   middle of the largest room.
3. **3D scene** — pick a **reasoning effort** and hit **Generate 3D scene**.
   Effort is how hard the model thinks about the plan: start at `low` while you
   are framing, re-run at `high` once you know what you want. The model reproduces the geometry
   of the _whole_ plan (every room, wall, ceiling, door and window, with frames
   and skirting) and furnishes each room with recognizable standard furniture
   and fixtures (legs, cushions, handles, taps, lamps…) in flat colors; no
   description is needed here. A stopwatch shows how long the call takes. The
   view starts where you put the camera, at eye height.
4. **Render** — walk to the framing you want and hit **Continue to render**: the
   3D view is frozen as a screenshot at that moment and the render step shows
   only the render itself. Describe materials, style and mood, pick a **quality**
   and a **size**, and hit **Generate render**; a second, separate stopwatch
   times the image generation. Size defaults to matching the 3D view, so the
   render keeps the framing you left it on; the explicit sizes are there when
   you need a square or a portrait. **Back** brings you to the 3D view exactly
   where you were standing, so you can reframe and render again.

### Moving around

The 3D view is a first-person walkthrough: click it, drag to look around,
`W A S D` / arrows to move (`Q`/`E` or ←/→ turn), scroll to step forward,
right-drag or two fingers to slide, `Shift` to go faster. The on-screen d-pad
does the same for mouse/touch users.

- **Walk** keeps you at eye height (1.70 m).
- **Fly** (`V`) frees the height (`R`/`F` up/down) and lets you look straight
  down at the plan like a dollhouse (ceilings hide when you rise above them).
- **Top view** (`T`) does that in one click, framing the whole plan from above.
- The buttons at the top of the view jump straight into each room the model
  found; the room you are in is highlighted.
- **Reset view** (`H`) returns to the starting camera.

The UI follows your system's light/dark preference automatically
(`prefers-color-scheme`); there is no manual toggle.

## Project layout

A standard Next.js App Router project. `app/` holds routes only; everything else
lives in a feature folder organised by role.

```
app/
  page.tsx                 the tool
  api/floorplan/generate/  POST: floorplan + camera -> Three.js code
  api/floorplan/render/    POST: screenshot + prompt -> render
features/floorplan/
  components/              React UI
  store/                   Zustand store
  types/                   shared client/server contracts
  lib/                     framework-free helpers, and their tests
  server/                  server-only prompt builders and error handling
lib/site.ts                site name and description
```

Every file under a `server/` folder starts with `import "server-only"`, and API
keys are read only inside route handlers and `server/` modules, so no secret can
reach the client bundle. Upstream OpenAI errors are logged on the server and
never returned in a response body — see
[SECURITY.md](SECURITY.md) for why both of those matter.

### The floorplan feature

- `components/` — `FloorplanPage` (layout), `StepNav` (Back / Continue), one
  `*Step.tsx` file per step (left panel), `CameraMarker`, `ScenePreview` and
  `RenderResult` (right-hand stage), `SceneOverlay` = `SceneControls` (d-pad,
  Walk/Fly, top view, reset) + `RoomSwitcher` (room buttons) drawn over the 3D
  view, `ElapsedTimer` (stopwatch), `StepHeading` ("Step n of 4" title block),
  `StagePlaceholder` (empty / loading states of the dark stage), `Spinner`,
  `ParamSelect` (the model parameters picked before a call), and `ui.ts` (shared
  class strings built on the tokens in `app/globals.css`).
- `store/` — the Zustand store (`useFloorplanStore`) with all state and actions,
  including the current step, the rooms and the two timings.
- `lib/` — iframe scene harness, iframe commands, screenshot capture, image
  utils, camera marker geometry, render output sizing, request validation.

**Scene generation.** `app/api/floorplan/generate/route.ts` sends the floorplan
and the camera to the Responses API with Structured Outputs and returns
`{ code, summary, camera, rooms }`: `camera` is the marker converted into scene
meters (where the visitor starts) and `rooms` is one `{ name, x, z, angleDeg }`
standing point per room on the plan (what the room buttons use). The prompt
(`features/floorplan/server/scenePrompt.ts`) is about completeness and accuracy:
measure the plan, list walls/openings/rooms/furniture as data, build the whole
home from the data with a fixed flat palette and a catalogue of standard
furniture builders, plus ceilings, frames, skirting and light fixtures.

**The sandbox.** The generated code is only the body of
`buildScene(THREE, scene, camera, renderer, controls)`. It runs inside an
`<iframe>` with `sandbox="allow-scripts"` and no `allow-same-origin`
(`features/floorplan/lib/sceneTemplate.ts`), so it cannot touch the app itself.
The harness derives the vertical fov from the 90° horizontal fov shared with the
marker (`features/floorplan/lib/cameraMarkerGeometry.ts`), places the camera at
the `camera` pose and then drives it with its own first-person controller (walk
at 1.70 m or fly), fades exterior walls that come between the camera and what it
looks at, hides ceilings (`mesh.userData.ceiling`) once the camera is above
them, and configures shadows for the scene's directional light. Walls are
identified through `mesh.userData.wall = "exterior" | "interior"` tags the
prompt asks for, with a bounding-box fallback when they are missing. The page
talks to the iframe with typed `postMessage` commands
(`features/floorplan/lib/sceneCommands.ts`: move, set mode, teleport to a room,
reset, capture) and the iframe reports its mode and floor position back so the
current room can be highlighted.

**Rendering.** The preview registers a screenshot function in the store while it
is mounted; leaving step 3 calls it (`postMessage`, see
`features/floorplan/lib/sceneScreenshot.ts`) and stores the frozen view, along
with the last standing position so the preview resumes there on Back. The render
step posts that screenshot, the plain floorplan and your description to
`app/api/floorplan/render/route.ts`. That route calls the Image API
(`images.edit`), using the screenshot as the main image and the floorplan as a
layout reference only (no marker is drawn on it: you may have walked anywhere
since placing it), with a prompt
(`features/floorplan/server/renderPrompt.ts`) that tells the model to keep the
camera, architecture and furniture layout exactly as-is, but to treat the boxy
mock-up furniture as placeholders (bounding volumes) and replace them with
real-looking products rather than reproducing their cubic shapes. The output
resolution follows the screenshot's aspect ratio unless an explicit size was
picked, and either way goes through the image model's constraints — edges
divisible by 16, aspect within 3:1, inside the pixel budget
(`features/floorplan/lib/outputSize.ts`).

## Deploying

Any host that runs Next.js 16 works. Three things to check:

- Both floorplan routes set `maxDuration = 300`; reasoning and image calls can
  take minutes, so a platform with a shorter function timeout will cut them off.
- Set the environment variables from the table above in the host's dashboard,
  not in a committed file.
- Read [Costs and abuse](#costs-and-abuse) before putting it on a public URL.

## Contributing

Issues and pull requests are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md)
for setup, the checks CI runs, and how the code is organised. Participation is
covered by our [Code of Conduct](CODE_OF_CONDUCT.md).

## Security

To report a vulnerability, and for how this project handles API keys and
model-generated code, see [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE) © Cosimo Taiuti
