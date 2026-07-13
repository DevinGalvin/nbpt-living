// Ipswich race courses — authored on the real road graph with tools/make_course.mjs
// (see src/game/race.ts for the engine).
import type { Course } from '../../game/race';

// The ladder (same design laws as the other towns: somewhat far, somewhat hard,
// climax AT the finish): a sprint over the 1764 Choate Bridge to the Town Wharf,
// the High Street run out to the Clam Box, and the long ride home from Castle
// Hill down Argilla Road — the classic Crane Beach road, in reverse.

export const COURSES: Course[] = [
  {
    // the sprint — off the South Green past the Whipple House, over the oldest
    // stone-arch bridge in America (the Choate, 1764), through Market Street's
    // shops, then East Street's drop to the water: finish on the Town Wharf.
    id: 'choate',
    name: 'Choate Bridge Dash',
    sub: 'South Green → Town Wharf',
    start: { x: 3284, z: 1888 },
    gates: [
      [2577, 1453],     // off the green onto South Main
      [2404, -790],     // over the Choate Bridge — mind the stone rail
      [2858, -1319],    // Market Street's shop row
      [3665, -2016],    // the Five Corners swing
      [5426, -3331],    // East Street, downhill now
      [7881, -4055],    // the last bend at the river
      [8682, -4609],    // finish on the Town Wharf
    ],
    route: [3284, 1888, 2577, 1453, 2424, 1098, 2593, -184, 2526, -528, 2404, -790, 2600, -907, 2744, -1083, 2858, -1319, 2848, -1434, 3665, -2016, 4293, -1776, 5353, -3276, 5562, -3434, 6355, -3497, 7415, -3966, 8159, -4108, 8342, -4220, 8682, -4609],
  },
  {
    // the middle — from Market Street straight up the old High Street corridor,
    // past Lords Square and the First Period houses, finishing where High Street
    // meets lunch: the Clam Box, the restaurant shaped like its own takeout box.
    id: 'clambox',
    name: 'Clam Box Run',
    sub: 'Market Street → the Clam Box',
    start: { x: 2126, z: -723 },
    gates: [
      [527, -2325],      // up out of downtown
      [-1432, -4030],    // Lords Square ahead
      [-2057, -4637],
      [-2009, -5484],    // the High Street straightaway begins
      [-3728, -7413],
      [-5817, -8925],
      [-7954, -10405],   // past the old houses, keep pedaling
      [-10092, -11885],
      [-12387, -13093],
      [-14739, -14201],
      [-16702, -15011],  // finish at the Clam Box — order the fried clams
      [-16786, -14895],
    ],
    route: [2126, -723, 2349, -855, -688, -3306, -2057, -4637, -2069, -4809, -1931, -5095, -2009, -5484, -3185, -6592, -3832, -7571, -4628, -8221, -5451, -8672, -10668, -12283, -14954, -14302, -16702, -15011, -16786, -14895],
  },
  {
    // the epic — from the Castle Hill gate the whole length of Argilla Road:
    // the estate bends, the farm straights, Russell Orchards on your left, then
    // County Road home — over the Choate Bridge to finish on Meeting House Green.
    id: 'homecoming',
    name: 'Castle Hill Homecoming',
    sub: 'Castle Hill → Meeting House Green',
    start: { x: 42177, z: -3076 },
    gates: [
      [41049, -829],     // down from the estate gate
      [40101, 1550],     // the first big bend
      [37704, 2381],
      [35144, 2811],     // Argilla's farm straights
      [33221, 4499],
      [31491, 6438],
      [29782, 8395],     // the long marsh-edge run
      [28000, 10287],
      [25801, 11632],
      [23435, 12695],    // Russell Orchards — smell the cider donuts
      [20901, 12213],
      [18524, 11169],
      [16338, 9788],
      [14456, 8015],     // Heartbreak Road junction
      [11918, 7678],
      [9379, 7252],
      [7423, 5669],      // the town line of trees breaks — downtown ahead
      [6488, 3894],
      [4049, 3017],
      [3648, 2476],      // County Road home
      [2532, 1395],      // South Main — one more push
      [2591, -222],      // over the Choate Bridge
      [2821, -1210],     // through Market Street
      [3148, -2861],     // finish on Meeting House Green
    ],
    route: [42177, -3076, 41700, -2659, 41333, -2063, 40742, 504, 40535, 954, 40099, 1553, 39437, 2021, 38882, 2243, 38176, 2355, 37172, 2410, 35645, 2690, 34936, 2861, 34586, 3063, 32131, 5646, 30686, 7435, 27692, 10614, 27146, 10972, 23980, 12524, 23510, 12687, 23085, 12733, 22559, 12650, 20599, 12133, 17636, 10756, 16498, 9936, 15295, 8818, 14777, 8204, 14361, 7959, 13864, 7774, 13325, 7654, 11390, 7687, 10631, 7643, 8865, 7091, 8472, 6901, 7905, 6343, 7335, 5546, 6930, 4851, 6488, 3894, 6264, 3749, 3557, 2854, 3648, 2476, 3538, 2126, 3334, 1916, 2764, 1605, 2532, 1395, 2422, 1012, 2591, -222, 2404, -790, 2664, -972, 2821, -1210, 2848, -1434, 2914, -1467, 2942, -2144, 3148, -2861],
  },
];
