// geode — crystalline formation: amethyst points growing out of matrix rock in the
// dark. The catalog's first crystalline register. A cracked-open cavity lined with
// druzy; crystals nucleate one by one and extend along their axes in compressed time,
// while a slow light sweep makes the facets flash in sequence. Crystals are hexagonal
// prisms with rhombohedral-ish terminations, procedural and exact; growth is scale-along-
// axis as pure f(t). No simulation anywhere.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { W, H } from '../../engine/gl';
import { DepthDoFPass } from '../../engine/dof';
import { smoothstep, mulberry32 } from '../../engine/util';

// hexagonal prism with a pointed termination, unit height along +y, radius r.
// authored once at full size; growth scales the mesh along its axis.
function crystalGeometry(r: number, tipFrac: number): THREE.BufferGeometry {
  const sides = 6;
  const pos: number[] = [];
  const idx: number[] = [];
  // prism ring bottom (y=0) and top of shaft (y = 1 - tipFrac)
  const shaftTop = 1 - tipFrac;
  for (const y of [0, shaftTop]) {
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * Math.PI * 2 + Math.PI / 6; // flat-topped hexagon orientation
      pos.push(r * Math.cos(a), y, r * Math.sin(a));
    }
  }
  // termination pyramid rings: hexagonal pyramid with slight rhombohedral stagger
  const tipY = 1;
  const tipIndex = sides * 2;
  pos.push(0, tipY, 0);
  // shaft side faces
  for (let i = 0; i < sides; i++) {
    const j = (i + 1) % sides;
    idx.push(i, sides + i, j, j, sides + i, sides + j);
  }
  // termination triangles
  for (let i = 0; i < sides; i++) {
    const j = (i + 1) % sides;
    idx.push(sides + i, tipIndex, sides + j);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

interface Crystal {
  basePos: THREE.Vector3;   // nucleation point on the cavity wall
  dir: THREE.Vector3;       // growth axis (roughly cavity-normal + jitter)
  length: number;           // final length
  radius: number;
  birth: number;            // nucleation time
  growDur: number;          // seconds to full length
  mesh?: THREE.Mesh;
}

export default class Geode extends Scene {
  private cam = new THREE.PerspectiveCamera(42, W / H, 0.05, 60);
  private world = new THREE.Scene();
  private dof = new DepthDoFPass();
  private main: THREE.WebGLRenderTarget | null = null;
  private crystals: Crystal[] = [];
  private crystalMat: THREE.MeshPhysicalMaterial | null = null;
  private sweep: THREE.PointLight | null = null;
  private tmp = { a: new THREE.Vector3(), b: new THREE.Vector3(), c: new THREE.Vector3() };

  override async init() {
    const rr = this.ctx.renderer;
    (this as any)._prevShadow = rr.shadowMap.enabled;
    (this as any)._prevType = rr.shadowMap.type;
    rr.shadowMap.enabled = true;
    rr.shadowMap.type = THREE.PCFShadowMap;

    // lighting: near-dark cavity, one cool fill, and the roaming sweep light that
    // makes facets fire in sequence — the sparkle IS the scene
    const fill = new THREE.HemisphereLight(0x1c1630, 0x080604, 0.5);
    const key = new THREE.DirectionalLight(0xcfd8ff, 0.7);
    key.position.set(2, 3, 4);
    this.sweep = new THREE.PointLight(0xfff0dd, 160, 16, 1.5);
    this.sweep.position.set(-3, 2.4, 3.5);
    const rim = new THREE.SpotLight(0xbfd4ff, 34, 20, 0.8, 0.6, 1.2);
    rim.position.set(-2.5, 3.5, -2);
    rim.target.position.set(0, 0, 0);
    this.world.add(fill, key, rim, rim.target, this.sweep);

    // --- the cavity: a rough dark shell the crystals sit inside — inverted sphere
    // with noise-bumped silhouette, open toward the camera
    const shellGeo = new THREE.SphereGeometry(2.6, 36, 28);
    // bump the shell vertices for rocky irregularity
    const rng0 = mulberry32(5);
    const posAttr = shellGeo.getAttribute('position');
    const v = new THREE.Vector3();
    for (let i = 0; i < posAttr.count; i++) {
      v.fromBufferAttribute(posAttr as any, i);
      const bump = 1 + 0.16 * Math.sin(v.x * 4.1 + v.y * 3.3) * Math.cos(v.z * 3.7 + v.y);
      v.multiplyScalar(bump);
      (posAttr as any).setXYZ(i, v.x, v.y, v.z);
    }
    shellGeo.computeVertexNormals();
    const shell = new THREE.Mesh(
      shellGeo,
      new THREE.MeshStandardMaterial({ color: 0x17110c, roughness: 0.98, side: THREE.BackSide }),
    );
    shell.scale.set(2.9, 2.0, 2.2);
    shell.receiveShadow = true;
    this.world.add(shell);

    // --- matrix rock: angular dark boulders the cluster visibly grows from
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x0e0a06, roughness: 1.0, flatShading: true });
    const rockRng = mulberry32(23);
    for (let i = 0; i < 7; i++) {
      const rg = new THREE.IcosahedronGeometry(0.5 + rockRng() * 0.8, 1);
      // jitter vertices for fractured-stone look
      const rp = rg.getAttribute('position');
      const rv = new THREE.Vector3();
      for (let j = 0; j < rp.count; j++) {
        rv.fromBufferAttribute(rp as any, j);
        // displacement must be a pure function of position: polyhedron corners are
        // duplicated per face, and independent jitter tears shared corners apart
        const h = Math.sin(rv.x * 12.9898 + rv.y * 78.233 + rv.z * 37.719) * 43758.5453;
        const jf = (h - Math.floor(h)) - 0.5;
        rv.multiplyScalar(1 + jf * 0.5);
        (rp as any).setXYZ(j, rv.x, rv.y, rv.z);
      }
      rg.computeVertexNormals();
      const rock = new THREE.Mesh(rg, rockMat);
      rock.position.set((rockRng() - 0.5) * 3.6, -1.15 - rockRng() * 0.5, -0.4 - rockRng() * 1.4);
      rock.rotation.set(rockRng() * 3, rockRng() * 3, rockRng() * 3);
      rock.receiveShadow = true;
      this.world.add(rock);
    }

    // --- crystals: nucleation sites distributed over the cavity's lower/inner wall,
    // growing inward. sizes and births staggered — big anchor points first, druzy later
    this.crystalMat = new THREE.MeshPhysicalMaterial({
      color: 0x8a5fe0,
      emissive: 0x2a1060,
      emissiveIntensity: 0.22,
      metalness: 0.1,
      roughness: 0.15,
      transmission: 0.35,
      thickness: 0.6,
      clearcoat: 0.8,
      clearcoatRoughness: 0.2,
      flatShading: true, // facets must read as facets
    });
    const rng = mulberry32(11);
    const druzyCount = 46;
    for (let i = 0; i < druzyCount; i++) {
      // distribute over a bowl-ish patch facing the camera (southern inner wall)
      const az = (rng() - 0.5) * 2.4;
      const el = -0.45 + rng() * 0.9;
      const R = 2.3;
      const px = R * Math.sin(az) * Math.cos(el) * 1.5;
      const py = R * Math.sin(el) * 1.05 - 0.85;
      const pz = -R * Math.cos(az) * Math.cos(el) * 1.15 * 0.6;
      const basePos = new THREE.Vector3(px, py, pz);
      // growth direction: inward-ish toward cavity center + jitter — classic radiating cluster
      const dir = new THREE.Vector3(-px * 0.6, 0.9 + rng() * 0.5, 0.55 + rng() * 0.4).normalize();
      const big = i < 5;
      this.crystals.push({
        basePos,
        dir,
        length: big ? 0.8 + rng() * 0.5 : 0.16 + rng() * 0.34,
        radius: big ? 0.13 + rng() * 0.05 : 0.032 + rng() * 0.045,
        birth: big ? 1.5 + i * 1.1 : 5 + rng() * 15,
        growDur: big ? 7 + rng() * 4 : 4 + rng() * 5,
      });
    }
  }

  override render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const lt = f.t;
    const rr = this.ctx.renderer;

    // crystals grow along their axes as pure f(t) — created at birth, scaled after
    for (const c of this.crystals) {
      const g = smoothstep(c.birth, c.birth + c.growDur, lt);
      if (g <= 0) {
        if (c.mesh) c.mesh.visible = false;
        continue;
      }
      if (!c.mesh) {
        const geo = crystalGeometry(c.radius, 0.38);
        c.mesh = new THREE.Mesh(geo, this.crystalMat!);
        c.mesh.castShadow = true;
        this.world.add(c.mesh);
      }
      c.mesh.visible = true;
      // orient +y along dir, scale length by growth; radius grows slightly too
      // bases are buried into the matrix along the negative growth axis — crystals
      // emerge from stone instead of floating at their nucleation point
      c.mesh.position.copy(c.basePos).addScaledVector(c.dir, -c.length * 0.3);
      this.tmp.c.set(0, 1, 0);
      c.mesh.quaternion.setFromUnitVectors(this.tmp.c, c.dir);
      const len = c.length * (0.25 + 0.75 * g); // nuclei exist small, then extend
      c.mesh.scale.set(0.6 + 0.4 * g, len, 0.6 + 0.4 * g);
    }

    // the sweep light arcs slowly across the cavity — facets ignite in sequence
    const sw = lt * 0.28;
    this.sweep!.position.set(
      Math.sin(sw) * 3.6,
      1.8 + Math.sin(lt * 0.43) * 0.9,
      2.8 + Math.cos(sw * 0.7) * 1.2,
    );
    this.sweep!.intensity = 150 + 40 * Math.sin(lt * 0.8);

    // camera: slow push into the cavity mouth, slight orbit — the crystals are the subject
    const k = smoothstep(0, 30, lt);
    const az = -0.25 + 0.4 * k;
    const rad = 5.6 - 2.2 * k;
    this.cam.position.set(rad * Math.sin(az), 1.5 + 0.3 * k, rad * Math.cos(az));
    this.tmp.b.set(0, -0.15 + 0.15 * k, -0.9);
    this.cam.up.set(0, 1, 0);
    this.cam.lookAt(this.tmp.b);

    const focusD = this.tmp.c.copy(this.tmp.b).sub(this.cam.position).length();

    if (!this.main) {
      this.main = new THREE.WebGLRenderTarget(out.width, out.height, {
        type: THREE.HalfFloatType,
        depthTexture: new THREE.DepthTexture(out.width, out.height, THREE.UnsignedInt248Type),
      });
    }
    rr.setRenderTarget(this.main);
    rr.clear(true, true, true);
    rr.render(this.world, this.cam);

    this.dof.render(rr, this.main.texture, this.main.depthTexture!, {
      enabled: true,
      focusDistance: focusD,
      aperture: 6.0,
      maxRadius: 15,
      samples: 36,
      near: 0.05,
      far: 60,
    }, out);
    rr.resetState();
    return {};
  }

  override dispose() {
    const rr = this.ctx.renderer;
    rr.shadowMap.enabled = (this as any)._prevShadow ?? false;
    rr.shadowMap.type = (this as any)._prevType ?? THREE.PCFShadowMap;
    this.main?.dispose();
    this.dof.dispose();
    this.world.traverse((o: any) => {
      if (o.isMesh) {
        o.geometry?.dispose?.();
      }
    });
    this.crystalMat?.dispose();
    this.world.traverse((o: any) => { if (o.isMesh && o.material?.isMeshStandardMaterial) o.material.dispose?.(); });
    super.dispose();
  }
}
