import * as THREE from 'three';
import { ViewportSpace } from './viewport';
import { getGlyph } from './vectorglyphs';
import { revealProgress, type RevealOpts } from './textfx';

export interface ExtrudedTextOpts {
  size?: number; // Character height in world units (default 1.0)
  depth?: number; // Extrusion thickness (default 0.2)
  bevelEnabled?: boolean;
  bevelThickness?: number; // Bevel depth (default 0.03)
  bevelSize?: number; // Bevel outward spread (default 0.02)
  bevelSegments?: number; // Bevel smoothness steps (default 3)
  letterSpacing?: number; // Extra space between glyphs (default 0.18)
  fixedAdvance?: boolean; // Legacy fixed 0.85 em advance per glyph instead of per-glyph widths
  material?: THREE.Material | THREE.Material[]; // Custom material(s)
  castShadow?: boolean;
  receiveShadow?: boolean;
}

export { VectorGlyphs } from './vectorglyphs';

export interface ExtrudedGlyph {
  index: number; // index into the source string
  char: string;
  word: number;
  center: [number, number, number]; // world-space ink box centre
  min: [number, number, number];
  max: [number, number, number];
  radius: number; // half-diagonal of the ink box (bounding sphere for deflection)
  screen: [number, number, number] | null; // [x, y, viewDepth] in logical px, or null if off-camera
}

/**
 * ExtrudedText: Universal Procedural 3D Mesh Typography Engine.
 * Constructs volumetric 3D letters with bevels, shadows, and diegetic lighting.
 */
export class ExtrudedText {
  /**
   * Creates an extruded 3D text group or mesh with bevels and world positioning.
   */
  static create(text: string, opts: ExtrudedTextOpts = {}): THREE.Group {
    const size = opts.size ?? 1.0;
    const depth = opts.depth ?? 0.2;
    const bevelEnabled = opts.bevelEnabled ?? true;
    const bevelThickness = opts.bevelThickness ?? 0.03;
    const bevelSize = opts.bevelSize ?? 0.02;
    const bevelSegments = opts.bevelSegments ?? 3;
    const letterSpacing = opts.letterSpacing ?? 0.18;
    const fixedAdvance = opts.fixedAdvance ?? false;

    const group = new THREE.Group();
    let currentX = 0;
    let wordIdx = 0;
    let prevSpace = false;

    const defaultMaterial = new THREE.MeshStandardMaterial({
      color: 0xe8e4da,
      roughness: 0.3,
      metalness: 0.2,
    });
    const material = opts.material ?? defaultMaterial;

    for (let i = 0; i < text.length; i++) {
      const char = text[i]!;
      if (char === ' ' || char === '\t') {
        currentX += size * 0.5;
        if (!prevSpace) wordIdx++;
        prevSpace = true;
        continue;
      }
      if (char === '\n' || char === '\r') {
        continue;
      }

      prevSpace = false;
      const info = getGlyph(char);
      const adv = info && !fixedAdvance ? info.advance : 0.85;
      if (info) {
        const shapes = info.shapes;
        const geom = new THREE.ExtrudeGeometry(shapes, {
          depth,
          bevelEnabled,
          bevelThickness,
          bevelSize,
          bevelSegments,
        });

        // Uniformly scale geometry to match requested size
        geom.scale(size, size, size);

        const mesh = new THREE.Mesh(geom, material);
        mesh.position.set(fixedAdvance ? currentX : currentX + size * (adv - (info.x1 - info.x0)) / 2 - size * info.x0, 0, 0);
        mesh.castShadow = opts.castShadow ?? true;
        mesh.receiveShadow = opts.receiveShadow ?? true;
        mesh.userData.glyph = { index: i, char, word: wordIdx, advance: size * adv };
        group.add(mesh);
      }

      currentX += size * (adv + letterSpacing);
    }

    // Center child meshes horizontally around origin
    const totalWidth = currentX - size * letterSpacing;
    for (const child of group.children) {
      child.position.x -= totalWidth / 2;
      child.userData.glyph.base = [child.position.x, child.position.y, child.position.z];
    }

    return group;
  }

