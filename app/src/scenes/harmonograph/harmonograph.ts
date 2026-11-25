// harmonograph — light drawing mathematics. Three luminous pendulum tips trace 3D Lissajous
// ribbons through a void, each line written progressively as its pen moves, spectral color
// along the arc, amplitudes decaying like a real damped pendulum. The motion is the subject.
// Everything closed-form: the curves are analytic, the reveal is a uniform time cutoff.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { W, H } from '../../engine/gl';
import { smoothstep } from '../../engine/util';

interface Pen {
  freq: [number, number, number];   // x/y/z angular frequencies
  phase: [number, number, number];
  amp: [number, number, number];
  decay: number;                    // amplitude damping rate (1/s)
  hueShift: number;
  writeDelay: number;               // when this pen starts drawing
  speed: number;                    // global time scale for this pendulum
}

const T_DRAW = 26.0; // seconds of writing before rest

// classic harmonic ratios — near-commensurate frequencies make the braid almost-close
const PENS: Pen[] = [
  { freq: [3.0, 2.0, 2.5], phase: [0.0, 0.0, 0.0], amp: [1.15, 0.85, 0.7], decay: 0.055, hueShift: 0.0, writeDelay: 0.0, speed: 1.0 },
  { freq: [5.0, 4.0, 3.0], phase: [1.3, 0.4, 2.1], amp: [0.95, 1.05, 0.6], decay: 0.05, hueShift: 0.33, writeDelay: 3.0, speed: 1.0 },
  { freq: [4.0, 3.0, 5.0], phase: [2.6, 1.1, 0.7], amp: [1.05, 0.8, 0.85], decay: 0.06, hueShift: 0.66, writeDelay: 9.0, speed: 1.0 },
];

// damped 3D Lissajous position at local time t — the physical harmonograph closed form
function penPos(p: Pen, lt: number, out: THREE.Vector3): THREE.Vector3 {
  const t = Math.max(0, lt - p.writeDelay) * p.speed;
  const d = Math.exp(-p.decay * t);
  out.set(
    p.amp[0] * d * Math.sin(p.freq[0] * t + p.phase[0]),
    p.amp[1] * d * Math.sin(p.freq[1] * t + p.phase[1]),
    p.amp[2] * d * Math.sin(p.freq[2] * t + p.phase[2]),
  );
  return out;
}

// camera: one slow orbit, slight vertical drift — the sculpture rotates in frame
function camPos(lt: number, out: THREE.Vector3): THREE.Vector3 {
  const yaw = 0.5 + lt * 0.09;
  const pitch = 0.12 + 0.10 * Math.sin(lt * 0.05 + 1.0);
  const r = 3.55;
  out.set(
    r * Math.cos(pitch) * Math.cos(yaw),
    r * Math.sin(pitch) + 0.15,
    r * Math.cos(pitch) * Math.sin(yaw),
  );
  return out;
}

const STEPS = 1600;   // curve samples per ribbon
const T_END = 30.0;

export default class Harmonograph extends Scene {
  private cam = new THREE.PerspectiveCamera(48, W / H, 0.05, 60);
  private world = new THREE.Scene();
  private ribbons: { mesh: THREE.Mesh; mat: THREE.ShaderMaterial; pen: Pen }[] = [];
  private tips: { mesh: THREE.Mesh; pen: Pen }[] = [];
  private tmp = { a: new THREE.Vector3(), b: new THREE.Vector3() };

