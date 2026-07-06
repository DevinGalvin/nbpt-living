// Newburyport race courses — the town's time-trial ladder (see src/game/race.ts
// for the engine; design law: somewhat far, somewhat hard, climax AT the finish).
// Authored against the real road graph — tools/make_course.mjs emits the
// start/gates/route fields for any new course.
import type { Course } from '../../game/race';

export const COURSES: Course[] = [
  {
    // course 3 (listed first: the sprint of the set) — a scramble through the South
    // End's narrow neighborhood grid: down Bromfield, a hard right up Purchase, a
    // hairpin left down Charles, then the Joppa shore road home. Under half a minute
    // flat-out, but every leg ends in a real corner — winning it is all brakes and line.
    id: 'southend',
    name: 'South End Scramble',
    sub: 'Bromfield top → Joppa Park',
    start: { x: 3961, z: 7552 },
    gates: [
      [5128, 4673],    // Bromfield × Purchase — hard right onto the diagonal
      [3818, 3920],    // Purchase × Charles — hairpin left
      [4675, 2117],    // Charles bottom — left onto the Water St shore
      [5831, 2938],    // the Joppa shore curve
      [7287, 4021],    // finish at Joppa Park
    ],
    route: [3961, 7552, 4800, 5140, 5035, 4627, 5108, 4629, 3818, 3918, 4675, 2117, 5123, 2499, 6320, 3275, 7287, 4021],
  },
  {
    // course 2 — the western homecoming: from the Maudslay gate down twisty Pine Hill
    // Rd, Ferry Rd and the Spofford descent, then Merrimac Street flat-out along the
    // river into the square. The middle of the ladder: sprint → this → the epic.
    id: 'merrimack',
    name: 'The Merrimack Run',
    sub: 'Maudslay gate → Market Square',
    start: { x: -34137, z: -9817 },
    gates: [
      [-32860, -12109], [-31522, -14475], [-29578, -16029], [-26964, -15254], [-24940, -13487],
      [-24914, -16117], [-23575, -17623], [-21252, -16425], [-18904, -15042], [-16534, -13607],
      [-14099, -12046], [-11842, -10340], [-9884, -8320], [-8303, -6194], [-6584, -4026],
      [-5429, -3205], [-4420, -1953], [-3271, -1020], [-1808, -549], [-481, -197],
      [-140, -130],
    ],
    route: [-34137, -9817, -31031, -15295, -30724, -15668, -30421, -15878, -29660, -16026, -28993, -15979, -26731, -15157, -25529, -14338, -25198, -13929, -24940, -13487, -24947, -15510, -24874, -16396, -24233, -17898, -23827, -17769, -20721, -16135, -15722, -13112, -12495, -10967, -10041, -8538, -8759, -6848, -7115, -4516, -6419, -3904, -5605, -3420, -4924, -2452, -4039, -1590, -3381, -1080, -2607, -741, -1808, -549, -1019, -489, -421, -171, -123, -120],
  },
  {
    id: 'homecoming',
    name: 'Yankee Homecoming',
    sub: 'Plum Island Light → Market Square',
    start: { x: 33026, z: -4051 },
    // traced from the real road polylines (Northern Blvd → Plum Island Turnpike →
    // Water St): ~2600px apart in the open, ~1400px through the downtown finish
    gates: [
      [35543, -2702], [37089, -599], [38326, 1827], [39272, 4252], [39634, 6942],
      [39646, 9654], [37006, 11184], [34404, 11732], [31739, 12048], [28997, 12645],
      [26362, 12930], [23470, 13235], [20585, 13521], [17573, 12997], [15269, 11498],
      [13109, 9922], [11152, 8172], [9577, 6017], [7582, 4286], [6320, 3275],
      [5145, 2513], [3994, 1571], [2877, 739], [1707, -171], [200, -180],
    ],
    route: [33026, -4051, 33318, -3799, 33445, -3541, 35596, -2679, 35995, -2391, 36971, -828, 37557, 236, 38973, 3235, 39130, 3689, 39568, 5478, 39659, 7678, 39569, 8868, 39788, 11053, 39748, 11172, 39623, 11276, 37006, 11184, 34589, 11707, 32542, 11865, 28526, 12720, 19337, 13638, 18672, 13635, 17573, 12997, 13800, 10528, 12095, 9054, 11096, 8115, 10720, 7630, 10552, 7015, 10205, 6515, 8449, 5137, 6927, 3717, 5123, 2499, 3961, 1547, 3289, 1134, 2166, -7, 1007, -342, 641, -369, 343, -285],
  },
];
