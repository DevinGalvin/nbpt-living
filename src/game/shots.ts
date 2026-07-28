// 📸 Discovery photos.
//
// When a kid finds a history marker we grab the actual frame they were looking at
// and keep it as the picture on their card. It is not stock art — it is *their*
// photo of the thing they walked to, which is the whole point: the collection is a
// record of places they went, not a set of pictures we shipped.
//
// Stored one key per marker (`nbpt-shot-<id>`) rather than one big JSON blob, so a
// quota failure costs one photo instead of the whole album, and so writing the 30th
// photo doesn't re-serialise the other 29.

import { townKey } from './saves';

// per town — two towns can hold a marker with the same id, and one photo must not
// show up on the other town's card
const PREFIX = townKey('shot-');

export function loadShot(id: string): string | null {
  try {
    return localStorage.getItem(PREFIX + id);
  } catch {
    return null;
  }
}

// Best-effort: a full disk drops the picture, never the discovery. The card falls
// back to its illustrated tile and the kid never learns anything went wrong.
export function saveShot(id: string, dataUrl: string): boolean {
  try {
    localStorage.setItem(PREFIX + id, dataUrl);
    return true;
  } catch {
    return false;
  }
}

export function clearShots(ids: string[]) {
  for (const id of ids) {
    try { localStorage.removeItem(PREFIX + id); } catch { /* nothing to do */ }
  }
}
