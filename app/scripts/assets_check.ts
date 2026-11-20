#!/usr/bin/env bun
// Preflight for project assets (scenes/<project>/assets/<id>/). Usage: bun run assets:check [project]
// Checks: model present, no external URIs, supported extensions, manifest parts/material slots/clips, budgets.
import fs from 'node:fs';
import path from 'node:path';

const SUPPORTED = new Set([
  'KHR_draco_mesh_compression', 'KHR_mesh_quantization', 'KHR_texture_transform', 'KHR_lights_punctual',
  'KHR_materials_clearcoat', 'KHR_materials_transmission', 'KHR_materials_ior', 'KHR_materials_specular',
  'KHR_materials_sheen', 'KHR_materials_volume', 'KHR_materials_emissive_strength', 'KHR_materials_iridescence',
  'KHR_materials_anisotropy', 'KHR_materials_dispersion', 'KHR_materials_unlit', 'EXT_mesh_gpu_instancing',
  'EXT_texture_webp', 'EXT_texture_avif',
]);

export interface AssetReport {
  project: string;
  id: string;
  errors: string[];
  warnings: string[];
  stats: { tris: number; textureMB: number; parts: string[]; clips: string[]; morphs: string[]; materials: string[] };
}

/** Parse the JSON chunk of a binary glTF (GLB v2). */
export function parseGlb(buf: Uint8Array): any {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  if (buf.byteLength < 20 || dv.getUint32(0, true) !== 0x46546c67) throw new Error('not a GLB (bad magic)');
  if (dv.getUint32(4, true) !== 2) throw new Error(`unsupported GLB version ${dv.getUint32(4, true)}`);
  const len = dv.getUint32(12, true);
  if (dv.getUint32(16, true) !== 0x4e4f534a) throw new Error('first GLB chunk is not JSON');
  return JSON.parse(new TextDecoder().decode(buf.subarray(20, 20 + len)));
}

