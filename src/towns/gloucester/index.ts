// Gloucester — America's Oldest Seaport (est. 1623), home of the Man at the
// Wheel, Hammond Castle, Dogtown's carved boulders, and a working fishing
// fleet four hundred years deep. The frame is ALL of Cape Ann, so Rockport's
// Bearskin Neck and the Thacher Island twin lights ride along as in-frame
// nods. World-only sandbox (no story spine), its own race ladder.
//
// ⚠️ Gameplay anchors below marked VERIFY are estimated from lat/lon and must
// be confirmed on the built world.json (on land, right feature) before ship.
import type { TownPack, SpawnAnchor } from '../types';
import { COURSES } from './courses';
import cfg from '../../../towns/gloucester/town.json';

export const TOWN: TownPack = {
  id: 'gloucester',
  name: 'Gloucester',
  title: 'Gloucester',
  tag: 'America’s Oldest Seaport',
  emoji: '🎣',
  path: '/gloucester/',

  story: false,   // world-only sandbox — ?story force-enables the (NBPT) spine for dev

  spawn: cfg.spawn as SpawnAnchor,   // downtown heart landmark (see town.json) — research pass settles the exact spot

  // ✈️ scenic flight from TEN POUND ISLAND — the first successful US Coast
  // Guard air station: "Base 7", 1925, one borrowed Vought UO-1 seaplane and a
  // canvas hangar, flying Prohibition rum-runner patrols (the first-ever
  // aircraft chase of a rum-runner, June 20, 1925). Closed 1935 — replaced by
  // CG Air Station Salem, this game's Salem flight site: the two towns'
  // aviation stories are one continuous arc. Verified: history.uscg.mil,
  // cgaviationhistory.org (see docs/research/gloucester-landmarks.md B2).
  flight: {
    runwayStart: { x: -2330, z: 11668 },      // the old seaplane ramp, Ten Pound Island
    runwayHdg: 0.05,                           // depart south past Eastern Point, out the harbor mouth
    airport: { x: -2330, z: 11668, r: 1400 },
    liftoffMsg: '✈️ Lifting off from Ten Pound Island — first flown for the Coast Guard in 1925',
    promoBody: 'Scenic flights are open to everyone. Head to Ten Pound Island — where Coast Guard aviation began with one seaplane and a canvas hangar in 1925 — and tap ✈️ FLY to soar over the fleet, the Boulevard, and all of Cape Ann. You can’t crash, promise.',
    promoCta: 'Take me to Ten Pound Island',
  },

  beachX: Infinity,      // Good Harbor / Wingaersheek are mapped sand — no recolor zone
  // Rockport reads gray cedar SHINGLE first (Commons harbor + Bearskin Neck
  // photos, docs/research/rockport-manchester.md) — the painted-clapboard
  // palette made the village a row of pale institutional blocks.
  shingleZones: [
    { x: 28800, z: -38900, r: 3400, p: 0.72 },   // the harbor village: Bearskin Neck, Dock Sq, Front/Back Beach
    { x: 24500, z: -55000, r: 3000, p: 0.6 },    // Pigeon Cove
  ],
  sledLane: null,        // Stage Fort's hill is open lawn — no tree clearing needed
  trainPlatform: { x: -3387, z: -1369 },   // Gloucester station (Rockport Line, 1847)
  holidayTree: { x: -2146, z: 3599 },      // St. Peter's Square — the Fiesta heart

  attractions: {
    frogPond: { x: 4798, z: 21710 },      // Niles Pond, Eastern Point — skating + kids' ice sailing
    sledHill: { top: { x: -10305, z: 7998 }, dir: { x: 0.89, z: 0.45 }, run: 900 },   // Stage Fort Park's big lawn — THE snow-day hill
    graveyard: { x: -7726, z: -2204 },    // First Parish Burial Ground (1600s), Centennial Ave — fall mist
  },

  // classic bright New England fall (Gloucester is a harbor town, not a Halloween town)
  fall: {
    fogRange: [1050, 2500],
    hemiSky: '#f2e6cc',
    hemiGround: '#8a8058',
    hemiIntensity: 0.5,
    duskStart: false,
  },
  halloween: 'classic',
  halloweenDisplay: { x: -900, z: 500 },   // downtown by Main St / Dale Ave — VERIFY open spot in preview

  courses: COURSES,
  raceTown: 'gloucester',
  devCourse: 'homecoming',
  racePromo: {
    course: 'boulevard',
    body: 'Real races on real streets! Three courses run through Gloucester — dash the Boulevard past the Man at the Wheel to Stage Fort, run the hills to Good Harbor Beach, or ride five miles home from Bearskin Neck. Beat the clock, top the town leaderboard, and race the leader’s ghost. Any route counts — shortcuts welcome.',
  },

  // GLOUCESTER palette: deep harbor-teal chrome + warm gold accent
  theme: {
    panel: 'linear-gradient(177deg, rgba(26,74,82,0.985), rgba(19,60,67,0.985) 58%, rgba(11,38,43,0.985))',
    maroon: '16, 50, 56',
    maroonLt: '28, 68, 75',
    goldRgb: '224, 178, 58',
    gold: '#e0b23a',
    goldMid: '#eec24a',
    goldBright: '#f8dc88',
  },
  borderLore: {
    'Gloucester': "America's oldest seaport · est. 1623",
    'Rockport': 'incorporated 1840',
    'Essex': 'shipbuilding town · inc. 1819',
    'Manchester-by-the-Sea': 'incorporated 1645',
    'Ipswich': 'birthplace of American independence · est. 1634',
  },
  searchPlaceholder: 'Go anywhere… try “Main Street” or “Good Harbor Beach”',
  fallSeasonLine: 'the leaves turn gold over the harbor',
  streetNudge: '📍 This is the real map of Gloucester.<br><b>Tap to find your street →</b>',
};
