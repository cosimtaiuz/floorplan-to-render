# Security policy

## Reporting a vulnerability

Please do **not** open a public issue for a security problem.

Report it through GitHub's private vulnerability reporting: go to the
**Security** tab of this repository and choose **Report a vulnerability**. That
opens a private advisory visible only to the maintainers.

Please include what you were able to do, the steps to reproduce it, and the
commit or version you tested. You can expect a first reply within a few days.

## Scope

This is a self-hosted application: there is no hosted service covered by this
policy, and each deployment is operated by whoever runs it. Reports about a
specific third-party deployment should go to that deployment's operator.

Things that are in scope for this repository:

- A way for a request to reach the OpenAI or Anthropic API with someone else's key, or to
  read a key from the server.
- An escape from the sandboxed preview iframe into the parent page.
- Input that reaches the OpenAI or Anthropic API without passing the validation in
  `features/floorplan/lib/validation.ts`.

## Handling API keys

`OPENAI_API_KEY` and `ANTHROPIC_API_KEY` are read only inside API route
handlers on the server and are never sent to the browser. Two properties keep it that way, and both are worth
preserving in any change:

- Every module under a `server/` folder starts with `import "server-only"`, so
  importing one from a client component fails the build rather than shipping it.
- Upstream error text from OpenAI or Anthropic is logged on the server and never returned in
  a response body, because it can name the organization, quota state or billing
  status behind the key. See `features/floorplan/server/openaiError.ts` and
  `anthropicError.ts` next to it.

Keep secrets in `.env.local`, which is git-ignored. `.env.example` documents the
variable names and must never contain real values.

## Running a public deployment

The API routes are **unauthenticated by design**: this project assumes whoever
deploys it owns the key and controls who can reach it. There is no rate
limiting, per-IP throttle or captcha in this repository.

If you expose a deployment to the public internet, every visitor can spend your
OpenAI and Anthropic credit. Put authentication, a rate limiter or a private network in front
of it first. See the "Costs and abuse" section of the README.

## Model-generated code

The scene step runs JavaScript written by a model. It executes in an
`<iframe>` with `sandbox="allow-scripts"` and no `allow-same-origin`, so it gets
an opaque origin and cannot reach the parent page, its DOM, its storage or its
cookies. Removing `sandbox`, adding `allow-same-origin`, or moving the generated
code out of the iframe would turn model output into same-origin script execution
and should be treated as a security change.
