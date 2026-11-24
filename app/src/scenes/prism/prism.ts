// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
// prism — a suspended glass prism in a near-black room. A bone-white beam
// strikes it and disperses into a spectral fan on the back wall: real Cauchy
// glass dispersion, n(λ) = A + B/λ², inverted per pixel so each wall point's
// exit deviation selects its wavelength (violet bends most). Over the take
// the prism yaws slowly, sweeping the fan across the wall; at the beat the
// spread collapses and the bands momentarily recombine into a white sliver.
import * as THREE from 'three';
import { Scene, type Frame, type SceneCtx, type PostOverrides } from '../../engine/scene';
import { GLSL_SPECTRUM } from '../../engine/glsl/spectrum';

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

// --- tuneables ---------------------------------------------------------------
const APEX = Math.PI / 3; // 60° prism apex
const N_A = 1.504; // crown-ish Cauchy A (visible band, not water)
const N_B_UM2 = 0.0042; // Cauchy B in µm² → n ≈ 1.515 @ 700nm, 1.532 @ 400nm
const LAM_REF_NM = 550;
const PRISM_POS = new THREE.Vector3(0, 1.15, 0);
const BEAM_SRC = new THREE.Vector3(-6.4, 2.2, 2.6);
const AXIS0 = new THREE.Vector3(0.42, -0.30, -0.86).normalize(); // exit fan aim
const WALL_Z = -2.2;

const REF_DEV = 2 * Math.asin((N_A + N_B_UM2 / (LAM_REF_NM / 1000) ** 2) * Math.sin(APEX / 2)) - APEX;

// beam ramp: light switches on, spreads, dips to white at the beat, recovers
const spreadAt = (t: number) => (1 - 0.92 * Math.exp(-(((t - 12) / 0.75) ** 2))) * smooth(0.4, 1.8, t);
const beamIAt = (t: number) => smooth(0, 0.9, t) * (1 - 0.25 * smooth(18.6, 20, t));
const yawAt = (t: number) => -0.55 + 0.028 * t; // slow sweep; fan walks toward the prism without hiding behind it

// --- shaders -----------------------------------------------------------------
const PRISM_VERT = `out vec3 vN; out vec3 vW;
void main(){ vN = normalize(mat3(modelMatrix) * normal); vW = (modelMatrix * vec4(position,1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;

const PRISM_FRAG = `${GLSL_SPECTRUM}
uniform vec3 uGlow; uniform float uGlowI;
in vec3 vN; in vec3 vW; out vec4 fragColor;
void main(){
  vec3 view = normalize(cameraPosition - vW);
  float fres = pow(1.0 - abs(dot(view, normalize(vN))), 2.8);
  float glow = exp(-distance(vW, uGlow) * 5.0) * uGlowI;
  vec3 col = vec3(0.55, 0.60, 0.72) * fres * 0.85
           + vec3(0.95, 0.92, 0.84) * glow * 0.55;
  fragColor = vec4(col, 1.0);
}`;

const BEAM_VERT = `out vec2 vUv;
void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;

const BEAM_FRAG = `precision highp float;
uniform float uI; in vec2 vUv; out vec4 fragColor;
void main(){
  float core = exp(-pow((vUv.y - 0.5) * 6.0, 2.0));
  float body = exp(-pow((vUv.y - 0.5) * 2.2, 2.0)) * 0.35;
  float taper = mix(0.55, 1.0, vUv.x) * smoothstep(0.0, 0.06, vUv.x);
  fragColor = vec4(vec3(0.95, 0.92, 0.84) * (core + body) * taper * uI, 1.0);
}`;

