// Ground surface detail for large procedural terrain: world-space fbm grain and fine bump, so wide shots read as
// textured land (soil, grass, paper fibre) instead of smooth vertex-colour gradients.
import * as THREE from 'three';

const NOISE = /* glsl */ `varying vec3 vGW;
float gh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float gn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(gh(i), gh(i+vec2(1,0)), f.x), mix(gh(i+vec2(0,1)), gh(i+vec2(1,1)), f.x), f.y); }
float gfbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ s += a * gn(p); p = p * 2.03 + 7.1; a *= 0.5; } return s; }`;

export function groundDetail(m: THREE.MeshStandardMaterial, scale = 1, amt = 0.45, bump = 0.8) {
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vGW;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvGW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + NOISE)
      .replace('#include <color_fragment>', `#include <color_fragment>
      { vec2 q = vGW.xz * ${scale.toFixed(3)}; float big = gfbm(q * 0.35), fine = gfbm(q * 3.0 + 3.0), speck = step(0.93, gh(floor(q * 14.0)));
        float streak = gn(vec2(q.x * 9.0, q.y * 1.5)); 
        diffuseColor.rgb *= mix(1.0, 0.62 + 0.75 * big, ${amt.toFixed(3)}) * (0.86 + 0.28 * fine) * (0.92 + 0.16 * streak) * (1.0 - 0.18 * speck); }`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      { float hb = gfbm(vGW.xz * ${(scale * 4).toFixed(3)});
        vec3 dpx = dFdx(-vViewPosition), dpy = dFdy(-vViewPosition); float dhx = dFdx(hb), dhy = dFdy(hb);
        vec3 r1 = cross(dpy, normal), r2 = cross(normal, dpx); float det = dot(dpx, r1);
        normal = normalize(abs(det) * normal - ${bump.toFixed(3)} * sign(det) * (dhx * r1 + dhy * r2)); }`);
  };
  m.customProgramCacheKey = () => 'groundDetail' + scale + amt + bump;
  return m;
}
