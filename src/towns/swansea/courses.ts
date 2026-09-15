// Swansea race courses — authored on the real road graph with tools/make_course.mjs
// (see src/game/race.ts for the engine).
import type { Course } from '../../game/race';

// The ladder (same design laws as the other towns: somewhat far, somewhat hard,
// climax AT the finish): a sprint from the Town Hall down to the Venus de Milo,
// the Memorial Day parade route through Ocean Grove to the Town Beach, and the
// long ride home from the 1728 Martin House Farm down the Grand Army Highway —
// past the old mall — and up into the village.

export const COURSES: Course[] = [
  {
    // the sprint — off the Town Hall lawn, west along Main Street past the
    // junior high and the dam, then the drop south to Route 6: finish at the
    // Venus de Milo on the Lee River.
    id: 'village',
    name: 'Village Dash',
    sub: 'Town Hall → the Venus de Milo',
    start: { x: -350, z: -732 },
    gates: [
      [-1469, -1374],   // Main Street, past the library
      [-3622, -1081],   // the junior high — hang the left
      [-2819, 1392],    // downhill now
      [-2147, 3849],    // Route 6 ahead
      [417, 5523],      // finish at the Venus — order the minestrone
    ],
    route: [-350, -732, -1182, -1283, -1469, -1374, -3622, -1081, -2648, 1918, -2174, 2857, -2133, 3185, -2155, 4214, 417, 5523],
  },
  {
    // the middle — the Memorial Day parade route, ridden: from St Francis of
    // Assisi down Gardners Neck Road, west along Wilbur Avenue, then Ocean Grove
    // Avenue's shore-hugging bends to the Town Beach.
    id: 'oceangrove',
    name: 'Ocean Grove Run',
    sub: 'St Francis → the Town Beach',
    start: { x: -3918, z: 11591 },
    gates: [
      [-4879, 14001],    // down Gardners Neck Road
      [-5542, 16513],
      [-5762, 17223],    // Wilbur Avenue — swing right
      [-8323, 17436],
      [-10906, 17138],   // over the Cole River
      [-12385, 18287],   // into Ocean Grove
      [-12933, 18843],
      [-14357, 19642],
      [-14420, 20550],   // Ocean Grove Avenue along the water
      [-16247, 20791],
      [-18883, 19757],   // finish at the Town Beach — straight into the bay
    ],
    route: [-3918, 11591, -4396, 12576, -4753, 13567, -5412, 15836, -5645, 17052, -5762, 17223, -6674, 17232, -7730, 17505, -10907, 17138, -12385, 18287, -12892, 18388, -12933, 18843, -14357, 19642, -14404, 19736, -14420, 20550, -16247, 20791, -16562, 20652, -16868, 20401, -18883, 19757],
  },
  {
    // the epic — from the 1728 Martin House Farm in North Swansea, down Stoney
    // Hill Road to the Grand Army Highway and the whole length of the strip —
    // the mall, the car dealers, the Venus turn — then north into the village to
    // finish at the Town Hall.
    id: 'homecoming',
    name: 'Martin House Homecoming',
    sub: 'Martin House Farm → Town Hall',
    start: { x: -46757, z: -15528 },
    gates: [
      [-45075, -14553],   // down Stoney Hill Road
      [-43337, -12620],
      [-41424, -10867],
      [-39380, -9262],    // onto the Grand Army Highway
      [-37075, -8072],
      [-34773, -6879],
      [-32521, -5608],
      [-30071, -4789],
      [-27652, -3838],
      [-25206, -2960],
      [-22714, -2220],    // Luther's Corner off to the right
      [-20169, -1737],
      [-17576, -1537],    // the old mall
      [-15951, -1161],
      [-13865, -1989],
      [-11301, -1770],
      [-8903, -2347],
      [-6390, -2891],     // Memorial Park, then the turn
      [-4047, -3221],     // north — the village ahead
      [-3622, -1081],     // onto Main Street
      [-1469, -1374],
      [-350, -732],       // finish at the Town Hall
    ],
    route: [-46757, -15528, -46375, -16031, -43920, -13240, -42561, -11794, -40337, -9981, -39126, -9071, -38331, -8637, -35577, -7397, -33107, -5807, -32601, -5626, -31158, -5306, -29733, -4628, -25811, -3140, -21734, -1929, -20626, -1772, -17346, -1519, -15951, -1161, -15874, -1323, -15812, -1782, -12966, -2084, -11763, -1885, -10965, -1686, -10036, -1700, -9521, -1866, -8734, -2479, -8304, -2622, -4047, -3221, -3917, -2328, -3622, -1081, -1469, -1374, -1182, -1283, -350, -732],
  },
];
