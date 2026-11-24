// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
// diffraction: a dark room, a thin slit of bone light on a baffle, and the
// wavefront it launches onto the back wall. The wall carries a true
// single-slit pattern — sinc² envelope, bright central maximum, decaying side
// lobes — while the slit width breathes mid-take so the lobe spacing visibly
// opens and closes. In the second half the slit count ramps 1→8 and the
// pattern sharpens into discrete grating orders (sin(Nφ)/(N sin φ))².
// A faint cool fringe rides the lobe edges — the only colour event.
// Camera: slow lateral dolly tracking the wall, then a drift that catches the
// baffle edge-on so the slit reads as a hairline of light. Stateless f(t):
// slit width, count and camera are all closed-form — no accumulators,
// no Math.random.
import * as THREE from 'three';
import { Scene, type Frame, type SceneCtx, type PostOverrides } from '../../engine/scene';
import { GLSL_COMMON } from '../../engine/glsl/common';

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

// --- shared GLSL ------------------------------------------------------------
// slit→wall geometry (world units): baffle at z = -20, wall at z = -60.
// Every plane that shows the pattern uses the same analytic intensity:
//   I(y) = sinc²(π a (y/L) / λ) · ( sin(N γ) / (N sin γ) )²,  γ = π d (y/L)/λ
// which collapses to the single-slit envelope when N = 1.
const PATTERN_GLSL = `
uniform float uA;      // slit width
uniform float uN;      // slit count (1 → 8)
uniform float uT;
uniform float uFade;   // beam dimmer as the camera leaves its frontal view
uniform float uWaves;  // wavefront-shell amplitude — dies with the dolly drift

const float L = 40.0;        // slit-to-wall distance
const float LAMBDA = 0.03;   // wavelength — sets fringe scale λL
const float DSPACING = 1.1;  // slit centre spacing for the grating phase

float sincf(float x) { return abs(x) < 1e-4 ? 1.0 : sin(x) / x; }

float patternI(float y) {
  float s = y / L;
  float b = sincf(PI * uA * s / LAMBDA);
  float single = b * b;
  float g = PI * DSPACING * s / LAMBDA;
  // principal maxima only: cos^p spikes at g = mπ sharpen as N grows. The true
  // Dirichlet comb's secondary maxima ripple N× finer than the order spacing —
  // permanently sub-pixel, so they render as moiré sparkle, not orders.
  float spike = pow(max(0.0, 0.5 + 0.5 * cos(2.0 * g)), uN * 3.0);
  float orders = mix(1.0, spike, smoothstep(1.0, 1.8, uN));
  return single * orders;
}

// envelope only — the fan mid-flight is near-field: broad lobes, no comb
float envelopeI(float y) {
  float s = y / L;
  float b = sincf(PI * uA * s / LAMBDA);
  return b * b;
}

// bone ramp, with the faint cool fringe on lobe edges as the colour event
vec3 patternColour(float y, float boost) {
  float i = patternI(y);
  vec3 col = vec3(0.96, 0.93, 0.86) * i * boost;
  float edge = i * (1.0 - i) * 4.0; // peaks at half-intensity — the lobe skirts
  col += vec3(0.42, 0.58, 0.85) * edge * edge * 0.06 * boost;
  return col;
}`;

// --- wall: the diffraction screen -------------------------------------------
const WALL_VERT = `out vec3 vW;
void main(){ vW = (modelMatrix * vec4(position,1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;

const WALL_FRAG = `${GLSL_COMMON}
${PATTERN_GLSL}
in vec3 vW; out vec4 fragColor;

