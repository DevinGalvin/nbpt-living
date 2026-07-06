// Beverly race courses — authored on the real road graph with tools/make_course.mjs
// (see src/game/race.ts for the engine).
import type { Course } from '../../game/race';

// The ladder (same design laws as the other towns: somewhat far, somewhat hard,
// climax AT the finish): a downtown dash to the Hannah's wharf, the shore run
// out to Lynch Park, and the long ride home from Beverly Farms.

export const COURSES: Course[] = [
  {
    // the sprint — off the Common, down Cabot past City Hall, then the drop to the
    // waterfront: finish at Glover Wharf, where America's first navy ship set sail.
    id: 'hannah',
    name: 'Hannah Dash',
    sub: 'Beverly Common → Glover Wharf',
    start: { x: 3483, z: 6802 },
    gates: [
      [2594, 6228],     // off the Common onto Cabot Street
      [1440, 7934],     // past Ellis Square, downhill through downtown
      [255, 10072],     // by City Hall
      [-1061, 12279],   // Cabot's long run toward the water
      [-2971, 14037],   // the harbor swing
      [-3449, 14629],   // last corner at the waterfront
      [-1932, 14724],   // finish on Glover Wharf — 1775, the schooner Hannah
    ],
    route: [3483, 6802, 2594, 6228, 2262, 6891, 1765, 7652, 1440, 7934, 1211, 7910, 1001, 8251, 440, 9687, -574, 11793, -868, 12122, -2046, 13081, -2977, 14043, -3449, 14629, -3246, 14772, -1932, 14724],
  },
  {
    // the middle — from the 1897 Depot through downtown, then Lothrop Street's
    // shoreline sweep past Independence Park and Dane Street Beach, finishing in
    // Lynch Park by the rose garden.
    id: 'shore',
    name: 'Shore Run',
    sub: 'Beverly Depot → Lynch Park',
    start: { x: -3908, z: 9457 },
    gates: [
      [-4088, 10289],   // out of the Depot yard
      [-3314, 9341],    // up onto the downtown grid
      [-733, 9201],     // crossing Cabot
      [97, 9107],
      [828, 8665],
      [1659, 9052],     // the turn toward the shore
      [3855, 7690],
      [5066, 8139],     // Lothrop Street — the sea on your right
      [6128, 8482],     // Dane Street Beach
      [7379, 7072],
      [8665, 7215],
      [10950, 8290],    // the Cove
      [12751, 8454],
      [13117, 9069],    // into Lynch Park
      [12715, 9969],
      [12664, 10674],   // finish by the rose garden
    ],
    route: [-3908, 9457, -4088, 10289, -3541, 10419, -3314, 9341, -2746, 9428, 97, 9107, 608, 9285, 828, 8665, 1659, 9052, 1932, 8904, 2280, 8563, 2991, 8217, 4383, 7368, 5066, 8139, 5471, 7704, 6128, 8482, 7379, 7072, 7903, 7069, 8527, 7228, 8665, 7215, 8702, 7311, 9116, 7690, 10376, 8176, 11472, 8394, 12751, 8454, 13004, 8777, 13117, 9069, 12963, 9610, 12715, 9969, 12664, 10674],
  },
  {
    // the epic — the whole length of Hale Street: Beverly Farms village, Prides
    // Crossing's little green depot, Endicott's oceanfront, Montserrat, and home
    // into downtown to finish at Ellis Square.
    id: 'homecoming',
    name: 'Farms Homecoming',
    sub: 'Beverly Farms → Ellis Square',
    start: { x: 43257, z: -4003 },
    gates: [
      [40974, -2954],   // out of the Farms village
      [38466, -2421],   // Captain Dusty's on your left
      [36405, -1606],   // Prides Crossing depot
      [34224, -305],
      [32872, 1237],
      [30794, 2726],
      [29469, 4927],    // the Hale Street coast bends
      [27190, 6108],
      [24795, 5757],
      [22514, 4612],    // past Endicott's lawns
      [20256, 3326],
      [18710, 2101],
      [16411, 3117],    // Montserrat
      [13997, 3998],
      [11739, 5193],
      [9639, 6699],
      [7190, 7068],
      [4623, 7251],     // the downtown approach
      [2594, 6228],     // onto Cabot
      [1327, 6448],
      [982, 6026],      // finish at Ellis Square
    ],
    route: [43257, -4003, 43086, -4093, 42517, -3688, 40502, -2730, 40070, -2628, 38878, -2577, 36696, -1749, 36405, -1606, 36238, -1298, 36144, -1224, 35188, -726, 34222, -304, 33194, 699, 32872, 1237, 31626, 1866, 30891, 2551, 30467, 3317, 30272, 3931, 29294, 5144, 27873, 5887, 26515, 6326, 26118, 6363, 25213, 6115, 24982, 5961, 24519, 5456, 24234, 5243, 23296, 4876, 22686, 4702, 21689, 4179, 19556, 2909, 18710, 2101, 18524, 2051, 17943, 2509, 17238, 2925, 15448, 3340, 14621, 3844, 13584, 4099, 12406, 4607, 12067, 4846, 11288, 5669, 9148, 7005, 8706, 7208, 8527, 7228, 7785, 7064, 5134, 7083, 4887, 7122, 4383, 7368, 2594, 6228, 2368, 6684, 1327, 6448, 1243, 6501, 982, 6026],
  },
];
