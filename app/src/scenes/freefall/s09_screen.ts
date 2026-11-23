// S09 your screen (31-38 s): the quark's light resolves into the RGB subpixels of a phone LCD (60 um pitch) showing the
// opening orbit shot. The camera pulls back until the screen fills the frame, the subpixel grid melts into the picture,
// and the final frame is exactly frame 0 (orbit at t=0 + the same HUD), so the short loops.
import * as THREE from 'three';
import { FSPass, makeRT, W, H } from '../../engine/gl';
import type { Frame, PostOverrides, SceneCtx } from '../../engine/scene';
import { Scene } from '../../engine/scene';
import { hud, inSeam, Z, END } from './kit';
import { FFN } from './glsl';
import { FRAG as ORBIT } from './s01_orbit';

const LCD = /* glsl */ `${FFN}
uniform sampler2D uImg; uniform float uN, uMelt;
void main() {
  vec2 q = ff_uv(); vec2 res = uRes; vec2 pc = mix(res * 0.5, res * 0.5 + vec2(0.17, 0.5), smoothstep(400.0, 4.0, uN)); vec2 pp = pc + q * 0.5 * uN;
  vec2 id = floor(pp), f = fract(pp); vec3 img = texture(uImg, (id + 0.5) / res).rgb; vec3 direct = texture(uImg, pp / res).rgb; vec3 lc = (0.55 + 0.9 * vec3(ff_fbm(vec3(f * 14.0, uT * 0.5), 4))) * mix(1.0, 0.3, smoothstep(8.0, 1.0, uN));
  float bx = 0.06, by = 0.07; vec3 m = vec3(0.0);
  for (int c = 0; c < 3; c++) { float x0 = float(c) / 3.0 + 0.03, x1 = float(c + 1) / 3.0 - 0.03; float r = 0.05;
    vec2 cc = vec2(clamp(f.x, x0 + r, x1 - r), clamp(f.y, by + r, 1.0 - by - r)); float dd = length(f - cc) - r; float on = smoothstep(0.01, -0.01, dd);
    float lum = (c == 0 ? img.r : c == 1 ? img.g : img.b); vec3 cl = c == 0 ? vec3(1.0, 0.05, 0.05) : c == 1 ? vec3(0.05, 1.0, 0.1) : vec3(0.1, 0.2, 1.0);
    m += cl * on * (0.04 + lum * 3.2 + (c == 0 ? 0.15 : 0.0) * smoothstep(8.0, 1.0, uN)) * (0.85 + 0.15 * sin(f.y * 40.0)) * lc; }
  m += vec3(0.02, 0.02, 0.03) * (1.0 - smoothstep(0.0, 0.1, abs(f.y - 0.5) - 0.4)); // black matrix sheen
  vec3 sheen = vec3(0.5, 0.6, 0.8) * pow(max(0.0, 1.0 - abs(q.x + q.y * 0.6 - 0.3)), 8.0) * 0.08 * (1.0 - uMelt);
  float sub = smoothstep(90.0, 20.0, uN); vec3 avg = mix(direct, img, step(uN, 1500.0) * 0.0 + 0.0); // past ~60 px per frame the stripes average out
  vec3 C = mix(direct * mix(1.0, 1.0, uMelt), m, sub * (1.0 - uMelt)) + sheen;
  C = mix(C, direct, uMelt);
  fragColor = vec4(C, 1.0); }`;

export default class S09Screen extends Scene {
  orbit = new FSPass(ORBIT, { uT: { value: 0 }, uZ: { value: Z(0) }, uDZ: { value: 0 }, uRes: { value: new THREE.Vector2(W, H) } });
  lcd = new FSPass(LCD, { uT: { value: 0 }, uZ: { value: 0 }, uDZ: { value: 0 }, uRes: { value: new THREE.Vector2(W, H) }, uImg: { value: null }, uN: { value: 1 }, uMelt: { value: 0 } });
  img: THREE.WebGLRenderTarget | null = null;
  constructor(ctx: SceneCtx) { super(ctx); this.prerollMax = 0; }
  override render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const rr = this.ctx.renderer, t = f.t; if (!this.img || this.img.width !== out.width) { this.img?.dispose(); this.img = makeRT(W, H); }
    const ou = this.orbit.u; const back = Math.max(0, END - t); ou.uT!.value = -back * 0.6; ou.uZ!.value = Z(0) + 0.12 * back; (ou.uRes!.value as THREE.Vector2).set(out.width, out.height);
    rr.setRenderTarget(this.img); rr.clear(); this.orbit.render(rr, this.img); rr.resetState();
    const u = this.lcd.u; u.uT!.value = t; u.uImg!.value = this.img.texture; (u.uRes!.value as THREE.Vector2).set(out.width, out.height);
    u.uN!.value = Math.min(1920, Math.pow(10, Z(t)) / 6e-5); u.uMelt!.value = Math.min(1, Math.max(0, (t - 35.2) / 1.6)) ** 2;
    rr.setRenderTarget(out); rr.setClearColor(0, 1); rr.clear(true, true, true); this.lcd.render(rr, out); rr.resetState();
    if (!inSeam(t)) hud(rr, this.ctx.comp, out, t);
    const z0 = Z(0); const melt = u.uMelt!.value as number;
    return { toneMap: 'aces', exposure: 1.25, bloom: 0.85 - 0.0 * melt, bloomThreshold: 0.45, halation: 0.35, vignette: 0.35, grain: 0.04, ca: Math.min(0.7, 0.15 + 0.05 * Math.max(0, 5.6 - z0) + 0.3 * (1 - melt)) };
  }
  override dispose() { this.orbit.dispose(); this.lcd.dispose(); this.img?.dispose(); }
}
