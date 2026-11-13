# DarnIt!

A daily one-line puzzle for the Reddit Daily Games hackathon, built as a Devvit Web app
named `darnit-puzzle` (React client, Hono server, Devvit Redis); `darnit` was taken.
Players always see the name "DarnIt!". It is installed in r/DarnItGame. `SPEC.md` is the source of truth
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
6. **Use the Devvit CLI from a cloud session sparingly.** David's account was suspended
   shortly after an earlier cloud login (see `SPIKES.md`). On Nov 13, with his computer
   down, David explicitly authorised cloud sessions to run it, knowing the risk. Keep it to
   `devvit upload`, `devvit install r/DarnItGame`, and short `devvit logs` reads, only
   when shipping a change he has asked for. No long `devvit playtest` loops, no posting or
   commenting as him, and never `devvit publish`. Test on the off-Reddit page first.

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
- `npm run bank:generate`: rebuild `src/server/bank/patterns.json` (fixed seed, so the
  same code writes the same bank)
- `npm run preview:dev`: serve the off-Reddit test page locally, reachable from a phone
  on the same Wi-Fi
- `npm run preview:build`: build the test page as one HTML file in `dist/preview`

## Testing without Reddit

`src/preview` runs the real client and the real server routes together in one page, with
`@devvit/web/server` and `@devvit/web/client` swapped for local stand-ins (in-memory Redis
saved to localStorage, one pretend player). It is published for David's phone as a private
claude.ai Artifact: https://claude.ai/artifact/Mw5522wktXEUJPFJr7j8aY

To update that page: `npm run preview:build`, then
`node tools/make-test-page.mjs <file>.html`, then publish that file with the Artifact tool,
passing the URL above as `url` so the link stays the same.

The test page proves game logic and feel. It does not prove anything about Reddit's
webview, so nothing in the Day-1 spikes table can be signed off from it. Its bundle
contains the pattern solutions, which the real client must never receive.

## Layout

- `devvit.json`: entrypoints, permissions, menu items, triggers, scheduler tasks
- `src/client`: runs in an iframe on reddit.com. `splash.html` is the inline feed card,
  `game.html` is the expanded view. Add an entrypoint by adding an HTML file and mapping it
  in `devvit.json`.
- `src/server`: Hono app in Devvit's serverless runtime. `redis`, `reddit`, `context`,
  `scheduler` come from `@devvit/web/server`.
- `src/shared`: code shared by client and server. `src/shared/puzzle` holds the rules
  (`pattern.ts`), the solver, the generator and the drag logic (`stitching.ts`).
- `src/server/core`: game logic written against a small `Store` type, so it runs on
  Devvit Redis, in tests and in the test page. `src/server/routes` stays thin.
- `src/server/bank`: the generated pattern bank and the daily picker
- `src/preview`: the off-Reddit test page. Never imported by the app.
- `tools/`: TypeScript configs, the bank generator script, test helpers
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
- Relative imports carry the `.ts` or `.tsx` extension, because the unit tests run the
  source directly with Node.
- Embroidery visuals are drawn in code (SVG or Canvas). No image files, no emoji as icons.
