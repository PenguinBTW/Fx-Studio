// biolume — deep-sea bioluminescence: a jellyfish pulses up through a dark water
// column, trailing tentacles, while plankton flash in cascades as its pressure wave
// passes and marine snow sifts down forever. The catalog's first aquatic register —
// light here is not sunlight but organism-made: every photon is biological.
// Everything closed-form in t: bell contraction, propulsion impulse integral,
// tentacle sway, plankton flash trains, snow drift.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { W, H } from '../../engine/gl';
import { DepthDoFPass } from '../../engine/dof';
import { smoothstep } from '../../engine/util';

// deterministic sin-hash seed in [0,1)
function seed(i: number, salt: number): number {
  const h = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return h - Math.floor(h);
}

// jellyfish vertical position: pulsed propulsion — each bell contraction impulse
// integrates to a smoothed step-up; closed form as a sum of smoothstep impulses.
function jellyY(t: number): number {
  // baseline rise: starts deep (-3.2) and ascends, slowing near the end
  const base = -3.2 + smoothstep(4, 26, t) * 4.4;
  // pulsed micro-bob: integral-ish of contraction pulses (period ~2.1s)
  const ph = t * (Math.PI * 2) / 2.1;
  return base + Math.sin(ph) * 0.06 * smoothstep(4, 6, t);
}
function jellyPos(t: number, out: THREE.Vector3): THREE.Vector3 {
  // slow lateral drift on a wide lissajous — gentle, organism-scale
  const x = Math.sin(t * 0.11 + 1.0) * 0.8 * smoothstep(4, 8, t);
  const z = Math.cos(t * 0.07 + 0.4) * 0.6 * smoothstep(4, 8, t);
  return out.set(x, jellyY(t), z);
}
// bell contraction: 0 = relaxed, 1 = fully contracted. Sharp contraction, slow release.
function bellPulse(t: number): number {
  const cyc = (t / 2.1) % 1;
  // contract fast in first 25% of cycle, release over remaining 75%
  return cyc < 0.25 ? smoothstep(0, 0.25, cyc) : 1 - smoothstep(0.25, 1.0, cyc);
}

export default class Biolume extends Scene {
  private cam = new THREE.PerspectiveCamera(42, W / H, 0.05, 200);
  private world = new THREE.Scene();
  private dof = new DepthDoFPass();
  private main: THREE.WebGLRenderTarget | null = null;
  private bellMat: THREE.ShaderMaterial | null = null;
  private jelly: THREE.Group | null = null;
  private bellGeo: THREE.BufferGeometry | null = null;
  private tentMat: THREE.ShaderMaterial | null = null;
  private plankMat: THREE.ShaderMaterial | null = null;
  private snowMat: THREE.ShaderMaterial | null = null;
  private _waterMesh: THREE.Mesh | null = null;
  private _plankGeo: THREE.BufferGeometry | null = null;
  private _snowGeo: THREE.BufferGeometry | null = null;
  private tmp = { a: new THREE.Vector3(), b: new THREE.Vector3() };