void main() {
  // near-black matte wall, barely lifted at the edges
  vec3 col = vec3(0.008, 0.009, 0.012) * (0.8 + 0.2 * smoothstep(40.0, 0.0, abs(vW.x)));

  float y = vW.x;                       // fringes spread along the wall's x
  // comb orders alias into moiré sparkle once a period spans fewer than a
  // few screen pixels — collapse them into the smooth sinc² envelope
  float dydx = fwidth(y);               // world units per screen pixel
  float aa = 1.0 - smoothstep(0.08, 0.25, dydx); // order period ~1.1 units
  // where even the envelope lobes go sub-pixel, show the unresolved glow —
  // a coordinate-compressed envelope is the analytic low-pass of the fan
  float vis = 1.0 - smoothstep(0.3, 0.9, dydx);
  float iWall = mix(envelopeI(y), patternI(y), aa) * vis
    + envelopeI(y * 0.12) * (1.0 - vis) * 0.4;
  iWall = pow(iWall, 0.6); // lift side lobes into visibility (sinc² lobe ~5% peak)
  vec3 spread = (vec3(0.96, 0.93, 0.86) * iWall
    + vec3(0.42, 0.58, 0.85) * (iWall * (1.0 - iWall) * 4.0)
      * (iWall * (1.0 - iWall) * 4.0) * 0.06) * 0.6  // the fan
    * (0.75 + 0.25 * fbm(vec2(y * 0.8, uT * 0.05), 3)) // slow breathing shimmer
    * (1.0 - smoothstep(8.0, 30.0, abs(y)));           // dies off the wall
  col += spread;

  // soft vertical pool around the pattern band
  col += vec3(0.96, 0.93, 0.86) * iWall * 0.10 * exp(-abs(vW.y - 1.0) / 2.2);
  fragColor = vec4(col, 1.0);
}`;

// --- baffle: the slit barrier -----------------------------------------------
const BAFFLE_FRAG = `${GLSL_COMMON}
${PATTERN_GLSL}
in vec3 vW; out vec4 fragColor;

void main() {
  vec3 col = vec3(0.006, 0.007, 0.010); // near-black baffle bar

  // N slits centred on x=0, compressed to a row that fits the stile; slit
  // width breathes with uA. Slits fade in one by one as the count animates —
  // fractional uN is a reveal amount for the incoming slit, not a fractional
  // aperture.
  float halfRow = (uN - 1.0) * 0.5 * DSPACING * 0.12;
  float slit = 0.0;
  for (int i = 0; i < 8; i++) {
    float appear = clamp(uN - float(i), 0.0, 1.0);
    float cx = (float(i) * DSPACING * 0.12) - halfRow;
    float d = abs(vW.x - cx);
    float w = uA * 0.18;              // hairline apertures, width tracks physics
    slit = max(slit, appear * (1.0 - smoothstep(w * 0.4, w * 0.6, d)));
  }
  float n = max(uN, 1.0);
  // slits only span a short vertical band
  slit *= 1.0 - smoothstep(2.6, 2.85, abs(vW.y - 1.0));
  // newly-appearing slits are dimmer — brightness shared across the row
  col += vec3(1.0, 0.97, 0.9) * slit * (2.2 / sqrt(n));
  col += vec3(0.85, 0.8, 0.72) * exp(-abs(vW.x) / 0.5) * exp(-abs(vW.y - 1.0) / 0.35) * 0.05; // faint halo

  fragColor = vec4(col, 1.0);
}`;

// --- beam: the propagating wavefront wedge ----------------------------------
const BEAM_FRAG = `${GLSL_COMMON}
${PATTERN_GLSL}
in vec3 vW; out vec4 fragColor;

