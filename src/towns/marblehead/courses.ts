// Marblehead race courses — authored on the real road graph with
// tools/make_course.mjs (see src/game/race.ts for the engine).
//
// Empty on purpose: a course has to be traced on the BUILT road graph, and
// Marblehead's world hasn't been baked yet. Author the ladder once the map
// exists (`TOWN=marblehead node tools/make_course.mjs`) — an empty ladder is a
// complete, shippable town in the meantime (the 🏁 RACE button just stays quiet).
//
// The obvious three when it's time, following the same design laws as the other
// towns (somewhat far, somewhat hard, climax AT the finish):
//   · Old Town sprint — Market Square → Washington St → finish at Crocker Park
//   · the Neck loop — over the causeway and around Ocean Ave to Marblehead Light
//   · the long one — Devereux Beach up Atlantic Ave, finishing at Fort Sewall
import type { Course } from '../../game/race';

export const COURSES: Course[] = [];
