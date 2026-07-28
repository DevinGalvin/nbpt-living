import * as THREE from 'three';
import { WorldIndex } from '../world/index';
import { Hud } from './hud';
import { GameAudio } from './audio';
import { loadShot, saveShot } from './shots';
import { townKey } from './saves';
import { TOWN } from '@town';

// Bronze history markers at the real sites, each opening a card written from
// the research dossier — every one a true story (pillar #4, made walkable).
// Read state persists; the travel panel keeps the count.

const READ_KEY = townKey('history-read');
const HISTORIAN_KEY = townKey('historian');

export type Site = { id: string; x: number; z: number; title: string; year: string; body: string; stamp?: string };

// Each town owns its own markers (src/towns/<id>/history.ts, the same pattern
// courses.ts follows). A town with no list simply has no collection — the engine
// never assumes Newburyport's.
export const SITES: Site[] = TOWN.history || [];

function plaqueMesh(seed: number): THREE.Group {
  const g = new THREE.Group();
  const post = new THREE.Mesh(new THREE.BoxGeometry(1.3, 15, 1.3), new THREE.MeshLambertMaterial({ color: '#3a3631' }));
  post.position.y = 7.5;
  post.castShadow = true;
  g.add(post);
  const rim = new THREE.Mesh(new THREE.BoxGeometry(9.2, 7, 0.7), new THREE.MeshLambertMaterial({ color: '#52432c' }));
  rim.position.set(0, 13.4, 0.2);
  rim.rotation.x = -0.13;
  g.add(rim);
  const plate = new THREE.Mesh(
    new THREE.BoxGeometry(8.4, 6.2, 0.6),
    new THREE.MeshLambertMaterial({ color: '#9a7e4e', emissive: '#4a3a1c', emissiveIntensity: 0.25 })
  );
  plate.position.set(0, 13.4, 0.62);
  plate.rotation.x = -0.13;
  g.add(plate);
  g.rotation.y = (seed % 7) * 0.5 - 1.5;
  return g;
}

export class HistoryRunner {
  private read: Set<string>;
  private hud: Hud;
  private audio: GameAudio;
  private index: WorldIndex;
  private nearId: string | null = null;
  private glints = new Map<string, THREE.Mesh>();
  private t = 0;
  private shot: ((cb: (dataUrl: string | null) => void) => void) | null = null;

  constructor(
    scene: THREE.Scene, index: WorldIndex, hud: Hud, audio: GameAudio,
    // asks the renderer for a thumbnail of the very next frame — see Game.captureShot
    shot?: (cb: (dataUrl: string | null) => void) => void,
  ) {
    this.hud = hud;
    this.audio = audio;
    this.index = index;
    this.shot = shot || null;
    try {
      this.read = new Set(JSON.parse(localStorage.getItem(READ_KEY) || '[]'));
    } catch {
      this.read = new Set();
    }
    let seed = 0;
    for (const s of SITES) {
      const m = plaqueMesh(seed++);
      m.position.set(s.x, index.heightAtPx(s.x, s.z), s.z);
      scene.add(m);
      // unread markers carry a small gold glint
      const glint = new THREE.Mesh(
        new THREE.SphereGeometry(1.5, 8, 6),
        new THREE.MeshBasicMaterial({ color: '#ffd24a', transparent: true, opacity: 0.9 })
      );
      glint.position.set(s.x, m.position.y + 22, s.z);
      glint.visible = !this.read.has(s.id);
      scene.add(glint);
      this.glints.set(s.id, glint);
    }
    this.hud.setHistoryCount(this.read.size, SITES.length);
    // the 🏛 collection owns the marker list now: every site gets a slot from the
    // first second, and tapping a found one re-opens its card
    this.hud.initCollection(
      SITES.map((s) => ({ id: s.id, title: s.title, year: s.year, body: s.body, stamp: s.stamp })),
      () => new Set(this.read),
      (id) => this.openCard(id, false),
    );
  }