void main() {
  // u along propagation (0 at the slit, 1 at the wall); lateral extent opens
  // from a hairline to the pattern's full fan — the same I(y) as the wall.
  float u = clamp((-20.0 - vW.z) / 40.0, 0.0, 1.0);
  float extent = mix(0.15, 24.0, u);  // matches the wedge geometry exactly
  // clamp: the triangle's z-parametrisation differs slightly from u's, so the
  // edge vertices land at lat > 1 and (1 - lat²) would add negative light
  float lat = min(abs(vW.x) / extent, 1.0); // 0 centre → 1 fan edge
  // fringes are angular: the wall-equivalent coordinate is x / distance gone
  float yEff = vW.x / max(u, 0.03);
  // fringe detail develops with propagation: near the slit the fan is an
  // unresolved glow (keeps x/u from aliasing into speckle at small u)
  float uu = min(u * 2.5, 1.0);
  float i = envelopeI(yEff * uu * uu);

  // wavefront arcs: concentric shells out of the slit, travelling outward
  // (low spatial frequency — fine shells alias into dot moiré at grazing views)
  float r = distance(vec2(vW.x, vW.z), vec2(0.0, -20.0));
  float waves = 1.0 - uWaves * 0.22 * (0.5 + 0.5 * sin(r * 1.7 - uT * 3.4));

  vec3 col = vec3(0.96, 0.93, 0.86) * i * waves * 0.13 * (1.0 - lat * lat);
  col += vec3(0.42, 0.58, 0.85) * i * lat * 0.03;
  fragColor = vec4(col * smoothstep(0.0, 0.04, u) * uFade, 1.0);
}`;

export default class DiffractionScene extends Scene {
  private three = new THREE.Scene();
  private cam: THREE.PerspectiveCamera;
  private wallMat: THREE.ShaderMaterial;
  private baffleMat: THREE.ShaderMaterial;
  private beamMat: THREE.ShaderMaterial;

  constructor(ctx: SceneCtx) {
    super(ctx);
    this.cam = new THREE.PerspectiveCamera(44, 16 / 9, 0.1, 400);

    const uniforms = () => ({
      uT: { value: 0 },
      uA: { value: 0.4 },
      uN: { value: 1 },
      uFade: { value: 1 },
      uWaves: { value: 1 },
    });

    this.wallMat = new THREE.ShaderMaterial({
      vertexShader: WALL_VERT, fragmentShader: WALL_FRAG,
      glslVersion: THREE.GLSL3, uniforms: uniforms(),
    });
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(160, 40), this.wallMat);
    wall.position.set(0, 4, -60);
    this.three.add(wall);

    this.baffleMat = new THREE.ShaderMaterial({
      vertexShader: WALL_VERT, fragmentShader: BAFFLE_FRAG,
      glslVersion: THREE.GLSL3, uniforms: uniforms(),
    });
    // the slit barrier is a thin floating bar, not a room-wide wall — the
    // diffraction fan must stay visible on the back wall behind it
    // narrow stile housing the slit row — a wide bar eclipses most of the
    // central maximum when the dolly sweeps it past the wall
    const baffle = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 12), this.baffleMat);
    baffle.position.set(0, 1, -20);
    this.three.add(baffle);

    this.beamMat = new THREE.ShaderMaterial({
      vertexShader: WALL_VERT, fragmentShader: BEAM_FRAG,
      glslVersion: THREE.GLSL3, uniforms: uniforms(),
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    // wedge quad: hairline at the slit, full fan at the wall
    const g = new THREE.BufferGeometry();
    const y0 = 1.0;
    g.setAttribute('position', new THREE.Float32BufferAttribute([
      -0.15, y0, -19.7, 0.15, y0, -19.7, -24, y0, -59.5,
      0.15, y0, -19.7, 24, y0, -59.5, -24, y0, -59.5,
    ], 3));
    const beam = new THREE.Mesh(g, this.beamMat);
    this.three.add(beam);
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t;

    // slit width breathes mid-take: lobes widen as it narrows (λL/a)
    const a = 0.5 * (0.72 + 0.28 * Math.cos(t * 0.5 - 0.8));
    // second half: slit count ramps 1 → 8, pattern sharpens into orders
    const n = 1 + 7 * smooth(10.0, 16.5, t);

    for (const m of [this.wallMat, this.baffleMat, this.beamMat]) {
      m.uniforms.uT!.value = t;
      m.uniforms.uA!.value = a;
      m.uniforms.uN!.value = n;
    }

    const aspect = out.width / out.height;
    this.cam.aspect = aspect;
    this.cam.updateProjectionMatrix();

    // lateral dolly tracking the wall, then a drift that ends edge-on to the
    // baffle so the slit is seen as a hairline of light
    const s1 = smooth(0.0, 12.0, t);
    const s2 = smooth(12.5, 19.0, t);
    (this.beamMat.uniforms.uFade as { value: number }).value = 1.0 - 0.8 * s2;
    (this.beamMat.uniforms.uWaves as { value: number }).value = 1.0 - s2;
    // the lens stays left of the slit through the wall-track and only crosses
    // the slit axis during the drift, so the stile never eclipses the pattern
    const px = -15 + 13 * s1 + 13 * s2;     // -15 → -2 → 11
    const pz = 6 - 8 * s1 - 12 * s2;        //  6  → -2 → -14
    const py = 1.6 + 0.4 * Math.sin(t * 0.11);
    const lx = (-4 + 4 * s1) * (1 - s2);    // wall centre → the slit
    const lz = -60 + 40 * s2;               // -60 → -20
    this.cam.position.set(px, py, pz);
    this.cam.lookAt(lx, 1.0, lz);

    const rr = this.ctx.renderer;
    rr.setRenderTarget(out);
    rr.clear(true, true, true);
    rr.render(this.three, this.cam);
    rr.resetState();

    return {
      exposure: 0.12,
      bloom: 0.55,
      bloomThreshold: 0.5,
      bloomRadius: 0.7,
      ca: 0.0,
      grain: 0.04,
      vignette: 0.4,
      fade: 0.0,
      toneMap: 'agx',
    };
  }

  override dispose(): void {
    this.three.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        const m = o.material;
        (Array.isArray(m) ? m : [m]).forEach((mm) => mm.dispose());
      }
    });
  }
}
