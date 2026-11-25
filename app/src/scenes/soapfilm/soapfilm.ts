// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
// soapfilm — wave-optics/iridescence register: a soap bubble floating in a dim
// studio void, thin-film interference marbling across its skin as the film drains
// under gravity and convection swirls it. Where optica decomposes light by
// refraction, soapfilm decomposes it by wave interference — color born purely
// from geometry measured in nanometers. Mid-scene the film drains critically
// and the bubble pops into a droplet mist; a second bubble is blown after.
// Everything closed-form in t: drainage, marbling advection, pop, droplet burst.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { W, H } from '../../engine/gl';
import { DepthDoFPass } from '../../engine/dof';
import { smoothstep } from '../../engine/util';

function seed(i: number, salt: number): number {
  const h = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return h - Math.floor(h);
}

// bubble timeline: bubble1 floats 0..popT, pops at popT; bubble2 blown after.
const POP_T = 19.0;
const BLOW_T0 = 21.5;
const BLOW_T1 = 24.5;

export default class Soapfilm extends Scene {
  private cam = new THREE.PerspectiveCamera(38, W / H, 0.02, 100);
  private world = new THREE.Scene();
  private dof = new DepthDoFPass();
  private main: THREE.WebGLRenderTarget | null = null;
  private filmMat: THREE.ShaderMaterial | null = null;
  private film2Mat: THREE.ShaderMaterial | null = null;
  private bubble1: THREE.Mesh | null = null;
  private bubble2: THREE.Mesh | null = null;
  private dropMat: THREE.ShaderMaterial | null = null;
  private _dropGeo: THREE.BufferGeometry | null = null;
  private _sphereGeo: THREE.BufferGeometry | null = null;
  private _bgMesh: THREE.Mesh | null = null;
  private tmp = { a: new THREE.Vector3(), b: new THREE.Vector3() };

