// Boston race courses — authored on the real road graph with
// tools/make_course.mjs (see src/game/race.ts for the engine).
//
// The ladder follows the same design laws as every other town (somewhat far,
// somewhat hard, climax AT the finish), except Boston hands all three climaxes
// over for free: the routes are already famous before the race exists. Gates are
// guidance, not rules — any route counts, shortcuts welcome.

import type { Course } from '../../game/race';

export const COURSES: Course[] = [
  {
    // the sprint — the tourist route run flat out. Out of the Public Garden,
    // along Beacon past the State House, down across the Common's corner and
    // through the old crooked streets to the Cradle of Liberty.
    // length 15119px ≈ 1.2 mi ≈ 29s at bike speed
    id: 'freedom',
    name: "Freedom Trail Dash",
    sub: "Public Garden → Faneuil Hall",
    start: { x: -6105, z: 2267 },
    gates: [
  [-6563, 888],
  [-4128, 37],
  [-1640, -718],
  [754, -1616],
  [2678, -906],
  [3340, -1049],
  [3394, -1964],
  [3467, -3411],
  [3912, -3600],
],
    route: [-6105, 2267, -6560, 1017, -6563, 888, -6468, 778, -5880, 569, -1560, -742, 496, -1658, 642, -1657, 2678, -906, 2838, -1122, 3340, -1049, 3394, -1964, 3690, -2240, 3467, -3411, 3912, -3600],
  },
  {
    // the middle — the most famous stretch of running road in America, and the
    // course name is just the two turns. In down Beacon from the Brookline line,
    // through Kenmore, out Commonwealth, then RIGHT on Hereford and LEFT on
    // Boylston for the last quarter mile into Copley Square.
    // length 28578px ≈ 2.2 mi ≈ 54s at bike speed
    id: 'marathon',
    name: "Right on Hereford, Left on Boylston",
    sub: "Beacon Street → the Copley finish line",
    start: { x: -31711, z: 2595 },
    gates: [
  [-31979, 5132],
  [-29412, 5546],
  [-26845, 5960],
  [-24278, 6374],
  [-21705, 6460],
  [-19106, 6383],
  [-16554, 6062],
  [-14109, 5178],
  [-13416, 4927],
  [-13041, 5957],
  [-11530, 5411],
  [-11013, 6839],
  [-9109, 6098],
],
    route: [-31711, 2595, -31979, 5132, -23167, 6553, -22636, 6589, -21940, 6467, -17291, 6329, -13416, 4927, -13556, 4550, -13041, 5957, -11530, 5411, -11013, 6839, -9829, 6452, -9109, 6098],
  },
  {
    // the long one — Olmsted's chain of parks, end to end, and the only course
    // in the set that is essentially all green. The Common and the Public Garden,
    // out the Commonwealth Avenue Mall, through the Back Bay Fens and the
    // Riverway, round Jamaica Pond and down the Arborway into the Arboretum.
    // length 85807px ≈ 6.7 mi ≈ 162s at bike speed
    id: 'necklace',
    name: "The Emerald Necklace",
    sub: "Boston Common → the Arboretum",
    start: { x: -925, z: 1830 },
    gates: [
  [-1421, 3580],
  [-3996, 3609],
  [-5470, 3997],
  [-6105, 2267],
  [-7655, 2831],
  [-7282, 3857],
  [-9724, 4749],
  [-12167, 5640],
  [-14324, 6428],
  [-14071, 7133],
  [-16514, 8022],
  [-18284, 8666],
  [-18475, 9575],
  [-18666, 10709],
  [-19074, 11612],
  [-21036, 11795],
  [-22952, 13136],
  [-23790, 13910],
  [-24754, 13808],
  [-24885, 14627],
  [-24083, 15376],
  [-25235, 17707],
  [-25002, 18190],
  [-27324, 19360],
  [-29575, 20563],
  [-30076, 21884],
  [-31090, 21541],
  [-31101, 20624],
  [-32743, 21724],
  [-32730, 23930],
  [-33213, 26424],
  [-33276, 27329],
  [-34829, 29309],
  [-35754, 31362],
  [-35640, 33620],
  [-35816, 34919],
  [-35138, 35130],
  [-34015, 35897],
  [-34084, 38493],
  [-34659, 41004],
  [-34977, 43501],
  [-34454, 46021],
  [-34333, 48608],
  [-36195, 49880],
  [-37674, 50229],
  [-38299, 51924],
],
    route: [-925, 1830, -1296, 2965, -1421, 3580, -2602, 3468, -3406, 3454, -5470, 3997, -6105, 2267, -7655, 2831, -7282, 3857, -14324, 6428, -14071, 7133, -18284, 8666, -18475, 9575, -18594, 9682, -18710, 10427, -18666, 10709, -18821, 11183, -19074, 11612, -19861, 11712, -20559, 11700, -21036, 11795, -21202, 11718, -21328, 12199, -21598, 12541, -21842, 12699, -23007, 13158, -23790, 13910, -24233, 14020, -24754, 13808, -24691, 14003, -24910, 14391, -24885, 14627, -24580, 14986, -24083, 15376, -25376, 17991, -25002, 18190, -27878, 19640, -29005, 20463, -29357, 20562, -29991, 20565, -30076, 21884, -31090, 21541, -31101, 20624, -31361, 20675, -31681, 20849, -32743, 21724, -33135, 21817, -33222, 22089, -33218, 22275, -32710, 23999, -32650, 24615, -32757, 25304, -33210, 26379, -33276, 27329, -33472, 27645, -34307, 28232, -34471, 28497, -34659, 29060, -34822, 29303, -35067, 29504, -35629, 29797, -35829, 30033, -35895, 30258, -35891, 30503, -35721, 31566, -36041, 32314, -36096, 32562, -36029, 32919, -35705, 33428, -35640, 33620, -35812, 34477, -35816, 34919, -35591, 34918, -35138, 35130, -35194, 35236, -35167, 35300, -34015, 35897, -34069, 36346, -34075, 38364, -34129, 39183, -34440, 40566, -34576, 40879, -34965, 41467, -35060, 41944, -34968, 43659, -34443, 45360, -34469, 46972, -34303, 48092, -34369, 49240, -34702, 49227, -34999, 49305, -36395, 49976, -37466, 50144, -37674, 50229, -37857, 50531, -37988, 51195, -38299, 51924],
  },
];
