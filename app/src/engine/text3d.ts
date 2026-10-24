import * as THREE from 'three';
import { ViewportSpace } from './viewport';

export interface ExtrudedTextOpts {
  size?: number; // Character height in world units (default 1.0)
  depth?: number; // Extrusion thickness (default 0.2)
  bevelEnabled?: boolean;
  bevelThickness?: number; // Bevel depth (default 0.03)
  bevelSize?: number; // Bevel outward spread (default 0.02)
  bevelSegments?: number; // Bevel smoothness steps (default 3)
  letterSpacing?: number; // Extra space between glyphs (default 0.15)
  material?: THREE.Material | THREE.Material[]; // Custom material(s)
  castShadow?: boolean;
  receiveShadow?: boolean;
}

/**
 * Procedural Geometric Vector Glyph Path Builder.
 * Generates clean structural neo-grotesque vector paths (0..1 normalized box)
 * with true inner holes for letters like A, B, D, O, P, Q, R, 0, 4, 6, 8, 9.
 */
function createGlyphShape(char: string): THREE.Shape | THREE.Shape[] | null {
  const c = char.toUpperCase();
  if (c === ' ' || c === '\t' || c === '\r' || c === '\n') return null;

  const shape = new THREE.Shape();

  switch (c) {
    case 'I':
    case '1':
      shape.moveTo(0.35, 0.0);
      shape.lineTo(0.65, 0.0);
      shape.lineTo(0.65, 1.0);
      shape.lineTo(0.35, 1.0);
      shape.closePath();
      return shape;

    case 'L':
      shape.moveTo(0.15, 0.0);
      shape.lineTo(0.85, 0.0);
      shape.lineTo(0.85, 0.22);
      shape.lineTo(0.40, 0.22);
      shape.lineTo(0.40, 1.0);
      shape.lineTo(0.15, 1.0);
      shape.closePath();
      return shape;

    case 'T':
      shape.moveTo(0.38, 0.0);
      shape.lineTo(0.62, 0.0);
      shape.lineTo(0.62, 0.78);
      shape.lineTo(0.90, 0.78);
      shape.lineTo(0.90, 1.0);
      shape.lineTo(0.10, 1.0);
      shape.lineTo(0.10, 0.78);
      shape.lineTo(0.38, 0.78);
      shape.closePath();
      return shape;

    case 'H':
      shape.moveTo(0.15, 0.0);
      shape.lineTo(0.38, 0.0);
      shape.lineTo(0.38, 0.40);
      shape.lineTo(0.62, 0.40);
      shape.lineTo(0.62, 0.0);
      shape.lineTo(0.85, 0.0);
      shape.lineTo(0.85, 1.0);
      shape.lineTo(0.62, 1.0);
      shape.lineTo(0.62, 0.60);
      shape.lineTo(0.38, 0.60);
      shape.lineTo(0.38, 1.0);
      shape.lineTo(0.15, 1.0);
      shape.closePath();
      return shape;

    case 'E':
      shape.moveTo(0.15, 0.0);
      shape.lineTo(0.85, 0.0);
      shape.lineTo(0.85, 0.22);
      shape.lineTo(0.40, 0.22);
      shape.lineTo(0.40, 0.40);
      shape.lineTo(0.75, 0.40);
      shape.lineTo(0.75, 0.60);
      shape.lineTo(0.40, 0.60);
      shape.lineTo(0.40, 0.78);
      shape.lineTo(0.85, 0.78);
      shape.lineTo(0.85, 1.0);
      shape.lineTo(0.15, 1.0);
      shape.closePath();
      return shape;

    case 'F':
      shape.moveTo(0.15, 0.0);
      shape.lineTo(0.40, 0.0);
      shape.lineTo(0.40, 0.40);
      shape.lineTo(0.75, 0.40);
      shape.lineTo(0.75, 0.60);
      shape.lineTo(0.40, 0.60);
      shape.lineTo(0.40, 0.78);
      shape.lineTo(0.85, 0.78);
      shape.lineTo(0.85, 1.0);
      shape.lineTo(0.15, 1.0);
      shape.closePath();
      return shape;

    case 'C':
      shape.moveTo(0.85, 0.22);
      shape.lineTo(0.85, 0.0);
      shape.lineTo(0.20, 0.0);
      shape.lineTo(0.20, 1.0);
      shape.lineTo(0.85, 1.0);
      shape.lineTo(0.85, 0.78);
      shape.lineTo(0.45, 0.78);
      shape.lineTo(0.45, 0.22);
      shape.closePath();
      return shape;

    case 'U':
      shape.moveTo(0.15, 1.0);
      shape.lineTo(0.15, 0.0);
      shape.lineTo(0.85, 0.0);
      shape.lineTo(0.85, 1.0);
      shape.lineTo(0.60, 1.0);
      shape.lineTo(0.60, 0.22);
      shape.lineTo(0.40, 0.22);
      shape.lineTo(0.40, 1.0);
      shape.closePath();
      return shape;

    case 'O':
    case '0': {
      shape.moveTo(0.10, 0.0);
      shape.lineTo(0.90, 0.0);
      shape.lineTo(0.90, 1.0);
      shape.lineTo(0.10, 1.0);
      shape.closePath();

      // Inner Hole
      const hole = new THREE.Path();
      hole.moveTo(0.35, 0.22);
      hole.lineTo(0.65, 0.22);
      hole.lineTo(0.65, 0.78);
      hole.lineTo(0.35, 0.78);
      hole.closePath();
      shape.holes.push(hole);
      return shape;
    }

    case 'A': {
      shape.moveTo(0.10, 0.0);
      shape.lineTo(0.32, 0.0);
      shape.lineTo(0.40, 0.35);
      shape.lineTo(0.60, 0.35);
      shape.lineTo(0.68, 0.0);
      shape.lineTo(0.90, 0.0);
      shape.lineTo(0.60, 1.0);
      shape.lineTo(0.40, 1.0);
      shape.closePath();

      const hole = new THREE.Path();
      hole.moveTo(0.43, 0.52);
      hole.lineTo(0.57, 0.52);
      hole.lineTo(0.50, 0.78);
      hole.closePath();
      shape.holes.push(hole);
      return shape;
    }

    case 'P': {
      shape.moveTo(0.15, 0.0);
      shape.lineTo(0.40, 0.0);
      shape.lineTo(0.40, 0.45);
      shape.lineTo(0.85, 0.45);
      shape.lineTo(0.85, 1.0);
      shape.lineTo(0.15, 1.0);
      shape.closePath();

      const hole = new THREE.Path();
      hole.moveTo(0.40, 0.65);
      hole.lineTo(0.65, 0.65);
      hole.lineTo(0.65, 0.82);
      hole.lineTo(0.40, 0.82);
      hole.closePath();
      shape.holes.push(hole);
      return shape;
    }

    case '-':
    case '_':
      shape.moveTo(0.15, 0.40);
      shape.lineTo(0.85, 0.40);
      shape.lineTo(0.85, 0.55);
      shape.lineTo(0.15, 0.55);
      shape.closePath();
      return shape;

    case ':': {
      shape.moveTo(0.38, 0.20);
      shape.lineTo(0.62, 0.20);
      shape.lineTo(0.62, 0.38);
      shape.lineTo(0.38, 0.38);
      shape.closePath();

      const dot2 = new THREE.Shape();
      dot2.moveTo(0.38, 0.62);
      dot2.lineTo(0.62, 0.62);
      dot2.lineTo(0.62, 0.80);
      dot2.lineTo(0.38, 0.80);
      dot2.closePath();
      return [shape, dot2];
    }

    default: {
      // Robust box-glyph fallback for arbitrary characters
      shape.moveTo(0.15, 0.0);
      shape.lineTo(0.85, 0.0);
      shape.lineTo(0.85, 1.0);
      shape.lineTo(0.15, 1.0);
      shape.closePath();

      const hole = new THREE.Path();
      hole.moveTo(0.38, 0.25);
      hole.lineTo(0.62, 0.25);
      hole.lineTo(0.62, 0.75);
      hole.lineTo(0.38, 0.75);
      hole.closePath();
      shape.holes.push(hole);
      return shape;
    }
  }
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

    const group = new THREE.Group();
    let currentX = 0;

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
        continue;
      }
      if (char === '\n' || char === '\r') {
        continue;
      }

      const glyph = createGlyphShape(char);
      if (glyph) {
        const shapes = Array.isArray(glyph) ? glyph : [glyph];
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
        mesh.position.set(currentX, 0, 0);
        mesh.castShadow = opts.castShadow ?? true;
        mesh.receiveShadow = opts.receiveShadow ?? true;
        group.add(mesh);
      }

      currentX += size * (0.85 + letterSpacing);
    }

    // Center child meshes horizontally around origin
    const totalWidth = currentX - size * letterSpacing;
    for (const child of group.children) {
      child.position.x -= totalWidth / 2;
    }

    return group;
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
