# Handoff — the flop (roll / leaf pile / snow angel) and its button

Cold-start doc for a fresh session. Devin asked for one because the flop needs a
**fresh look at both the animation and the button**, and the last session was too
deep in its own patches to see either clearly.

Read `HANDOFF.md` for the project. This file is only about the flop.

Branch: `claude/next-steps-ng14v3`. Deploy: push to `source` → `deploy.yml` → `main`
→ clippertown.io. Head at time of writing: `98d7ea3`, deployed as `main` `3e89887`.

---

## 1. Why the flop exists

Devin, unprompted, mid-session:

> "i have to explain to you jack (my son who is 7) LOVED that clipper would do snow
> angels. these are the type of small fun wins that make a kid want to play.
> consider this please."

So the snow angel got three more seasons — 🌿 ROLL in spring/summer, 🍂 LEAVES in
fall, ❄️ ANGEL in winter. **The bar is a 7-year-old laughing, not a state machine
that technically fires.** That is the whole spec.

---

## 2. Where the code is

| what | file:line |
|---|---|
| `softGround()` — where flopping is allowed | `src/game/Game.ts:3427` |
| `flop()` — entry point, season switch | `src/game/Game.ts:3432` |
| `roll(hex)` / `updateRoll(dt)` | `src/game/Game.ts:3440` / `:3447` |
| `snowAngel()` / `updateSnowAngel(dt)` | `src/game/Game.ts:3473` / `:3479` |
| `updateRoll` called from the frame loop | `src/game/Game.ts:2758` |
| HUD gate (`canFlop` → `setRoll`) | `src/game/Game.ts:~2934-2939` |
| `G` keybinding | `src/game/Game.ts:824` |
| button tap wiring | `src/game/Game.ts:784` |
| `.roll-btn` markup | `src/game/hud.ts:1727` |
| `.roll-btn` CSS | `src/game/hud.ts:395-402`, and the shared groups at `461`, `470`, `471`, `1409`, `1415` |
| `initRoll` / `setRoll` | `src/game/hud.ts:3080` / `:3087` |
| the Dog model | `src/three/actors.ts:546` |

---

## 3. PROBLEM A — the animation is not a roll

**Devin's screenshot:** Clipper mid-flop in an autumn field reads as a **pale
jumble of limbs** — a pile, not a dog enjoying himself. Legs splayed stiff, no
readable belly-up pose, orange leaf particles fountaining straight up out of the
middle of him.

**Why.** `updateRoll` animates **nothing but the root transform**:

```ts
root.rotation.z = Math.PI * k * (0.82 + Math.sin(this.rollT * 9) * 0.18);
root.rotation.y = Math.sin(this.rollT * 16) * 0.1;
root.position.y = this.kidY + 15 * k;
```

That is a rigid 180° flip of a **standing** dog. Every limb keeps its stand pose,
so four straight legs point at the sky like table legs; the trunk stays rigid; the
tail stays rigid; the head stays level. Nothing about it says *dog scrubbing its
shoulders in the grass*. `updateSnowAngel` has the identical shape and the identical
problem.

**The two things to fix, in order:**

**(a) Rotate about the body, not the paws.** `root` sits at the **paws**, so a 180°
roll swings the whole trunk below ground. The current answer is a magic number —
`+ 15 * k` — tuned until it stopped looking wrong. It is still wrong: Devin reported
"his entire body can be underground during the rolling process" twice, and it was
raised 7 → 9 → 15 by eye. **Do it properly:** rotate about the trunk's centre
(translate up by half the body height, rotate, translate back), or roll an inner
group whose origin is already at the spine. Then the lift is derived, not guessed,
and this class of bug is gone for all three seasons at once.

**(b) Pose the limbs.** `Dog` (`src/three/actors.ts:546`) already has everything
needed, all `private`: `trunk`, `headGroup`, `earL`/`earR`, `legs[]` (upper, LF RF
LR RR), `shins[]` (lower), `tail`, `tailTip`. Add a **public pose method** —
something like `bellyUp(k: number, t: number)` — and let `updateRoll` drive it
instead of manhandling the root. A believable belly-up wriggle wants:

- knees/hocks **folded**, paws up and loose, front and rear on **opposite phases**
  (the bicycle), not all four in lockstep
- the **spine** wriggling (yaw the `trunk`, not the root — see the warning below)
- head **tipped back**, ears flopping with the wriggle
- tail **thumping** the ground
- a little **squash** as the back lands, then a pop back up
- an entry tip-over and an exit — `shake()` (`actors.ts:804`) already ends it, and
  it's the best beat in the whole animation. Keep it.

Also: **leaf/snow particles should kick out low and sideways** from under the
shoulders, not fountain vertically out of his middle. Currently
`eggs?.burst(this.px, this.kidY + 6, this.pz, ...)` — centre of mass, upward.

### ⚠️ The trap that has bitten this code twice

> **ASSIGN to `root.rotation.*`, never `+=`.**

A `+=` bakes yaw into the root every frame for 2.2 s, and the tidy-up only clears
`rotation.z` — so the dog stands up with a few tenths of a radian of permanent yaw
and **runs sideways for the rest of the session**. `root.rotation.y` is otherwise
always 0 (the `Player` yaws its inner `heading` group). The snow angel shipped this
bug once. If the rewrite moves the wriggle onto `trunk`, reset `trunk` on exit too.

