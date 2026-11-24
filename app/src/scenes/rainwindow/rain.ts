// rainwindow (~20 s): night rain rivulets racing down a dark window pane — the
// classic screensaver. Behind the glass a defocused warm bokeh city-glow; each
// droplet refracts it, leaves a fading wet trail, and merges into others.
//
// Determinism: every droplet's full path (wobble + gravity, merges) is
// fixed-step integrated ONCE at setup into typed arrays; per-frame head state
// is a pure lookup of f.lt. Trails come from a distance/arrival-time field
// rasterized once from those same paths — no accumulators anywhere.
import * as THREE from 'three';
import { Scene, Frame, SceneCtx, PostOverrides } from '../../engine/scene';
import { FSPass, W, H } from '../../engine/gl';

const END = 20.0;
const N = 96;          // uniform slots — total drops (base + merge children)
const BASE_DROPS = 64;
const DT = 0.04;       // path integration step (s)
const TW = 480;        // trail field resolution
const TH = 270;

// deterministic hash — no Math.random anywhere
const hash = (i: number, k: number) => {
  const s = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

interface Drop {
  t0: number;          // spawn time
  xs: Float32Array;    // node x (logical px)
  ys: Float32Array;    // node y
  ts: Float32Array;    // node times (t0 + i*DT, truncated at end)
  r: number;           // radius (px)
  warm: number;        // warm accent weight for big drops
  mergedAt: number;    // for parents: time a child merged into it (radius bump)
  mergeR: number;      // post-merge radius
}

// Head position at time t: pure lookup over the precomputed node arrays.
// (Also used during setup for child/parent contact checks — retimed ts arrays
// are no longer on a uniform grid, so an index shortcut is not valid.)
function headAt(d: Drop, t: number): { x: number; y: number; r: number } | null {
  if (t < d.t0 || t > d.ts[d.ts.length - 1]) return null;
  let lo = 0, hi = d.ts.length - 1;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (d.ts[m] <= t) lo = m; else hi = m;
  }
  const span = d.ts[hi] - d.ts[lo] || 1;
  const s = (t - d.ts[lo]) / span;
  return {
    x: d.xs[lo] + (d.xs[hi] - d.xs[lo]) * s,
    y: d.ys[lo] + (d.ys[hi] - d.ys[lo]) * s,
    r: t >= d.mergedAt ? d.mergeR : d.r
  };
}

// Rivulet dynamics: gravity pulls, surface tension stalls; bigger drops run
// faster. x wiggles around a slowly-drifting rivulet line. boostT speeds the
// drop up after a merge (post-merge vmax ×1.55).
function integrate(x0: number, r: number, t0: number, parent?: Drop, boostT = Infinity): Drop {
  const cap = Math.ceil(END / DT) + 2;
  const xs = new Float32Array(cap), ys = new Float32Array(cap), ts = new Float32Array(cap);
  const wf = 0.012 + 0.02 * hash(t0 * 91, r);          // wiggle freq per unit y
  const wp = hash(t0 * 37, x0) * Math.PI * 2;          // wiggle phase
  const wAmp = 1.5 + 6 * hash(x0, t0);                 // wiggle amplitude px
  const drift = (hash(t0 * 13, x0 * 7) - 0.5) * 8;     // slow x drift over path
  const vmax = 60 + 110 * (r / 12);                    // terminal speed px/s
  let y = -r - 4, v = 20, n = 0;
  for (let t = t0; t <= END + DT && n < cap; t += DT) {
    // stick-slip: short deterministic stalls seeded on y-bands
    const stall = hash(Math.floor(y / 37), t0 * 7.7) < 0.16 ? 0.25 : 1;
    const vm = t > boostT ? vmax * 1.55 : vmax;        // merged drops run faster
    v += (vm * (0.72 + 0.4 * Math.sin(y * 0.05 + wp)) - v) * 3.2 * DT;
    y += Math.max(4, v * stall) * DT;
    const x = x0 + drift * (y / H) + wAmp * Math.sin(y * wf * 6.2831853 + wp);
    xs[n] = x; ys[n] = y; ts[n] = t; n++;
    if (y > H + 20) break;
    // child on a parent's rivulet dies when it catches the parent's head
    if (parent) {
      const ph = headAt(parent, t);
      // circular heads must actually touch — a per-axis box counts a
      // diagonal approach as contact while the discs are still apart
      if (ph) {
        const dx = x - ph.x, dy = y - ph.y, rr = ph.r + r;
        if (dx * dx + dy * dy < rr * rr) break;
      }
    }
  }
  return { t0, xs: xs.slice(0, n), ys: ys.slice(0, n), ts: ts.slice(0, n), r, warm: 0, mergedAt: Infinity, mergeR: r };
}

