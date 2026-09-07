import * as THREE from 'three';

// Photo facades: the real storefronts, from photos. A town ships an optional
// towns/<id>/public/facades.json + facades.png (made with tools/facades.html): each
// item is one business's street face, rectified from a phone photo and packed into
// the atlas. At build the decor lays the tile on the building's street wall, proud
// of the brick, sized in metres. No manifest, no change.
export interface FacadeItem {
  name: string;          // the business as named in the map (POI or building name)
  u: number; v: number;  // atlas pixel rect (top-left)
  w: number; h: number;
  widthM: number;        // how wide the photographed face is, in metres
  floors: number | 'all';// 1 = the ground floor only (a shop in a block); 'all' = the whole face
  at?: [number, number]; // world px of the shop's door, for a business the map does not name (nbpt.pos() in the console)
}
export interface FacadeManifest { atlas: string; size: number; items: FacadeItem[] }

export const FACADES: { tex: THREE.Texture | null; size: number; items: FacadeItem[] } = { tex: null, size: 1, items: [] };

/** load the town's facades, if it has any; resolves either way */
export async function loadFacades(): Promise<void> {
  try {
    const res = await fetch('facades.json', { cache: 'no-cache' });
    if (!res.ok) return;
    const man = (await res.json()) as FacadeManifest;
    if (!man || !Array.isArray(man.items) || !man.items.length) return;
    const tex = await new Promise<THREE.Texture>((ok, bad) => new THREE.TextureLoader().load(man.atlas || 'facades.png', ok, undefined, bad));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    FACADES.tex = tex;
    FACADES.size = man.size || tex.image.width || 2048;
    FACADES.items = man.items;
  } catch (err) {
    console.warn('facades unavailable:', err);
  }
}
