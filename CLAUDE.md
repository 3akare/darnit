# DarnIt!

A daily one-line puzzle for the Reddit Daily Games hackathon, built as a Devvit Web app
named `darnit` (React client, Hono server, Devvit Redis). `SPEC.md` is the source of truth
for what to build. `SPIKES.md` records what the platform actually allows.

## Rules

1. **Follow SPEC.md.** Use its vocabulary in UI text and in code names: Pattern, Thread,
   Button, Seam, Unpick, Fabric (inside a hoop). Where the installed Devvit SDK or the
   current Devvit docs disagree with SPEC.md, trust the SDK, and write the difference down
   under "SPEC changes" in `SPIKES.md`. Never diverge silently.
2. **Build in P0 order.** Work through the P0 list in SPEC.md's Scope section top to bottom.
   Nothing in P1 starts until P0 works on a real phone. P2 only if time allows.
3. **Never run `devvit publish`**, or anything that wraps it. The app is uploaded and
   playtested, never published. The template's `launch` script was removed for this reason;
   do not add it back.
4. **Every generator or solver change needs tests.** Add or update the tests in the same
   change and run `npm run test:unit` before committing. The bank tests (every pattern is
   solvable, unique, and obeys the cross-stitch rule) must pass.
5. **No screen is done until David approves a phone screenshot.** A desktop or headless
   render does not count. When a screen is ready, ask David for a real phone screenshot and
   wait for his approval before ticking it off or calling it done.

## Commands

Node 24 is required (`.nvmrc`). In Claude Code cloud sessions run
`export PATH=/opt/node24/bin:$PATH NODE_USE_ENV_PROXY=1` first. The default there is
Node 22, and without `NODE_USE_ENV_PROXY=1` every Devvit CLI network call fails with
"HTTP error 403: Forbidden", because Node's fetch bypasses the session proxy.

- `npm run dev`: playtest on Reddit (`devvit playtest`), rebuilding on save
- `npm run build`: build client and server with Vite
- `npm run test:types`: typecheck (`tsc --build`)
- `npm run lint`: ESLint
- `npm run test:unit`: unit tests (`node --test` over `src/**/*.test.ts`)
- `npm run deploy`: typecheck, lint, then `devvit upload` (private upload, not a publish)
- `npx devvit login --copy-paste`: log in from a session with no local browser

## Layout

- `devvit.json`: entrypoints, permissions, menu items, triggers, scheduler tasks
- `src/client`: runs in an iframe on reddit.com. `splash.html` is the inline feed card,
  `game.html` is the expanded view. Add an entrypoint by adding an HTML file and mapping it
  in `devvit.json`.
- `src/server`: Hono app in Devvit's serverless runtime. `redis`, `reddit`, `context`,
  `scheduler` come from `@devvit/web/server`.
- `src/shared`: types shared by client and server
- `spike/`: throwaway app (`darnit-spike`) for the Day-1 spikes. Never import from it.
  Delete it once `SPIKES.md` is settled.

## Platform constraints (checked against @devvit/web 0.15.3)

- Inline views are tap and click only. No `touch-action: none`, no `preventDefault` on
  touch or wheel, no scrolling inside the post. Drag drawing and anything that scrolls
  belong in expanded mode, opened with `requestExpandedMode` from a real tap.
- The server bundle must be CommonJS. Requests time out at 30 s, so pattern generation
  never runs inside a request.
- The client never receives a pattern's solution. Hints come one step at a time and the
  server validates every submission.
- Every menu, form, trigger and scheduler endpoint starts with `/internal/` and must be
  registered in `devvit.json`.
- No `window.alert` or `confirm` (use `showToast`, `showForm`, or our own UI), no
  `window.location` (use `navigateTo`), no inline `<script>` in HTML files.
- Devvit Web only. Do not use `@devvit/public-api` or Blocks code, even if docs show it.

## Docs

- Devvit MCP server (`.mcp.json`): `devvit_search`. In cloud sessions it cannot download
  its index; fall back to `https://developers.reddit.com/docs/llms.txt` and fetch the `.md`
  page you need.
- The type definitions in `node_modules/@devvit/*` are the final word on what the SDK does.

## Code style

- Type aliases over interfaces, named exports over default exports, no type casts.
- Embroidery visuals are drawn in code (SVG or Canvas). No image files, no emoji as icons.