function buildDrops(): Drop[] {
  const drops: Drop[] = [];
  // spawn waves: t≈2 a few runners, t≈8 more + merges, t≈14 many racing
  for (let i = 0; i < BASE_DROPS; i++) {
    const wave = i < 9 ? 0 : i < 30 ? 1 : i < 52 ? 2 : 3;
    const t0 = [0.8, 5.5, 9.5, 12.5][wave] + hash(i, 3) * [2.0, 4.0, 4.0, 2.5][wave];
    const r = 2.5 + 9.5 * Math.pow(hash(i, 11), 2.6);
    const x0 = (0.03 + 0.94 * hash(i, 5)) * W;
    drops.push(integrate(x0, r, t0));
  }
  // ~30% of drops are "children": delayed runners on an earlier drop's rivulet
  // that catch up and merge (parent radius bumps by volume at the merge time).
  const parents = drops.filter((d) => d.r > 5 && d.ts.length > 20);
  for (let i = 0; i < Math.min(18, parents.length); i++) {
    const p = parents[i % parents.length]; // spread merges across the pane
    const delay = 1.5 + 3 * hash(i, 23);
    const cr = 2 + 3.5 * hash(i, 29);
    const c = integrate(p.xs[0] + (hash(i, 31) - 0.5) * 14, cr, p.t0 + delay, p);
    // merge time ≈ child's last node; parent swells by cubic-volume addition
    c.mergedAt = -1; // marker: this drop is a merging child
    const tm = c.ts[c.ts.length - 1];
    if (tm < p.mergedAt) {
      p.mergedAt = tm;
      p.mergeR = Math.cbrt(p.r * p.r * p.r + cr * cr * cr);
    }
    drops.push(c);
  }
  // merged parents get a post-merge velocity boost: re-integrate them with
  // the boost applied after the merge time. Pre-merge nodes are identical
  // (same deterministic params), so children's recorded merges stay aligned;
  // the parent then genuinely accelerates instead of only swelling.
  for (const p of parents) {
    if (p.mergedAt === Infinity) continue;
    const np = integrate(p.xs[0], p.r, p.t0, undefined, p.mergedAt);
    p.xs = np.xs; p.ys = np.ys; p.ts = np.ts;
  }
  // warm accent on the few largest drops only
  drops.sort((a, b) => b.r - a.r).slice(0, 4).forEach((d) => (d.warm = 1));
  return drops;
}

