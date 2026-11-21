// Dimension Flight — a swallow's flight through five dimensions, each entered through its own gateway.
// One continuous camera rides the bird's trail; the world beyond the next portal is rendered with the
// same camera (clipped to the far side of the membrane) and shown through it, so every crossing is seamless.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { W, H, PW, PH, makeRT } from '../../engine/gl';
import { smoothstep } from '../../engine/util';
import { Swallow } from './swallow';
import { PLUMAGE_RIM } from './materials/plumage';
const RIM_BY_WORLD = ['#34446a', '#b08870', '#9a88ff', '#7a6a50', '#8a6050'];
import { DepthDoFPass } from '../../engine/dof';
import { GLTFManager } from '../../engine/gltf';
import { resolveAsset } from '../../engine/assets';
import { Portal } from './portals';
import type { World } from './world';
import { BIRD, PORTALS, FLAP, FOLD, CAM_LAG, CAM_OFF, CAM_FOV, DIVE } from './path';
import { overworld } from './w_overworld';
import { nether } from './w_nether';
import { theEnd } from './w_end';
import { aether } from './w_aether';
import { sift, siftH } from './w_sift';
import { owHeight } from './w_overworld';

/** Composed hero shots: the trailing camera cranes out to a fixed dolly (a→b) mid-world, away from every portal window. */
type Shot = { t0: number; t1: number; a: [number, number, number]; b: [number, number, number]; fov: number; ground?: (x: number, z: number) => number };
const SHOTS: Shot[] = [
  { t0: -3, t1: 5.6, a: [-6, 40, 64], b: [-14, 20, -14], fov: 36, ground: owHeight },
  { t0: 19.6, t1: 24.4, a: [-26, 14, -318], b: [-14, 18, -352], fov: 40 },
  { t0: 25.6, t1: 29.8, a: [4, 64, -408], b: [-2, 72, -434], fov: 44 },
  { t0: 32.4, t1: 43, a: [12, -26, -488], b: [26, -64, -572], fov: 38 },
  { t0: 51.8, t1: 58.8, a: [-20, -56, -805], b: [-26, -50, -868], fov: 38 },
  { t0: 66.6, t1: 74.2, a: [20, -42, -1040], b: [22, -44, -1084], fov: 40, ground: siftH },
  { t0: 76.2, t1: 86, a: [-14, -40, -1140], b: [-75, -62, -1090], fov: 56, ground: siftH },
];
const SHOT_RAMP = 1.6, _hp = new THREE.Vector3(), _hb = new THREE.Vector3();
function heroAt(t: number): { w: number; fov: number; p: THREE.Vector3 } {
  for (const s of SHOTS) {
    if (t <= s.t0 || t >= s.t1) continue;
    const w = smoothstep(s.t0, s.t0 + SHOT_RAMP, t) * (1 - smoothstep(s.t1 - SHOT_RAMP, s.t1, t));
    const k = smoothstep(s.t0, s.t1, t);
    _hp.fromArray(s.a).lerp(_hb.fromArray(s.b), k);
    if (s.ground) _hp.y = Math.max(_hp.y, s.ground(_hp.x, _hp.z) + 4);
    return { w: w * w * (3 - 2 * w), fov: s.fov, p: _hp };
  }
  return { w: 0, fov: 0, p: _hp };
}

const V = () => new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0), DOWNZ = new THREE.Vector3(0, 0, -1);

export default class Odyssey extends Scene {
  private cam = new THREE.PerspectiveCamera(50, W / H, 0.1, 9000);
  private bird = new Swallow();
  private worlds: World[] = [];
  private portals: Portal[] = [];
  private rt = makeRT(W, H);
  private camCross: number[] = [];
  private tmp = { a: V(), b: V(), c: V(), d: V(), e: V(), f: V() };

