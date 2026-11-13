# Day-1 spikes

Throwaway app: `spike/` (`darnit-spike`). Installed SDK: `@devvit/web` 0.15.3, Devvit CLI
0.15.3, Node 24.22. Results below are filled in from the phone checklist and from the app's
`SPIKE {...}` log lines (`npx devvit logs <subreddit> darnit-spike`).

**Status: blocked.** The spike app was installed in r/DarnItGame on 2026-11-12 at 22:08 UTC
(v0.0.1.1). About 40 minutes later Reddit reported the owner account as banned or
suspended. David did get through part of the checklist on his phone first; those results are
below as he reported them, since the ban stopped the app's own log from being read. No
Devvit command has been run from the cloud session since. Rows marked "pending" are
untested, and none of this can be re-run until the account is restored.

## Results

| # | Spike | Passes when | Result | Evidence |
| --- | --- | --- | --- | --- |
| 1 | Devvit CLI login and playtest from a Claude Code cloud session | The test post renders the app | Worked technically, then the account was suspended. Treat as failed | `devvit login --copy-paste` logged in as the app owner and `devvit playtest r/DarnItGame` uploaded, installed and created post `t3_1xuqa0z`, all from the cloud session. Needs `NODE_USE_ENV_PROXY=1`. The account was reported banned or suspended roughly 40 minutes after this login. The cause is not confirmed, but a full-access login from a cloud datacenter address is a plausible trigger |
| 2 | Clipboard copy on Reddit iOS, Android and desktop | A Copy tap puts the share text on the clipboard | Pass on David's phone. Desktop and the other phone OS untested | David: "clipboard worked". Which of the three methods worked was not recorded |
| 3 | Drag performance in expanded mode on a mid-range Android | 60 fps drawing, page never scrolls | Pass for speed, on David's phone ("kind of okay"). No fps numbers recovered | The interaction failed: see "From David's drag test" below |
| 4 | Scheduler posts at a fixed UTC time | Post appears within a minute of 01:00 UTC | Untested | Not checked before the ban |
| 5 | App sets user flair in its subreddit | Flair shows beside the user's name | Probably pass, not confirmed by eye | David saw a notification after the first tap. Flair beside his name was not checked |
| 6 | Comment as the user after consent | Comment appears (from the app owner in playtest) | Untested | Not reported |
| 7 | Bundled font in the webview | The custom font renders | Pass | David: the two sample lines looked different on his phone |
| 8 | Push notifications | An opted-in account gets one that opens the post | Untested, expected to fail | Docs: gated beta, and an unpublished app can only notify its own developer |

## What the spike app does for each row

| # | In the app | What is measured |
| --- | --- | --- |
| 1 | The post itself | `render` report on load: client, view mode, viewport, app version |
| 2 | Card 2: three copy methods (Clipboard API, legacy `execCommand`, SDK `showShareSheet`), a paste box, and the press-and-hold fallback box. Also one copy button on the inline feed card | Which method resolved, and whether the pasted text equals the share text |
| 3 | Drag test tab: 8x8 board on Canvas 2D with the planned satin-stitch thread, pointer events, `touch-action: none` on the board only. Toggle between full stitches and a plain line | Frames per second, 95th percentile and worst frame time, share of slow frames, touch-to-frame delay, `pointercancel` count (the browser stealing the gesture), whether the webview scrolled |
| 4 | Three scheduler tasks in `devvit.json`: an every-minute tick (no post), a post at 01:00 UTC, a second fixed-time post set shortly after install. Plus a one-off job button, and a moderator menu action as the fallback | How many milliseconds after the scheduled minute each run fired |
| 5 | Card 3: `reddit.setUserFlair` with text and colours, then reads the flair back | Call result, read-back text, and David's eyes on Reddit |
| 6 | Card 4: on-screen confirm, then `reddit.submitComment({ runAs: 'USER' })`, both top-level and as a reply under a stickied app comment | Author of the created comment compared with the logged-in user |
| 7 | Card 1: Space Grotesk bundled from `@fontsource`, no network font | `document.fonts.check` plus a width comparison against the fallback |
| 8 | Card 5: `notifications.optInCurrentUser`, `isOptedIn`, `enqueue`, `requestShowGameBadge` | Each call's response or error, and whether a notification arrives |

Bonus card 7 shows the player's snoovatar from `context.snoovatar` and from
`reddit.getSnoovatarUrl`, since the leaderboard depends on it. Result: neither returned an
image for an account with no custom avatar.

