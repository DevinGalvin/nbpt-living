# UX principles

Rules for every control in this game. They exist because each one was learned the
expensive way — a shipped panel that a kid, or Devin, read wrong.

The audience is third graders on a phone. That single fact decides most of what
follows: a control they cannot name is a control they will not press, and a target
smaller than a fingertip is a control they cannot press even when they want to.

These are **grammar, not taste.** A panel that breaks one of them is wrong the way a
sentence with no verb is wrong — not "a different look."

---

## The rules

### 1. Position encodes hierarchy
Where a control sits says what it belongs to. A control placed *inside* a block of
content claims to act on that content. A control that takes you **up** a level — out
of this town, out of this card, out of this level — must sit **above** the thing it
leaves, not below it.

> Broke it: the town-switcher button sat under the "Newburyport" title, so it read as
> something you do *inside* Newburyport. It goes up a level, so it goes up top.
> (`089377b`)

### 2. Direction encodes destination
An arrow points where the action actually goes. Back and out are **left**. Forward and
in are **right**. Up a level is **up**. Never pick a chevron because it balances the
layout — the layout can move, the direction cannot.

> Broke it: a right-pointing chevron, on the right edge, for an action that goes back.
> (`815a1f8`)

### 3. A control needs a word
An emoji is decoration until a word tells you what it does. 🧭 versus 🗺 versus 🎒 is a
coin-flip for a six-year-old. Every icon-only button wears a `.blab` — the small
always-on label pill on its bottom rim.

**`title=` is not a label.** It does not exist on touch, which is where most of our
players are. If the only place the real word lives is a `title` attribute, the control
is unlabelled.

> Broke it: shipped a control whose meaning existed only in a tooltip. (`815a1f8`)

### 4. Hit area is at least 44×44 — even when the control looks smaller
The visual can be small. The *tappable* box cannot. Get there with padding, not size:
a quiet 12px text link can carry a 44px target and still look quiet.

This applies hardest to the controls we make small on purpose — a ✕, a "Maybe later,"
a destructive reset. Small-on-purpose is a visual decision, never a hit-area one.

### 5. Clickable looks clickable
`cursor: pointer` plus a visible edge — a pill, a border, a fill. A bare run of text
with a click handler is a secret. If it does something, it must look like it does
something.

### 6. Destructive actions arm, then confirm — in our own words
Two taps: the first arms and **states exactly what will be lost**, the second does it.
Never `confirm()` — it is blocked in some embedded webviews and reads as a system
error to a kid. `.cf-reset` in the collection footer is the reference implementation.

### 7. A feature the platform can only do badly is worse than no feature
Read-aloud is the case study, and it is **removed** — twice now, for the same reason.

The audience is third grade and a chunk of them cannot read a card yet, so the need is
real. But the Web Speech API only offers what the device has installed, and a stock Mac's
entire usable English set is Samantha plus five dated regionals — no Enhanced, no Premium,
no network voice. No amount of ranking produces a good voice from that list; it only picks
the best bad one. Shipping it anyway made the cards worse, not more accessible.

Do not rebuild this on `speechSynthesis`. If the need comes back, the answer is recorded
human audio for the flagship markers. See `DISCOVERY-HANDOFF.md` §5.

### 8. Motion is a shared vocabulary, not a per-panel decision
Fast travel got the good treatment first, and for a while it was the only panel that had
it. That is how surfaces drift apart. The vocabulary now lives at the foot of `hud.ts`
in the **LIVELY layer**, and anything grid-shaped should use all four pieces:

| piece | what it does |
|---|---|
| `nbpt-tile-in` + `stagger()` | a list arrives one tile at a time instead of all at once |
| `.nb-chip` | an emoji in a raised rimmed box reads as an **object**, not text |
| lift + squash | hover raises `2px`, press squashes to `0.96` |
| `.tv-switch` slab | a headline button: gradient, own shadow, sheen, chunky press |

Rules: transform and opacity only, never layout. Cap a stagger at ~14 steps — past that
the wave is off-screen and the tail only reads as lag. And keep the blanket
`prefers-reduced-motion` rule at the bottom working: it must zero **delay** as well as
duration, or a reduced-motion user just watches the cascade snap instead of glide.

**Motion arrives, then stops. Nothing loops behind content you are meant to read.**
The album's found tiles first shipped with a looping sheen, desynchronised per tile so
the grid would not pulse in lockstep. Desync was the wrong fix for the wrong problem:
36 tiles quietly strobing is noise whether or not they are in phase, and it competes
with the words on the tile. It is now a single `nbpt-glint` — one pass, 0.34s, peak
alpha 0.16, chasing each tile's own entrance delay, then over. The wall catches the
light as it arrives and afterwards holds still.

If you can sit and watch an effect, it is too strong. An idle loop has to earn its
place by **pointing at something** — decoration does not qualify. The fast-travel
panel is the worked example: the slab's sheen and the bobbing town emoji both became
single passes on open, and the only survivor is the ‹ chevron's nudge, because it is
indicating where the tap goes.

**Two sanctioned loops. Do not "fix" these:**
- `nbpt-meping` — the minimap ping. It marks where you are.
- `nbpt-trophy-shine` — the light travelling around the discovery card's border.
  Devin's call, and it is the one place a loop is the point: the card *is* the prize,
  and the shine is what makes it read as one. Note it rides the **border** rather than
  crossing the text, which is why it does not compete the way the album's old sheen
  did. That distinction is the rule — light around an edge can idle, light across
  something you are reading cannot.

