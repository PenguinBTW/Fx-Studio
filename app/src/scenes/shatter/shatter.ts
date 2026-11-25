// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
// shatter — destruction register: a porcelain plate struck in extreme slow
// motion. Fracture is normally faster than perception; compressed time makes
// the crack race the star. Deterministic Voronoi shards pre-computed from
// sin-hashed seed points; each shard is a flat extruded wedge mesh. Motion is
// fully closed-form: shards hold formation until the crack front (expanding
// radially from the impact point) reaches them, then ballistic drift + tumble.
// No simulation, no physics engine — the breakage is a pure function of t.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { W, H } from '../../engine/gl';
import { smoothstep } from '../../engine/util';
import { CameraRig } from '../../engine/rig';

function hash1(i: number, salt: number): number {
  const h = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return h - Math.floor(h);
}

const N_SHARDS = 26;
const PLATE_R = 3.0;
const IMPACT = new THREE.Vector2(0.8, 0.5);
const STRIKE_T = 3.0;
const CRACK_SPEED = 3.4; // units/s — the front crosses the plate in ~1.4s

interface Shard {
  mesh: THREE.Mesh;
  center: THREE.Vector2;
  dist: number;      // distance from impact — crack-arrival time
  vel: THREE.Vector3;
  axis: THREE.Vector3;
  spin: number;
}

export default class Shatter extends Scene {
  private cam = new THREE.PerspectiveCamera(38, W / H, 0.1, 100);
  private world = new THREE.Scene();
  private rig = new CameraRig('perspective');
  private shards: Shard[] = [];
  private keyLight: THREE.DirectionalLight | null = null;
  private rimLight: THREE.DirectionalLight | null = null;
  private shardMat: THREE.MeshStandardMaterial | null = null;
  private focusDist = 14;
  private disposables: { dispose(): void }[] = [];

