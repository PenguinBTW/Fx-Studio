#!/usr/bin/env bun
// Copies three's Draco decoders into public/draco/ (gitignored) so compressed .glb files decode offline.
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const app = path.resolve(import.meta.dir, '..');
const src = path.join(app, 'node_modules/three/examples/jsm/libs/draco/gltf');
const dst = path.join(app, 'public/draco');
if (!existsSync(src)) {
  console.warn(`[sync_draco] ${src} not found; skipping`);
} else {
  mkdirSync(dst, { recursive: true });
  cpSync(src, dst, { recursive: true });
  console.log('[sync_draco] Draco decoders copied to public/draco/');
}