  private filmShader(): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: true, // hero subject — the DoF focus plane needs it (biolume pattern)
      uniforms: {
        uTime: { value: 0 },
        uBirth: { value: 0 },     // scale-in envelope
        uPop: { value: 0 },       // pop disintegration 0..1
        uDrain: { value: 0 },     // cumulative drainage clock for this bubble
        uCamPos: { value: new THREE.Vector3() },
      },
      vertexShader: `
        varying vec3 vN;
        varying vec3 vW;
        varying vec3 vP;
        uniform float uPop;
        uniform float uBirth;
        void main(){
          vP = position;
          vec3 p = position * uBirth;
          // pop: fragments fly outward slightly as the film disintegrates
          p *= (1.0 + uPop * 0.4);
          vN = normalize(mat3(modelMatrix) * normal);
          vec4 w = modelMatrix * vec4(p, 1.0);
          vW = w.xyz;
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: `
        varying vec3 vN;
        varying vec3 vW;
        varying vec3 vP;
        uniform float uTime;
        uniform float uPop;
        uniform float uDrain;
        uniform vec3 uCamPos;

        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
        float noise(vec2 p){
          vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f);
          return mix(mix(hash(i),hash(i+vec2(1,0)),u.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x), u.y);
        }
        float fbm(vec2 p){
          float v = 0.0, a = 0.5;
          for(int k=0;k<4;k++){ v += noise(p)*a; p *= 2.13; a *= 0.5; }
          return v;
        }
        // thin-film interference: reflectance amplitude for wavelength lambda (nm)
        // given film thickness d (nm), angle of incidence cos0. Air/film/air —
        // one phase inversion, so constructive reflection at 2nd = (m+0.5)lambda.
        vec3 thinfilm(float d, float cosT){
          vec3 col = vec3(0.0);
          // sample RGB as three bands
          float lambdas[3];
          lambdas[0] = 620.0; lambdas[1] = 540.0; lambdas[2] = 460.0;
          for(int k=0;k<3;k++){
            float lambda = lambdas[k];
            // optical path difference in the film (n=1.33), first-order dominant
            float opd = 2.0 * 1.33 * d * cosT;
            float phase = fract(opd / lambda);
            // two-beam interference intensity with single phase inversion
            float inten = 0.5 + 0.5 * cos(6.28318 * phase + 3.14159);
            col[k] = inten;
          }
          return col;
        }
        void main(){
          vec3 n = normalize(vN);
          vec3 view = normalize(uCamPos - vW);
          float fres = pow(1.0 - abs(dot(n, view)), 1.5);

          // film thickness field (nm): base drainage + convection marbling.
          // sphere-local coords: vP.y in [-1,1]; thinner toward the top over time.
          vec2 flowUv = vec2(atan(vP.z, vP.x) * 1.2, vP.y * 2.0);
          // marbling advects slowly upward (convection) — closed form swirl
          float swirl = fbm(flowUv * 2.0 + vec2(0.0, -uDrain * 0.35));
          float marble = fbm(flowUv * 4.0 + swirl * 2.2 + vec2(uDrain * 0.06, -uDrain * 0.22));
          // vertical gradient: film drains — top thins toward zero approaching the pop
          float drainBase = 620.0 - uDrain * 22.0 - (vP.y * 0.5 + 0.5) * 320.0;
          float d = drainBase + marble * 260.0 + swirl * 120.0;
          d = max(d, 30.0);

          // Snell refraction into the film (n=1.33): interference depends on the
          // INSIDE-film angle, not the incident angle in air
          float cosI = abs(dot(n, view));
          float sinI2 = 1.0 - cosI * cosI;
          float sinT2 = sinI2 / (1.33 * 1.33);
          float cosT = sqrt(max(0.0, 1.0 - sinT2));
          vec3 irid = thinfilm(d, cosT);
          irid = irid / (1.0 + irid * 0.25);

          // bubble shading: mostly transparent, interference flares at grazing angles
          // studio env approximation: two soft boxes reflected as streak highlights
          vec3 r = reflect(-view, n);
          float box1 = pow(max(0.0, dot(r, normalize(vec3(-0.5, 0.7, 0.4)))), 24.0);
          float box2 = pow(max(0.0, dot(r, normalize(vec3(0.6, -0.2, 0.5)))), 30.0);
          vec3 highlight = vec3(1.0) * box1 * 0.7 + vec3(0.9, 0.95, 1.0) * box2 * 0.4;

          float filmVis = 0.28 + fres * 0.72;
          vec3 col = irid * filmVis * (1.35 + fres * 0.8) + highlight;
          // edge-on the film is bright; face-on nearly invisible
          float alpha = clamp(fres * 0.82 + 0.07 + length(irid) * 0.05 * (0.4 + fres), 0.0, 0.9);

          // pop disintegration: noise-driven dissolve — holes spread across the film
          if (uPop > 0.0) {
            float holes = fbm(flowUv * 6.0 + 3.7);
            float dissolve = smoothstep(uPop * 1.2 - 0.2, uPop * 1.2, holes);
            alpha *= dissolve;
            col *= dissolve;
          }
          if (alpha < 0.01) discard;
          gl_FragColor = vec4(col, alpha);
        }`,
    });
  }

  override async init() {
    // dim studio void — deep charcoal gradient, brighter above
    const bgMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {},
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: `varying vec3 vP;
        void main(){
          float h = normalize(vP).y;
          vec3 lo = vec3(0.012, 0.012, 0.016);
          vec3 hi = vec3(0.06, 0.065, 0.085);
          gl_FragColor = vec4(mix(lo, hi, smoothstep(-0.5, 0.9, h)), 1.0);
        }`,
    });
    this._bgMesh = new THREE.Mesh(new THREE.SphereGeometry(60, 24, 12), bgMat);
    this.world.add(this._bgMesh);
    this.world.add(new THREE.HemisphereLight(0x30343f, 0x0a0a0c, 0.5));

    // bubbles
    this._sphereGeo = new THREE.SphereGeometry(1, 96, 64);
    this.filmMat = this.filmShader();
    this.bubble1 = new THREE.Mesh(this._sphereGeo, this.filmMat);
    this.bubble1.renderOrder = 10;
    this.world.add(this.bubble1);

    this.film2Mat = this.filmShader();
    this.bubble2 = new THREE.Mesh(this._sphereGeo.clone(), this.film2Mat);
    this.bubble2.renderOrder = 10;
    this.world.add(this.bubble2);

    // pop droplets: 600 GPU points bursting outward at pop time — closed form ballistics
    const ND = 600;
    const dg = new THREE.BufferGeometry();
    const dp = new Float32Array(ND * 3);
    const ds = new Float32Array(ND * 3);
    for (let i = 0; i < ND; i++) {
      // directions distributed over the sphere surface
      const u = seed(i, 51) * 2 - 1;
      const th = seed(i, 52) * Math.PI * 2;
      const rr = Math.sqrt(1 - u * u);
      dp[i * 3] = rr * Math.cos(th);
      dp[i * 3 + 1] = u;
      dp[i * 3 + 2] = rr * Math.sin(th);
      ds[i * 3] = seed(i, 53);
      ds[i * 3 + 1] = seed(i, 54);
      ds[i * 3 + 2] = seed(i, 55);
    }
    dg.setAttribute('position', new THREE.BufferAttribute(dp, 3));
    dg.setAttribute('aSeed', new THREE.BufferAttribute(ds, 3));
    this._dropGeo = dg;
    this.dropMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uPopT: { value: POP_T }, uCenter: { value: new THREE.Vector3() } },
      vertexShader: `
        attribute vec3 aSeed;
        varying float vA;
        uniform float uTime;
        uniform float uPopT;
        uniform vec3 uCenter;
        void main(){
          float dt = uTime - uPopT;
          float alive = step(0.0, dt) * (1.0 - smoothstep(1.2, 2.2, dt));
          // burst: initial radial velocity + slight gravity, closed form
          float v0 = 1.6 + aSeed.x * 2.4;
          vec3 p = uCenter + position * (0.9 + dt * v0);
          p.y -= dt * dt * 0.9;
          vA = alive * (1.0 - smoothstep(0.6, 1.8, dt)) * 0.7;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = (0.5 + aSeed.y * 1.2) * (120.0 / max(1.0, -mv.z)) * max(0.0, alive);
        }`,
      fragmentShader: `
        varying float vA;
        void main(){
          vec2 uv = gl_PointCoord - 0.5;
          float d = length(uv) * 2.0;
          float disc = 1.0 - smoothstep(0.2, 1.0, d);
          float alpha = disc * vA;
          if (alpha < 0.01) discard;
          gl_FragColor = vec4(vec3(0.7, 0.85, 1.0) * alpha, alpha);
        }`,
    });
    const drops = new THREE.Points(dg, this.dropMat);
    drops.frustumCulled = false;
    drops.renderOrder = 1; // before the bubble — never culled by its depth
    this.world.add(drops);
  }

  override render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const rr = this.ctx.renderer;
    const lt = f.t;

    // camera first — uniforms depend on it and every frame must be order-independent
    const k0 = smoothstep(0, 30, lt);
    const az0 = 0.3 + lt * 0.05;
    const b1x0 = Math.sin(lt * 0.23) * 0.3;
    const b1y0 = 0.3 + Math.sin(lt * 0.31 + 1.0) * 0.15 + lt * 0.008;
    const b1z0 = Math.cos(lt * 0.19) * 0.2;
    const b2grow0 = smoothstep(BLOW_T0, BLOW_T1, lt);
    const b2t0 = Math.max(0, lt - BLOW_T0);
    // focus stays on bubble1 through the pop, then blends to bubble2 as it grows
    const focusBlend = smoothstep(BLOW_T0, BLOW_T1 + 1, lt);
    const fx0 = b1x0 * (1 - focusBlend) + (0.4 - b2t0 * 0.05) * focusBlend;
    const fy0 = b1y0 * (1 - focusBlend) + (-0.4 + b2t0 * 0.13) * focusBlend;
    const fz0 = b1z0 * (1 - focusBlend) + 0.3 * focusBlend;
    const popWide = smoothstep(POP_T - 2, POP_T + 2, lt) * (1.0 - smoothstep(POP_T + 4, POP_T + 8, lt));
    const rad0 = 3.1 + popWide * 0.7 - k0 * 0.3;
    this.cam.position.set(fx0 + Math.sin(az0) * rad0, fy0 + 0.25 + Math.sin(lt * 0.1) * 0.1, fz0 + Math.cos(az0) * rad0);
    this.cam.up.set(0, 1, 0);
    this.cam.lookAt(fx0, fy0, fz0);

    // ---- bubble 1: floats gently, drains, pops at POP_T -------------------
    const b1x = Math.sin(lt * 0.23) * 0.3;
    const b1y = 0.3 + Math.sin(lt * 0.31 + 1.0) * 0.15 + lt * 0.008;
    const b1z = Math.cos(lt * 0.19) * 0.2;
    const popped = smoothstep(POP_T, POP_T + 0.45, lt);
    this.bubble1!.position.set(b1x, b1y, b1z);
    const birth1 = smoothstep(0, 1.2, lt);
    this.filmMat!.uniforms.uTime.value = lt;
    this.filmMat!.uniforms.uBirth.value = birth1;
    this.filmMat!.uniforms.uPop.value = popped;
    // drainage accelerates after 12s per the storyboard beat
    const drainT = Math.min(lt, POP_T);
    const effDrain = drainT + Math.max(0, drainT - 12) * Math.max(0, drainT - 12) * 0.12;
    this.filmMat!.uniforms.uDrain.value = effDrain;
    this.filmMat!.uniforms.uCamPos.value.copy(this.cam.position);

    // ---- bubble 2: blown after the pop — scales in, smaller, rises ---------
    const b2grow = smoothstep(BLOW_T0, BLOW_T1, lt);
    const b2t = Math.max(0, lt - BLOW_T0);
    const b2x = 0.4 - b2t * 0.05;
    const b2y = -0.4 + b2t * 0.13;
    const b2z = 0.3;
    this.bubble2!.position.set(b2x, b2y, b2z);
    this.bubble2!.scale.setScalar(0.65);
    this.film2Mat!.uniforms.uTime.value = lt;
    this.film2Mat!.uniforms.uBirth.value = b2grow;
    this.film2Mat!.uniforms.uPop.value = 0;
    this.film2Mat!.uniforms.uDrain.value = b2t * 0.6;
    this.film2Mat!.uniforms.uCamPos.value.copy(this.cam.position);

    // droplets uniform
    this.dropMat!.uniforms.uTime.value = lt;
    this.dropMat!.uniforms.uCenter.value.set(b1x, b1y, b1z);

    const fwd = this.cam.getWorldDirection(new THREE.Vector3());
    // focus on the FILM SURFACE, not the center — subtract the bubble radius along the view axis
    const birthScale = birth1 * (1 - focusBlend) + b2grow * focusBlend;
    const popExpand = (1 - focusBlend) * (1.0 + smoothstep(POP_T, POP_T + 0.45, lt) * 0.4) + focusBlend;
    const focusR = ((1 - focusBlend) * 1.0 + focusBlend * 0.65) * birthScale * popExpand;
    const focusD = new THREE.Vector3(fx0, fy0, fz0).sub(this.cam.position).dot(fwd) - focusR;

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
      focusDistance: Math.max(0.3, focusD),
      aperture: 7,
      maxRadius: 10,
      samples: 36,
      near: 0.02,
      far: 100,
    }, out);
    rr.resetState();
    return { exposure: 1.1, bloom: 0.5, vignette: 0.5 } as PostOverrides;
  }

  override dispose() {
    this._bgMesh?.geometry.dispose();
    (this._bgMesh?.material as THREE.Material | undefined)?.dispose();
    this._sphereGeo?.dispose();
    this.bubble2?.geometry.dispose();
    this.filmMat?.dispose();
    this.film2Mat?.dispose();
    this.dropMat?.dispose();
    this._dropGeo?.dispose();
    this.main?.dispose();
    this.dof.dispose?.();
  }
}
