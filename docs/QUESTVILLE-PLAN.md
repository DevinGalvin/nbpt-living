# QuestVille — the classroom pilot plan

**QuestVille is Clipper Town walking into a third-grade classroom.** One teacher
one-pager exists ([questville-teacher-overview.pdf](questville-teacher-overview.pdf),
extracted below where it matters) and it makes promises. This document is the plan for
keeping them: what we promised, what already exists, what has to be built, in what
order, and what can sink it.

Dates in this plan assume today is **Friday, August 22, 2026**. The one-pager promises
a working version to show teachers in **early September** (~2 weeks out) and a
classroom start in **late October / early November** (~10 weeks out).

---

## 1. What the one-pager promises

Each of these is a commitment a teacher will reasonably hold us to:

| # | Promise | Exists today? |
|---|---|---|
| P1 | Browser game on the real Newburyport map, Clipper the skateboarding dog | ✅ live at clippertown.io |
| P2 | Runs on a school Chromebook, nothing to install | ⚠️ untested on school hardware |
| P3 | 30-minute weekly block; students resume where they left off | ⚠️ resume is per-device localStorage — breaks on Chromebook carts |
| P4 | Students tap their name from a class list; no passwords ever | ❌ no sign-in of any kind |
| P5 | At each place: short story + **a question** | ⚠️ 36 stories exist; zero questions |
| P6 | Three parts: Find Your Way / How the Town Works / Newburyport Then | ❌ no strand structure |
| P7 | Tied to MA grade-3 standards, "we can show you exactly which ones" | ❌ no mapping written |
| P8 | Teacher page: sign in, paste class list, pick the week's part, share link | ❌ doesn't exist |
| P9 | Live view: who has found what, during class | ❌ doesn't exist |
| P10 | 5-minute quiz at start and end of unit, teacher chooses when | ❌ doesn't exist |
| P11 | "We collect a first name and their progress. Nothing else." | ⚠️ today we collect *nothing* — the backend that makes this true must also be *held* to it |
| P12 | Working version to show teachers early September | the point of §6 |

The good news buried in that table: the hard part — a beautiful, true, playable
Newburyport at a third-grade reading level — is done and live. Everything missing is
**a thin classroom layer plus content**, and the repo already contains the pattern for
both (the leaderboard worker for the layer, the discovery cards for the content).

---

## 2. Shape of the thing: five decisions

These are the recommendations this plan is built on. Each is cheap to reverse now and
expensive to reverse in October.

### D1. QuestVille is a *mode*, not a fork
Same engine, same deploy, same `source` branch. School mode boots when the URL carries
a class code (`clippertown.io/?class=OTTER-42` or similar). The multi-town lesson
applies verbatim: one engine, N experiences, config + data — a fork would rot in a
month. Public players never see any of it.

### D2. The backend is a second tiny worker, in the leaderboard's image
`infra/leaderboard` already established the house style: one Cloudflare Worker + KV,
a schema you can read in one breath, no accounts, no cookies, server re-validates
everything, client ships dark until a URL is configured. QuestVille gets a sibling —
`infra/classroom` — speaking an equally small protocol:

```
POST /class          {adminKey, name, roster:[names]}   -> {code, teacherKey}  admin creates a class
GET  /classes?adminKey=                                 -> {classes}           admin room: every class + its keys
DELETE /class        {adminKey, code}                   -> {ok}                admin-only: the data-deletion story
GET  /class?code=    ...                                -> {roster, week}      student boot: the name-tap list
POST /found          {code, student, site, quiz?}       -> {ok}                a kid found a place / answered
GET  /live?code=&key=                                   -> {grid}              live view (teacher or admin key)
POST /week           {code, key, week}                  -> {ok}                pick the active part
```