## SPEC changes

### Certain already (from the SDK and current docs, no phone needed)

| SPEC.md says | The platform says | Change to SPEC.md |
| --- | --- | --- |
| Feed card: "On mobile it opens in expanded mode" | Inline views are tap and click only on every platform. `touch-action: none`, gesture capture and scrolling inside an inline post are rejection reasons | Play always runs in expanded mode, on desktop too |
| "Back before reset: today's post opens straight to Results" (a one-scroll page) | An inline post may not scroll internally | Inline shows a compact solved card (time, badge, countdown, one button). The full Results page opens in expanded mode from that button |
| "Post to comments writes the same text as a comment from the player's account" | Score comments must be a reply to a single stickied comment, unless the player adds their own message | The daily job posts and stickies one "Share your result" comment on each post. Post to comments replies under it |
| Notifications: opt-in toggle, send at reset, optional second nudge | Gated beta that needs an application and targets established games. An unpublished app can only notify its own developer. Limit once live: 2 per user per day | Cut notifications for the hackathon build, since the app is uploaded but not published. The 2-per-day cap matches the SPEC if it is ever revived |
| "Agent setup: the Devvit MCP server" | `devvit_search` downloads its index from a GitHub release, which a Claude Code cloud session cannot reach | Keep the MCP for local sessions. In cloud sessions use `llms.txt` and the SDK type definitions |
| "8x8 ... gives roughly 44 px cells on a 360 px-wide phone" | With a 14 px hoop and 12 px page margin the spike board measures 39 px cells at 360 px | Say "about 39 px". Button numbers still fit at 16 px |
| App named darnit, set up by scaffolding | App names are registered in the web wizard at developers.reddit.com/new, not by the CLI. The name is also the app account's username (3 to 20 characters, lowercase letters, digits, hyphens) | If `darnit` is taken, the app slug changes. Players still see "DarnIt!" |
| Not mentioned | Node 24 is required by the template and docs | Add to the agent setup line |
| Not mentioned | `permissions.journeys: true` must be set in `devvit.json` for Journeys telemetry | Add to the Journeys section |
| Leaderboard rows show snoovatars | `context.snoovatar` covers the current player only. Other players need `reddit.getSnoovatarUrl(username)`, one call each | Store each solver's snoovatar URL in Redis at solve time and read rows from there |

### From David's drag test

| SPEC.md says | What happened | Change to SPEC.md |
| --- | --- | --- |
| "Drag back over the thread to unpick it to that point" | When the thread's head touched any earlier part of the thread, everything after that point was cut. David: "terrible UX" | While dragging, the thread only unpicks one cell at a time, when the finger moves back onto the cell just behind the head. Touching any other part of the thread does nothing. Cutting back to an earlier cell needs a deliberate tap on it |
| Leaderboard rows and the feed card show snoovatars | Neither `context.snoovatar` nor `reddit.getSnoovatarUrl` returned an image for David's account, which had no custom avatar | Always draw a stitched placeholder avatar in code, and show the snoovatar only when one exists |

### From building the generator and the play screen

| SPEC.md says | What was built | Change to SPEC.md |
| --- | --- | --- |
| "Redis holds the pattern bank" | The bank is a JSON file bundled with the server (90 patterns, 24 KB). Redis holds only which pattern ran on which day | Say the bank ships in the server bundle. Nothing to seed, and nothing is generated inside a request |
| "Tap any earlier thread cell to cut back to it" | Kept, but only on a clean tap: press and release on the same cell. Pressing and then moving does nothing | Add "a clean tap" |
| Rules list does not say what happens when a player steps on a button out of order | The step is refused, like stepping across a seam | Add it to Core rules |
| Cross-stitch placement: interior only, never on a button | Also kept apart from each other (not touching, even diagonally), and placed so the two checkerboard colours balance; otherwise no thread can exist | Add both to the cross-stitch constraints |
| Difficulty score calibrated against David's times | Score is computed, but its weights are a first guess and no pattern is rejected on it yet | Unchanged. Calibration still needs David's 20 boards per tier |

### From David's play test on the test page (Nov 13)