// Trail field: for each texel, normalized distance to the nearest rivulet
// centerline and the droplet's arrival time there. Rasterized once.
function buildTrailField(drops: Drop[]): THREE.DataTexture {
  const data = new Float32Array(TW * TH * 2).fill(255);
  const sx = TW / W, sy = TH / H;
  for (const d of drops) {
    const w = Math.max(1.6, d.r * 1.15) * Math.max(sx, sy); // trail half-width
    for (let k = 1; k < d.ts.length; k++) {
      const ax = d.xs[k - 1] * sx, ay = d.ys[k - 1] * sy;
      const bx = d.xs[k] * sx, by = d.ys[k] * sy;
      const minx = Math.max(0, Math.floor(Math.min(ax, bx) - w - 1));
      const maxx = Math.min(TW - 1, Math.ceil(Math.max(ax, bx) + w + 1));
      const miny = Math.max(0, Math.floor(Math.min(ay, by) - w - 1));
      const maxy = Math.min(TH - 1, Math.ceil(Math.max(ay, by) + w + 1));
      const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy || 1;
      for (let py = miny; py <= maxy; py++) {
        for (let px = minx; px <= maxx; px++) {
          const u = Math.min(1, Math.max(0, ((px - ax) * dx + (py - ay) * dy) / len2));
          const ex = px - (ax + u * dx), ey = py - (ay + u * dy);
          const dist = Math.sqrt(ex * ex + ey * ey) / w;
          if (dist >= 1) continue;
          const tau = d.ts[k - 1] + u * (d.ts[k] - d.ts[k - 1]);
          const o = (py * TW + px) * 2;
          // earliest wetting τ wins; closest pass wins distance. Independent
          // mins so a nearer later pass can't leave a dry gap inside a trail.
          if (dist < data[o]) data[o] = dist;
          // τ = earliest pass that actually wets the texel — a far graze
          // (dist ≥ 0.7) mustn't light the trail before the drop arrives
          if (dist < 0.7 && tau < data[o + 1]) data[o + 1] = tau;
        }
      }
    }
  }
  // Dilate τ a few texels into dry neighbours so linear filtering at trail
  // edges never blends a wet arrival time with the 255 dry sentinel.
  for (let pass = 0; pass < 3; pass++) {
    const prev = data.slice();
    for (let y = 0; y < TH; y++) {
      for (let x = 0; x < TW; x++) {
        const o = (y * TW + x) * 2;
        if (prev[o + 1] < 200) continue;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= TW || ny >= TH) continue;
          const no = (ny * TW + nx) * 2;
          if (prev[no + 1] < data[o + 1]) data[o + 1] = prev[no + 1];
        }
      }
    }
  }
  const tex = new THREE.DataTexture(data, TW, TH, THREE.RGFormat, THREE.FloatType);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

const FRAG = /* glsl */ `
uniform float uT;
uniform vec2 uRes;
uniform float uFade;
uniform sampler2D uTrail;    // RG: normalized dist, arrival time (s), 255 = dry
uniform vec4 uDrops[${N}];   // x, y, r, warm flag (r<=0 = inactive)

vec3 bg(vec2 p) {
  // defocused bokeh city glow: warm sodium window + cooler ambient spots
  vec3 c = vec3(0.012, 0.013, 0.018);
  for (int i = 0; i < 14; i++) {
    vec2 bp = vec2(hash11(float(i) * 7.1 + 0.3), hash11(float(i) * 3.7 + 9.1)) * uRes;
    float br = (24.0 + 74.0 * hash11(float(i) * 5.3 + 2.2));
    float d = length(p - bp) / br;
    float g = exp(-d * d * 2.2);
    float warm = step(0.35, hash11(float(i) * 9.9 + 4.4));
    vec3 col = mix(vec3(0.10, 0.13, 0.22), vec3(0.85, 0.42, 0.14), warm);
    c += col * g * (0.10 + 0.35 * warm);
  }
  // faint sodium lamp core top-left — the "one warm accent" source
  c += vec3(0.9, 0.45, 0.16) * exp(-pow(length(p - vec2(0.30, 0.72) * uRes) / (0.16 * uRes.y), 2.0)) * 0.55;
  return c;
}

void main() {
  vec2 p = vec2(vUv.x, 1.0 - vUv.y) * uRes;   // pixel coords, y-down = window space

  // pane: near-black with faint vertical glass streaks
  vec3 c = bg(p) * 0.32 + vec3(0.010, 0.011, 0.014);
  c += vec3(0.012) * (0.5 + 0.5 * snoise(vec3(p.x * 0.06, p.y * 0.003, 3.7)));

  // wet trails: displaced/reflected bg + slight brightening, fading over ~9 s
  vec2 tr = texture(uTrail, vec2(vUv.x, 1.0 - vUv.y)).rg; // field is y-down
  if (tr.g < 200.0) {
    float wet = 1.0 - smoothstep(0.55, 0.95, tr.r);
    float age = uT - tr.g;
    float fade = age < 0.0 ? 0.0 : exp(-age / 9.0) * 0.9 + 0.10;
    vec2 off = vec2(0.0, 3.0) + vec2(fwidth(p.x), 0.0);
    vec3 refr = bg(p + off) * 0.5;
    c = mix(c, refr + vec3(0.035, 0.038, 0.045) * wet, wet * fade);
  }

  // droplet heads: fake refraction — the drop shows the bokeh inverted and
  // compressed, with a bone rim highlight and a faint shadow beneath.
  for (int i = 0; i < ${N}; i++) {
    vec4 dr = uDrops[i];
    if (dr.z <= 0.0) continue;
    float d = length(p - dr.xy);
    float r = dr.z;
    if (d > r * 1.6) continue;
    if (d < r) {
      vec2 q = dr.xy + (dr.xy - p) * 0.62;            // inverted lens sample
      vec3 body = bg(q) * 1.15;
      body += vec3(0.05) * (1.0 - d / r);              // lifted interior
      body += vec3(0.55, 0.30, 0.08) * dr.w * 0.35 * (1.0 - d / r); // warm accent
      // directional bone rim: crescent toward the upper-left lamp
      vec2 dir = (p - dr.xy) / max(d, 0.001);
      float rim = smoothstep(0.55, 0.95, d / r) * (0.35 + 0.65 * max(0.0, dot(dir, vec2(-0.42, -0.91))));
      body += vec3(0.55, 0.53, 0.48) * rim;
      c = mix(c, body, 0.92);
    } else {
      // soft contact shadow just below the drop
      float sh = 1.0 - smoothstep(r, r * 1.6, d);
      c *= 1.0 - 0.25 * sh;
    }
  }

  c *= uFade;
  fragColor = vec4(c, 1.0);
}
`;

