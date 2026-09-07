// The Newburyport/Rockport Line, stop by stop, the way the timetable board shows
// it. A stop with a `town` is one of our towns; it is boardable only when that
// town's build has a platform placed (TOWN.trainPlatform) — the rest are shown and
// passed through, never pretended. Keep BOARDABLE honest when a platform is added.
export interface LineStop { name: string; town?: string }

export const LINE: LineStop[] = [
  { name: 'Newburyport', town: 'nbpt' },
  { name: 'Rowley' },
  { name: 'Ipswich', town: 'ipswich' },
  { name: 'Hamilton / Wenham' },
  { name: 'North Beverly' },
  { name: 'Beverly', town: 'beverly' },
];
// past Beverly the line splits: the Rockport branch up the cape, the main line in to Boston
export const BRANCH_ROCKPORT: LineStop[] = [
  { name: 'Montserrat' },
  { name: 'Prides Crossing' },
  { name: 'Beverly Farms' },
  { name: 'Manchester', town: 'manchester' },
  { name: 'West Gloucester' },
  { name: 'Gloucester', town: 'gloucester' },
  { name: 'Rockport', town: 'rockport' },
];
export const BRANCH_BOSTON: LineStop[] = [
  { name: 'Salem', town: 'salem' },
  { name: 'Swampscott' },
  { name: 'Lynn' },
  { name: 'Chelsea' },
  { name: 'North Station', town: 'boston' },
];
/** towns whose build has a platform on the line (see each town's trainPlatform) */
export const BOARDABLE = new Set(['nbpt', 'ipswich', 'beverly', 'manchester', 'gloucester', 'rockport']);
