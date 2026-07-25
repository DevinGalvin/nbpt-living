# NBPT racing era — session handoff (2026-07-01, updated 7/2)

This session executed **the gameplay-first pivot**: Devin's call that gameplay (racing →
leaderboards → someday CTF) is the scalable tier across towns, with story demoted to NBPT's
flagship layer. Racing went from zero to a complete, live experience in one session.
**Everything below is SHIPPED and LIVE on clippertown.io — including the cloud leaderboard** (7/2: Google Apps Script backend, no Cloudflare needed; see the 7/2 update block below).
Deep background in memory: `nbpt-racing-system.md` (the canonical racing doc), `nbpt-flight-prototype.md`,
`nbpt-preview-verification.md` (hard-won test techniques).

## Live state

- **`source` HEAD = `423d799`**, in sync with origin; CI deploy green. Salem worktree
  (`../nbpt-salem`, branch `salem-experiment`) HEAD = `76a6d58` (witch museum rebuild, bundled
  into `source` as `2c21026`).
- Always-dirty + intentional: `.claude/launch.json` (never commit), `SALEM-HANDOFF.md` +
  `RACING-HANDOFF.md` (untracked by convention). **Stage explicit paths; never `git add -A`.**
- ~~The cloud leaderboard ships DARK~~ **UPDATE 7/2: the cloud leaderboard is LIVE** — Devin
  chose a **Google Apps Script** backend over Cloudflare (no new account). `LEADERBOARD_URL` in
  race.ts points at his `/exec` deployment; the board lives in a "Clipper Town Leaderboards"
  Sheet in his Drive (**delete a row = moderate a name**). Protocol went path-less + text/plain
  POST (no CORS preflight) so ONE client fits Apps Script AND the still-available worker.js.
  The filter now lives in THREE files: race.ts / worker.js / **apps-script.gs** — keep in sync.
  Script updates: script.google.com → Deploy → Manage deployments → ✏️ → New version (same URL).
  ALSO shipped 7/2 (details in `nbpt-racing-system.md`): RACE AGAIN on the results board, ghost
  intro banner + ⚙️ ghost on/off toggle (`nbpt-ghost`), name-rejection error text, ride-time
  estimates in the picker, quit window 2.6s→6s, "Still racing!" on mid-race landing, and the
  full kids' UX audit wave (button labels, read-aloud, dead-ends pass).

## Shipped this session (newest first)

1. **🏁 "Race the Town" promo** (`423d799`) — flight-style featurePromo; CTA fades into the
   Scramble countdown. Promos are one-per-visit: race first, flight next visit (`tryRacePromo`
   → `tryFlightPromo`, shared `promoBusy()`).
2. **Results modal batch** (`bbc6dc8`) — 🏆 town-leaderboard modal auto-opens on EVERY finish
   (big time, placement line, top-8 ranked, your row highlighted, unnamed runs get an inline
   CLAIM row at their would-be rank); 🏆 per picker row opens board-only mode; course distances
   in the picker (`courseMiles`, meta.pxPerMeter=8 → 0.8/3.8/4.9 mi); spawn faces down-course
   (orient callback → camAz snap); the finish arch goes CHECKERED (black/white, 1.2×, white ring).
3. **Arrows float + x-ray** (`6499d5f`) — chevrons float at +10 (chase cam foreshortened ground
   decals) and render twice: solid + through-walls pass (whisper 0.08–0.16 on approach, LOUD
   0.22–0.38 in the corner zone, 1.45× size) so corner houses can't swallow the line.
4. **Cloud leaderboard package** (`65ef509`) — `infra/leaderboard/` Cloudflare Worker (KV,
   GET/POST /board, server-side kid-safe name re-validation, CORS-locked) + dark client sync
   (`LEADERBOARD_URL` in race.ts; empty = local-only).
5. **👻 Ghost racing** (`3db25b8`) — the town leader's recorded line replays as a translucent
   rider: waits at the line, launches on GO, vanishes after crossing. Per-name ghosts.
