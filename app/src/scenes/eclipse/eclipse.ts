// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
// eclipse: a slow solar eclipse on a near-black sky. A bright bone disc is
// covered by a darker disc drifting right→left (closed-form path); the thin
// diamond-ring flare blazes at second and third contact, the corona — soft
// radial streamers (analytic angular falloff × slow brightness noise) — fans
// out at totality, faint stars surface, then egress rebrightens the sky. A
// warm chromosphere rim hugs the limb only at the two contacts — the single
// colour event. Camera: near-static, very slow push-in. Fully stateless f(t):
// every element derives from the frame time — no accumulators, no Math.random.
import * as THREE from 'three';
import { Scene, type Frame, type SceneCtx, type PostOverrides } from '../../engine/scene';
import { GLSL_COMMON } from '../../engine/glsl/common';
import { orbitPosition } from '../../engine/rig';

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

// --- shaders -----------------------------------------------------------------
const SKY_VERT = `out vec3 vW;
void main(){ vW = (modelMatrix * vec4(position,1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;

const SKY_FRAG = `${GLSL_COMMON}

uniform float uT;
in vec3 vW; out vec4 fragColor;

const vec2 SUN = vec2(0.0, 0.9);
const float R = 3.4;      // solar disc radius in world units
const float RM = R * 1.03; // lunar disc just larger, so the corona peeks past the limb

float hash1(float n){ return fract(sin(n * 127.1) * 43758.5453123); }
vec2 hash2(float n){ return vec2(hash1(n), hash1(n + 71.7)); }

// Moon centre: fast approach, a slow crawl through totality, fast egress.
vec2 moonAt(float t) {
  float x = t < 11.0 ? mix(8.0, 0.12, smoothstep(2.5, 11.0, t))
          : t < 14.5 ? mix(0.12, -0.12, smoothstep(11.0, 14.5, t))
          : mix(-0.12, -8.0, smoothstep(14.5, 19.2, t));
  float y = 0.9 + mix(0.35, -0.15, smoothstep(2.5, 19.2, t));
  return vec2(x, y);
}

// 1 at totality, 0 while any photosphere shows.
float totality(vec2 m) {
  float d = distance(m, SUN);
  return (1.0 - smoothstep(0.3, 0.9, d));
}