  override async init() {
    const r = this.ctx.renderer;
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
    await this.bird.load(this.ctx.project ?? 'dimension_flight');
    const ow = overworld(r);
    const nw = nether(r);
    const ew = theEnd(r);
    const aw = aether(r);
    const sw = sift(r);
    this.worlds = [ow, nw, ew, aw, sw];
    const trees = resolveAsset('trees', this.ctx.project ?? 'dimension_flight');
    const treeInst = await GLTFManager.instantiate(trees.url, {});
    ow.plant((id) => treeInst.part(id));
    const np = resolveAsset('nether_props', this.ctx.project ?? 'dimension_flight');
    const npInst = await GLTFManager.instantiate(np.url, {});
    nw.plant((id) => npInst.part(id));
    const ch = resolveAsset('chorus', this.ctx.project ?? 'dimension_flight');
    const chInst = await GLTFManager.instantiate(ch.url, {});
    ew.plant((id) => chInst.part(id));
    const sk = resolveAsset('skyroot', this.ctx.project ?? 'dimension_flight');
    const skInst = await GLTFManager.instantiate(sk.url, {});
    aw.plant((id) => skInst.part(id));
    const sf = resolveAsset('sift_flora', this.ctx.project ?? 'dimension_flight');
    const sfInst = await GLTFManager.instantiate(sf.url, {});
    sw.plant((id) => sfInst.part(id));
    const res = new THREE.Vector2(PW, PH);
    PORTALS.forEach((p, i) => {
      const portal = new Portal(p.kind, new THREE.Vector3(...p.c), new THREE.Vector3(...p.n), this.rt.texture, res);
      this.portals.push(portal); this.worlds[i]!.scene.add(portal.group);
    });
    await Promise.all(this.portals.map((p) => p.loadFrame(this.ctx.project ?? 'dimension_flight')));
    // camera crossing times (camera rides the bird's trail; find where it pierces each membrane)
    const cp = V();
    for (const P of this.portals) {
      const T = PORTALS[this.portals.indexOf(P)]!.t;
      let prev = -1, tc = T + 0.3;
      for (let t = T - 2; t < T + 4; t += 1 / 480) {
        this.camPos(t, cp); const s = P.side(cp);
        if (prev < 0 && s >= 0 && P.inside(cp, 0.5)) { tc = t; break; }
        prev = s;
      }
      this.camCross.push(tc);
    }
  }

  private camPos(t: number, out: THREE.Vector3) {
    BIRD.at(t - CAM_LAG.at(t), out).add(CAM_OFF.at(t, this.tmp.f));
    const h = heroAt(t);
    return h.w > 0 ? out.lerp(h.p, h.w) : out;
  }