  override async init() {
    // ---- Voronoi fracture: seed points, assign plate disc pixels to nearest seed ----
    const seeds: THREE.Vector2[] = [IMPACT.clone()];
    for (let i = 1; i < N_SHARDS; i++) {
      const ang = hash1(i, 1) * Math.PI * 2;
      const rr = Math.sqrt(hash1(i, 2)) * PLATE_R * 0.92;
      seeds.push(new THREE.Vector2(Math.cos(ang) * rr, Math.sin(ang) * rr));
    }
    // build each shard as a fan of small triangles covering the disc, assigned by nearest seed
    const RINGS = 10;
    const SECTORS = 72;
    for (let s = 0; s < N_SHARDS; s++) {
      const positions: number[] = [];
      const cellPts: THREE.Vector2[] = [];
      for (let ri = 0; ri < RINGS; ri++) {
        for (let si = 0; si < SECTORS; si++) {
          const r0 = (ri / RINGS) * PLATE_R;
          const r1 = ((ri + 1) / RINGS) * PLATE_R;
          const a0 = (si / SECTORS) * Math.PI * 2;
          const a1 = ((si + 1) / SECTORS) * Math.PI * 2;
          const quad: [number, number][] = [
            [Math.cos(a0) * r0, Math.sin(a0) * r0],
            [Math.cos(a1) * r0, Math.sin(a1) * r0],
            [Math.cos(a1) * r1, Math.sin(a1) * r1],
            [Math.cos(a0) * r1, Math.sin(a0) * r1],
          ];
          // assign quad by its center to nearest seed
          const cx = (quad[0][0] + quad[2][0]) / 2;
          const cy = (quad[0][1] + quad[2][1]) / 2;
          let best = 0; let bestD = 1e9;
          for (let k = 0; k < N_SHARDS; k++) {
            const d = (cx - seeds[k].x) ** 2 + (cy - seeds[k].y) ** 2;
            if (d < bestD) { bestD = d; best = k; }
          }
          if (best !== s) continue;
          cellPts.push(new THREE.Vector2(cx, cy));
          // corner-shared jitter: adjacent cells jitter identical corners — seams stay sealed
          const cornerKeys: [number, number][] = [[ri, si], [ri, (si + 1) % SECTORS], [ri + 1, (si + 1) % SECTORS], [ri + 1, si]];
          const v = (q: [number, number], cornerIdx: number) => {
            const [cr, cs] = cornerKeys[cornerIdx];
            // jitter fades to zero at the center ring — the shared center must stay one point
            const radScale = Math.min(1, cr / 2);
            const jx = (hash1(cr * 131 + cs, 40) - 0.5) * 0.03 * radScale;
            const jy = (hash1(cr * 131 + cs, 41) - 0.5) * 0.03 * radScale;
            return [q[0] + jx, q[1] + jy, 0];
          };
          const [p0, p1, p2, p3] = [v(quad[0], 0), v(quad[1], 1), v(quad[2], 2), v(quad[3], 3)];
          positions.push(...p0, ...p2, ...p1, ...p0, ...p3, ...p2);
        }
      }
      if (positions.length === 0) continue;
      // shard centroid in plate space
      let ccx = 0, ccy = 0;
      for (const p of cellPts) { ccx += p.x; ccy += p.y; }
      ccx /= cellPts.length; ccy /= cellPts.length;
      // rebase vertices to centroid — mesh origin at shard center
      const geo = new THREE.BufferGeometry();
      const rebased: number[] = [];
      for (let i = 0; i < positions.length; i += 3) {
        rebased.push(positions[i] - ccx, positions[i + 1] - ccy, positions[i + 2]);
      }
      geo.setAttribute('position', new THREE.Float32BufferAttribute(rebased, 3));
      geo.computeVertexNormals();
      const mesh = new THREE.Mesh(geo, null as unknown as THREE.Material);
      this.shards.push({
        mesh,
        center: new THREE.Vector2(ccx, ccy),
        dist: Math.hypot(ccx - IMPACT.x, ccy - IMPACT.y),
        vel: new THREE.Vector3(),
        axis: new THREE.Vector3(),
        spin: 0,
      });
      this.disposables.push(geo);
      mesh.userData.shardIndex = this.shards.length - 1;
    }

    // shard material: white porcelain glaze
    this.shardMat = new THREE.MeshStandardMaterial({
      color: 0xf2efe9,
      roughness: 0.16,
      metalness: 0.05,
      side: THREE.DoubleSide,
    });
    this.disposables.push(this.shardMat);

    // per-shard ballistic parameters, seeded — assigned after material exists
    for (let i = 0; i < this.shards.length; i++) {
      const sh = this.shards[i];
      sh.mesh.material = this.shardMat;
      const dir = new THREE.Vector2(sh.center.x - IMPACT.x, sh.center.y - IMPACT.y);
      const len = Math.max(0.001, dir.length());
      dir.divideScalar(len);
      const speed = (0.5 + hash1(i, 5) * 0.7) * (1.3 - Math.min(1, sh.dist / PLATE_R) * 0.5) * 0.5;
      sh.vel.set(dir.x * speed, dir.y * speed, (hash1(i, 6) - 0.3) * speed * 0.8);
      sh.axis.set(hash1(i, 7) - 0.5, hash1(i, 8) - 0.5, hash1(i, 9) - 0.5).normalize();
      sh.spin = (hash1(i, 10) - 0.5) * 0.9;
      this.world.add(sh.mesh);
    }

    // lighting: key + rim, porcelain does the work
    this.keyLight = new THREE.DirectionalLight(0xfff2e0, 2.4);
    this.keyLight.position.set(4, 6, 8);
    this.world.add(this.keyLight);
    this.rimLight = new THREE.DirectionalLight(0xcfe0ff, 1.6);
    this.rimLight.position.set(-6, 2, -7);
    this.world.add(this.rimLight);
    const amb = new THREE.AmbientLight(0x1a1c22, 1.2);
    this.world.add(amb);
    this.disposables.push({ dispose: () => { this.keyLight?.dispose(); this.rimLight?.dispose(); amb.dispose(); } });

    this.rig.setLensMm(38);
  }

