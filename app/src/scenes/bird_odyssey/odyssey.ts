// Bird Odyssey — a swallow's flight through five dimensions, each entered through its own gateway.
// One continuous camera rides the bird's trail; the world beyond the next portal is rendered with the
// same camera (clipped to the far side of the membrane) and shown through it, so every crossing is seamless.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { W, H, PW, PH, makeRT } from '../../engine/gl';
import { smoothstep } from '../../engine/util';
import { Bird } from './bird';
import { Portal } from './portals';
import type { World } from './world';
import { BIRD, PORTALS, FLAP, FOLD, CAM_LAG, CAM_OFF, CAM_FOV, DIVE } from './path';
import { overworld } from './w_overworld';
import { nether } from './w_nether';
import { theEnd } from './w_end';
import { aether } from './w_aether';
import { sift } from './w_sift';

const V = () => new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0), DOWNZ = new THREE.Vector3(0, 0, -1);

export default class Odyssey extends Scene {
  private cam = new THREE.PerspectiveCamera(50, W / H, 0.1, 9000);
  private bird = new Bird(2.1);
  private worlds: World[] = [];
  private portals: Portal[] = [];
  private rt = makeRT(W, H);
  private camCross: number[] = [];
  private tmp = { a: V(), b: V(), c: V(), d: V(), e: V(), f: V() };

  override init() {
    const r = this.ctx.renderer;
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFShadowMap;
    this.worlds = [overworld(r), nether(r), theEnd(r), aether(r), sift(r)];
    const res = new THREE.Vector2(PW, PH);
    PORTALS.forEach((p, i) => {
      const portal = new Portal(p.kind, new THREE.Vector3(...p.c), new THREE.Vector3(...p.n), this.rt.texture, res);
      this.portals.push(portal); this.worlds[i]!.scene.add(portal.group);
    });
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
    BIRD.at(t - CAM_LAG.at(t), out);
    return out.add(CAM_OFF.at(t, this.tmp.f));
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
    this.bird.pose(t, t * Math.PI * 2 * 3.6, amp, fold);
    return p;
  }

  override render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t, r = this.ctx.renderer;
    // camera
    const cam = this.cam;
    this.camPos(t, cam.position);
    const birdP = this.poseBird(t).clone();
    const look = birdP.clone().addScaledVector(BIRD.vel(t, V()), 0.12);
    cam.up.copy(UP).lerp(DOWNZ, DIVE.at(t - 0.2)).normalize();
    cam.fov = CAM_FOV.at(t); cam.updateProjectionMatrix();
    cam.lookAt(look); cam.updateMatrixWorld();

    let k = 0; while (k < this.camCross.length && t >= this.camCross[k]!) k++;
    let bw = 0; while (bw < PORTALS.length && t >= PORTALS[bw]!.t) bw++;
    this.worlds[bw]!.scene.add(this.bird.group);

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
    r.setRenderTarget(out); r.setClearColor(0x000000, 1); r.clear();
    r.render(cur.scene, cam);
    r.resetState();

    // post
    let flash = 0;
    for (const tc of this.camCross) flash += Math.exp(-Math.pow((t - tc) / 0.09, 2)) * 0.35;
    const post: PostOverrides = {
      hud: 0, frame: 0, metricReadout: 0, toneMap: 'agx', volumetricSteps: 48, volumetricJitter: 1, grain: 0.025, ca: 0.7, halation: 0.15, vignette: 0.32,
      bloom: 0.6, bloomThreshold: 1.0, bloomRadius: 0.8, flash,
      fade: Math.max(1 - smoothstep(0, 1.6, t), smoothstep(80.2, 82, t)),
      ...cur.post(t),
    };
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
    this.rt.dispose();
  }
}