6. **Turn arrows + town leaderboard** (`2d08971`) — big gold arrow atop each arch pointing down
   the EXIT street (yaw measured over ~70px of arc — raw adjacent verts can be degenerate);
   chevron trail runs THROUGH corners; local top-10 board per course, one row per rider name;
   per-name bests/ghosts (a shared iPad = real household board).
7. **Road-following chevrons** (`cb9feeb`) — each course carries its real road polyline
   (RDP eps 35); chevrons trace the arc, not the gate-to-gate chord (chords strayed up to
   1,321px into blocks — Devin's "arrows cut through houses").
8. **South End Scramble** (`4b5c28e`) — course 3: Bromfield → Purchase → Charles hairpin →
   shore → Joppa Park; 0.8 mi of corners. Picker ladder: sprint → middle → epic.
9. **Finish-card name box** (`2d16ac5`) — superseded by the results modal, but the pending-run
   machinery it introduced remains: unnamed runs are HELD per course and bank retroactively
   when a name lands (from modal claim row OR picker).
10. **Gates = pure guidance** (`75392b7`) — Devin: "we just want general direction." The ONLY
    rule is crossing the finish (r=64). The guidance arch route-snaps to wherever the route
    runs nearest the rider. **Do not reintroduce ordered-gate requirements** (two bugs came
    from them).
11. **Shortcuts legal + explicit quit** (`ebb11d3`) — stray-cancel DELETED; runs end only via
    finish, fast travel (announced), or the ✕ on the race clock (arm-to-confirm). **Never
    silent** (`hud.announce`).
12. **No name, no board** (`55e0c4f`) — times only persist with a real entered name (RIDER
    fallback doesn't count).
13. **Race arch** (`d2461b2`) — the Goldilocks wayfinding: beacon "too obvious" → pennants
    "too subtle" → full race arch spanning the road.
14. **Vehicles baseline** (`3d718a3`) — bike + kayak + flight all ungated ("moving away from
    story mode towards gameplay"). Story beats still gift them narratively.
15. **✈️ Flight = sanctioned mid-race cheat** (`699dda5`) — boarding never cancels; gates score
    on 2D distance (overflying counts); clock never stops.
16. **Names, kid-safe** (`1ebcd0b`) — 12-char arcade names; leet-normalized blocklist +
    whole-word tier (ESSEX/CASSIE legal) + compound patch (`bbc6dc8`: a55hat caught by test).
    **The filter lives in BOTH race.ts and infra/leaderboard/worker.js — keep in sync.**
17. **Courses 1–2 + core runner** (`a0e1c65`, `cd613dc`, `252014c`) — Yankee Homecoming
    (PI light → Market Sq, the real race's downtown-finish tradition), Merrimack Run
    (Maudslay → Market Sq), 🏁 one-tap picker, 5s countdown, ghost-recording from day 1.
18. **Pre-racing:** explore-mode HUD chrome strip (`ee5faf7`), size-scaled building doors
    (`87743e2`), Salem Witch Museum accurate Gothic rebuild (`2c21026`).

## ⚠️ THE pending human step — cloud leaderboard (5 min)

Only Devin can do this (account + auth). Follow `infra/leaderboard/README.md`:
Cloudflare account → `npx wrangler login` → `npx wrangler kv namespace create BOARDS` →
paste id into `wrangler.toml` → `npx wrangler deploy` → paste worker URL into
`LEADERBOARD_URL` (src/game/race.ts) → commit + push. Boards go town-wide instantly;
offline play falls back to local automatically.

## Architecture (all in `src/game/race.ts` unless noted)

- **COURSES**: `{id, name, sub, start, gates[], route[]}` — gates = guidance waypoints (last =
  finish), route = real road polyline (flat [x,z...], RDP-simplified). **New courses must ship
  gates + route together** (recipe below).
- **RaceRunner**: state idle/count/run. Owns start flags, the arch (+turn arrow, checkered
  finish swap), 10 two-pass chevrons, the ghost rider, ghost recording (5Hz [t,x,z]).
  Integration: constructed in Game.ts after HistoryRunner with `ride` (auto-mount) + `orient`
  (camera snap) callbacks; update chain quest > race > history > eggs; race writes `hud.guide`
  per frame (waypoint arrow = gate nav); `race.freeze` zeroes speed in countdown; cancels wired
  in travelToXY only.
- **hud.ts race pieces**: 🏁 race-btn + picker (`initRaces` — rows/onPick/rider/onQuit/onBoard),
  timer chip + ✕ quit (arm-to-confirm), countdown overlay, `raceBoard()` modal, `announce()`.
  Race chrome is deliberately NOT hidden by `#hud.no-story`.
- **localStorage schema**: `nbpt-race-name` (rider), `nbpt-race-<id>-board` (top-10 [{n,t}]),
  `nbpt-race-<id>-ghost-<NAME>` ({v,t,s}). Bests live ON the board (bestFor = your row).
  No separate best key.

## Course-authoring recipe (~30 min/course)

1. Pick a story: start → climax finish (both at/near fast-travel landmarks; finish downtown-ish).
2. Node script: filter `world.json` roads by name, stitch segments in ride order (CHECK A→B
   orientation per segment — don't blanket-reverse), verify joint gaps < ~200px.
3. Gates every ~2600px open / ~1400px technical; always end at the finish point.
4. Route: same stitched polyline → RDP(eps 35) → paste both arrays into COURSES.
5. In preview: probe every gate + connector with `index.isBlocked/isWaterAt`; ride it via the
   gate-walk pump; check the picker ladder order (slot by length).

## Devin's design laws (learned the hard way — don't relitigate)

1. **Silent state loss is the worst feeling in the game.** No auto-cancels, ever. Announce endings.
2. **Gates are advice, the clock is the rule, the route is the skill.** Shortcuts are the game.
3. **Guides are race-day dressing, not video-game beams** — but a kid at speed must never wonder
   where to go. (Beacon→arch took three calibrations.)
4. **Ask at the moment of motivation** (name box ON the results board), never make them hunt.
5. **Zero discovery friction**: 🏁 always visible, one tap to the start line, promo for awareness.
6. **Kid-safe names everywhere**, enforced client AND server.

## Verification playbook (racing-specific)

- Dismiss the mode-pick + flight promo FIRST (they lock movement); then `nbpt.race(id)` to
  teleport+start. Pump `_game.race.update(dt, gx, gz, false)` walking gate coords to simulate
  rides. Real loop runs between evals (countdown finishes in wall time).
- Chevron/arch assertions: geometry checks beat screenshots (shimmer only writes opacities in
  'run' state — don't assert during countdown).
- The preview camera fights framing (loop re-derives from player); numeric proof first,
  screenshots for flavor. Full gotcha list: memory `nbpt-preview-verification.md`.
- Clean test slate after: `Object.keys(localStorage).filter(k=>k.startsWith('nbpt-race-'))...remove`.

## Backlog (rough priority)

1. **Devin's Cloudflare step** → boards go worldwide (everything else is done).
2. **Cloud ghosts**: upload the leader's ghost polyline alongside their row (~2KB) so towns race
   each other's lines, not just local ones. Schema note in worker comments.
3. **Minimap route line** — draw the course + rider dot on the top-right minimap; next lever if
   wayfinding complaints continue.
4. More courses (High Street mansion mile is scouted and unused; Salem gets racing when its
   bundle rebuilds — course data is town-local, engine is town-agnostic).
5. Weekly challenge course / rotating spotlight; CTF is the someday-multiplayer dream (needs
   real-time infra — don't start it casually).
6. Story reward moments lost their mechanical punch with vehicles ungated (Ch3 bike, L2 kayak) —
   consider cosmetic rewards (bell skins, kayak colors) to restore the gift feeling.
