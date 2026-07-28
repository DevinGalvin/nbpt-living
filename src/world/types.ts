export interface WorldMeta {
  name: string;
  pxPerMeter: number;
  origin: { lat: number; lon: number };
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  attribution: string;
}

export interface Poly {
  k: string;
  p: number[];      // flat ring [x,y,...]
  h?: number[][];   // holes
  n?: string;
  z: number;
  s?: string;       // pitch sport (baseball|basketball|tennis|athletics|...)
  m?: number;       // pier: 1 = boats moor here (real mooring tag)
}

export interface Building {
  p: number[];
  k: string;        // house | commercial | civic | church | industrial | shed | light
  lv: number;       // levels
  n?: string;
  sf?: number;      // 1 = storefront ground floor (real retail-zone/POI evidence)
  style?: string;   // mapped building:architecture — 'federal' | 'georgian' | 'queen_anne'
  // Height its walls START at, world px above the ground — a skybridge, an
  // air-rights span, an elevated station headhouse. Set from OSM `min_height` /
  // `building:min_level`, or inferred at build time for a small thin footprint
  // lying across a road. Such a building must NOT block the street underneath.
  my?: number;
}

export interface Road {
  p: number[];
  c: string;        // motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|service|busway
  w: number;        // width px
  n?: string;
  b?: number;       // bridge
  l?: number;       // OSM layer (vertical stacking where ways cross); absent = 0
}

export interface PathSeg {
  p: number[];
  c: string;        // foot|cycle|board|ped|crossing|steps|track|pierline|stoneline|runway|taxiway
  w: number;
  n?: string;
  b?: number;
  l?: number;       // OSM layer (vertical stacking where ways cross); absent = 0
  m?: number;       // dock line: 1 = boats moor here
  s?: string;       // surface (runways: asphalt|grass)
}

export interface Label {
  x: number;
  y: number;
  t: string;
  k: string;        // bldg | area | water
  s: number;        // size hint 0|1
}

export interface Landmark {
  id: string;
  name: string;
  sub: string;
  x: number;
  y: number;
  r: number;
}

export interface Poi {
  x: number;
  y: number;
  k: string;
  n: string;
}

export interface Barrier {
  p: number[];
  k: string; // fence | hedge | wall | picket (white post-and-rail, hand-mapped yards)
}

// a municipality's outer ring(s) in world px (baked from OSM admin boundaries)
export interface TownArea {
  n: string;
  p: number[][];
}

// a roadside "Welcome to …" sign spot: where a real road crosses a town line;
// yaw `a` faces the arriving player, `n` = the town being entered
export interface TownSign {
  x: number;
  y: number;
  a: number;
  n: string;
}

export interface WorldData {
  meta: WorldMeta;
  polys: Poly[];
  buildings: Building[];
  roads: Road[];
  paths: PathSeg[];
  rails: { p: number[] }[];
  labels: Label[];
  landmarks: Landmark[];
  pois: Poi[];
  barriers: Barrier[];          // real mapped property-line barriers
  trees: { x: number; y: number }[]; // real surveyed tree positions
  addrs: { s: string; a: [string, number, number][] }[]; // mapped addresses per street
  power: { p: number[]; c: string }[]; // mapped power lines (vertices = poles)
  towns?: TownArea[];           // municipal boundaries — "Entering …" banner + welcome signs
  signs?: TownSign[];           // welcome-sign spots (tools/lib/borders.mjs)
}