const WALL_VERT = `out vec3 vW; out vec2 vUv;
void main(){ vW = (modelMatrix * vec4(position,1.0)).xyz; vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;

const WALL_FRAG = `${GLSL_SPECTRUM}
uniform vec3 uExit, uAxis, uSide, uUp;
uniform float uSpread, uIntensity, uHw, uDevGain, uDref, uApex, uCauchyA, uCauchyB;
in vec3 vW; in vec2 vUv; out vec4 fragColor;
void main(){
  vec3 toPix = vW - uExit;
  float dist = length(toPix);
  vec3 dir = toPix / dist;
  float fwd = dot(dir, uAxis);
  float lat = atan(dot(dir, uSide), fwd);   // signed dispersion angle
  float vert = atan(dot(dir, uUp), fwd);
  // exit deviation → IOR via min-deviation geometry → wavelength via Cauchy.
  // uDevGain exaggerates the (physically ~1°-wide) chromatic spread so the
  // rainbow reads as a broad soft fan; the deviation→λ inversion stays real.
  float dev = uDref + lat * uDevGain * uSpread;
  float nPix = sin((dev + uApex) * 0.5) / sin(uApex * 0.5);
  float lamNm = sqrt(uCauchyB / max(nPix - uCauchyA, 1e-4)) * 1000.0;
  vec3 spec = spectralColour(clamp(lamNm, 360.0, 830.0));
  spec = mix(vec3(0.92, 0.90, 0.84), spec, clamp(uSpread, 0.0, 1.0)); // recombine → white
  float hw = uHw * mix(0.15, 1.0, uSpread);
  float band = (1.0 - smoothstep(hw * 0.72, hw, abs(lat)))
             * exp(-vert * vert * 60.0)
             * smoothstep(0.02, 0.14, fwd)
             / (1.0 + dist * dist * 0.06); // wall distance falloff
  vec3 col = vec3(0.0028, 0.0028, 0.0034) + spec * band * uIntensity;
  fragColor = vec4(col, 1.0);
}`;

export default class PrismScene extends Scene {
  private three = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(42, 16 / 9, 0.1, 100);
  private prism = new THREE.Group();
  private fanU: Record<string, THREE.IUniform>;
  private beamU: Record<string, THREE.IUniform>;
  private prismU: Record<string, THREE.IUniform>;
  private entry = new THREE.Vector3();

  constructor(ctx: SceneCtx) {
    super(ctx);

    // room: dark floor + back wall (floor unlit — the fan lives on the wall)
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 30),
      new THREE.MeshStandardMaterial({ color: 0x0a0a0c, roughness: 0.95 }),
    );
    floor.rotation.x = -Math.PI / 2;
    this.three.add(floor);

    this.fanU = {
      uExit: { value: new THREE.Vector3() }, uAxis: { value: new THREE.Vector3() },
      uSide: { value: new THREE.Vector3() }, uUp: { value: new THREE.Vector3() },
      uSpread: { value: 0 }, uIntensity: { value: 0 }, uHw: { value: 0.2 }, uDevGain: { value: 0.12 },
      uDref: { value: REF_DEV }, uApex: { value: APEX },
      uCauchyA: { value: N_A }, uCauchyB: { value: N_B_UM2 },
    };
    const wall = new THREE.Mesh(
      new THREE.PlaneGeometry(22, 7),
      new THREE.ShaderMaterial({ uniforms: this.fanU, vertexShader: WALL_VERT, fragmentShader: WALL_FRAG, glslVersion: THREE.GLSL3 }),
    );
    wall.position.set(0, 2.2, WALL_Z);
    this.three.add(wall);

    const backWall = new THREE.Mesh(
      new THREE.PlaneGeometry(22, 7),
      new THREE.MeshStandardMaterial({ color: 0x08080b, roughness: 0.98 }),
    );
    backWall.position.set(0, 2.2, WALL_Z - 0.01);
    this.three.add(backWall);

    // suspended prism: equilateral triangle extruded along Z, vertex up
    const s = 0.46, shape = new THREE.Shape();
    for (let i = 0; i < 3; i++) {
      const a = Math.PI / 2 + (i * 2 * Math.PI) / 3;
      const x = s * Math.cos(a), y = s * Math.sin(a) * Math.sin(APEX / 2) * 2 / Math.sqrt(3) * 1.7;
      i === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y);
    }
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.85, bevelEnabled: false });
    geo.center();
    this.prismU = { uGlow: { value: new THREE.Vector3() }, uGlowI: { value: 0 } };
    this.prism.add(new THREE.Mesh(geo, new THREE.ShaderMaterial({
      uniforms: this.prismU, vertexShader: PRISM_VERT, fragmentShader: PRISM_FRAG,
      glslVersion: THREE.GLSL3, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    })));
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(geo, 20),
      new THREE.LineBasicMaterial({ color: 0x9aa3b0, transparent: true, opacity: 0.35 }),
    );
    this.prism.add(edges);
    this.prism.position.copy(PRISM_POS);
    this.three.add(this.prism);

    // suspension wire into the dark
    const topY = s * 1.7 * 0.58;
    const wire = new THREE.Mesh(
      new THREE.CylinderGeometry(0.004, 0.004, 4, 6),
      new THREE.MeshBasicMaterial({ color: 0x1c1c20 }),
    );
    wire.position.copy(PRISM_POS).add(new THREE.Vector3(0, topY + 2, 0));
    this.three.add(wire);

    // beam: two crossed additive planes along the beam axis
    this.beamU = { uI: { value: 0 } };
    const beamDir = PRISM_POS.clone().sub(BEAM_SRC).normalize();
    const beamLen = PRISM_POS.distanceTo(BEAM_SRC);
    const beamMat = new THREE.ShaderMaterial({
      uniforms: this.beamU, vertexShader: BEAM_VERT, fragmentShader: BEAM_FRAG,
      glslVersion: THREE.GLSL3, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    const beamGroup = new THREE.Group();
    for (const rot of [0, Math.PI / 2]) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(beamLen, 0.10), beamMat);
      p.rotation.x = rot;
      beamGroup.add(p);
    }
    beamGroup.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), beamDir);
    beamGroup.position.copy(BEAM_SRC).addScaledVector(beamDir, beamLen / 2);
    this.three.add(beamGroup);

    // entry point: where the beam meets the prism's left face
    this.entry.copy(PRISM_POS).addScaledVector(beamDir, -s * 0.75);

    this.three.add(new THREE.AmbientLight(0x223, 0.4));
    const key = new THREE.DirectionalLight(0x334, 0.6);
    key.position.set(2, 4, 3);
    this.three.add(key);
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.lt;
    const yaw = yawAt(t);
    this.prism.rotation.y = yaw;

    // fan frame: exit dir yaws with the prism (deviation direction follows it)
    const axis = AXIS0.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw - yawAt(0));
    const side = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), axis).normalize().negate();
    const up = new THREE.Vector3().crossVectors(axis, side).normalize();
    const exit = PRISM_POS.clone().addScaledVector(axis, 0.35);
    const spread = spreadAt(t);

    this.fanU.uExit.value.copy(exit);
    this.fanU.uAxis.value.copy(axis);
    this.fanU.uSide.value.copy(side);
    this.fanU.uUp.value.copy(up);
    this.fanU.uSpread.value = spread;
    this.fanU.uIntensity.value = 2.4 * smooth(0.6, 2.0, t);
    this.beamU.uI.value = beamIAt(t);
    this.prismU.uGlow.value.copy(this.entry);
    this.prismU.uGlowI.value = beamIAt(t);

    const wob = 0.02 * Math.sin(t * 0.4);
    this.cam.position.set(3.2 + 0.06 * Math.sin(t * 0.13), 1.5 + 0.03 * Math.sin(t * 0.09 + 1), 4.8 + wob);
    this.cam.lookAt(-0.2, 0.95, -0.8);

    const r = this.ctx.renderer;
    r.setRenderTarget(out);
    r.clear(true, true, true);
    r.render(this.three, this.cam);
    r.resetState();

    const fade = t < 0.8 ? 1 - t / 0.8 : t > 19.2 ? (t - 19.2) / 0.8 : 0;
    return {
      exposure: 1.05, bloom: 0.9, bloomThreshold: 0.5, bloomRadius: 0.8,
      ca: 0.6, grain: 0.05, vignette: 0.5, fade: clamp01(fade), toneMap: 'agx',
    };
  }
}
