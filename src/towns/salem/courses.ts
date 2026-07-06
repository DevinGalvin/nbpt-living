// Salem race courses — authored on the real road graph with tools/make_course.mjs
// (see src/game/race.ts for the engine).
import type { Course } from '../../game/race';

// Salem's ladder (same design laws as Newburyport's: somewhat far, somewhat hard,
// climax AT the finish): a corner-dense downtown dash to the Witch House, the harbor
// run out to Salem Willows, and the Marblehead epic home to Derby Wharf.

export const COURSES: Course[] = [
  {
    // the sprint — a dash through the McIntire district's tight downtown grid: off the
    // Common, down past the Burying Point, a zig through Derby Square, then Essex
    // Street west to the Witch House. Short, but every leg ends in a real corner.
    id: 'witchhunt',
    name: 'Witch Hunt Dash',
    sub: 'Salem Common → the Witch House',
    start: { x: 7225, z: -7205 },
    gates: [
      [6158, -7068],    // off the Common onto Hawthorne Blvd
      [6366, -5571],    // Hawthorne × Essex — right, into the grid
      [3853, -4961],    // past the Burying Point
      [2973, -4863],    // Derby Square jog
      [2834, -5727],    // up to Essex Street — hard left
      [827, -5665],     // finish at the Witch House
    ],
    route: [7225, -7205, 6158, -7068, 6366, -5571, 5986, -5556, 5447, -5438, 4091, -4988, 2973, -4863, 2834, -5727, 1049, -5723, 827, -5665],
  },
  {
    // the middle — the harbor run: from the Witch House down Essex, past the wharves
    // on Derby Street, then Fort Avenue all the way out the Neck to the seaside park.
    id: 'willows',
    name: 'The Willows Run',
    sub: 'the Witch House → Salem Willows',
    start: { x: 827, z: -5665 },
    gates: [
      [2834, -5727], [2973, -4863], [5495, -5436], [6504, -5544], [7317, -5099],
      [9591, -6359], [11649, -7886], [13131, -10003], [14880, -11821], [16856, -13482],
      [18297, -15561], [19550, -17328], [19143, -17603],
    ],
    route: [827, -5665, 1049, -5723, 2834, -5727, 2973, -4863, 4091, -4988, 5258, -5386, 6174, -5578, 6504, -5544, 6802, -5170, 6795, -5075, 7317, -5099, 9250, -6151, 11198, -7341, 11486, -7602, 12424, -9238, 13203, -10081, 13243, -10187, 13206, -10270, 13640, -10566, 15983, -12937, 16806, -13432, 17959, -14579, 18151, -14969, 18425, -16077, 19550, -17328, 19143, -17603],
  },
  {
    // the epic — Marblehead old town home to Salem: wind out of the tangled peninsula
    // streets, the long coastal road past Salem State, then Lafayette Street flat-out
    // into town and a finish at the Custom House on Derby Wharf, under the Friendship's
    // masts. Open riding in the middle, corners at both ends.
    id: 'marblehead',
    name: 'Marblehead Homecoming',
    sub: 'Marblehead old town → Derby Wharf',
    start: { x: 27090, z: 10053 },
    gates: [
      [28150, 10839], [28408, 11624], [26719, 13591], [25942, 15210], [24148, 17018],
      [21784, 18044], [19285, 18754], [16715, 19133], [14136, 19462], [11578, 19580],
      [9533, 18069], [8479, 15766], [7411, 14662], [7269, 12076], [6541, 9602],
      [5856, 7133], [5503, 4557], [5150, 1981], [4797, -595], [4444, -3171],
      [4332, -3989], [6329, -5041], [8563, -5758],
    ],
    route: [27090, 10053, 28150, 10839, 27834, 11304, 28408, 11624, 26970, 13185, 26533, 13892, 25942, 15210, 24993, 15866, 24763, 16146, 24476, 16685, 24286, 16929, 23359, 17525, 22234, 17947, 21448, 18116, 19769, 18642, 18787, 18869, 12129, 19718, 11728, 19667, 9890, 18602, 9651, 18328, 9539, 18095, 9169, 16620, 9060, 16401, 8533, 15812, 7713, 15119, 7411, 14662, 7474, 13823, 7167, 11210, 6652, 9806, 6104, 8800, 6060, 8620, 4332, -3989, 5729, -4645, 6329, -5041, 7419, -5123, 8563, -5758],
  },
];
