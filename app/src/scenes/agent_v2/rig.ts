// Shared dragon rig: loads the Blender dragon once per scene with a named look, plus a jaw hinge and a reveal front
// (blocky shard-tile dissolve along the body, glowing at the edge) so it can be forged, folded and restyled.
import * as THREE from 'three';
import type { SceneCtx } from '../../engine/scene';
import { Dragon, deform, scaleFrag } from './dragon';

export const LEN = 10.6;
export interface DragonLook { scale: number; iri: number; metal: number; rough: number; horn: number; mane: number; maneSheen: number; fin: number; finGlow: number; seam: number; eye: [number, number, number] }
export const OBSIDIAN: DragonLook = { scale: 0x20262c, iri: 0.6, metal: 0.35, rough: 0.4, horn: 0x3a3028, mane: 0x1c0a08, maneSheen: 0xff6a30, fin: 0x6a0e06, finGlow: 0x3a0800, seam: 0.8, eye: [9, 5, 0.8] };

function eyeFrag(e: [number, number, number]) {
  return (s: THREE.WebGLProgramParametersWithUniforms) => { s.fragmentShader = s.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
    { float d = abs(vLoc.x - 9.86); float r = length((vLoc - vec3(9.86, 0.14, sign(vLoc.z) * 0.25)) * vec3(1.0, 1.8, 1.0)) / 0.075;
      vec3 c = mix(vec3(${e.map((x) => x.toFixed(2)).join(',')}), vec3(3.0, 0.5, 0.05), smoothstep(0.1, 1.0, r));
      diffuseColor.rgb = c * smoothstep(0.004, 0.009, d); }`); };
}

/** visible where body x > LEN * (1 - uReveal) - tile jitter; glowing seam right at the front */
function revealFrag(rv: { value: number }, glow: { value: number }) {
  return (s: THREE.WebGLProgramParametersWithUniforms) => {
    s.uniforms.uReveal = rv; s.uniforms.uRevGlow = glow;
    const edge = `float rvH_ = fract(sin(dot(floor(vLoc * vec3(3.0, 7.0, 7.0)), vec3(12.9898, 78.233, 37.719))) * 43758.5453);
      float rvD_ = vLoc.x - (${LEN.toFixed(2)} + 0.8) * (1.0 - uReveal) + 0.8 * rvH_;`;
    s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uReveal, uRevGlow;')
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>\n { ${edge} if (rvD_ < 0.0) discard; }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n { ${edge} totalEmissiveRadiance += vec3(1.0, 0.45, 0.12) * 6.0 * uRevGlow * smoothstep(0.5, 0.0, rvD_); }`);
  };
}


export interface PaperU { paper: { value: number }; facet: { value: number }; fold: { value: number }; ink: { value: number }; tint: { value: THREE.Color } }
/** paper: washi material sweeping head->tail; facet: flat-shaded folds; fold: vertices snap to a coarse lattice (origami); ink: sumi creases */
function paperHook(P: PaperU) {
  return (s: THREE.WebGLProgramParametersWithUniforms) => {
    s.uniforms.uPaper = P.paper; s.uniforms.uFacet = P.facet; s.uniforms.uFold = P.fold; s.uniforms.uInk = P.ink; s.uniforms.uPTint = P.tint;
    const front = (u: string) => `clamp(${u} * 14.0 - (${LEN.toFixed(2)} + 1.0 - vLoc.x) * 1.1, 0.0, 1.0)`;
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nuniform float uFold;')
      .replace('vec3 P0 = position, N0 = normal;', `vec3 P0 = position, N0 = normal; { float fk_ = clamp(uFold * 14.0 - (${LEN.toFixed(2)} + 1.0 - position.x) * 1.1, 0.0, 1.0);
        float r_ = length(P0.yz), a_ = atan(P0.z, P0.y), n_ = 4.0, ac_ = (floor(a_ / 6.2832 * n_) + 0.5) * 6.2832 / n_;
        float tw_ = abs(fract(P0.x / 0.38) - 0.5) * 2.0; float rp_ = r_ * cos(3.1416 / n_) / max(cos(a_ - ac_), 0.5) * (0.7 + 0.6 * tw_);
        vec2 yz_ = vec2(cos(a_), sin(a_)) * rp_; P0.yz = mix(P0.yz, yz_, fk_ * (1.0 - smoothstep(0.32, 0.5, r_))); }`);
    s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uPaper, uFacet, uInk; uniform vec3 uPTint;\nfloat ph_(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }')
      .replace('#include <color_fragment>', `#include <color_fragment>
      { float pp_ = ${front('uPaper')}, ik_ = ${front('uInk')};
        float fib_ = ph_(floor(vLoc * vec3(400.0, 900.0, 900.0))) * 0.025 + 0.03 * sin(vLoc.x * 37.0 + vLoc.y * 90.0) * sin(vLoc.z * 70.0);
        vec3 pc_ = uPTint * (1.0 - fib_ * 1.5);
        float back_ = smoothstep(0.02, 0.3, vLoc.y + 0.08 * sin(vLoc.x * 5.0));
        float brush_ = smoothstep(0.35, 0.75, ph_(floor(vLoc * vec3(3.0, 1.0, 1.0)) + 3.0) * 0.5 + 0.5 * sin(vLoc.x * 2.3 + vLoc.z * 9.0));
        pc_ = mix(pc_, vec3(0.08, 0.07, 0.07), ik_ * back_ * (0.55 + 0.45 * brush_));
        diffuseColor.rgb = mix(diffuseColor.rgb, pc_, pp_); }`);
    if (s.fragmentShader.includes('#include <lights_physical_fragment>')) s.fragmentShader = s.fragmentShader
      .replace('#include <lights_physical_fragment>', `
      { vec3 fn_ = normalize(cross(dFdx(vViewPosition), dFdy(vViewPosition))); normal = normalize(mix(normal, fn_, max(${front('uFacet')}, ${front('uPaper')})));
        float ed_ = length(fwidth(fn_)); diffuseColor.rgb *= 1.0 - ${front('uInk')} * smoothstep(0.25, 0.9, ed_) * 0.85; }
#include <lights_physical_fragment>`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>\n roughnessFactor = mix(roughnessFactor, 0.85, ${front('uPaper')});`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>\n metalnessFactor = mix(metalnessFactor, 0.0, ${front('uPaper')});`)
      .replace('#include <lights_fragment_begin>', `{ float pq_ = ${front('uPaper')}; totalEmissiveRadiance *= 1.0 - pq_;
        #ifdef USE_IRIDESCENCE
        material.iridescence *= 1.0 - pq_;
        #endif
        #ifdef USE_CLEARCOAT
        material.clearcoat *= 1.0 - pq_;
        #endif
        #ifdef USE_SHEEN
        material.sheenColor *= 1.0 - pq_;
        #endif
      }\n#include <lights_fragment_begin>`);
  };
}