  override render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const rr = this.ctx.renderer;
    const lt = f.t;

    for (const sh of this.shards) {
      // crack front arrival time for this shard
      const arrival = STRIKE_T + sh.dist / CRACK_SPEED;
      const bt = lt - arrival; // ballistic time since crack reached the shard
      if (bt <= 0) {
        // intact: plate formation position
        sh.mesh.position.set(sh.center.x, sh.center.y, 0);
        sh.mesh.rotation.set(0, 0, 0);
        // pre-stress shiver in the final 0.15s before the crack arrives
        const pre = smoothstep(-0.15, 0, bt);
        if (pre > 0) {
          sh.mesh.position.x += Math.sin(lt * 90) * 0.004 * pre;
          sh.mesh.position.y += Math.cos(lt * 83) * 0.004 * pre;
        }
      } else {
        // bounded drift: displacement asymptotes — the halo eases into a constellation
        const dd = (1 - Math.exp(-bt * 0.25)) / 0.25;
        sh.mesh.position.set(
          sh.center.x + sh.vel.x * dd,
          sh.center.y + sh.vel.y * dd,
          sh.vel.z * dd,
        );
        sh.mesh.setRotationFromAxisAngle(sh.axis, sh.spin * bt);
      }
    }

    // camera: slow push-in during calm, hold through shatter, slight pull-back
    const pushIn = smoothstep(0, 3, lt) * 1.5;
    const pullBack = smoothstep(5, 26, lt) * 4.5;
    const radius = 14 - pushIn + pullBack;
    this.rig.orbit([0, 0, 0], radius, 0.18, 0.35 + lt * 0.004);
    const spec = this.rig.evalCam(lt);
    this.rig.syncToThreeCamera(spec, this.cam);

    this.publishBounds(lt);
    rr.setRenderTarget(out);
    rr.setClearColor(0x08090c, 1);
    rr.clear(true, true, true);
    rr.render(this.world, this.cam);
    rr.resetState();
    // flash of exposure at the strike instant
    const flash = Math.exp(-Math.abs(lt - STRIKE_T) * 6) * 0.35;
    this.focusDist = radius;
    return {
      exposure: 1.0 + flash,
      bloom: 0.25 + flash * 0.5,
      vignette: 0.5,
      depthFocusDist: this.focusDist,
      depthAperture: 5,
      depthDof: { near: 0.1, far: 100 },
    } as PostOverrides;
  }


  private publishBounds(lt: number) {
    // raw-scene telemetry rule: publish screen-space bounds of the hero plate to textProbes
    const P = (window as any).__motion || (window as any).__pdoom;
    if (!P || !P.textProbes) return;
    const corners = [
      new THREE.Vector3(-3, -3, 0), new THREE.Vector3(3, -3, 0),
      new THREE.Vector3(3, 3, 0), new THREE.Vector3(-3, 3, 0),
    ];
    let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
    for (const c of corners) {
      const v = c.clone().project(this.cam);
      const sx = (v.x * 0.5 + 0.5) * W;
      const sy = (1 - (v.y * 0.5 + 0.5)) * H;
      minX = Math.min(minX, sx); maxX = Math.max(maxX, sx);
      minY = Math.min(minY, sy); maxY = Math.max(maxY, sy);
    }
    P.textProbes.push({
      frameIdx: P.currentFrameIdx ?? 0,
      t: lt,
      text: 'plate',
      fontFamily: 'Archivo, sans-serif',
      fontPx: 24,
      fillStyle: '#FFFFFF',
      globalAlpha: 1,
      layerId: 'scenegraph',
      bbox: [minX, minY, maxX, maxY],
      w: maxX - minX,
      h: maxY - minY,
      cx: (minX + maxX) / 2,
      cy: (minY + maxY) / 2,
      hPct: (24 / 1080) * 100,
      isStroke: false,
    });
  }

  override dispose() {
    for (const d of this.disposables) d.dispose();
    for (const sh of this.shards) this.world.remove(sh.mesh);
  }
}
