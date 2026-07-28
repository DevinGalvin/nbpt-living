import { TOWN } from '@town';

// Every town is served from the SAME origin (clippertown.io/, /gloucester/, /salem/…),
// so they all share one localStorage. Most keys are deliberately shared — your race
// name and ghost preference should follow you between towns — but anything that COUNTS
// something per town must not be, or Gloucester reports "14 of 22 discovered" using
// Newburyport's finds.
//
// Newburyport keeps its historical un-prefixed keys: real players out there already
// have `nbpt-history-read` populated, and a rename would silently wipe a collection
// they spent hours on. New towns get their own namespace.
export function townKey(suffix: string): string {
  return TOWN.id === 'nbpt' ? 'nbpt-' + suffix : TOWN.id + '-' + suffix;
}
