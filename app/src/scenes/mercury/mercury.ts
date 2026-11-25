// mercury — the fluid register. Liquid metal droplets swell, detach, fall, and are
// absorbed into a central pool; surface tension wobbles decay after every impact until
// only a mirror sphere remains. Raymarched smooth-min sphere union in one fullscreen
// pass — coalescence is a property of the field, not animated geometry. Everything is
// closed-form f(lt): droplet schedules, merge interpolation, wobble impulse sums.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { W, H, FSPass } from '../../engine/gl';
import { smoothstep } from '../../engine/util';

const M = 14; // droplets

// deterministic per-index hash in [0,1)
function hash(i: number, salt: number): number {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

interface Drop { spawn: number; hit: number; ox: number; oz: number; }
const DROPS: Drop[] = [];
for (let i = 0; i < M; i++) {
  const spawn = 0.9 + i * 1.45 + hash(i, 1) * 0.35;
  DROPS.push({
    spawn,
    hit: spawn + 1.1, // constant-duration fall, tuned so the drop meets the pool top
    ox: (hash(i, 2) - 0.5) * 1.0,
    oz: (hash(i, 3) - 0.5) * 1.0,
  });
}
const FALL_H = 2.7;   // detach height above the pool centre
const DROP_R = 0.21;
const MERGE_T = 0.7;  // absorption duration

// pool radius: base + growth per absorbed droplet, all closed-form
function poolR(lt: number): number {
  let absorbed = 0;
  for (const d of DROPS) absorbed += smoothstep(d.hit + 0.1, d.hit + MERGE_T, lt);
  return 0.85 + 0.022 * absorbed;
}

// impact impulse sum — drives both the shader wobble amplitude and the camera tremor
function impulse(lt: number, freq: number): number {
  let s = 0;
  for (const d of DROPS) {
    const dt = lt - d.hit;
    if (dt > 0) s += Math.exp(-3.2 * dt) * Math.sin(freq * dt);
  }
  return s;
}

const FRAG = /* glsl */`
uniform vec3 uCamPos;
uniform vec3 uCamRight;
uniform vec3 uCamUp;
uniform vec3 uCamFwd;
uniform float uFov;
uniform vec4 uDrops[${M}];   // xyz centre, w radius (0 = inactive)
uniform float uPoolR;
uniform float uWobble;       // signed wobble amplitude
uniform float uWobPhase;
uniform float uAspect;

float sminMeta(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

float map(vec3 p) {
  // central pool: sphere with a decaying directional surface ripple
  float rip = uWobble * sin(6.0 * atan(p.z, p.x) + uWobPhase) * 0.5
            + uWobble * 0.5 * sin(4.0 * p.y + uWobPhase * 1.7);
  float d = length(p) - uPoolR - rip * 0.035;
  for (int i = 0; i < ${M}; i++) {
    vec4 dr = uDrops[i];
    if (dr.w < 0.001) continue;
    d = sminMeta(d, length(p - dr.xyz) - dr.w, 0.18);
  }
  return d;
}

vec3 calcNormal(vec3 p) {
  vec2 e = vec2(0.0015, 0.0);
  return normalize(vec3(
    map(p + e.xyy) - map(p - e.xyy),
    map(p + e.yxy) - map(p - e.yxy),
    map(p + e.yyx) - map(p - e.yyx)
  ));
}

// procedural environment the mercury mirrors: dark void, warm key glint, cool horizon rim
vec3 envColor(vec3 r) {
  float up = clamp(r.y, -1.0, 1.0);
  // near-black studio void with a faint cool floor bounce
  vec3 base = mix(vec3(0.012, 0.013, 0.018), vec3(0.002, 0.002, 0.004), smoothstep(-0.4, 0.5, up));
  // horizontal softbox stripes — the classic liquid-metal reflection language
  float strip1 = smoothstep(0.08, 0.0, abs(r.y - 0.35)) * max(r.x * -0.5 + 0.5, 0.0);
  base += vec3(0.9, 0.85, 0.8) * strip1 * 1.4;
  float strip2 = smoothstep(0.05, 0.0, abs(r.y + 0.15)) * max(r.x * 0.5 + 0.5, 0.0);
  base += vec3(0.2, 0.3, 0.55) * strip2 * 0.9;
  // warm key blob high to the left
  vec3 keyDir = normalize(vec3(-0.45, 0.72, 0.45));
  float key = pow(max(dot(r, keyDir), 0.0), 120.0);
  base += vec3(1.3, 0.9, 0.5) * key * 10.0;
  return base;
}

void main() {
  vec2 uv = (vUv * 2.0 - 1.0);
  uv.x *= uAspect;
  float fl = 1.0 / tan(uFov * 0.5);
  vec3 rd = normalize(uCamFwd * fl + uCamRight * uv.x + uCamUp * uv.y);
  vec3 ro = uCamPos;

  // raymarch the metaball field
  float t = 0.0;
  float hit = -1.0;
  for (int i = 0; i < 96; i++) {
    vec3 p = ro + rd * t;
    float d = map(p);
    if (d < 0.0012) { hit = t; break; }
    t += d * 0.9;
    if (t > 30.0) break;
  }

  vec3 col;
  if (hit > 0.0) {
    vec3 p = ro + rd * hit;
    vec3 n = calcNormal(p);
    vec3 r = reflect(rd, n);
    vec3 env = envColor(r);
    float fres = pow(1.0 - max(dot(-rd, n), 0.0), 3.0);
    // mercury: mirror-dominant with a dark metallic core
    vec3 base = vec3(0.012, 0.013, 0.016);
    col = base + env * (0.35 + 0.65 * fres);
    // hot key specular
    vec3 keyDir = normalize(vec3(-0.45, 0.72, 0.45));
    float spec = pow(max(dot(r, keyDir), 0.0), 240.0);
    col += vec3(1.4, 1.0, 0.6) * spec * 8.0;
    // cool fresnel rim
    col += vec3(0.3, 0.45, 0.8) * fres * 0.35;
  } else {
    // void background — near-black with the faintest cool cast
    col = envColor(rd) * 0.05;
  }
  fragColor = vec4(col, 1.0);
}
`;

export default class Mercury extends Scene {
  private pass: FSPass | null = null;
  private dropsArr = new Float32Array(M * 4);

  override init() {
    const uniforms: Record<string, THREE.IUniform> = {
      uCamPos: { value: new THREE.Vector3() },
      uCamRight: { value: new THREE.Vector3() },
      uCamUp: { value: new THREE.Vector3() },
      uCamFwd: { value: new THREE.Vector3() },
      uFov: { value: 0.72 },
      uDrops: { value: this.dropsArr },
      uPoolR: { value: 0.85 },
      uWobble: { value: 0 },
      uWobPhase: { value: 0 },
      uAspect: { value: W / H },
    };
    this.pass = new FSPass(FRAG, uniforms);
  }

  override render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const lt = f.lt, r = this.ctx.renderer;
    if (!this.pass) return {};

    // ── droplet schedule: swell → detach → accelerate down → absorb ──
    for (let i = 0; i < M; i++) {
      const d = DROPS[i]!;
      const o = i * 4;
      this.dropsArr[o + 3] = 0; // inactive unless proven otherwise
      if (lt < d.spawn) continue;
      const surfY = 0.55; // approximate pool-top height at impact time
      if (lt < d.hit) {
        const q = (lt - d.spawn) / (d.hit - d.spawn); // 0..1 falling
        // swell-in for the first fraction, then accelerating fall (ease-in quad)
        const swell = smoothstep(0, 0.3, q);
        const y = FALL_H - (FALL_H - surfY) * q * q;
        this.dropsArr[o] = d.ox * (1 - 0.3 * q);
        this.dropsArr[o + 1] = y;
        this.dropsArr[o + 2] = d.oz * (1 - 0.3 * q);
        this.dropsArr[o + 3] = DROP_R * swell;
      } else if (lt < d.hit + MERGE_T) {
        // absorption: slide toward the pool centre and shrink away
        const q = (lt - d.hit) / MERGE_T;
        const pull = q * q;
        this.dropsArr[o] = d.ox * 0.7 * (1 - pull);
        this.dropsArr[o + 1] = surfY - pull * 0.5;
        this.dropsArr[o + 2] = d.oz * 0.7 * (1 - pull);
        this.dropsArr[o + 3] = DROP_R * (1 - q);
      }
    }

    // ── camera: low push-in, then a quarter orbit, settling to the hero ──
    const orb = smoothstep(8, 26, lt);
    const yaw = orb * 1.15;
    const push = smoothstep(0, 12, lt);
    const settle = smoothstep(24, 30, lt);
    const rad = 5.3 - 0.9 * push - 0.2 * settle;
    const height = 1.35 - 0.5 * orb + 0.2 * settle;
    const cx = Math.sin(yaw) * rad;
    const cz = Math.cos(yaw) * rad;
    const tremor = impulse(lt, 26) * 0.02;
    const camPos = new THREE.Vector3(cx + tremor * 0.6, height + tremor, cz);
    const target = new THREE.Vector3(0, 0.55 - 0.25 * smoothstep(18, 30, lt), 0);
    const fwd = target.clone().sub(camPos).normalize();
    const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
    const up = new THREE.Vector3().crossVectors(right, fwd).normalize();

    const u = this.pass.u;
    (u.uCamPos!.value as THREE.Vector3).copy(camPos);
    (u.uCamFwd!.value as THREE.Vector3).copy(fwd);
    (u.uCamRight!.value as THREE.Vector3).copy(right);
    (u.uCamUp!.value as THREE.Vector3).copy(up);
    u.uPoolR!.value = poolR(lt);
    u.uWobble!.value = impulse(lt, 9);
    u.uWobPhase!.value = lt * 2.2;

    r.setRenderTarget(out);
    r.setClearColor(0x020202, 1);
    r.clear();
    this.pass.render(r, out);
    r.resetState();
    return { bloom: 0.55, vignette: 0.35 };
  }

  override dispose() {
    this.pass?.dispose();
  }
}
