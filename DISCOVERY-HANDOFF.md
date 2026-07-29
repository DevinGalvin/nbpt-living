# Discovery collection — handoff

**Status: LIVE at clippertown.io.** 17 commits, `78b01cc` → `815a1f8`, all deployed and
verified against `window.__build`.

The Gram story spine is retired from the shipped game and the town's history became a
**collectible** — the thing you actually do. Newburyport has 36 discoveries, Gloucester
23. This document is what the next person needs to not repeat the mistakes.

---

## 1. What changed, in one pass

| | before | now |
|---|---|---|
| Main activity | Gram's chaptered quest | 🏛 collecting the town's history |
| Story mode | default | retired behind `?story`, nothing deleted |
| Markers | 30, hardcoded to NBPT in `game/history.ts` | per-town `src/towns/<id>/history.ts` |
| Find a marker | a card appears | town **freezes**, card lands, **your own photo** |
| The album | found items only | every slot from second one, locked ones named |
| Photos | none | 960×600 JPEG in IndexedDB, taken by the player |

### The key files
- `src/game/history.ts` — `HistoryRunner`, the `Site` type, the epoch reset
- `src/towns/<id>/history.ts` — a town's markers (the pattern `courses.ts` follows)
- `src/game/shots.ts` — discovery photos (IndexedDB)
- `src/game/saves.ts` — `townKey()`, per-town localStorage namespacing
- `src/game/hud.ts` — the card, the album, the fast-travel panel
- `tools/check_markers.mjs` — **run this after any coordinate change**

---

## 2. Traps that cost real time