  /**
   * Letter-level hook: world position/extent of every glyph (ink box), plus 1080p screen position when a
   * camera is given. Call after the group's transform and the camera are final for the frame.
   */
  static glyphs(group: THREE.Group, cam?: THREE.Camera, viewportW = 1920, viewportH = 1080): ExtrudedGlyph[] {
    group.updateMatrixWorld(true);
    const out: ExtrudedGlyph[] = [];
    const box = new THREE.Box3();
    const c = new THREE.Vector3(), sz = new THREE.Vector3();
    for (const child of group.children) {
      const g = child.userData.glyph as { index: number; char: string; word: number } | undefined;
      if (!g || !(child as THREE.Mesh).isMesh) continue;
      box.setFromObject(child);
      box.getCenter(c);
      box.getSize(sz);
      const center: [number, number, number] = [c.x, c.y, c.z];
      out.push({
        index: g.index, char: g.char, word: g.word,
        center,
        min: [box.min.x, box.min.y, box.min.z],
        max: [box.max.x, box.max.y, box.max.z],
        radius: Math.hypot(sz.x, sz.y, sz.z) / 2,
        screen: cam ? ViewportSpace.worldToScreen(center, cam, viewportW, viewportH) : null,
      });
    }
    return out.sort((a, b) => a.index - b.index);
  }

  /**
   * Word-by-word or letter-by-letter reveal driven by time: sets visibility/scale/offset per glyph (and a
   * cloned-material opacity for 'fade'). Pure function of t; call every frame.
   */
  static reveal(group: THREE.Group, t: number, o: RevealOpts & { slideDistance?: number }): void {
    const meshes = group.children.filter((ch) => ch.userData.glyph) as THREE.Mesh[];
    const n = o.unit === 'word' ? (meshes.length ? Math.max(...meshes.map((m) => m.userData.glyph.word)) + 1 : 0) : meshes.length;
    const slide = o.slideDistance ?? 0.4;
    meshes.forEach((m, k) => {
      const g = m.userData.glyph;
      const i = o.unit === 'word' ? g.word : k;
      const p = revealProgress(t, o, i, n);
      const motion = o.motion ?? 'fade';
      m.visible = p > 0;
      m.position.set(g.base[0], g.base[1] + (motion === 'slide-up' ? (1 - p) * -slide : 0), g.base[2]);
      m.scale.setScalar(motion === 'scale-pop' ? 0.3 + 0.7 * p : 1);
      if (motion === 'fade' || motion === 'slide-up') {
        if (!m.userData.fadeMat) {
          const src = Array.isArray(m.material) ? m.material[0]! : m.material;
          const mat = src.clone();
          mat.transparent = true;
          m.userData.fadeMat = mat;
          m.material = mat;
        }
        (m.material as THREE.Material).opacity = p;
      }
    });
  }

  /**
   * Calculates 2D screen bounding box [minX, minY, maxX, maxY] for telemetry auditing.
   */
  static getScreenBounds(
    group: THREE.Group,
    cam: THREE.Camera,
    viewportW: number,
    viewportH: number
  ): [number, number, number, number] {
    group.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(group);
    if (box.isEmpty()) return [0, 0, 0, 0];

    const corners = [
      new THREE.Vector3(box.min.x, box.min.y, box.min.z),
      new THREE.Vector3(box.min.x, box.min.y, box.max.z),
      new THREE.Vector3(box.min.x, box.max.y, box.min.z),
      new THREE.Vector3(box.min.x, box.max.y, box.max.z),
      new THREE.Vector3(box.max.x, box.min.y, box.min.z),
      new THREE.Vector3(box.max.x, box.min.y, box.max.z),
      new THREE.Vector3(box.max.x, box.max.y, box.min.z),
      new THREE.Vector3(box.max.x, box.max.y, box.max.z),
    ];

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let anyVisible = false;

    for (const c of corners) {
      const proj = ViewportSpace.worldToScreen([c.x, c.y, c.z], cam, viewportW, viewportH);
      if (proj) {
        anyVisible = true;
        if (proj[0] < minX) minX = proj[0];
        if (proj[1] < minY) minY = proj[1];
        if (proj[0] > maxX) maxX = proj[0];
        if (proj[1] > maxY) maxY = proj[1];
      }
    }

    if (!anyVisible) {
      return [0, 0, 0, 0];
    }

    return [
      Math.max(0, Math.floor(minX)),
      Math.max(0, Math.floor(minY)),
      Math.min(viewportW, Math.ceil(maxX)),
      Math.min(viewportH, Math.ceil(maxY)),
    ];
  }

  static dispose(group: THREE.Group): void {
    group.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.geometry?.dispose();
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((m) => m?.dispose?.());
        } else {
          mesh.material?.dispose?.();
        }
      }
    });
  }
}
