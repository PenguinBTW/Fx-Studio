// THRESHOLD END: the Z1 beat-1.1 office frame, darkened for YouTube end slots, 225-235 s.
// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { buildOfficeLoopSet, type OfficeLoopSet } from './office_loop_set';

const hash = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const smooth = (x: number) => { const u = clamp(x); return u * u * (3 - 2 * u); };
const lerp = (a: number, b: number, u: number) => a + (b - a) * clamp(u);


export default class ThresholdEndscreen extends Scene {
  private s = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(74, 16 / 9, 0.05, 70);
  private office?: OfficeLoopSet;

  override async init() {
    this.s.background = new THREE.Color(0x030404);
    this.s.fog = new THREE.FogExp2(0x030404, 0.035);
    this.office = await buildOfficeLoopSet();
    this.s.add(this.office.root);
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t;
    // Exact Z1 beat-1.1 pose/framing: eye height, opening camera, hero desk six metres ahead.
    // Not frozen: a few millimetres of deterministic breathing drift keep the final
    // loop alive without disturbing the approved end-slot composition.
    const breath = Math.sin((t - 225) * Math.PI * 2 * 0.19) * 0.028 + Math.sin((t - 225) * Math.PI * 2 * 0.071) * 0.018;
    const driftX = Math.sin((t - 225) * Math.PI * 2 * 0.047) * 0.052;
    const driftZ = Math.sin((t - 225) * Math.PI * 2 * 0.031 + 0.8) * 0.046;
    this.cam.position.set(driftX, 1.65 + breath, driftZ);
    this.cam.fov = 74;
    this.cam.aspect = out.width / out.height;
    this.cam.updateProjectionMatrix();
    this.cam.lookAt(driftX * 0.35, 1.35 + breath * 0.55, -6 + driftZ * 0.2);

    // The phone keeps ringing, quieter each cycle; the detailed receiver gives the motion a visible payoff.
    const ringIndex = Math.floor((t - 225) / 4.0);
    const ringPhase = (t - 225) % 4.0;
    const ring = ringPhase < 1.1 ? Math.max(0, Math.sin(ringPhase * Math.PI * 8)) / (1 + ringIndex * 0.75) : 0;
    if (this.office?.receiver && this.office.receiverHome) {
      this.office.receiver.position.copy(this.office.receiverHome).add(new THREE.Vector3(0, ring * 0.012, ring * 0.006));
      this.office.receiver.rotation.z = ring * 0.045;
    }
    const fade = 0.35;
    const endT = t - 225;
    const pulse = (center: number, width: number) => Math.max(0, 1 - Math.abs(endT - center) / width);
    // Three irregular one-off power dips across the ten-second slot, each with a real
    // recovery to baseline; deliberately not a periodic flicker loop.
    const powerSag = Math.min(1, pulse(1.18, 0.24) * 0.82 + pulse(5.35, 0.34) * 0.96 + pulse(8.42, 0.27) * 0.72);
    const powerLevel = 1 - powerSag * 0.52;
    const loopRecovery = 0.07 + 0.68 * smooth(endT / 1.2);
    this.office?.tubeMats.forEach((m, i) => {
      m.emissiveIntensity = (1.75 + 0.25 * hash(Math.floor(t * 4) + i * 7)) * (1 - fade * 0.38) * powerLevel * loopRecovery;
      if (this.office?.tubeLights[i]) this.office.tubeLights[i].intensity = 1.45 * powerLevel * loopRecovery;
    });
    if (this.office) this.office.ambientLight.intensity = lerp(0.11, 0.34, smooth(endT / 1.2)) * (1 - fade * 0.28);

    const rr = this.ctx.renderer;
    rr.setRenderTarget(out);
    rr.setClearColor(0x030404, 1);
    rr.clear(true, true, true);
    rr.render(this.s, this.cam);
    rr.resetState();

    // Same frame, intentionally darkened about 60%; modest radial/depth softness reads as endscreen blur
    // while grain/CA preserve the film's sensor language. No text or UI: slots are added by the user.
    return {
      exposure: (0.25 - fade * 0.04) * (1 - powerSag * 0.58) * (1 + 0.045 * Math.sin((t - 225) * 1.7)),
      bloom: 0.09,
      bloomThreshold: 1.05,
      vignette: 0.42,
      grain: 0.05,
      ca: 0.09,
      dof: 0.34,
      focusDist: 0.08,
      focalRange: 0.18,
      dofRadius: 2.6,
    };
  }

  override dispose() {
    this.office?.phoneInst.dispose();
    this.office?.officeKit.dispose();
    this.office?.propPack.dispose();
  }
}