### ⚠️ NO BACKTICKS in `hud.ts` CSS — hit this THREE times in one session
The entire stylesheet is a template literal. One `` ` `` in a comment ends the string and
the build fails with `':' expected` at the closing backtick, ~700 lines from the actual
mistake. There is a warning in the file now, next to the code.

### ⚠️ A safety check that goes quiet is worse than no check
`check_markers.mjs` silently passed for a whole town: adding an `icon:` field between
`z` and `title` broke its regex, it parsed **zero** markers, printed nothing, exited 0.
It now hard-fails (exit 2) when a `history.ts` parses to no markers. **Any parser-based
checker needs a zero-result tripwire.**

### ⚠️ The check must model what the RENDERER draws, not what the data says
The USRC Massachusetts had her bow on the dock. The mooring was cleared by testing the
hull *footprint*, but `revenueCutter()` draws to **1.34× the half-length** (bow wedge
1.05×, bowsprit 1.34×). Same family as above: verify the thing that actually appears.

### ⚠️ Never probe placement in the running game
The collision grid only exists for **streamed chunks**, so `isBlocked` lies about
anywhere the player is not standing — and a backgrounded tab (throttled rAF, nothing
streams) reports *everything* as blocked. Two browser sweeps wasted before
`check_markers.mjs` existed. Read `world.json` off disk instead.

### ⚠️ `box()` and `rotBox()` take HALF-extents
The Babson boulders shipped as 4-metre flat slabs, so wide the carved word landed on the
top face.

### ⚠️ `manualFeatures()` must be idempotent
`towns/nbpt/map.mjs` was not, and `patch_features.mjs` duplicated **Devin's own pool and
picket fence**. The first fix was also wrong — filtering on a tag the legacy baked-in
copies don't carry. Match by position or by a kind that is manual-only.

### ⚠️ "On first X" is invisible to everyone who already did X
Photos only captured on a *first* find, so every existing player had a permanently empty
album with no way to fix it. Always ask what the existing-player path looks like.

### ⚠️ iOS focus
`focus()` inside a `setTimeout` breaks the user-gesture chain and iOS silently refuses
the keyboard — caret, no typing. Focus on **`pointerdown`**, the earliest moment.

### ⚠️ CSS is source-ordered
A narrow-screen `@media` block placed *before* the base rule loses at equal specificity.

---

## 3. Reading level is an acceptance bar

The audience is **third grade**, not "all ages". [[nbpt-writing-voice]] says all-ages and
that produced "The Market Square Poltergeist … barely escaped the gallows" — two hard
words in a title and a joke that needs you to know what hanging is.

The rule: **plainer words, same weight.** Elizabeth Morse nearly being put to death stays;
it is the point of the story. Hard words get explained in place, the way the set already
does — privateers = legal pirates, sagamore = the leader, middens = the world's oldest
trash pile, crypt = a stone room under the floor.

Grep new copy for hard words before shipping. A scan of all 36 NBPT cards currently
returns clean.

---

## 4. Content status

**Newburyport (36)** — 6 Indigenous cards lead the set, because the town's story does not
begin in 1635. Dossier with citations and open questions:
`docs/research/indigenous-newbury.md`.

**Gloucester (23)** — Indigenous first again (Wanaskwiwam, the shell middens,
Masconomet), then Stage Fort, the Cut, the Man at the Wheel, the sea serpent, Dogtown.

> ⚠️ **The Indigenous cards have NOT been reviewed by an Indigenous reader.** Everything
> is from published sources with citations, but before a classroom uses this it should be
> read by the Museum of Old Newbury, the Newbury Historical Commission, and ideally an
> Abenaki/Pennacook reviewer. This is the single most important open item.

**Heroes built this pass:** the Garrison statue (added to the map by hand — OSM has no
node), Old South Presbyterian, Whale's Jaw, all 21 Babson boulders, the Timothy Dexter
House (named via `nameFixes`), the mills, and the USRC Massachusetts.

**Refused:** the USRC Massachusetts *memorial*. Its POI exists but three searches found
no photograph or description, and guessing at a real object is how this game got a red
Ropes Mansion. The card got the **ship** instead, which it was always about.

---

## 5. Open items, ranked

1. **Indigenous review** before classroom use. Blocking for the pilot.
2. **Read-aloud is removed — twice now — and should not be rebuilt on Web Speech.**
   The need is real (third graders, and the cards *are* the lesson), but
   `speechSynthesis` can only offer what the device has installed. Attempt one used the
   platform default: Samantha on Apple, correctly called robotic. Attempt two ranked
   voices by name and picked `Flo` — which is **worse**, because Eddy, Flo, Grandma,
   Grandpa, Reed, Rocko, Sandy and Shelley are Apple's ***Novelty*** voices, siblings of
   Bubbles and Zarvox. The tell: those eight are the only voices whose names carry an
   `(English (United States))` suffix, and `Grandma`/`Grandpa` were already in the
   exclusion list.
   The real finding is that a stock Mac's *entire* usable English set is Samantha plus
   five dated regionals — no Enhanced, no Premium, no network voice — so ranking cannot
   produce a good voice, only the best bad one. Devin's call, 7/28: **cut it, revisit if
   it becomes a need.** `src/game/speech.ts` is deleted; recover from git if wanted.
   If it comes back, the answer is **recorded human audio** for the flagship NBPT
   markers, not a better sort order. (Chromebooks do get `Google US English`, which is
   decent — so a school-only path exists if the pilot ever asks for one.)
   Note `hushSay()` in `hud.ts` stays: it cancels any speech an older cached build left
   running when a panel opens.
3. **The other 10 towns have no markers.** Purely content now — write
   `src/towns/<id>/history.ts`, set `history:` in the pack, run `check_markers.mjs`.
4. **Spice pass is one panel deep.** Fast travel has motion and depth; the discovery card
   and the HUD buttons are still the old flat treatment. Rules for any pass on them now
   live in [docs/UX-PRINCIPLES.md](docs/UX-PRINCIPLES.md) — read it first.
5. Photos are ~100 KB each in IndexedDB. Fine now; worth watching across 12 towns.

---

## 6. How to do the common jobs

```bash
# after ANY marker coordinate change — non-negotiable
node tools/check_markers.mjs [town]

# name an unnamed footprint so HEROES can find it (edit nameFixes in map.mjs first)
node tools/patch_names.mjs

# add hand-placed geometry/POIs (edit manualFeatures in map.mjs first)
node tools/patch_features.mjs

# reset EVERY player's collection once: bump COLLECTION_EPOCH in src/game/history.ts
```

**Deploy** is push-to-`source`. Note it is **two stages** — the "Deploy to clippertown.io"
Action going green does *not* mean the site updated; a second `pages-build-deployment`
run publishes afterwards. Wait for the Pages build, then check `window.__build`.

**Photo-verification is cheap and you should do it**: `curl` a Wikimedia Commons
thumbnail to a scratch file and read the image. It changed the Garrison statue twice —
he is standing, and the patina is dark brown-black, not the verdigris of Gloucester's
fisherman. It also caught that our own dossier had the sculptor's name wrong.
