# DarnIt! — Game Spec (Reddit Daily Games Hackathon)

Nov 12, 2026 · @David Bakare

## Summary

DarnIt! is a daily one-line puzzle on Reddit: sew one thread through numbered buttons, in order, filling every cell of the fabric. The twist is cross-stitch cells, where the thread must cross itself. Each solved day becomes a square in your own quilt and in the subreddit's shared quilt, and after solving you see where today's players went wrong.

Target: Best Daily Game ($15,000). An honorable mention ($1,000) is the floor. The four criteria are equally weighted and ties go to Delightful UX ([rules](https://redditgameofday2026.devpost.com/rules)).

| Criterion | How DarnIt! covers it |
| --- | --- |
| Delightful UX | Lag-free drag drawing, a 10-second first-time guide, one clean results screen |
| Polish | Embroidery look drawn in code, tested on iOS, Android and desktop Reddit |
| Reddit-y | Shared subreddit quilt, wrong-turn heatmap, comments as the discussion space, streak flair, snoovatars |
| Daily Content | One generated pattern per day at random difficulty, each verified to have exactly one solution |

## Name and identity

The game is called DarnIt! Darning is mending fabric with thread, which fits the unpick mechanic, and it is what players will mutter when they get stuck.

Subreddit names can't contain "!", so the demo subreddit uses a variant such as r/DarnItGame. Check it is free before creating it.

Rules for identity: no LinkedIn name, colours, layout or icons. No Reddit, Snoo or karma theming inside the game, since Reddit marks on-the-nose theming down. Players see the name DarnIt! everywhere, with the exclamation mark.

In-game vocabulary, used everywhere:

| Generic term | DarnIt! term |
| --- | --- |
| Puzzle | Pattern |
| Path | Thread |
| Numbered dot | Button |
| Wall | Seam |
| Backtrack | Unpick |
| Grid | Fabric, inside a hoop |

## Core rules

The player sews one thread from button 1 to the last button, passing every button in order and filling every cell.

1. Start on button 1. Move one cell at a time: up, down, left or right.
2. Pass the buttons in number order and finish on the highest one.
3. Fill every cell exactly once, except cross-stitch cells. Before the first stitch the status line says so ("Join 1 to 9 in order and fill every square."). If the thread reaches the last button with squares left, the status line says how many are empty and the board hatches them until the player unpicks.
4. Seams (thick stitched lines between cells) block movement.
5. Cross-stitch cells, marked with a faint X, must be passed twice: once horizontally and once vertically, straight through both times. They are the only place the thread may cross itself.

Why the twist matters: a cross-stitch cell forces straight runs through it in both directions, so all four of its neighbours are on the thread and the board splits into regions that must connect in a fixed way. That creates deductions Zip doesn't have, while the rule still fits in one picture.

Constraints on cross-stitch cells:

- Interior cells only, never on the border, since they need all four neighbours.
- Never on a button.
- None on easy days, 1–2 on medium, 2–3 on hard.

Every daily pattern has exactly one solution, so any valid fill is the solution and the client can check completion without knowing the answer.

## Daily cycle and difficulty

A new pattern goes live every day at 02:00 Lagos time (01:00 UTC, 20:00 New York, 17:00 Los Angeles), the same moment for everyone.

- At reset, a scheduled job creates one new post titled "DarnIt! #N · date". That post is the game of the day, and its comments are the discussion.
- Opening today's post after solving shows your results, not a fresh board, with a countdown to the next pattern.
- Older posts stay playable for practice but never count toward leaderboards or streaks. They show "Closed — play today's pattern" with a button that jumps to today's post.
- Difficulty is random each day, not tied to the weekday: 40% easy, 40% medium, 20% hard, with no more than two hard days in a row.
- The launch screen shows difficulty as one to three needles.

| Difficulty | Grid | Buttons | Seams | Cross-stitch cells | Target solve (experienced player) |
| --- | --- | --- | --- | --- | --- |
| Easy | 5×5 to 6×6 | 6–10 | None or few | 0 | 10–40 s |
| Medium | 6×6 to 7×7 | 8–13 | Some | 1–2 | 40–90 s |
| Hard | 7×7 to 8×8 | 10–16 | Many | 2–3 | 2–5 min |

Targets are anchored to David's Zip times: 5 s fastest, about 1 min on average, about 5 min at worst. 8×8 is the ceiling, because it gives roughly 44 px cells on a 360 px-wide phone.

## Controls

Drawing must never lag: input lag is the thing David dislikes most about Zip, and fiLLr's team called touch controls their hardest problem.

- Drag from the thread's end to extend it. On a fast swipe that skips cells, fill the skipped cells along the run as long as each step is legal.
- Drag back over the thread to unpick it to that point. Tap a cell next to the thread's end to extend by one. Tap any earlier thread cell to cut back to it.
- Use pointer events with touch-action: none so the page never scrolls during play. Target 60 fps on a mid-range Android phone.
- Undo removes the last cell. Reset clears the thread with no confirmation.

Hint, matching Zip's behaviour:

- If the thread contains a mistake, unpick back to the last correct cell, then flash the next correct step.
- If the thread is correct so far, flash the next correct step.
- Hints come from the server one step at a time, so the full solution never sits in the client.
- Cooldown: the hint button is disabled for 5 s after each use, shown as a ring filling around it. Without this, spamming hints beats honest solving on a time-only leaderboard.

What counts as an unpick:

- One continuous retreat: a drag back, a run of back-to-back undos, a tap that cuts the thread, or a reset. Dragging back ten cells in one motion is one unpick.
- Hint-triggered rewinds don't count, because hint users get no badge anyway.

## Scoring, badges and leaderboard

Rank is by time only; badges just describe how clean the solve was. Time is measured by the server from the first stitch to the final valid submission, and the on-screen clock is display only. Only your first completion of today's pattern counts.

| Hints used | Unpicks | Badge shown |
| --- | --- | --- |
| Yes | Any | None |
| No | 0 | Flawless |
| No | 1–2 | No hints · 1 unpick (or 2 unpicks) |
| No | 3 or more | No hints |

Leaderboard, scoped to the game's subreddit (Reddit has no friends list an app can read):

- Today tab: top 10 rows of rank, snoovatar, username, badge and time. Your own row is pinned and highlighted if you're outside the top 10.
- Streaks tab: longest current streaks.
- Percentile line under your row: "You were faster than 75% of r/DarnItGame today." With fewer than 5 solvers, show rank instead: "2nd of 4 today."

Share text must be copyable. It never shows the path, so it can't spoil:

```
DarnIt! #14 · 0:48
Faster than 75% of r/DarnItGame today
Flawless · 12-day streak
```

- Copy button writes this to the clipboard. If Reddit's in-app browser blocks clipboard access, fall back to the same text in a selectable box with "Press and hold to copy". Spike on day 1.
- Post to comments writes the same text as a comment from the player's account, only after they confirm on screen. It is never required to keep playing ([user actions rules](https://developers.reddit.com/docs/capabilities/server/userActions)). During playtest these comments post from the app account unless the app owner triggers them.

## Screen flow

Four screens plus a return state, one results page, nothing extra during play.

1. **Feed card** (inline launch screen): pattern number, date, difficulty needles, "142 people stitched today" with the last five solvers' snoovatars, your streak, and one Start stitching button. On mobile it opens in expanded mode.
2. **Play screen**: timer and Reset at the top, the board in its hoop, Undo and Hint under it, and a collapsed How to play with two mini drawings (buttons in order; the cross-stitch rule). Nothing else on screen.
3. **Solve moment**, about 1.5 s: the thread tightens, the buttons glint, and the board shrinks into a quilt square that flies into your quilt.
4. **Results**, one scroll, in this order:
   1. Solve card: "#14 stitched in 0:48", badge, percentile line, Copy and Post to comments.
   2. Leaderboard, Today and Streaks tabs.
   3. Crowd replay: the wrong-turn heatmap, then Race the fastest.
   4. Stats: plays, best time, current streak, max streak, and the next streak milestone.
   5. Your quilt, with today's square just added.
   6. The subreddit quilt, with today's square stitched in.
   7. Discuss today's pattern, which opens the comments, plus the reminder toggle if notifications ship.
5. **Back before reset**: today's post opens straight to Results, topped with "Next pattern in 6 h 12 min".

## Streaks, flair and quilts

A streak counts consecutive days on which you solved that day's pattern before the next reset; missing a day resets it to 0. Both quilts make the streak and the community visible at a glance.

| Streak | Reward |
| --- | --- |
| 3 days | A new thread colour |
| 7 days | Flair: Apprentice; a hoop frame on your quilt |
| 30 days | Flair: Journeyman; another thread colour |
| 50 days | Flair: Master; gold thread |
| 100 days | Flair: Grand Master; gold quilt border |

Flair text carries the count, for example "Journeyman · 34", and is set by the app in the game's subreddit. Verify the app can set flair on day 1.

Personal quilt:

- One square per day since your first play, seven to a row so each row is a week.
- Solved days show that day's pattern sewn in your thread colour. Missed days show plain, unstitched fabric, so a streak reads as an unbroken run.
- Tap a square to see that day's time and badge.

Subreddit quilt:

- One square per day since launch. Each square is that day's pattern, sewn in a colour set by its difficulty, with the number of solvers stitched in the corner.
- Shown on the results screen and reachable from the feed card.
- Daily posts start by Nov 25, so the quilt holds about two weeks of squares when judging opens on Dec 9.

## Crowd replay

Crowd replay replaces Zip's solution video and only unlocks after you finish, so it never spoils. It is the main Reddit-y feature and must look alive with only a handful of players, because judges play in a subreddit under 200 members.

- **Wrong-turn heatmap:** the board tinted by how often players unpicked from each cell today, with a caption naming the hottest spot: "3 of 7 players unpicked at button 4." Counts, not percentages, while fewer than 20 have played.
- **Race the fastest:** your thread and today's fastest thread draw side by side at their real pace, replayed from move logs. With fewer than 3 solvers, you race the pattern's own solution at an average pace.
- **Data:** each finished run uploads a compressed move log (cells added and removed, with timestamps). The server aggregates per-cell unpick counts into one heatmap per day.

## Onboarding

First-time players get one guided board; after that the game gets out of the way.

- **First play ever:** a 4×4 practice pattern before today's. A hand points to each next cell in turn until the thread reaches the last button. A Skip button is always visible.
- **Then today's pattern**, with no guidance: just 1, 2, 3.
- **First board with a cross-stitch cell:** a 3-second looping animation of thread crossing straight through, shown once over the board. Tap anywhere to dismiss.
- **Stall nudge:** if a new player hasn't stitched within 20 s, button 1 pulses. No text walls anywhere.
- Stored per user: tutorial done, cross-stitch intro seen.

## Notifications

Build last and cut if time runs out: judges score from the demo post over one week, so notifications barely move the score.

- Opt-in toggle on the results screen: "Remind me when the next pattern drops."
- At reset (01:00 UTC), opted-in players get "Pattern #15 is ready", which opens today's post.
- Optional second nudge at 03:00 UTC for opted-in players who haven't played yet, if platform limits allow.
- Titles stay at or under 60 characters and bodies at or under 100. The capability is experimental, so spike it first.

## Visual direction

A sketchbook page with real craft materials on it: red wool stretched across white paper and held down with clear tape, black buttons, an embroidered logo. High-definition and tactile, colourful, strong and sharp. Everything is drawn in code (SVG or Canvas), with no image files. (Direction set by David on Nov 13, replacing the hoop-and-aida look.)

Materials:

- **Paper:** white sketchbook paper with a fine grain, faint fibres and specks, and a steel ring binding along the top, coming out of punched holes. One look in every system theme: the game is always on white paper, with no dark mode.
- **Board:** a pencil grid drawn straight onto the paper, clearly visible, with a hole pricked through the paper at every grid corner, like paper embroidery.
- **Thread:** red wool about a third of a cell wide: round shading, twisted plies, fine fibres and loose fuzz, and a soft shadow on the paper. Its cut end at button 1 is frayed and taped down with a strip of clear tape; the last end gets taped when the pattern is solved. While dragging, the wool lifts off the page and follows the finger, with a steel needle at its end.
- **Buttons:** real buttons, mixed like a tin of odd ones: round, square, scalloped flower, hexagon and domed brass shank shapes, in navy, mustard, wood, mother-of-pearl, green, black, red and purple. Raised rim, dished centre, thread holes above and below the number so they never cover it. The same pattern always gets the same buttons. When the wool reaches one, a thin strand of wool rings it.
- **Seams:** black thread in a running stitch along the cell edge, much heavier than the pencil grid.
- **Cross-stitch cells:** a pencil X in a dashed pencil ring. After the first pass, a dashed ink ring and two ink chevrons are drawn on top of the wool, pointing along the pass still owed, so the cell never disappears under the thread. On the second pass the wool crosses over the first strand.
- **Logo:** embroidered varsity lettering, like a college hoodie: "DARNIT!" in heavy slab capitals (Alfa Slab One) on a gentle arch, each letter a satin-stitch fill in its own colour (red, marigold, green, teal, cobalt, magenta, orange), with a cream twill outline, a dark edge and a raised shadow. Players still read the name as DarnIt!.
- **Controls:** embroidered patches: a solid colour with a satin texture, a dashed stitched border and a raised shadow. Undo is cobalt, Hint is magenta, Reset is black, Start stitching is wool red.
- **Results:** a paper note taped over the page.

| Role | Colour |
| --- | --- |
| Paper | #FCFBF8 with grain |
| Text and ink | #16151A |
| Pencil | #5B6070 |
| Wool | #CC1A2E, shading from #A3101F to #F25A66 |
| Patches | Cobalt #2F5BEA, magenta #C0247A, black #1C1B20, wool red #CC1A2E |
| Logo | #E11D48, #F59E0B, #16A34A, #0891B2, #2F5BEA, #C026D3, #EA580C |
| Unlockable wool colours | Marigold, teal, cobalt, magenta, leaf |

All text meets 4.5:1 contrast, and button numbers stay at least 16 px on an 8×8 board on a 360 px-wide phone.

Type: Space Grotesk for everything, with tabular numbers; Alfa Slab One for the logo only. Both bundled with the app rather than loaded from Google.

Scale: the board takes about 90% of the screen width with paper showing round it, so the page never feels pressed against the face.

Motion:

- New cell: the stitch pulls through in 80 ms with a small scale pop.
- Button reached: a 200 ms X-stitch sewing animation.
- Unpick: stitches loosen and fade in 120 ms.
- Solve: the thread tightens, every button glints, and the board shrinks into a quilt square; 1.5 s total, no confetti.
- Honour prefers-reduced-motion.

Anti-AI-slop rules, since Reddit marks obvious AI output down:

- No default component-library look: no generic cards, gradients, glassmorphism or emoji as icons.
- One custom icon set (undo, hint, reset, copy, share) drawn as stitched outlines.
- Everything fits the viewport with no scrolling during play.
- David reviews every screen as a real phone screenshot before it counts as done.

David can add 3–5 Pinterest references of modern embroidery; where they clash with this section, the references win.

## Platform and architecture

&#91;embedded content: system architecture · 6 parts\]

The client never receives the solution: hints arrive one step at a time and the server checks every submission, so the leaderboard can't be faked.

- Devvit hosts the client, the server and Redis; there is no Cloudflare, Postgres or separate backend. Requests time out at 30 s, so generation never runs inside a request.
- Client: React for screens and Canvas 2D for the board. A game engine like Phaser isn't needed for a grid; Claude Code can change this after the drag-performance spike.
- Redis holds the pattern bank, today's post-to-pattern map, each player's run for the day (start, finish, hints, unpicks, move log), a leaderboard sorted set per day, per-player stats and streaks, and per-day heatmap counts.
- Anti-cheat: the server stamps start and finish, rejects solves faster than 0.08 s per cell, and ranks only each player's first finished run per day.
- Agent setup: the Devvit MCP server (npx -y @devvit/mcp), the Devvit docs index (llms.txt), and this spec saved as SPEC.md in the repo root.

## Puzzle generator and solver

Patterns are generated offline into a bank; the solver proves each has exactly one solution and scores its difficulty.

Generator:

1. Pick grid size and cross-stitch count for the chosen difficulty.
2. Place cross-stitch cells on interior cells.
3. Build a random thread that fills every cell once and passes each cross-stitch cell twice, straight through both ways. Claude Code chooses the method, for example random backbite moves on a full-board path with crossings spliced in.
4. Put button 1 and the last button on the thread's ends, then add buttons along it.
5. Add seams the thread never crosses.
6. Run the solver. If there is more than one solution, add a button or seam where the solutions split and check again until unique.
7. Remove buttons and seams one at a time while the solution stays unique, down to the target count.

Solver:

- Depth-first search with pruning: a free cell with fewer than two open neighbours must be an end, never cut the board into two regions, keep button order, and enforce the cross-stitch straight-through rule.
- Stops at two solutions, which means not unique.
- Difficulty score from search effort, the share of forced moves, and the longest stretch with no forced move. Calibrate by having David play 20 boards per tier and comparing his times to the targets.

Bank:

- At least 60 days of patterns, generated ahead and stored with an id each. The daily job picks by the weighted random rule and never repeats a pattern.
- The stored solution powers hints, the heatmap and the race replay.
- Tests: every bank pattern is solvable, unique and obeys the cross-stitch rule; the solver passes against hand-made boards.

## Analytics with Devvit Journeys

Instrument the play loop with Devvit Journeys, which Reddit lists as a stand-out item ([hackathon page](https://redditgameofday2026.devpost.com/)).

| Event | Fires when |
| --- | --- |
| App.Ready | Board and fonts have loaded |
| Journey.Start | First stitch on today's pattern |
| Journey.Progress | Each button reached; progress = button number ÷ last button |
| Journey.Interaction | Hint, undo, reset, copy, post to comments, quilt opened |
| Journey.End | Pattern solved |

Playtest builds don't record Journey events and return JOURNEY\_RECEIPT\_DENIED\_PLAYTEST, which is expected, not a bug ([example](https://github.com/victorlap/reddit-suika/pull/4)). Telemetry is rate limited, so never fire an event per cell.

## Scope

P0 is the core loop plus the Reddit-y layer; nothing in P1 starts until P0 works on a real phone.

P0, must ship:

- [ ] Generator, solver and a 60-day pattern bank
- [ ] Daily scheduled post at 01:00 UTC
- [ ] Lag-free drawing, Undo, Reset, Hint with cooldown
- [ ] Server timing and path validation
- [ ] Results card with badges and copyable share text
- [ ] Today leaderboard with the percentile line
- [ ] Streaks and stats
- [ ] Personal quilt and subreddit quilt
- [ ] Wrong-turn heatmap
- [ ] First-time guided board and cross-stitch intro
- [ ] Full embroidery visual pass, light and dark

P1, should ship:

- [ ] Race the fastest
- [ ] Streak flair
- [ ] Post to comments
- [ ] Journeys events
- [ ] Streaks leaderboard tab

P2, only if time allows:

- [ ] Notifications
- [ ] Unlockable thread colours
- [ ] Practice play on old posts

## Day-1 spikes

Verify these on a throwaway app before building anything else; each one changes the design if it fails.

| Spike | Passes when | If it fails |
| --- | --- | --- |
| Devvit CLI login and playtest from a Claude Code cloud session | The test post renders the app | Run playtests on David's machine |
| Clipboard copy on Reddit iOS, Android and desktop | A Copy tap puts the share text on the clipboard | Selectable text box fallback |
| Drag performance in expanded mode on a mid-range Android | 60 fps drawing, page never scrolls | Simplify thread rendering |
| Scheduler posts at a fixed UTC time | Post appears within a minute of 01:00 UTC | Moderator menu action to post manually |
| App sets user flair in its subreddit | Flair shows beside the user's name | Show tiers in-game only |
| Comment as the user after consent | Comment appears (from the app owner in playtest) | Copy-only sharing |
| Bundled font in the webview | The custom font renders | System font stack |
| Push notifications | An opted-in account gets one that opens the post | Cut notifications |

## Timeline

&#91;embedded content: build timeline · Nov 13 to Dec 17\]

Going live on Nov 25 matters more than any single feature: it gives the subreddit quilt, leaderboards and heatmaps two weeks of real history before judges arrive. Each stage runs until it works; the two dates that don't move are the Nov 25 go-live and the Dec 7 submission.

## Submission package

The deadline is Dec 8 at 18:00 Los Angeles time (Dec 9, 03:00 Lagos); submit on Dec 7 to leave a buffer.

- [ ] App uploaded and playtested, not published.
- [ ] Public demo subreddit under 200 members, with daily posts running from Nov 25 through the end of judging on Dec 16.
- [ ] Links to today's post and to the app listing on developers.reddit.com.
- [ ] README.md in the repo root: what the game is, how to play, the cross-stitch rule, features.
- [ ] Video under 60 seconds, recorded on a phone: first stitch within 3 seconds, the cross-stitch moment, the solve animation, results, quilts and heatmap.
- [ ] Devpost write-up: one-line pitch, how it covers each judging criterion, and what is new compared with existing path puzzles.
- [ ] Real playtesters (friends and family) playing daily from Nov 25 so the leaderboard and heatmap aren't empty. No fake accounts.
- [ ] Developer feedback survey filled in for the $200 Feedback award.
- [ ] Scheduler, data and posts left running through Dec 16.

## Calls made for David

- Hint cooldown: 5 s between hints, so hint-spamming can't beat honest solving.
- Unpick badge: the count shows for 1–2 unpicks and is hidden at 3 or more.