**No accounts — two kinds of key** (Devin's call, 8/22: classes are admin-created).
**Admin keys** are held by Devin, Joe, and selected teachers, provisioned out of band
(a wrangler secret, not an endpoint); an admin creates classes, mints teacher keys,
opens any dashboard, and deletes. A **teacher key** is minted per class at creation,
handed to the teacher (printed handout), and opens exactly that class. A lost teacher
key is an admin re-showing it — nothing ever needs recreating. The "teacher sign-in"
of P8 is that key, pasted once per device.

One classroom of 25 polling every 5s for 30 min/week is ~9k requests/week: free tier
holds this a hundred times over. Apps Script stays on the bench as the fallback (its
Sheet-as-admin-panel trick is tempting for rosters, but the live view wants
sub-second latency).

### D3. Cloud progress is the source of truth *in school mode only*
This is the sneaky-critical one. **Chromebook carts mean a kid gets a different
machine each week**, so P3 (pick up where you left off) cannot ride localStorage.
In school mode, found-sites/answers live server-side under `code + firstName`;
localStorage becomes a write-through cache. Public mode changes nothing — and school
saves get their own `townKey`-style namespace (`class-<code>-…`) so a kid who also
plays at home never collides with their class identity. The existing local-first
philosophy holds: the game never *waits* on the network, it merges.

### D4. Strands are tags on content that already exists, plus one new set
- **Newburyport Then** = the existing 36 markers, tagged. Done content, done tone.
- **How the Town Works** = ~10–12 *new* civics markers: police station, fire HQ,
  the schools themselves, post office, DPW, plus re-aiming existing ones (City Hall,
  Tracy Library, Bulfinch Courthouse, Custom House, Coast Guard) with a today-facing
  card variant. Who does what, why towns have governments, how people take part.
- **Find Your Way** = mostly *mechanics*, not plaques: the compass, cardinal-direction
  tasks ("walk north from Market Square until you hit water — what is it?"), find your
  school, find your own street *by navigating there* (see P11 note in §5 — we never
  ask for or store an address), the river/coast/Plum Island geography markers.

The `Site` type grows two optional fields — `ask?: string` (the question, P5) and
`strand?: 'map' | 'town' | 'then'` — and the weekly "part" (P8) is a filter on the
find-list, not a wall: a kid who wanders is wandering in Newburyport, which is the
point.

### D5. Questions are reflective, not gated
The one-pager's sample ("Why do you think people built the town next to the river?")
is an *open* question — that's the right model. In-game questions get a short answer
box (or 2–3 tap choices where a right answer exists), logged to the live view, never
blocking progress. The pre/post **quiz** (P10) is the separate, scored instrument:
~8 items, same quiz both times, five minutes, teacher launches it from the teacher
page. Growth between the two attempts is the number the teacher shows their principal.

---

## 3. What gets built (the work, itemized)

### Engine (school mode) — `src/game/school.ts` + touches
- [ ] Boot path: `?class=` → fetch roster → name-tap screen ("You are **Maya** — right?"
      confirm, because shared devices + 8-year-olds = taps on the wrong name)
- [ ] `Site.ask` + `Site.strand`; question UI on the discovery card; answers sync
- [ ] School save namespace + server merge (D3)
- [ ] Find-list panel for the active week ("this week: How the Town Works — 4 of 9 found")
- [ ] Quiz screen (launchable by teacher flag; 8 items; result sync)
- [ ] Low-spec mode if the Chromebook spike (§4) demands it: shadows off, fewer
      pedestrians/cars/dogs, shorter draw distance — a `?lite` flag first, auto later

### The 🏫 gate — teacher + admin UI lives in-game (wireframed 8/22)
Not a separate `/teach/` page after all: one schoolhouse button in the slimmed
top-left (travel · settings · 🏫; the 🏁 button hidden, the 🍂 season picker folded
into ⚙️ settings). Tapping it branches on who you are: a public device gets an inert
"School" sheet with a single key box behind "I'm a teacher"; a saved teacher key
opens that class's dashboard; a saved admin key opens the admin room; a kid on a
class link gets their week's panel with a tiny "Teachers ▸" in the corner.
- [ ] HUD slim-down: hide the race button (system stays in code), move seasons into
      the settings popover, add 🏫
- [ ] The School sheet + key box (one box takes either kind of key)
- [ ] Admin room: class list (open any dashboard / re-show a teacher key / delete),
      create class — paste roster (first names only; the kid-safe name filter from
      `race.ts`/`worker.js` runs here too — third grade will test it), hand-off
      panel with link/code/teacher key + printed handout
- [ ] Teacher dashboard, four tabs: **Live** (roster × places grid, polled;
      zero-progress kids float to the top flagged), **Week** (pick the active part;
      free-roam option), **Quiz** (open pre/post, results side by side), **Class**
      (roster edit + merge for wrong-name taps, share link, print)

### Worker — `infra/classroom/`
- [ ] The endpoints from D2, KV-backed, CORS-pinned to clippertown.io
- [ ] Admin keys as a wrangler secret; teacher keys minted per class
- [ ] Name filter server-side (never trust the client — house rule)
- [ ] Rate limits per class code; roster cap (~35); body-size caps
- [ ] Admin-only delete-a-class = the entire data-deletion story (P11)

### Content
- [ ] Tag all 36 markers with strands; write `ask` for each (~36 questions)
- [ ] Write + place the civics set (~10–12 new markers) — `check_markers.mjs` after
      every coordinate, no exceptions; today-facing variants for City Hall et al.
- [ ] Find Your Way task list (~8 tasks using compass + real geography)
- [ ] The quiz: 8 items spanning all three strands, written *with* the teachers
- [ ] `docs/QUESTVILLE-STANDARDS.md`: each 2018 MA HSS Framework grade-3 standard
      (Topic 1: MA cities/towns, geography, map skills; civics topics; local history)
      quoted **by code** against the in-game content that teaches it. Verify codes
      against the published framework — this doc is P7 and teachers will read it.

### Not built (on purpose)
No student accounts, no passwords, no email, no addresses, no photos leaving the
device, no analytics beyond the progress grid, no parent app. Every "no" here is a
sentence we get to say in the privacy conversation with the district.

---

## 4. QA gates — each one blocks something

> **Devin's call, 8/22:** no external Indigenous review. The pilot proceeds on the
> dossier's published-source citations (`docs/research/indigenous-newbury.md`); the
> dossier's open questions stay open, and the reading-level and fact bars below still
> apply to those six cards like any others. (DISCOVERY-HANDOFF §5.1 records the same.)

| Gate | Blocks | Status / move |
|---|---|---|
| **Chromebook perf** on the actual school model | the demo being honest (P2) | Borrow/buy the school's model in Week 0; run the real game on it Week 1; decide if `?lite` is needed |
| **School IT** | everything | District must not block clippertown.io + the worker domain; ask what student-data paperwork they need (MA districts commonly require a signed Student Data Privacy Agreement). First name + progress only (P11) is our whole case — start the conversation now, these move at district speed |
| **Reading level** | any new copy shipping | The §3 bar from DISCOVERY-HANDOFF holds: plainer words, same weight; hard words explained in place; grep before shipping. Questions and quiz items count as copy |
| **`check_markers.mjs`** | any new marker | Non-negotiable, as ever |
| **Existing-player path** | school mode touching saves | The handoff's "on first X is invisible to everyone who already did X" trap — a kid who played Clipper Town at home before the unit must not see a broken or pre-completed class experience (the D3 namespace is the fix; test it explicitly) |

---

## 5. Privacy, said plainly (P11)

The one-pager promises: *first name, progress in the game, nothing else, no ads,
nothing shared.* Today that's trivially true (we collect nothing). The classroom
worker makes it a real engineering constraint:

- The schema **is** the policy: `code → roster of first names → found sites, answers,
  quiz scores`. If a field isn't in that sentence, it doesn't get stored.
- No cookies, no fingerprinting, no third-party requests from school mode.
- "Find your own street" is the kid steering Clipper there. We never ask where they
  live and nothing about the task stores it.
- Deleting the class deletes everything. It's one button in the admin room
  (Devin, Joe, selected teachers); teachers ask an admin.
- Write the one-page privacy note for teachers/families **before** the September
  demo — it's the first question a good teacher asks, and handing them a printed
  answer is how a two-person outfit looks trustworthy.

---

## 6. Timeline — back from "late October"

**Week 0 · now (Aug 22–24) — the two emails.** (1) School contact: which Chromebook
model, whitelist request, what privacy paperwork. (2) Line up the demo date with the
teachers for the week of Sep 1. Get a school-model Chromebook in hand. *Nothing here
is code and all of it is critical path.*

**Week 1 · Aug 25–29 — scaffolding + the perf verdict.** School boot path, name-tap
screen, `ask`/`strand` on `Site`, worker v0 (class/roster/found/live), Chromebook
spike → `?lite` decision. Draft the standards mapping.

**Week 2 · Sep 1–5 — the demo (P12).** One strand end-to-end: **Newburyport Then**
on existing markers with questions added, a mock class ("Ms. Demo's class"), the
teacher page with the live view actually moving while a second device plays. Demo it
on the school's own Chromebook model. Hand over the privacy one-pager. Run the
one-pager's own four feedback questions and *write the answers down* — the 30-minute
structure, the reading level, coverage, and their definition of success are the spec
for the next six weeks.

**Weeks 3–5 · Sep 8–26 — the real build.** Cloud-authoritative school saves, quiz
system, week gating, civics content written/placed/checked, Find Your Way tasks,
teacher-page polish, teacher feedback folded in. Content freeze at the end of Week 5.

**Week 6 · Sep 29–Oct 3 — hardening.** Reading-level pass over every new word.
Standards doc finalized with verified codes. Quiz reviewed by the teachers. Worker
rate limits, roster caps, delete-class. Wrong-name/shared-device flows tested.

**Weeks 7–8 · Oct 5–16 — external reality.** In-school test on the real network with
the real filter; dry run with one actual kid on one actual Chromebook, timed against
a 30-minute block. These two weeks are also the schedule's slack — the build can spill
into them if it must.

**Week 9 · Oct 19–23 — onboarding.** An admin (Devin or Joe) creates the real
classes and hands each teacher their key and printed handout. On-site tech check.
Family letter goes home if the school wants one.

**Week 10 · Oct 26+ — start**, on the school's calendar. During the unit: the live
view doubles as our telemetry (where kids stall is a design bug), same-week fix
cadence, weekly teacher check-in. Post-quiz at the end; debrief scored against their
own Week-2 definition of success.

**Slack in the plan:** the demo needs Weeks 0–2 only; the classroom needs everything.
If the build runs long, Weeks 7–8 compress; the school IT conversation does not —
which is why it starts in Week 0.

---

## 7. Risks, ranked

1. **District IT / privacy paperwork stalls** — external, slow by design.
   *Mitigation:* Week-0 ask; the no-accounts/no-PII architecture *is* the fast path
   through most district checklists.
2. **Chromebook performance** — a Three.js town with shadows and 30 live agents on
   a $220 laptop. *Mitigation:* Week-1 spike on the real model; `?lite` mode is a
   day's work if needed; demo on their hardware so nobody is surprised in November.
3. **Content volume underestimated** — ~12 new markers, ~44 questions, 8 quiz items,
   a standards doc, all at the reading-level bar, all placement-checked.
   *Mitigation:* it's scheduled as three full weeks, and Newburyport Then ships the
   demo without a word of new story.
4. **Shared devices scramble identities** — wrong-name taps, two classes on one cart.
   *Mitigation:* confirm screen, teacher-side reassign/merge on the live view.
5. **Scope creep in the classroom layer** — the worker wants to become an LMS.
   *Mitigation:* the D2 protocol is the fence; anything not expressible in those five
   endpoints waits for a second pilot.
6. **A challenge to the Indigenous cards' accuracy lands mid-unit** — with no external
   review, the dossier's citations are the whole defense. *Mitigation:* the citations
   are real and in-repo (`docs/research/indigenous-newbury.md`); if a teacher, parent,
   or historical society raises something, the dossier answers it or the card gets
   corrected same-week like any other bug.

---

## 8. Open questions (cheap now, awkward later)

- **The name on the door:** does the title screen say QuestVille in school mode, or
  does the *program* say QuestVille while the game stays Clipper Town? (Recommend the
  latter — the brand kids take home is Clipper Town; QuestVille is what the unit is
  called on paper. Pure config either way.)
- **Do secrets/races stay on in school mode?** Recommend yes for eggs (delight is
  curriculum), indifferent on races — ask the teachers in Week 2.
- **Quiz authorship:** we draft, teachers edit — confirm they want that pen.
- **Which school/teachers exactly, and how many classes?** Sizes the roster cap and
  the onboarding week. Related: which teachers get admin keys beyond Devin and Joe —
  "selected teachers" needs names before Week 9.
- **Worker domain:** `class.clippertown.io` vs the workers.dev URL — decide before
  the IT whitelist email, so we only ask them once.

---

*The teacher-facing promise this plan serves:*
*[docs/questville-teacher-overview.pdf](questville-teacher-overview.pdf).*
*The content-quality bar it inherits: DISCOVERY-HANDOFF.md §3 (reading level).
The infra pattern it copies: infra/leaderboard/README.md.*