export class DragonRig {
  readonly dragon = new Dragon();
  readonly jaw = { value: 0 };
  readonly reveal = { value: 1 };
  readonly revGlow = { value: 1 };
  readonly paperU: PaperU = { paper: { value: 0 }, facet: { value: 0 }, fold: { value: 0 }, ink: { value: 0 }, tint: { value: new THREE.Color(0.93, 0.89, 0.80) } };
  async load(ctx: SceneCtx, L: DragonLook = OBSIDIAN) {
    const fr = this.dragon.frames, sc = this.dragon.scale, rv = revealFrag(this.reveal, this.revGlow), ph = paperHook(this.paperU);
    const both = (a?: (s: THREE.WebGLProgramParametersWithUniforms) => void) => (s: THREE.WebGLProgramParametersWithUniforms) => { a?.(s); rv(s); ph(s); };
    await this.dragon.load(ctx, (name, mesh) => {
      const j = mesh.startsWith('jaw') ? this.jaw : undefined;
      if (name === 'Scale') return deform(new THREE.MeshPhysicalMaterial({ color: L.scale, metalness: L.metal, roughness: L.rough, envMapIntensity: 0.4, iridescence: L.iri, iridescenceIOR: 1.8, iridescenceThicknessRange: [300, 900], clearcoat: 0.6, clearcoatRoughness: 0.22 }), fr, sc, both(scaleFrag), j);
      if (name === 'Tooth') return deform(new THREE.MeshPhysicalMaterial({ color: 0xe8dcc4, roughness: 0.25, clearcoat: 0.6 }), fr, sc, both(), j);
      if (name === 'Eye') return deform(new THREE.MeshBasicMaterial({ color: 0xffffff }), fr, sc, both(eyeFrag(L.eye)));
      if (name === 'Mouth') return deform(new THREE.MeshStandardMaterial({ color: 0x3a0606, roughness: 0.45, emissive: 0x200000 }), fr, sc, both(), j);
      if (name === 'Mane') return deform(new THREE.MeshPhysicalMaterial({ color: L.mane, roughness: 0.5, sheen: 1, sheenColor: new THREE.Color(L.maneSheen), sheenRoughness: 0.4 }), fr, sc, both());
      if (name === 'Fin') return deform(new THREE.MeshPhysicalMaterial({ color: L.fin, roughness: 0.5, side: THREE.DoubleSide, emissive: L.finGlow, transparent: true, opacity: 0.8, sheen: 0.6, sheenColor: new THREE.Color(0xff5020) }), fr, sc, both());
      return deform(new THREE.MeshPhysicalMaterial({ color: L.horn, roughness: 0.32, clearcoat: 0.8, clearcoatRoughness: 0.2 }), fr, sc, both(), j);
    });
    return this.dragon.group;
  }
  dispose() { this.dragon.dispose(); }
}
