# Day-1 spikes

Throwaway app: `spike/` (`darnit-spike`). Installed SDK: `@devvit/web` 0.15.3, Devvit CLI
0.15.3, Node 24.22. Results below are filled in from the phone checklist and from the app's
`SPIKE {...}` log lines (`npx devvit logs <subreddit> darnit-spike`).

**Status: waiting on the first playtest.** Nothing below marked "pending" has been run on
Reddit yet.

## Results

| # | Spike | Passes when | Result | Evidence |
| --- | --- | --- | --- | --- |
| 1 | Devvit CLI login and playtest from a Claude Code cloud session | The test post renders the app | Pending | Login URL issued with `--copy-paste`; waiting for the code |
| 2 | Clipboard copy on Reddit iOS, Android and desktop | A Copy tap puts the share text on the clipboard | Pending | |
| 3 | Drag performance in expanded mode on a mid-range Android | 60 fps drawing, page never scrolls | Pending | Headless Chromium only so far: 60 fps, no scroll. Says nothing about a phone |
| 4 | Scheduler posts at a fixed UTC time | Post appears within a minute of 01:00 UTC | Pending | |
| 5 | App sets user flair in its subreddit | Flair shows beside the user's name | Pending | |
| 6 | Comment as the user after consent | Comment appears (from the app owner in playtest) | Pending | |
| 7 | Bundled font in the webview | The custom font renders | Pending | Font files bundle into `dist/client` and render in headless Chromium |
| 8 | Push notifications | An opted-in account gets one that opens the post | Pending, expected to fail | Docs: gated beta, and an unpublished app can only notify its own developer |

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
`reddit.getSnoovatarUrl`, since the leaderboard depends on it.

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

### Depends on the phone results

Filled in after the playtest: clipboard method, thread rendering, scheduler accuracy and
timezone, flair, comment attribution, font.

## Setup notes

- The React template is `reddit/devvit-template-react` at commit `97a03bb`. It ships Hono
  (not Express), React 19, Vite 8 and Tailwind 4.
- `devvit publish` is never run. The template's `launch` script was removed from
  `package.json`.
- Clean-up when the spikes are settled: run the "Spike: delete all spike posts" menu action
  in the subreddit, `npx devvit uninstall <subreddit> darnit-spike`, then delete `spike/`.