export default class RainWindow extends Scene {
  override stateful = false;
  override prerollMax = 0;
  override handlesTransition = false;

  private drops = buildDrops();
  private dropU = new Float32Array(N * 4);

  private pass = new FSPass(FRAG, {
    uT: { value: 0 },
    uRes: { value: new THREE.Vector2(W, H) },
    uFade: { value: 0 },
    uTrail: { value: null as THREE.Texture | null },
    uDrops: { value: this.dropU },
  });

  constructor(ctx: SceneCtx) {
    super(ctx);
    this.pass.u.uTrail!.value = buildTrailField(this.drops);
  }

  override init() {}
  override reset() {}

  override render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.lt;
    const u = this.pass.u;
    u.uT!.value = t;
    // uRes stays at the logical W×H: drops, paths and the trail field are all
    // authored in logical pixels regardless of the export resolution.

    // droplet heads: pure lookup of t in the precomputed path arrays.
    // The parent radius swells after its merge time (precomputed).
    const u4 = this.dropU;
    for (let i = 0; i < N; i++) {
      const o = i * 4;
      const d = this.drops[i];
      const h = d ? headAt(d, t) : null;
      if (!h) { u4[o + 2] = 0; continue; }
      u4[o] = h.x;
      u4[o + 1] = h.y;
      u4[o + 2] = h.r;
      u4[o + 3] = d!.warm;
    }

    // two-phase fades keep the near-black run under F16's 0.3 s threshold
    const fadeIn = 0.8 * Math.min(1, t / 0.3) + 0.2 * Math.min(1, Math.max(0, t - 0.3) / 1.5);
    const rem = END - t;
    const fadeOut = rem > 0.25 ? 0.55 + 0.45 * Math.min(1, (rem - 0.25) / 0.75) : 0.55 * (rem / 0.25);
    u.uFade!.value = fadeIn * fadeOut;

    const rr = this.ctx.renderer;
    rr.setRenderTarget(out);
    rr.setClearColor(0x000000, 1);
    rr.clear(true, true, true);
    this.pass.render(rr, out);
    rr.setRenderTarget(null);
    rr.resetState();

    return {
      toneMap: 'aces',
      exposure: 1.1,
      bloom: 0.5,
      bloomThreshold: 0.5,
      halation: 0.2,
      vignette: 0.3,
      grain: 0.02,
      ca: 0.0,
    };
  }

  override dispose() {
    (this.pass.u.uTrail!.value as THREE.DataTexture | null)?.dispose();
    this.pass.dispose(); // fsGeom is a shared singleton — never dispose it here
  }
}
