// Charlestown race courses — authored on the real road graph with
// tools/make_course.mjs (see src/game/race.ts for the engine).
import type { Course } from '../../game/race';

// The ladder (same design laws as the other towns: somewhat far, somewhat hard,
// climax AT the finish). Charlestown hands you the best climax in the set for
// free — the Monument is on top of the hill and visible from everywhere — so two
// of the three finish by climbing to it. The middle course runs the other axis:
// the whole length of the peninsula, Sullivan Square to the far end of the yard.

export const COURSES: Course[] = [
  {
    // the sprint — from Old Ironsides at Pier 1, out of the Navy Yard gate,
    // across City Square and then UP: Main Street to Thompson Square and the
    // last pull onto Monument Square. Downhill start, uphill finish.
    id: 'monument',
    name: 'Bunker Hill Climb',
    sub: 'Old Ironsides → the Monument',
    start: { x: 4701, z: 2141 },
    gates: [
      [4090, 1418],     // out past the ship
      [2986, 970],      // First Avenue, through the yard
      [1161, 2815],     // the gate onto Chelsea Street
      [-206, 4085],     // City Square — swing right for Main
      [-754, 3080],     // Main Street, starting to rise
      [-2234, 987],     // Thompson Square
      [-1730, -99],     // the hill proper now
      [-1026, 238],
      [-480, -193],     // finish on Monument Square — 294 steps if you keep going
    ],
    route: [4701, 2141, 4090, 1418, 3710, 1744, 3229, 1173, 2986, 970, 2415, 1468, 1556, 2447, -206, 4085, -757, 3723, -754, 3080, -958, 2691, -1603, 2117, -1791, 1858, -2310, 838, -2408, 753, -2469, 823, -1730, -99, -1026, 238, -791, -341, -480, -193],
  },
  {
    // the middle — the long axis of the whole peninsula. Off Sullivan Square at
    // the top of town, down the length of Bunker Hill Street, through City
    // Square and into the Navy Yard, then the full run of the waterfront to the
    // far tip: finish at Menino Park, with the harbor on three sides.
    id: 'navyyard',
    name: 'Navy Yard Run',
    sub: 'Sullivan Square → Menino Park',
    start: { x: -10856, z: -7258 },
    gates: [
      [-11041, -8097],  // out of Sullivan Square
      [-9084, -6923],
      [-8313, -6624],
      [-7273, -4470],   // onto the long straight
      [-6557, -2848],
      [-5504, -2217],
      [-3776, -608],
      [-2065, 1320],
      [-764, 3043],     // Main Street's drop into City Square
      [-206, 4085],     // City Square
      [1684, 2301],     // in through the yard gate
      [2986, 970],      // First Avenue
      [3710, 1744],     // past Old Ironsides
      [7384, -1362],    // finish at Menino Park, out at the tip
    ],
    route: [-10856, -7258, -10847, -7827, -11041, -8097, -10896, -8341, -10343, -8059, -8987, -6835, -8451, -6631, -8313, -6624, -8142, -6703, -8117, -6381, -6557, -2848, -5504, -2217, -5417, -2215, -5236, -2360, -3772, -603, -2310, 838, -1791, 1858, -1567, 2158, -971, 2674, -764, 3043, -757, 3723, -206, 4085, 1556, 2447, 2415, 1468, 2986, 970, 3229, 1173, 3710, 1744, 7384, -1362],
  },
  {
    // the epic — a full lap of Charlestown. Out of the yard at Menino Park, west
    // along the water past the ship, across City Square, up Rutherford Avenue
    // the whole west side, around the Neck at the top of town, then back down
    // Bunker Hill Street through the neighbourhood — and the hill last.
    id: 'homecoming',
    name: 'Townie Homecoming',
    sub: 'Menino Park → the Neck → the Monument',
    start: { x: 7384, z: -1362 },
    gates: [
      [5398, 317],      // back along the waterfront
      [3710, 1744],     // past Old Ironsides again
      [2986, 970],
      [1161, 2815],     // out of the yard
      [-206, 4085],     // City Square
      [-1250, 4404],    // onto Rutherford Avenue
      [-3396, 2954],
      [-4438, 1922],    // the college on your right
      [-5604, -122],
      [-6650, -2500],
      [-7722, -4869],
      [-8127, -5762],
      [-8156, -6630],
      [-7656, -9158],   // the Neck — the top of town, then turn for home
      [-7929, -7081],
      [-7219, -6285],
      [-4716, -6271],   // Bunker Hill Street, heading back down
      [-4683, -5766],
      [-2589, -5068],
      [-3338, -3698],
      [-1579, -2506],
      [-2040, -1648],
      [-616, -776],     // the last climb
      [-480, -193],     // finish on Monument Square
    ],
    route: [7384, -1362, 3710, 1744, 3229, 1173, 2986, 970, 2415, 1468, 1556, 2447, -206, 4085, -757, 3723, -1250, 4404, -1938, 4005, -2732, 3460, -2918, 3253, -3942, 2613, -4250, 2302, -4438, 1922, -4689, 2020, -4859, 1660, -5518, 151, -5676, -350, -8127, -5762, -8055, -5888, -7914, -5927, -8117, -6381, -8156, -6630, -7929, -7081, -7638, -9296, -7929, -7081, -7593, -6545, -7219, -6285, -6903, -6406, -5605, -6557, -5197, -6529, -4476, -6142, -4683, -5766, -4476, -6142, -2589, -5068, -3338, -3698, -1579, -2506, -2040, -1648, -616, -776, -791, -341, -480, -193],
  },
];