  // whether a marker currently owns the talk button (eggs defer to us)
  get nearActive(): boolean {
    return this.nearId !== null;
  }

  // Show a site's card. `fresh` is a first find — it gets the banner, the sound and
  // the tally; a re-read from the collection is the same words, quietly.
  private openCard(id: string, fresh: boolean, photo?: string | null) {
    const s = SITES.find((k) => k.id === id);
    if (!s) return;
    this.hud.historyCard(s.title, s.year + ' · ' + TOWN.name, s.body, s.stamp, {
      photo: photo !== undefined ? photo : loadShot(s.id),
      fresh,
      found: this.read.size,
      total: SITES.length,
    });
  }

  // suppressed = the quest system already owns the talk button
  update(dt: number, px: number, pz: number, suppressed: boolean) {
    this.t += dt;
    for (const [id, glint] of this.glints) {
      if (glint.visible) glint.position.y += Math.sin(this.t * 2.6 + glint.position.x) * dt * 1.4;
      void id;
    }
    if (this.hud.dialogueOpen) {
      if (this.nearId) { this.nearId = null; this.hud.showTalk(null); }
      return;
    }
    if (suppressed) {
      this.nearId = null;   // the quest owns the button — don't clobber its TALK
      return;
    }
    let best: Site | null = null;
    let bd = 54;
    for (const s of SITES) {
      const d = Math.hypot(px - s.x, pz - s.z);
      if (d < bd) { bd = d; best = s; }
    }
    if ((best && best.id) !== this.nearId) {
      this.nearId = best ? best.id : null;
      this.hud.showTalk(best ? '\u{1F4DC} READ' : null, () => this.tryInteract(px, pz));
    }
  }

  tryInteract(px: number, pz: number) {
    if (this.hud.dialogueOpen) return;
    let best: Site | null = null;
    let bd = 60;
    for (const s of SITES) {
      const d = Math.hypot(px - s.x, pz - s.z);
      if (d < bd) { bd = d; best = s; }
    }
    if (!best) return;
    const site = best;
    this.hud.showTalk(null);
    this.nearId = null;
    this.audio.paper();

    // Already collected: straight to the card, no fanfare. Re-reading is for
    // looking something up, and confetti on the fourth read is noise.
    if (this.read.has(site.id)) {
      this.openCard(site.id, false);
      return;
    }

    // A NEW one. Bank it first — a failed photo must never cost the discovery —
    // then take the picture of what the kid is looking at right now and open the
    // card with it. The capture rides the next rendered frame, so the card waits a
    // beat; that beat is also what makes it land like a shutter.
    this.read.add(site.id);
    localStorage.setItem(READ_KEY, JSON.stringify([...this.read]));
    const glint = this.glints.get(site.id);
    if (glint) glint.visible = false;
    this.audio.jingle();
    this.hud.setHistoryCount(this.read.size, SITES.length);
    this.hud.refreshCollectCount(true);

    let revealed = false;
    const reveal = (photo: string | null) => {
      if (revealed) return;
      revealed = true;
      if (photo) saveShot(site.id, photo);
      this.openCard(site.id, true, photo);
      if (this.read.size === SITES.length && !localStorage.getItem(HISTORIAN_KEY)) {
        localStorage.setItem(HISTORIAN_KEY, '1');
        setTimeout(() => this.hud.chapterCard('EVERY DISCOVERY FOUND', 'Town Historian', TOWN.name + ' remembers — and now, so do you'), 900);
      }
    };
    if (this.shot) {
      this.shot(reveal);
      // The photo rides the next rendered frame — but if the render loop is stalled
      // (backgrounded tab, a kid alt-tabbing on a Chromebook, a wedged GL context)
      // that frame may never come, and the discovery is already banked. Never leave
      // a kid holding nothing after they walked all the way here: show the card
      // without the picture rather than not at all.
      setTimeout(() => reveal(null), 600);
    } else {
      reveal(null);
    }
  }
}