| SPEC.md said | What happened | Change |
| --- | --- | --- |
| Cross-stitch cell: a faint printed X | After the first pass the wool covered it and David could not tell where it was | Ink ring and chevrons drawn on top of the wool after the first pass (SPEC.md updated). David later decided to keep cross-stitch (Nov 13) |
| Board: aida cloth in a hoop | The grid was not obvious | Pencil grid with pricked holes on white paper (SPEC.md updated) |
| Drag | "Not so bad, but not the best" | The board now applies steps itself and redraws in the same frame, the wool follows the finger, cells change only once the finger is a fifth of a cell past the edge, and phones that allow it give a short vibration per stitch |
| Dark mode is indigo denim | David wants a white background | The game is always white paper (SPEC.md updated) |

### From building the Results page and onboarding (Nov 13)

| SPEC.md says | What was built | Change to SPEC.md |
| --- | --- | --- |
| Heatmap: "each finished run uploads a compressed move log ... the server aggregates per-cell unpick counts" | Each finished run sends only the squares the player unpicked back to; the server de-duplicates them, counts each player once per square, and ignores out-of-range squares | Move logs arrive with Race the fastest (P1). The heatmap does not need them |
| Leaderboard rows show snoovatars | A snoovatar when Reddit gives one, otherwise a coloured circle with the player's initial and a stitched ring | Already noted under the spikes: most players have no snoovatar |
| Stall nudge "if a new player hasn't stitched within 20 s" | Applies to every player: after 20 s with no stitch, button 1 pulses until the first stitch | Drop "new" |
| Results are reached after the solve moment | The finished thread stays on screen for 1.6 s, then the Results page replaces the play screen. Reopening a solved post goes straight to Results | Solve animation (thread tightens, board shrinks into a quilt square) is still to do in the visual pass |
| Personal quilt squares: "that day's pattern sewn in your thread colour" | Sewn as a simple line in wool red; unlockable colours are P2 | None |

### From David's play test of the Results page and onboarding (Nov 13)

| Feedback | What changed |
| --- | --- |
| The mixed real buttons look wrong; prefers the plain black circles on the heatmap | Game buttons are plain black circles with white numbers, a red ring once reached (SPEC.md updated) |
| The drag no longer feels good | Measured: with the CPU slowed to mid-range-phone speed, the worst frames during a drag took 350 to 480 ms, because every stitch redrew the whole thread with all its fuzz plus every button. The board now keeps the paper and older wool cached, redraws only the newest few stitches, and redraws buttons only when one is reached. Same test after: worst frame 67 ms, typical stitch 2 ms |
| Remove the needle | Removed, at rest and while dragging (SPEC.md updated) |
| No pointing hand in the practice board; let the grid show the way | The next three squares light up orange with arrows; a wrong turn outlines the square to unpick back to (SPEC.md updated) |
| Landing on the practice board and the Results page cold made little sense | The practice board opens with one line on the goal. Every Results section has a one-line explanation, and the heatmap is now "Today's trickiest spot", drawn over the day's solution so the orange squares read as places on the route |
| The heatmap feels useless | Reworked as above. After seeing the rework, David decided to keep it (Nov 13) |

### From the account suspension

| SPEC.md says | What happened | Change to SPEC.md |
| --- | --- | --- |
| Day-1 spike: log in and playtest from a Claude Code cloud session | The owner account was suspended shortly after the cloud login | Take the fallback: run `devvit login`, `upload` and `playtest` only on David's machine. The cloud session writes code and reads results David pastes back |
| App named darnit | `darnit` is already registered by someone else | Pick another slug, for example `darnit-game`. Players still see "DarnIt!" |

### Depends on the phone results

Filled in after the playtest: clipboard method, thread rendering, scheduler accuracy and
timezone, flair, comment attribution, font.

## Setup notes

- The React template is `reddit/devvit-template-react` at commit `97a03bb`. It ships Hono
  (not Express), React 19, Vite 8 and Tailwind 4.
- In a cloud session the Devvit CLI must run with `NODE_USE_ENV_PROXY=1`. Without it the
  login fails with "HTTP error 403: Forbidden" because Node's fetch skips the session proxy.
- Cloud containers restart when idle, which kills a waiting `devvit login` prompt and a
  running `devvit playtest`. The installed app version stays on the subreddit.
- The first upload of a new app auto-creates a private test subreddit
  (`r/darnit_spike_dev`) even when a playtest subreddit is given. It is unused.
- `devvit publish` is never run. The template's `launch` script was removed from
  `package.json`.
- Clean-up when the spikes are settled: run the "Spike: delete all spike posts" menu action
  in the subreddit, `npx devvit uninstall <subreddit> darnit-spike`, then delete `spike/`.
