// Marblehead race courses — authored on the real road graph with
// tools/make_course.mjs (see src/game/race.ts for the engine).
//
// The ladder follows the same design laws as the other towns — somewhat far,
// somewhat hard, climax AT the finish — and matches their rungs: a ~1 mi sprint,
// a ~2 mi middle, a ~4 mi homecoming.
//
// All three were traced with make_course.mjs and then checked for DOUBLE-BACKS:
// park and beach centroids tend to snap to cul-de-sacs, which produced routes
// that ran into a dead end and back out (Castle Rock and Wyman Woods both did).
// The vias below are on real through-streets, and each route has zero repeated
// points. If you add a course, check for repeats before shipping it.
import type { Course } from '../../game/race';

export const COURSES: Course[] = [
  {
    // the short one: down off the burial-hill ridge past Redd's Pond, through
    // Old Town's crooked lanes to Washington Square, then out to the harbor —
    // finish on the grass at Crocker Park with the whole anchorage in front of you.
    // 13519px ≈ 1.1 mi
    id: 'oldtown',
    name: 'Old Town Sprint',
    sub: "Redd's Pond → Crocker Park",
    start: { x: 6791, z: -8027 },
    gates: [
  [6216, -7770],
  [5465, -6901],
  [5863, -6294],
  [5198, -5934],
  [6448, -5159],
  [4944, -3082],
  [3177, -1708],
  [4849, -2238],
  [5326, -1929],
  [5638, -1745],
    ],
    route: [6791, -8027, 6204, -8064, 6216, -7770, 6080, -7531, 6055, -7315, 5465, -6901, 5863, -6294, 5198, -5934, 6448, -5159, 6257, -4886, 5656, -4358, 5432, -4075, 4779, -2746, 4222, -2527, 3177, -1708, 3425, -1322, 4077, -1908, 4527, -2168, 4849, -2238, 4906, -2126, 5093, -2174, 5095, -1815, 5326, -1929, 5504, -1740, 5638, -1745],
  },
  {
    // over the causeway onto the Neck, down the ocean side past Garmet Beach,
    // then the run up to Chandler-Hovey — the lighthouse at the very tip is the
    // finish, which is the whole point of riding out here.
    // 22959px ≈ 1.8 mi
    id: 'theneck',
    name: 'Out to the Light',
    sub: 'The causeway → Marblehead Light',
    start: { x: 1628, z: 7927 },
    gates: [
  [4172, 7733],
  [6754, 7716],
  [8608, 6288],
  [10015, 5172],
  [12309, 3997],
  [14134, 2917],
  [15023, 523],
  [14720, -620],
  [16526, -2287],
  [17017, -2781],
  [16354, -3850],
    ],
    route: [1628, 7927, 2188, 8090, 3436, 7834, 5200, 7591, 5544, 7580, 7078, 7752, 7633, 7641, 7882, 7504, 8116, 7215, 8513, 6407, 8656, 6228, 9745, 5502, 10015, 5172, 10616, 5010, 11216, 4581, 12033, 4160, 14134, 2917, 14172, 2271, 14258, 1933, 15201, 195, 15205, 35, 15108, -212, 14720, -620, 14796, -1112, 15223, -1479, 15495, -1589, 17019, -2621, 17017, -2781, 16489, -3534, 16354, -3850],
  },
  {
    // the long one: start at the Swampscott line on Preston Beach, up Lafayette,
    // along West Shore Drive with the water on your left the whole way, and home
    // into Old Town — finishing at Crocker Park like the sprint does.
    // 46351px ≈ 3.6 mi
    id: 'homecoming',
    name: 'The Long Way Home',
    sub: 'Preston Beach → Crocker Park',
    start: { x: -14814, z: 19586 },
    gates: [
  [-13307, 17475],
  [-14540, 15726],
  [-14387, 14840],
  [-13511, 12909],
  [-12605, 11838],
  [-14570, 10136],
  [-15293, 7757],
  [-15678, 7134],
  [-13289, 6566],
  [-12321, 6268],
  [-11361, 3882],
  [-10678, 1390],
  [-9208, -655],
  [-7305, -2369],
  [-5342, -1572],
  [-3132, -203],
  [-2418, 238],
  [-1814, -383],
  [521, -1468],
  [1632, -700],
  [2286, -996],
  [4502, -2144],
  [5095, -1815],
  [5638, -1745],
    ],
    route: [-14814, 19586, -14575, 19292, -14147, 18551, -12968, 17041, -14880, 15442, -14387, 14840, -14815, 14388, -14260, 13659, -13714, 13149, -12605, 11838, -14613, 10099, -14506, 9787, -14714, 8695, -15678, 7134, -15674, 7046, -15531, 6836, -12803, 6508, -12547, 6421, -12321, 6268, -11975, 5684, -11444, 4506, -11243, 2987, -11044, 2291, -10222, 267, -9847, -223, -7952, -1503, -7608, -1892, -7030, -2801, -5307, -1547, -2418, 238, -1977, -156, -1814, -383, 521, -1468, 1480, -879, 1632, -700, 2060, -924, 2286, -996, 2517, -920, 3258, -1230, 3425, -1322, 4077, -1908, 4585, -2190, 4849, -2238, 4906, -2126, 5093, -2174, 5095, -1815, 5326, -1929, 5504, -1740, 5638, -1745],
  },
];
