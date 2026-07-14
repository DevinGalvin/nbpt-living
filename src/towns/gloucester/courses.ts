// Gloucester race courses — authored on the real road graph with tools/make_course.mjs
// (see src/game/race.ts for the engine).
import type { Course } from '../../game/race';

// The ladder (same design laws as the other towns: somewhat far, somewhat hard,
// climax AT the finish): a dash down Stacy Boulevard past the Man at the Wheel
// and over the Cut to Stage Fort's cannons, the run out to Good Harbor Beach,
// and the long ride home from Bearskin Neck — Rockport to the Boulevard.

export const COURSES: Course[] = [
  {
    // the sprint — off St. Peter's Square, down the Boulevard past the Man at
    // the Wheel and the Fishermen's Wives, over the honking Blynman drawbridge,
    // and up into Stage Fort Park: finish where Gloucester began, 1623.
    id: 'boulevard',
    name: 'Boulevard Dash',
    sub: 'St. Peter’s Square → Stage Fort',
    start: { x: -2297, z: 3303 },
    gates: [
      [-2949, 3298],    // out of the square, down to the water
      [-3448, 4038],    // onto Stacy Boulevard
      [-6009, 4299],    // past the Man at the Wheel — tip your cap
      [-8496, 4971],    // the Cut drawbridge — hope it's down!
      [-10435, 5729],   // around Half Moon Beach
      [-11022, 8268],   // finish at the Stage Fort cannons
    ],
    route: [-2297, 3303, -2633, 3491, -2949, 3298, -3448, 4038, -3895, 4223, -5478, 4249, -7026, 4396, -10435, 5729, -10441, 5872, -10670, 6287, -10842, 6760, -11025, 7585, -11022, 8268],
  },
  {
    // the middle — from City Hall through downtown, out Main Street and over
    // the East Gloucester hills, then the drop to the shore: finish at the
    // Good Harbor footbridge with Salt Island dead ahead.
    id: 'goodharbor',
    name: 'Good Harbor Run',
    sub: 'City Hall → Good Harbor Beach',
    start: { x: -746, z: 853 },
    gates: [
      [69, 1079],       // down past Main Street
      [215, 1937],      // the harbor on your right
      [2016, 200],      // climbing into East Gloucester
      [4363, -685],
      [6561, -2012],    // Portagee Hill country
      [7269, -2421],
      [8900, -4230],    // the long ridge road
      [11074, -5587],
      [13024, -7177],
      [13913, -7773],   // the turn for the shore
      [15107, -6931],
      [15386, -6244],   // Bass Rocks — the open Atlantic!
      [17752, -6984],
      [19840, -6761],   // finish at the Good Harbor footbridge
    ],
    route: [-746, 853, -690, 1196, 69, 1079, 137, 1778, 215, 1937, 1032, 1509, 1304, 1337, 1543, 1100, 1962, 263, 2297, -132, 2728, -335, 4182, -565, 4678, -893, 5015, -1240, 5267, -1407, 6053, -1692, 6727, -2117, 7055, -2170, 7269, -2421, 7342, -3026, 7726, -3306, 8409, -3992, 8758, -4181, 9792, -4539, 11226, -5711, 12288, -6944, 12644, -7103, 13429, -7255, 13913, -7773, 15107, -6931, 15386, -6244, 15726, -6564, 16100, -6798, 16538, -6964, 16923, -7033, 17425, -7028, 19480, -6749, 19840, -6761],
  },
  {
    // the epic — five miles home from Rockport: out of Bearskin Neck, down
    // Route 127 through the woods, over the East Gloucester hills, through
    // downtown, and onto the Boulevard to finish at the Man at the Wheel.
    id: 'homecoming',
    name: 'Rockport Homecoming',
    sub: 'Bearskin Neck → Man at the Wheel',
    start: { x: 29933, z: -39710 },
    gates: [
      [28005, -38436],   // out of Bearskin Neck
      [27027, -36534],   // past Front Beach
      [25591, -35390],   // by Rockport station
      [24498, -33035],   // Route 127 south — settle in
      [23804, -30535],
      [22684, -28305],
      [20570, -26794],   // the granite woods
      [18441, -25306],
      [16843, -23311],
      [15560, -21049],
      [14597, -18652],   // halfway — Dogtown on your right
      [14740, -16108],
      [15878, -13810],
      [16040, -11243],
      [14865, -8995],    // dropping toward town
      [13356, -7219],
      [11316, -5816],
      [9216, -4340],
      [7342, -3026],     // East Gloucester
      [7055, -2170],
      [4783, -1001],
      [4182, -565],
      [2424, -215],      // downtown — almost home
      [732, 1674],
      [-1743, 2259],     // onto the Boulevard
      [-3521, 4088],
      [-5478, 4249],     // finish at the Man at the Wheel
    ],
    route: [29933, -39710, 29866, -39285, 29436, -38806, 28878, -38531, 28005, -38436, 27999, -38261, 27678, -37837, 27027, -36534, 27092, -36367, 25752, -35537, 25591, -35390, 25145, -34286, 24523, -33105, 24055, -31767, 23593, -29500, 23396, -28966, 22933, -28492, 21192, -27188, 19610, -26187, 17727, -24768, 17471, -24417, 15213, -20438, 14993, -19997, 14653, -18971, 14448, -17795, 14477, -17001, 14606, -16405, 15051, -15418, 15754, -14416, 16152, -12477, 16003, -10836, 15905, -10450, 15698, -10062, 13657, -7448, 13356, -7219, 12644, -7103, 12288, -6944, 11226, -5711, 9792, -4539, 8758, -4181, 8409, -3992, 7726, -3306, 7342, -3026, 7269, -2421, 7055, -2170, 6727, -2117, 6053, -1692, 5267, -1407, 5015, -1240, 4678, -893, 4182, -565, 3179, -430, 2424, -215, 2008, 191, 1577, 1043, 1441, 1208, 1032, 1509, 343, 1887, -628, 2241, -1508, 2200, -1878, 2293, -2501, 3015, -3016, 3357, -3525, 4094, -3895, 4223, -5478, 4249],
  },
];