  override async init() {
    // the water column itself: a vast gradient sphere — abyss below, faint photic teal above
    const waterMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: { uTime: { value: 0 } },
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: `varying vec3 vP;
        void main(){
          float h = normalize(vP).y;
          vec3 abyss = vec3(0.001, 0.002, 0.005);
          vec3 photic = vec3(0.004, 0.02, 0.032);
          vec3 col = mix(abyss, photic, smoothstep(-0.4, 1.0, h));
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    this._waterMesh = new THREE.Mesh(new THREE.SphereGeometry(120, 32, 16), waterMat);
    this.world.add(this._waterMesh);

    // faint ambient — barely anything; most light is biological
    this.world.add(new THREE.HemisphereLight(0x0a2030, 0x020408, 0.15));

    // ---- the jellyfish -------------------------------------------------
    this.jelly = new THREE.Group();

    // bell: lathe of a dome profile — wide rim, domed top
    const pts: THREE.Vector2[] = [];
    const N = 24;
    for (let i = 0; i <= N; i++) {
      const u = i / N; // 0 rim -> 1 apex
      const ang = u * Math.PI * 0.52;
      pts.push(new THREE.Vector2(Math.sin(ang) * 0.55, Math.cos(ang) * 0.42));
    }
    this.bellGeo = new THREE.LatheGeometry(pts, 40);
    // lathe builds around Y with profile rotated — recenter so rim is at y=0, dome up
    this.bellGeo.translate(0, -0.1, 0);

    this.bellMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: true,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uPulse: { value: 0 },
        uGlow: { value: 1 },
      },
      vertexShader: `
        varying vec3 vP;
        varying vec3 vN;
        uniform float uPulse;
        void main(){
          vP = position;
          // contraction: rim pulls inward+downward on pulse, dome squashes slightly
          vec3 p = position;
          float rimness = 1.0 - smoothstep(0.1, 0.35, position.y);
          float squeeze = uPulse * (0.22 + rimness * 0.18);
          p.xz *= (1.0 - squeeze);
          p.y *= (1.0 - uPulse * 0.12);
          vN = normalize(mat3(modelMatrix) * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: `
        varying vec3 vP;
        varying vec3 vN;
        uniform float uTime;
        uniform float uPulse;
        uniform float uGlow;
        void main(){
          // translucent tissue: fresnel-bright rim, glowing organs near apex
          vec3 n = normalize(vN);
          float fres = pow(1.0 - abs(n.z), 2.0);
          float apex = smoothstep(0.05, 0.32, vP.y);
          // radial organ stripes — the gonad ring of a moon jelly, faint violet
          float ang = atan(vP.z, vP.x);
          float organs = pow(abs(sin(ang * 2.0)), 6.0) * apex * 0.8;
          vec3 tissue = vec3(0.12, 0.3, 0.42) * fres * 0.28;
          vec3 organ = vec3(0.75, 0.3, 0.9) * organs * 1.4;
          // internal bioluminescent core, breathing with the pulse
          float core = apex * (0.4 + uPulse * 1.2);
          vec3 glow = vec3(0.2, 0.85, 1.0) * core * uGlow * 1.5;
          vec3 col = tissue + organ + glow;
          float alpha = clamp(fres * 0.32 + apex * 0.2 + organs * 0.3, 0.0, 0.7);
          gl_FragColor = vec4(col * alpha, alpha);
        }`,
    });
    const bell = new THREE.Mesh(this.bellGeo, this.bellMat);
    this.jelly.add(bell);

    // tentacles: 9 ribbons as camera-ish-facing planes, shader-displaced sine sway.
    // closed-form: sway phase per tentacle, amplitude grows toward the tip.
    const tentGeo = new THREE.PlaneGeometry(0.03, 1.6, 1, 40);
    tentGeo.translate(0, -0.8, 0); // root at origin, hangs down
    this.tentMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uPulse: { value: 0 },
      },
      vertexShader: `
        varying float vDown;
        varying float vSeed;
        uniform float uTime;
        uniform float uPulse;
        attribute float aSeed;
        void main(){
          vDown = -position.y / 1.6;
          vSeed = aSeed;
          vec3 p = position;
          // sway: traveling wave down the tentacle, phase per-tentacle
          float wave = sin(vDown * 5.0 - uTime * 1.7 + aSeed * 6.28) * 0.22 * vDown;
          float wave2 = cos(vDown * 3.4 - uTime * 1.1 + aSeed * 9.4) * 0.17 * vDown;
          p.x += wave;
          p.z += wave2;
          // contraction drag: tentacles trail outward slightly when bell squeezes
          float drag = uPulse * 0.16 * vDown;
          p.x += drag * sin(aSeed * 6.28);
          p.z += drag * cos(aSeed * 6.28);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: `
        varying float vDown;
        varying float vSeed;
        uniform float uTime;
        void main(){
          // faint cyan filament, brighter at root, occasional glint traveling down
          float glint = pow(0.5 + 0.5 * sin(vDown * 7.0 - uTime * 2.6 + vSeed * 12.0), 8.0);
          vec3 col = vec3(0.3, 0.8, 0.9) * (0.25 * (1.0 - vDown * 0.6) + glint * 0.8);
          float alpha = (1.0 - vDown * 0.75) * 0.5;
          gl_FragColor = vec4(col * alpha, alpha);
        }`,
    });
    for (let i = 0; i < 9; i++) {
      const tg = tentGeo.clone();
      const seeds = new Float32Array(tg.attributes.position.count).fill(i / 9);
      tg.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
      const tm = new THREE.Mesh(tg, this.tentMat);
      const ang = (i / 9) * Math.PI * 2;
      tm.position.set(Math.cos(ang) * 0.32, -0.05, Math.sin(ang) * 0.32);
      // orient each tentacle plane facing outward-ish; shader handles the life
      tm.rotation.y = -ang + Math.PI / 2;
      this.jelly.add(tm);
    }
    this.world.add(this.jelly);


    // ---- plankton: 1400 GPU points, drift + flash cascades ---------------
    const NP = 1400;
    const pgeo = new THREE.BufferGeometry();
    const ppos = new Float32Array(NP * 3);
    const pseed = new Float32Array(NP * 3); // x: hash1, y: hash2, z: hash3
    for (let i = 0; i < NP; i++) {
      // spread through the visible water column
      ppos[i * 3] = (seed(i, 1) - 0.5) * 22;
      ppos[i * 3 + 1] = (seed(i, 2) - 0.5) * 14;
      ppos[i * 3 + 2] = (seed(i, 3) - 0.5) * 22;
      pseed[i * 3] = seed(i, 4);
      pseed[i * 3 + 1] = seed(i, 5);
      pseed[i * 3 + 2] = seed(i, 6);
    }
    pgeo.setAttribute('position', new THREE.BufferAttribute(ppos, 3));
    pgeo.setAttribute('aSeed', new THREE.BufferAttribute(pseed, 3));
    this.plankMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uJelly: { value: new THREE.Vector3() },
      },
      vertexShader: `
        attribute vec3 aSeed;
        varying float vFlash;
        varying float vDim;
        uniform float uTime;
        uniform vec3 uJelly;
        void main(){
          // slow drift: closed-form current + micro turbulence
          vec3 p = position;
          p.x += sin(uTime * 0.05 + aSeed.x * 6.28) * 1.2 + uTime * 0.02;
          p.y += sin(uTime * 0.07 + aSeed.y * 6.28) * 0.4 - uTime * 0.008;
          p.z += cos(uTime * 0.04 + aSeed.z * 6.28) * 1.2;
          // wrap in the column
          p.x = mod(p.x + 11.0, 22.0) - 11.0;
          p.y = mod(p.y + 7.0, 14.0) - 7.0;
          p.z = mod(p.z + 11.0, 22.0) - 11.0;

          // flash logic: spontaneous rare flashes + cascade when the jelly passes near.
          // spontaneous: each plankton flashes once per ~9s cycle, brief 0.4s window
          float cyc = fract(uTime / 9.0 + aSeed.x);
          float spont = smoothstep(0.0, 0.02, cyc) * (1.0 - smoothstep(0.02, 0.05, cyc)) * step(0.75, aSeed.y);
          // cascade: distance to jelly vs expanding wavefront — the pressure wave of
          // each contraction travels outward at ~1.2 units/s; plankton flash as it passes
          float d = distance(p, uJelly);
          float waveT = fract(uTime / 2.1);
          float waveR = waveT * 2.1 * 1.2;
          float ring = 1.0 - smoothstep(0.0, 0.5, abs(d - waveR));
          float cascade = ring * (1.0 - smoothstep(0.0, 0.75, waveT)) * step(0.4, aSeed.z);
          vFlash = max(spont, cascade * 2.2);
          vDim = 0.05 + aSeed.z * 0.05;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          float size = (0.8 + aSeed.x * 1.1) * (1.0 + vFlash * 1.2);
          gl_PointSize = size * (140.0 / max(1.0, -mv.z));
        }`,
      fragmentShader: `
        varying float vFlash;
        varying float vDim;
        void main(){
          vec2 uv = gl_PointCoord - 0.5;
          float d = length(uv) * 2.0;
          float disc = 1.0 - smoothstep(0.3, 1.0, d);
          // dim ambient plankton body + hot cyan flash
          vec3 col = vec3(0.35, 0.9, 1.0) * (vDim + vFlash * 2.0);
          float alpha = disc * (vDim + vFlash) * 0.9;
          if (alpha < 0.01) discard;
          gl_FragColor = vec4(col * alpha, alpha);
        }`,
    });
    this._plankGeo = pgeo;
    const plank = new THREE.Points(pgeo, this.plankMat);
    plank.frustumCulled = false; // positions are GPU-computed
    this.world.add(plank);

    // ---- marine snow: 700 slow-falling motes ------------------------------
    const NS = 700;
    const sgeo = new THREE.BufferGeometry();
    const spos = new Float32Array(NS * 3);
    const sseed = new Float32Array(NS);
    for (let i = 0; i < NS; i++) {
      spos[i * 3] = (seed(i, 11) - 0.5) * 20;
      spos[i * 3 + 1] = (seed(i, 12) - 0.5) * 14;
      spos[i * 3 + 2] = (seed(i, 13) - 0.5) * 20;
      sseed[i] = seed(i, 14);
    }
    sgeo.setAttribute('position', new THREE.BufferAttribute(spos, 3));
    sgeo.setAttribute('aSeed', new THREE.BufferAttribute(sseed, 1));
    this.snowMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 } },
      vertexShader: `
        attribute float aSeed;
        varying float vA;
        uniform float uTime;
        void main(){
          vec3 p = position;
          // steady fall at per-mote rate + lateral sway — closed form
          float fall = 0.10 + aSeed * 0.12;
          p.y -= uTime * fall;
          p.x += sin(uTime * 0.3 + aSeed * 20.0) * 0.3;
          p.y = mod(p.y + 7.0, 14.0) - 7.0;
          vA = 0.10 + aSeed * 0.15;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = (0.7 + aSeed * 1.1) * (140.0 / max(1.0, -mv.z));
        }`,
      fragmentShader: `
        varying float vA;
        void main(){
          vec2 uv = gl_PointCoord - 0.5;
          float d = length(uv) * 2.0;
          float disc = 1.0 - smoothstep(0.2, 1.0, d);
          vec3 col = vec3(0.5, 0.65, 0.75);
          float alpha = disc * vA;
          if (alpha < 0.01) discard;
          gl_FragColor = vec4(col * alpha, alpha);
        }`,
    });
    this._snowGeo = sgeo;
    const snow = new THREE.Points(sgeo, this.snowMat);
    snow.frustumCulled = false;
    this.world.add(snow);
  }

  override render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const rr = this.ctx.renderer;
    const lt = f.t;

    // jellyfish placement — pulses into view from below after the dark open
    jellyPos(lt, this.tmp.a);
    this.jelly!.position.copy(this.tmp.a);
    const pulse = bellPulse(lt) * smoothstep(4, 5, lt);
    this.bellMat!.uniforms.uTime.value = lt;
    this.bellMat!.uniforms.uPulse.value = pulse;
    this.tentMat!.uniforms.uTime.value = lt;
    this.tentMat!.uniforms.uPulse.value = pulse;
    this.plankMat!.uniforms.uTime.value = lt;
    this.plankMat!.uniforms.uJelly.value.copy(this.tmp.a);
    this.snowMat!.uniforms.uTime.value = lt;

    // camera: slow drift-orbit keeping the jelly off-center-left, macro intimacy.
    // before the jelly rises (t<4) the camera drifts through plankton space.
    const k = smoothstep(4, 10, lt);
    const az = 0.6 + lt * 0.045;
    const rad = 3.4 - k * 1.1;
    const cx = Math.sin(az) * rad + this.tmp.a.x * 0.5;
    const cz = Math.cos(az) * rad + this.tmp.a.z * 0.5;
    const cy = this.tmp.a.y + 0.35 + Math.sin(lt * 0.13) * 0.12 + (1.0 - smoothstep(0, 6, lt)) * 1.1;
    this.cam.position.set(cx, cy, cz);
    this.cam.up.set(0, 1, 0);
    // look at the jelly heart, slightly above center — tentacles read below
    this.tmp.b.copy(this.tmp.a);
    this.tmp.b.y += 0.1;
    this.cam.lookAt(this.tmp.b);

    // DoF on the bell — view-axis depth
    const fwd = this.cam.getWorldDirection(new THREE.Vector3());
    const focusD = this.tmp.a.clone().sub(this.cam.position).dot(fwd);

    if (!this.main) {
      this.main = new THREE.WebGLRenderTarget(out.width, out.height, {
        type: THREE.HalfFloatType,
        depthTexture: new THREE.DepthTexture(out.width, out.height, THREE.UnsignedInt248Type),
      });
    }
    rr.setRenderTarget(this.main);
    rr.clear(true, true, true);
    rr.render(this.world, this.cam);
    this.dof.render(rr, this.main.texture, this.main.depthTexture!, {
      enabled: true,
      focusDistance: Math.max(0.4, focusD),
      aperture: 9,
      maxRadius: 12,
      samples: 36,
      near: 0.05,
      far: 200,
    }, out);
    rr.resetState();
    return { exposure: 1.05, bloom: 0.45, vignette: 0.5 } as PostOverrides;
  }

  override dispose() {
    this._waterMesh?.geometry.dispose();
    (this._waterMesh?.material as THREE.Material | undefined)?.dispose();
    this._plankGeo?.dispose();
    this._snowGeo?.dispose();
    this.bellGeo?.dispose();
    this.bellMat?.dispose();
    this.tentMat?.dispose();
    this.plankMat?.dispose();
    this.snowMat?.dispose();
    this.main?.dispose();
    this.jelly?.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
    });
    this.dof.dispose?.();
  }
}