void main() {
  vec2 p = vW.xy;
  float t = uT;
  vec2 m = moonAt(t);
  float tot = totality(m);

  // Sky: near-black, deepening a touch as the light dies at totality.
  vec3 sky = mix(vec3(0.012, 0.016, 0.028), vec3(0.004, 0.006, 0.012), tot);

  // Stars: a hashed point lattice that fades in only inside totality.
  vec2 cell = floor(p * 4.0);
  vec2 sp = (cell + 0.5 + (hash2(cell.x * 73.7 + cell.y * 19.3) - 0.5) * 0.9) / 4.0;
  float sh = hash1(cell.x * 91.3 + cell.y * 37.1);
  float star = (1.0 - smoothstep(0.004, 0.012, distance(p, sp))) * step(0.78, sh);
  float twinkle = 0.75 + 0.25 * sin(t * 2.7 + sh * TAU);
  sky += vec3(0.75, 0.8, 0.95) * star * twinkle * smoothstep(0.55, 0.95, tot) * 0.5;

  // Photosphere: a limb-darkened bone disc; its crescent dims into totality.
  float rs = distance(p, SUN);
  float disc = 1.0 - smoothstep(R - 0.012, R + 0.012, rs);
  float covered = smoothstep(RM - 0.012, RM + 0.012, distance(p, m));
  float visible = disc * covered;
  float limb = 0.55 + 0.45 * sqrt(clamp(1.0 - pow(rs / R, 2.0), 0.0, 1.0));
  float phase = 1.0 - tot; // how much disc remains
  vec3 bone = vec3(0.98, 0.94, 0.86);
  vec3 col = sky + bone * visible * limb * (0.35 + 2.8 * phase);
  // Broad photosphere glow shrinks with the crescent.
  col += bone * phase * 0.35 * exp(-rs / (R * 1.4)) * disc;

  // Corona: only at totality — radial falloff, equatorial streamer lobes via
  // angular harmonics, brightness breathed by slow noise on angle only.
  float r = rs - R;
  if (r > 0.0 && tot > 0.001) {
    float theta = atan(p.y - SUN.y, p.x - SUN.x);
    // Brightness-only noise in [0,1]: fbm is centered on zero, so it is
    // normalised before it modulates — never allowed to invert a term.
    float wisps = 0.5 + 0.5 * fbm(vec2(cos(theta), sin(theta)) * 2.4 + vec2(t * 0.045, -t * 0.03), 4);
    float lobes = 0.45 + 0.30 * cos(2.0 * theta - 0.4) + 0.15 * cos(3.0 * theta + 1.2);
    float fil = pow(0.5 + 0.5 * cos(9.0 * theta + wisps * 6.0), 3.0);
    float rad = exp(-r / (0.45 + 0.9 * wisps)) * (1.0 - smoothstep(1.1 * R, 3.8 * R, rs));
    vec3 corona = mix(vec3(0.55, 0.62, 0.78), vec3(0.9, 0.92, 0.98), 1.0 - smoothstep(R, 2.2 * R, rs));
    col += corona * tot * lobes * (0.5 + 0.9 * fil * wisps) * rad;
    col += bone * tot * 0.22 * exp(-r / 0.35); // inner ring hugging the limb
  }

  // Chromosphere: a warm pin-thin rim riding the moon's limb, only while the
  // two contacts brush past — the scene's single colour event.
  float wC2 = exp(-pow((t - 10.85) / 0.5, 2.0)) + exp(-pow((t - 14.65) / 0.5, 2.0));
  float rim = exp(-abs(distance(p, m) - RM) / 0.035);
  col += vec3(1.0, 0.42, 0.22) * rim * wC2 * 0.9;

  // Diamond ring: a hard point of fire where the photosphere last vanishes /
  // first returns — the leading limb at C2, the trailing limb at C3.
  float env2 = exp(-pow((t - 10.9) / 0.3, 2.0));
  float env3 = exp(-pow((t - 14.7) / 0.3, 2.0));
  // The flash peeks just past the limb — at the contact instants the moon's
  // disc still leaves a hairline gap at those points, so the points sit a
  // shade outside R to stay visible through the moon-mix.
  vec2 f2 = SUN + vec2(-R * 1.045, 0.05);
  vec2 f3 = SUN + vec2(R * 1.045, -0.05);
  float flare = env2 * exp(-distance(p, f2) / 0.09) + env3 * exp(-distance(p, f3) / 0.09);
  col += vec3(1.0, 0.97, 0.9) * flare * 5.0;

  // The moon: a near-black disc with a whisper of earthshine.
  float inMoon = 1.0 - smoothstep(RM - 0.008, RM + 0.008, distance(p, m));
  vec3 moonCol = vec3(0.015, 0.017, 0.024) * (0.55 + 0.45 * smoothstep(0.0, RM, distance(p, m)));
  col = mix(col, moonCol, inMoon * 0.97);

  fragColor = vec4(col, 1.0);
}`;

export default class EclipseScene extends Scene {
  private three = new THREE.Scene();
  private cam: THREE.PerspectiveCamera;
  private mat: THREE.ShaderMaterial;

  constructor(ctx: SceneCtx) {
    super(ctx);
    this.cam = new THREE.PerspectiveCamera(38, 16 / 9, 0.1, 300);
    this.mat = new THREE.ShaderMaterial({
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      glslVersion: THREE.GLSL3,
      uniforms: { uT: { value: 0 } },
    });
    // Sky plane well behind the discs' world — big enough that every export
    // aspect fills it (portrait crops the wings, ultrawide sees the full fan).
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(180, 60), this.mat);
    sky.position.set(0, 0.9, -60);
    this.three.add(sky);
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t;
    this.mat.uniforms.uT!.value = t;

    const aspect = out.width / out.height;
    this.cam.aspect = aspect;
    this.cam.updateProjectionMatrix();

    // Near-static with a very slow push-in: an orbit of shrinking radius,
    // dead-centre so nothing but the scale of the sky moves.
    const r = 60 - 6 * smooth(0.0, 20.0, t);
    const pos = orbitPosition([0, 0.9, -60], r, 0.02, 0.01 * Math.sin(t * 0.08));
    this.cam.position.set(pos[0], pos[1], pos[2]);
    this.cam.lookAt(0, 0.9, -60);

    const rr = this.ctx.renderer;
    rr.setRenderTarget(out);
    rr.clear(true, true, true);
    rr.render(this.three, this.cam);
    rr.resetState();

    return {
      exposure: 0.15,
      bloom: 0.55,
      bloomThreshold: 0.55,
      bloomRadius: 0.7,
      ca: 0.0,
      grain: 0.04,
      vignette: 0.35,
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
    this.mat.dispose();
  }
}