---

## 4. PROBLEM B — the button

**Devin: "look how different it looks from the others."** In his screenshot the
LEAVES button's `G` renders as **raw 26px black text** beside the leaf, while
BARK/SKATE/RUN wear a small dark keycap badge at the bottom-right. The LEAVES
circle also reads lighter and slightly larger than its neighbours.

**Cause:** `.roll-btn` was styled as a button but was never added to any of the
**shared** selector groups — the `.kc` badge rules, the `#hud.keys` reveal, `:hover`,
the `:active` scale, and the `backdrop-filter`/shadow material block. It looked like
a different species because, in CSS terms, it was one.

**Status — read before touching:** this was fixed in `98d7ea3` and the fix **is
present in the deployed bundle** (verified: `assets/index-BR7BO_m6.js` on
`origin/main` contains `#hud.keys .roll-btn .kc`). Devin's screenshot is almost
certainly a **service-worker-cached build** — this has caused three false bug
reports already this week.

> **FIRST ACTION: hard-reload past the service worker and look again.** If the badge
> is now small and dark and the circle matches its neighbours, the CSS is done and
> the remaining button work is the *design* question below. Do not re-fix it blind.

### The design question that is genuinely open

Even styled correctly, is a stack button right? Devin's original complaint was:

> "The roll button is just going to appear the whole game. That's not really how I
> want it. It's too distracting. It should feel more like a fun thing to do maybe
> put something above bark like roll?"

It was moved out of the contextual pill into the stack above BARK, which is what he
asked for. Worth a fresh eye on: it is a **fifth** permanent-ish circle in a
bottom-right column that already has four, and it appears and disappears as he walks
(see §5), which makes the column jump. Options nobody has evaluated: a quieter
treatment than a full peer button; only revealing it the first few times; or
accepting the jump. **Ask Devin — he is the UX call, and he wants to be argued with,
not agreed with.**

---

## 5. Where flopping is allowed (settled, don't relitigate)

This churned a lot. The measured end state:

- Gating on `standingOn() === 'green'` was **far too strict** — over 961 walkable
  NBPT samples: `plain` 59.7%, `road` 18.7%, `parking` 8.1%, `made` 7.3%,
  **`green` 6.1%**. The verb existed on a twentieth of the map and Devin reported
  "g does nothing by the way". He was right.
- Allowing `plain` alone **brings back the bug that started this**: downtown brick
  reads `plain`, and Clipper rolled on State Street throwing up grass
  ("he's rolling around on brick and yet there's grass popping up").
- `softGround()` = `green || (plain && !downtownAt)`. Measured after, 44,478 dry
  samples: **75.1%** of dry town, with roads, paths, parking and downtown brick all
  still refused. Verified by real keypress: soft-plain → `rollT` 2.2; downtown brick
  → `rollT` 0.

The HUD gate and `flop()` both call `softGround()` so the button and the key can
never disagree. **Keep that shared.**

---

## 6. How to verify (and the trap in verifying)

Dev server on `http://127.0.0.1:5173/`, season via `?season=fall|winter|spring|summer`.
Headless Chromium at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome` with
`--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader --no-sandbox`.

Debug hooks on `window.nbpt`: `_game`, `travel`, `go`, `pos`, `walk`, `zoom`,
`season`, `time`.

```js
// put him somewhere floppable — travelToXY SNAPS to a walkable spot and will
// land him on 'made'; set the position directly instead
await p.evaluate(() => { const g = window.nbpt._game; g.px = -5350; g.pz = 146; });
await p.keyboard.press('KeyG');
// then read g.rollT — NOT the button label
```

### ⚠️ Two traps, both of which produced wrong conclusions last session

1. **Headless rAF throttles to ~2 fps.** `pollAcc` is fed by frame `dt` and never
   crosses its 0.45 s gate inside a short test window, so the HUD never refreshes and
   **every button-state read comes back `null` or stale**. Force `g.pollAcc = 9`
   before reading any HUD class. A `null` label is not evidence the button is off.
2. **Absence of signal is not evidence of absence.** This burned the last session
   repeatedly — `samples: 0`, empty output files, null labels, and wait-loops that
   fired early were all read as findings when they were instrumentation failures.
   If a probe returns nothing, **prove the probe ran** before believing it.

And for the animation specifically: **screenshot it.** The gate firing and `rollT`
counting down tell you nothing about whether it looks like a dog having fun. The
last session shipped the flop having verified only that the label armed, and Devin
found three faults in under a minute.

---

## 7. Also open (not flop, but queued behind it)

Devin asked for both of these and neither is started:

1. **Pink House realism pass** — "go look up the pink house and make it look as
   realistic as possible". Current build is a generic American Foursquare
   (`buildPinkHouse` in `src/three/decor.ts`). The real one on Plum Island Turnpike
   is well photographed; look it up rather than inventing it. *(Inventing a landmark
   from memory cost four rebuild passes on the osprey last session. One search would
   have got it first time.)*
2. **House / memorial mutual exclusivity** — "if the pink house is shown it shouldnt
   have memorial, if its not it should have memorial". Both are currently present.

Carried, not requested: the 41-egg audit against `docs/research/`; a CI rebake to
pick up real `highway` stop/signal nodes; 81 State Street is built as a duplicate of
the 1871 brownstone; osprey wing quality.
