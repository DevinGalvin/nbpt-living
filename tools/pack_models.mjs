// Pack the CC0 prop models into one meshopt-compressed GLB (public/models/props.glb).
//
//   node tools/pack_models.mjs --kenney <pmndrs market-assets>/files/models \
//                              --kaykit <KayKit City Builder Bits>/addons/kaykit_city_builder_bits/Assets/gltf
//
// Each source becomes its own scene, NAMED after the model, which is how
// src/three/assets.ts finds it. Sources: see public/models/CREDITS.md.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, unpartition, meshopt, mergeDocuments } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
import { MeshoptEncoder } from 'meshoptimizer';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const kenney = opt('--kenney'), kaykit = opt('--kaykit');
if (!kenney || !kaykit) { console.error('usage: --kenney <dir> --kaykit <dir>'); process.exit(2); }

const KENNEY = ['sedan', 'hatchback', 'sports-sedan', 'suv', 'suv-luxury', 'van', 'truck', 'delivery-truck', 'police-car', 'taxi', 'tree-big', 'tree-small', 'boat-small', 'boat-large',
  // rigged people (no clips; src/game/life.ts animates the bones itself)
  'male', 'skater-male', 'skater-female'];
const KAYKIT = ['streetlight', 'firehydrant', 'bench', 'trash_A', 'trash_B', 'dumpster', 'trafficlight_A', 'bush'];

await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.decoder': await draco3d.createDecoderModule(),
  'meshopt.encoder': MeshoptEncoder
});

let main = null;
async function add(path, name) {
  const doc = await io.read(path);
  // sources arrive Draco-compressed; the read decodes them, so drop the extension
  for (const e of doc.getRoot().listExtensionsUsed()) if (e.extensionName === 'KHR_draco_mesh_compression') e.dispose();
  const scene = doc.getRoot().listScenes()[0];
  scene.setName(name);
  for (const s of doc.getRoot().listScenes().slice(1)) s.dispose();
  if (!main) main = doc; else mergeDocuments(main, doc);
  console.log('  +', name);
}
for (const n of KENNEY) await add(resolve(kenney, n, 'model.gltf'), n);
for (const n of KAYKIT) await add(resolve(kaykit, `${n}.gltf`), n);

await main.transform(dedup(), prune(), unpartition(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
const out = resolve('public/models/props.glb');
await io.write(out, main);
const scenes = main.getRoot().listScenes().map((s) => s.getName());
console.log(`wrote ${out}: ${scenes.length} scenes`, scenes.join(' '));