Two mechanics that make "once, on open" work:
- Scope the animation to the open state (`.travel-panel.open .tv-switch::after`). A
  CSS animation restarts whenever its rule *starts* matching, so it replays on every
  open without a line of JavaScript — and it is not running inside a closed panel.
- Reuse one keyframe across surfaces and vary it with a custom property
  (`nbpt-glint` takes `--glint-from`), rather than writing a second near-identical one.

### 9. "On your first X" is invisible to everyone who already has an X
Any first-run nudge, badge, or promo is dead code for every existing player, because
their save already passed the trigger. Decide what those players see, or gate it on
something they can still reach.

---

## How to check a panel

Do not eyeball it. Open the panel and measure, because rules 4 and 5 fail silently —
the control still works with a mouse, so it looks fine on this Mac and is unusable on
a phone.

Run this in the preview console with the panel open (`mcp__Claude_Browser__javascript_tool`):

```js
[...document.querySelectorAll('#hud .hcard *, #hud .collect-card *, #hud .promo-card *')]
  .filter(e => getComputedStyle(e).cursor === 'pointer' || e.onclick)
  .map(e => ({
    cls: e.className, w: e.offsetWidth, h: e.offsetHeight,
    cursor: getComputedStyle(e).cursor, text: (e.textContent || '').trim().slice(0, 20),
    FAIL: e.offsetHeight < 44 || e.offsetWidth < 44 || getComputedStyle(e).cursor !== 'pointer',
  }));
```

Anything with `FAIL: true` breaks rule 4 or rule 5.

**Measure with `offsetWidth`/`offsetHeight`, not `getBoundingClientRect()`.** The rect is
post-transform, and `.hcard-wrap` opens with `animation: nbpt-card-in` whose `from`
keyframe is `scale(0.9)` — under `fill-mode: both` in a preview tab that is not
compositing, the card sits parked on that first keyframe forever. Every real 44px
control then measures 42 and the audit invents failures that do not exist. The
un-transformed layout box is what a thumb actually hits.

Then read the panel back to yourself against rules 1–3, which no script can check:
- Does every control sit inside the thing it acts on?
- Does every arrow point where it goes?
- Can you name every button without hovering it?

---

## CSS traps that make these fail silently

`hud.ts`'s stylesheet is one giant template literal. That has consequences.

### ⚠️ No backticks anywhere in the CSS — not even in a comment
One `` ` `` ends the string. The build fails with `':' expected` at the *closing*
backtick, hundreds of lines from the mistake. Cost three separate debugging sessions.

### ⚠️ Deleting half a grouped selector orphans the whole block
This is the one that shipped:

```css
#hud .hcard .hsay, #hud .hcard .hclose {   /* someone deleted this line   */
  min-width: 44px; height: 44px; ...       /* leaving these homeless      */
}
```

Removing read-aloud meant removing `.hsay`, and the whole selector line went with it.
The declarations stayed. CSS does not warn — the parser treats the orphan as a rule
prelude and keeps consuming until the *next* `{`, so it silently eats the rule after it
too. Two buttons lost their pills, their 44px, and their pointer cursor, and the card
still looked plausible on a desktop.

**When you delete one half of a grouped selector, delete the comma, not the line.**
Then check the CSSOM actually has the rule:

```js
[...document.styleSheets].flatMap(s => { try { return [...s.cssRules]; } catch { return []; } })
  .filter(r => /hclose|hsay/.test(r.selectorText || '')).map(r => r.selectorText)
```

A rule that is missing here does not exist, however good it looks in the source file.

### ⚠️ Source order decides ties
Same specificity means last one wins. A base rule written *after* its own modifier
silently overrides the modifier.

### ⚠️ `animation-fill-mode: both` silently kills every `:hover` on the same property
An animation outranks normal declarations, and a `forwards`/`both` fill keeps the final
keyframe applied **forever**. So this pair looks right and is not:

```css
.tile        { animation: tile-in 0.34s both; }   /* ends at transform: none */
.tile:hover  { transform: translateY(-2px); }     /* never applies again */
```

The entrance runs once, then permanently pins `transform`, and the tile stops
responding to hover and press. It shipped that way in the fast-travel panel and nobody
noticed, because the panel still *looked* animated.

Use **`backwards`** for entrances: it holds the from-state through the stagger delay,
then lets go. Reserve `forwards`/`both` for elements whose resting style genuinely is
the final keyframe (`.promo-card` starts at `opacity: 0`, so it needs `forwards`).

Verify in the console rather than by eye — and note that reading a transform straight
after adding a class gives you frame 0 of the transition, not its target:

```js
// add a class that also sets transition:none, then read on the next frame
getComputedStyle(el).transform   // matrix(1, 0, 0, 1, 0, -2) = the lift applies
```

---

## Surfaces and their status

| Surface | Rules 1–3 | Rule 4 (44px) | Rule 5 (looks clickable) |
|---|---|---|---|
| HUD round buttons | ✅ all wear `.blab` | ✅ 44 + border | ✅ |
| Discovery card `.hsay` / `.hclose` | ✅ | ✅ *(fixed — was 19px / 17px)* | ✅ *(fixed)* |
| Collection album | ✅ | ✅ | ✅ |
| Collection reset `.cf-reset` | ✅ | ✅ *(fixed — was 14px)* | ✅ |
| Promo card `.promo-x` / `-skip` / `-cta` | ✅ | ✅ *(fixed — was 29 / 21 / 39px)* | ✅ |
| Fast-travel panel | ✅ | ✅ | ✅ |
