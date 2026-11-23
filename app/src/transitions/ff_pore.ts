// ff_pore: radiolarian -> salt crystal. We slam through one hexagonal pore: a hex aperture opens from the centre with a
// Rheinberg magenta/gold glowing rim, the skeleton zooming past the lens while the crystal face waits inside.
import { ffTransition, TG } from '../scenes/freefall/tkit';
export default ffTransition(`${TG}
float hexD(vec2 p) { p = abs(p); return max(dot(p, normalize(vec2(1.0, 1.732))), p.x); }
void main() { vec2 p = P(); float e = u * u; float R = mix(0.04, 1.6, e); float h = hexD(p) / R; vec3 A = radialA(p, exp(e * 2.5), 0.2 * u);
  vec3 B = tapB(p, mix(0.5, 1.0, e)); float m = smoothstep(1.0, 0.96, h); float rim = exp(-pow((h - 1.0) * 14.0, 2.0));
  vec3 c = mix(A, B, m) + mix(vec3(1.0, 0.7, 0.15), vec3(1.0, 0.1, 0.7), smoothstep(0.0, 1.0, length(p))) * rim * 1.2; gl_FragColor = vec4(c, 1.0); }`, { dur: 0.8 });