export function inspectAsset(dir: string, project: string, id: string, materialsDir: string): AssetReport {
  const r: AssetReport = { project, id, errors: [], warnings: [], stats: { tris: 0, textureMB: 0, parts: [], clips: [], morphs: [], materials: [] } };
  let manifest: any = {};
  const mPath = path.join(dir, 'manifest.json');
  if (fs.existsSync(mPath)) {
    try { manifest = JSON.parse(fs.readFileSync(mPath, 'utf8')); } catch (e) { r.errors.push(`manifest.json: ${(e as Error).message}`); }
  }
  const file = manifest.model ?? (fs.existsSync(path.join(dir, 'model.glb')) ? 'model.glb' : fs.readdirSync(dir).find((f) => /\.(glb|gltf)$/i.test(f)));
  if (!file || !fs.existsSync(path.join(dir, file))) { r.errors.push(`model file missing (${file ?? 'model.glb'})`); return r; }
  if (!manifest.model && file !== 'model.glb') r.warnings.push(`model '${file}' is not 'model.glb'; set "model" in manifest.json or rename`);

  let json: any;
  try {
    const bytes = fs.readFileSync(path.join(dir, file));
    json = /\.gltf$/i.test(file) ? JSON.parse(bytes.toString('utf8')) : parseGlb(new Uint8Array(bytes));
  } catch (e) { r.errors.push(`${file}: ${(e as Error).message}`); return r; }
  if (/\.gltf$/i.test(file)) r.warnings.push('prefer binary .glb (single file, no request waterfall)');

  for (const kind of ['buffers', 'images'] as const) {
    for (const b of json[kind] ?? []) {
      if (b.uri && !String(b.uri).startsWith('data:')) r.errors.push(`external ${kind.slice(0, -1)} URI '${b.uri}' (export as glTF Binary with embedded textures)`);
    }
  }
  for (const ext of json.extensionsRequired ?? []) if (!SUPPORTED.has(ext)) r.errors.push(`required extension '${ext}' is not supported by the engine loader`);
  for (const ext of json.extensionsUsed ?? []) if (!SUPPORTED.has(ext) && !(json.extensionsRequired ?? []).includes(ext)) r.warnings.push(`extension '${ext}' is not supported and will be ignored`);

  const acc = json.accessors ?? [];
  const meshTris = (json.meshes ?? []).map((m: any) =>
    (m.primitives ?? []).reduce((n: number, p: any) => {
      if (p.mode !== undefined && p.mode !== 4) return n;
      const a = p.indices !== undefined ? acc[p.indices] : acc[p.attributes?.POSITION];
      return n + Math.floor((a?.count ?? 0) / 3);
    }, 0),
  );
  const nodes: any[] = json.nodes ?? [];
  const names = new Map<string, number>();
  for (const n of nodes) {
    if (n.mesh !== undefined) r.stats.tris += meshTris[n.mesh] ?? 0;
    if (n.name) names.set(n.name, (names.get(n.name) ?? 0) + 1);
    const part = n.extras?.fx_part ?? n.extras?.fx?.part;
    if (typeof part === 'string') {
      if (r.stats.parts.includes(part)) r.errors.push(`duplicate fx_part '${part}'`);
      r.stats.parts.push(part);
    }
  }
  for (const [n, c] of names) if (c > 1) r.warnings.push(`node name '${n}' appears ${c}x; node()/parts by name are ambiguous`);
  for (const m of json.meshes ?? []) for (const t of m.extras?.targetNames ?? []) if (!r.stats.morphs.includes(t)) r.stats.morphs.push(t);
  const views = json.bufferViews ?? [];
  r.stats.textureMB = (json.images ?? []).reduce((s: number, im: any) => s + (im.bufferView !== undefined ? views[im.bufferView]?.byteLength ?? 0 : 0), 0) / (1024 * 1024);
  r.stats.clips = (json.animations ?? []).map((a: any, i: number) => a.name ?? `animation_${i}`);
  r.stats.materials = (json.materials ?? []).map((m: any) => m.name).filter(Boolean);

  for (const [pid, nodeName] of Object.entries<string>(manifest.parts ?? {})) {
    if (!names.has(nodeName)) r.errors.push(`manifest.parts.${pid}: node '${nodeName}' not found`);
    else if (!r.stats.parts.includes(pid)) r.stats.parts.push(pid);
  }
  for (const [slot, key] of Object.entries<string>(manifest.materials ?? {})) {
    if (!r.stats.materials.includes(slot)) r.errors.push(`manifest.materials: slot '${slot}' not in model (have: ${r.stats.materials.join(', ') || 'none'})`);
    if (!fs.existsSync(path.join(materialsDir, `${key}.ts`))) r.errors.push(`manifest.materials.${slot}: missing ${path.join('materials', `${key}.ts`)}`);
  }
  for (const clip of Object.keys(manifest.clips ?? {})) if (!r.stats.clips.includes(clip)) r.errors.push(`manifest.clips: clip '${clip}' not in model (have: ${r.stats.clips.join(', ') || 'none'})`);
  const b = manifest.budgets ?? {};
  if (b.tris !== undefined && r.stats.tris > b.tris) r.errors.push(`tris ${r.stats.tris} > budget ${b.tris}`);
  if (b.textureMB !== undefined && r.stats.textureMB > b.textureMB) r.errors.push(`textures ${r.stats.textureMB.toFixed(1)} MB > budget ${b.textureMB} MB`);
  return r;
}

export function checkScenes(scenesDir: string, only?: string): AssetReport[] {
  const out: AssetReport[] = [];
  for (const project of fs.existsSync(scenesDir) ? fs.readdirSync(scenesDir) : []) {
    if (only && project !== only) continue;
    const assetsDir = path.join(scenesDir, project, 'assets');
    if (!fs.existsSync(assetsDir) || !fs.statSync(assetsDir).isDirectory()) continue;
    for (const id of fs.readdirSync(assetsDir)) {
      const dir = path.join(assetsDir, id);
      if (fs.statSync(dir).isDirectory()) out.push(inspectAsset(dir, project, id, path.join(scenesDir, project, 'materials')));
    }
  }
  return out;
}

if (import.meta.main) {
  const reports = checkScenes(path.resolve(import.meta.dir, '../src/scenes'), process.argv[2]);
  let errors = 0;
  for (const r of reports) {
    const s = r.stats;
    console.log(`${r.errors.length ? 'FAIL' : 'ok  '} ${r.project}/${r.id}  tris=${s.tris} tex=${s.textureMB.toFixed(1)}MB parts=[${s.parts.join(',')}] clips=[${s.clips.join(',')}] morphs=${s.morphs.length}`);
    for (const e of r.errors) console.log(`     error: ${e}`);
    for (const w of r.warnings) console.log(`     warn:  ${w}`);
    errors += r.errors.length;
  }
  if (reports.length === 0) console.log('[assets:check] no project assets found (scenes/<project>/assets/<id>/)');
  if (errors) { console.error(`[assets:check] ${errors} error(s)`); process.exit(1); }
}