  override init() {
    this.world.background = new THREE.Color(0x030304);
    // faint ambient so pen spheres read as solid
    this.world.add(new THREE.AmbientLight(0xffffff, 0.25));

    for (const pen of PENS) {
      // sample the full curve once at init — static geometry, deterministic; the
      // reveal is a per-frame uniform cutoff, so evaluation stays closed-form
      const positions = new Float32Array((STEPS + 1) * 3);
      const times = new Float32Array(STEPS + 1);
      const v = new THREE.Vector3();
      for (let i = 0; i <= STEPS; i++) {
        const lt = (i / STEPS) * T_END;
        penPos(pen, lt, v);
        positions[i * 3] = v.x; positions[i * 3 + 1] = v.y; positions[i * 3 + 2] = v.z;
        times[i] = lt;
      }
      // polyline → camera-facing ribbon strip built in the vertex shader is complex;
      // use a narrow TubeGeometry per pen instead, with custom time attribute
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= STEPS; i += 4) pts.push(new THREE.Vector3(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]));
      const curve = new THREE.CatmullRomCurve3(pts);
      const tube = new THREE.TubeGeometry(curve, 900, 0.013, 6, false);
      // arc-time attribute: interpolate local time along the tube by uv.x
      const uv = tube.attributes.uv!;
      const timeAttr = new Float32Array(uv.count);
      for (let i = 0; i < uv.count; i++) timeAttr[i] = uv.getX(i) * T_END;
      tube.setAttribute('aTime', new THREE.BufferAttribute(timeAttr, 1));

      const mat = new THREE.ShaderMaterial({
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        uniforms: {
          uNow: { value: 0 },
          uHueShift: { value: pen.hueShift },
        },
        vertexShader: /* glsl */`
          attribute float aTime;
          varying float vTime;
          varying vec3 vPos;
          void main() {
            vTime = aTime;
            vPos = position;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */`
          uniform float uNow;
          uniform float uHueShift;
          varying float vTime;
          varying vec3 vPos;
          // spectral hue as rgb — amber → rose → violet drift
          vec3 spectral(float h) {
            vec3 c = 0.5 + 0.5 * cos(6.28318 * (h + vec3(0.0, 0.33, 0.67)));
            // warm-biased: boost red/amber end
            return c * vec3(1.15, 0.95, 1.05);
          }
          void main() {
            float wrote = uNow - vTime;
            if (wrote < 0.0) discard;
            float age = wrote / 30.0;
            // fresh ink is hot, older ink settles — long-exposure feel
            float glow = 2.6 / (1.0 + age * 5.0);
            float h = fract(uHueShift + vTime / 30.0 * 1.15);
            vec3 col = spectral(h) * glow;
            gl_FragColor = vec4(col, 0.85);
          }
        `,
      });
      const mesh = new THREE.Mesh(tube, mat);
      this.world.add(mesh);
      this.ribbons.push({ mesh, mat, pen });

      // pen tip: small hot sphere — emissive white-gold
      const tip = new THREE.Mesh(
        new THREE.SphereGeometry(0.03, 16, 12),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(4.0, 3.2, 2.0) }),
      );
      this.world.add(tip);
      this.tips.push({ mesh: tip, pen });
    }
  }

  override render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const lt = f.lt, r = this.ctx.renderer;

    camPos(lt, this.tmp.a);
    this.cam.position.copy(this.tmp.a);
    this.cam.lookAt(0, 0, 0);
    this.cam.updateMatrixWorld();

    // writing progress slows to rest after T_DRAW — pens settle at the heart
    const writeT = lt < T_DRAW ? lt : T_DRAW + (lt - T_DRAW) * 0.02;
    for (const rb of this.ribbons) rb.mat.uniforms.uNow!.value = writeT;
    for (const tp of this.tips) {
      penPos(tp.pen, writeT, this.tmp.b);
      tp.mesh.position.copy(this.tmp.b);
      // pens fade out once settled — the drawing remains
      const rest = smoothstep(T_DRAW + 1.5, T_DRAW + 3.5, lt);
      const started = smoothstep(tp.pen.writeDelay, tp.pen.writeDelay + 0.8, lt);
      const s = started * (1 - rest);
      tp.mesh.scale.setScalar(Math.max(0.0001, s));
    }

    r.setRenderTarget(out);
    r.setClearColor(0x030304, 1);
    r.clear();
    r.render(this.world, this.cam);
    r.resetState();
    return { bloom: 0.85, vignette: 0.3 };
  }

  override dispose() {
    this.world.traverse((o: any) => {
      o.geometry?.dispose?.();
      const m = o.material;
      if (Array.isArray(m)) m.forEach((x) => x.dispose?.());
      else m?.dispose?.();
    });
  }
}
