// Beverly race courses — authored on the real road graph with tools/make_course.mjs
// (see src/game/race.ts for the engine).
import type { Course } from '../../game/race';

// The ladder (same design laws as the other towns: somewhat far, somewhat hard,
// climax AT the finish) gets authored once the world is built:
//   sprint  — the Cabot Street downtown dash
//   middle  — the shore run out to Lynch Park
//   epic    — the Beverly Farms homecoming down Hale Street
export const COURSES: Course[] = [];