  private poseBird(t: number) {
    const { a: p, b: vel, c: acc, d: right, e: up } = this.tmp;
    BIRD.at(t, p); BIRD.vel(t, vel);
    const v2 = BIRD.vel(t + 0.05, V()), v1 = BIRD.vel(t - 0.05, V());
    acc.subVectors(v2, v1).divideScalar(0.1);
    const fwd = vel.clone().normalize();
    up.copy(UP).lerp(DOWNZ, DIVE.at(t)).normalize();
    right.crossVectors(up, fwd).normalize(); up.crossVectors(fwd, right);
    const bank = THREE.MathUtils.clamp(acc.dot(right) * 0.05, -0.9, 0.9);
    const pitchUp = 0;
    const m = new THREE.Matrix4().makeBasis(right, up, fwd);
    this.bird.group.quaternion.setFromRotationMatrix(m).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(pitchUp, 0, -bank)));
    this.bird.group.position.copy(p);
    const amp = THREE.MathUtils.clamp(FLAP.at(t), 0, 1), fold = THREE.MathUtils.clamp(FOLD.at(t), 0, 1);
    this.bird.pose(t, amp, fold);
    return p;
  }

  private dof = new DepthDoFPass();
  private main: THREE.WebGLRenderTarget | null = null;
  private mainRT(out: THREE.WebGLRenderTarget) {
    if (this.main && this.main.width === out.width && this.main.height === out.height) return this.main;
    this.main?.dispose();
    this.main = new THREE.WebGLRenderTarget(out.width, out.height, { type: THREE.HalfFloatType, depthTexture: new THREE.DepthTexture(out.width, out.height) });
    return this.main;
  }

  override render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t, r = this.ctx.renderer;
    // camera
    const cam = this.cam;
    this.camPos(t, cam.position);
    const birdP = this.poseBird(t).clone();
    const look = birdP.clone().addScaledVector(BIRD.vel(t, V()), 0.12);
    cam.up.copy(UP).lerp(DOWNZ, DIVE.at(t - 0.2)).normalize();
    { const h = heroAt(t); cam.fov = THREE.MathUtils.lerp(CAM_FOV.at(t), h.fov, h.w); }
    // keep the swallow's wingspan between ~18% and ~50% of frame height (portal windows excluded so crossings stay exact)
    {
      const gap = Math.min(...PORTALS.map((P) => Math.abs(t - P.t)));
      const cw = smoothstep(2.6, 3.8, gap);
      if (cw > 0) {
        const span = 3.4, tf = 2 * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2);
        const v = cam.position.clone().sub(birdP), d = v.length();
        const dc = THREE.MathUtils.lerp(d, THREE.MathUtils.clamp(d, span / (tf * 0.6), span / (tf * 0.3)), cw);
        if (Math.abs(dc - d) > 1e-3) cam.position.copy(birdP).addScaledVector(v.normalize(), dc);
      }
    } cam.updateProjectionMatrix();
    cam.lookAt(look); cam.updateMatrixWorld();

    let k = 0; while (k < this.camCross.length && t >= this.camCross[k]!) k++;
    let bw = 0; while (bw < PORTALS.length && t >= PORTALS[bw]!.t) bw++;
    this.worlds[bw]!.scene.add(this.bird.group);
    PLUMAGE_RIM.value.set(RIM_BY_WORLD[bw] ?? '#b8d0ff');

    const cur = this.worlds[k]!;
    cur.update(t, cam, birdP);
    for (const P of this.portals) { P.update(t, 0); P.mat.uniforms.uView!.value = 0; }

    if (k < this.portals.length) {
      const P = this.portals[k]!, d = -P.side(cam.position);
      P.update(t, 1 - smoothstep(3, 45, d));
      if (d > 0 && d < 900) {
        const next = this.worlds[k + 1]!;
        next.update(t, cam, birdP);
        r.setRenderTarget(this.rt); r.setClearColor(0x000000, 1); r.clear();
        // other membranes sample this.rt: hide them so the preview never reads its own target
        for (const Q of this.portals) Q.membrane.visible = false;
        r.clippingPlanes = [P.plane];
        r.render(next.scene, cam);
        r.clippingPlanes = [];
        for (const Q of this.portals) Q.membrane.visible = true;
        P.mat.uniforms.uView!.value = 1;
      }
    }
    // world + overlays into a depth-textured target, then physical DoF focused on the bird into `out`
    const main = this.mainRT(out);
    r.setRenderTarget(main); r.setClearColor(0x000000, 1); r.clear();
    r.render(cur.scene, cam);
    cur.overlay?.(r, cam, main, t);
    r.resetState();
    this.dof.render(r, main.texture, main.depthTexture!, { enabled: true, focusDistance: cam.position.distanceTo(birdP), aperture: 2.2, maxRadius: 3.5, blades: 0, near: cam.near, far: cam.far, samples: 32 }, out);
    r.resetState();

    // post
    let flash = 0;
    for (const tc of this.camCross) flash += Math.exp(-Math.pow((t - tc) / 0.09, 2)) * 0.12;
    const post: PostOverrides = {
      hud: 0, frame: 0, metricReadout: 0, volumetricSteps: 48, volumetricJitter: 1, toneMap: 'aces', grain: 0.025, ca: 0.7, halation: 0.15, vignette: 0.32,
      bloom: 0.6, bloomThreshold: 1.0, bloomRadius: 0.8, flash,
      fade: Math.max(1 - smoothstep(0, 1.6, t), smoothstep(81, 82, t)),
      ...cur.post(t),
    };
    // portal beat: chromatic split + bloom surge either side of each membrane crossing
    let beat = 0;
    for (const tc of this.camCross) beat += Math.exp(-Math.pow((t - tc) / 0.12, 2));
    post.ca = (post.ca ?? 0.7) + beat * 3;
    post.bloom = (post.bloom ?? 0.6) + beat * 0.15;
    if (cur.lightPos) {
      const s = cur.lightPos.clone().project(cam);
      const inFront = cur.lightPos.clone().sub(cam.position).dot(cam.getWorldDirection(V())) > 0;
      if (inFront && Math.abs(s.x) < 1.6 && Math.abs(s.y) < 1.6) post.volumetricLightPos = [s.x * 0.5 + 0.5, s.y * 0.5 + 0.5];
      else post.volumetric = 0;
    }
    return post;
  }

  override dispose() {
    for (const w of this.worlds) w.dispose();
    for (const p of this.portals) p.dispose();
    this.bird.dispose(); this.dof.dispose(); this.main?.dispose();
    this.rt.dispose();
  }
}
