// ff_nucleus: atom -> quark. On the shared dive camera the nucleon at the centre goes white-hot and opens at the zoom
// rate; A keeps its own descent with a re-rendered echo of itself 0.15 s earlier (the speed trail), and the proton's
// interior blooms through the core at matched scale.
import { ffTransition, TG } from '../scenes/freefall/tkit';
export default ffTransition(`${TG}
void main() { vec2 p = P(); float r = length(p); float e = smoothstep(0.0, 1.0, u); float z = diveZ(e); float R = 0.035 * z;
  vec3 A = radialA(p, 1.0 + 0.6 * e, 0.3 * e); vec3 E = texture2D(texE, toUv(p / (1.0 + 0.4 * e))).rgb; A = max(A, E * 0.6 * (1.0 - u));
  vec3 B = tapB(p, diveS(R)); float m = max(smoothstep(R, R * 0.8, r), smoothstep(0.85, 1.0, u));
  float core = exp(-pow((r - R) / (0.01 + 0.06 * R), 2.0)) * (1.0 - e) + exp(-r * r / (0.001 + 0.02 * R)) * sin(3.14159 * u);
  vec3 c = mix(A, B, m) + vec3(1.4, 1.0, 1.2) * core * 0.6; gl_FragColor = vec4(c, 1.0); }`, { dur: 0.8, extra: { texE: (api, t0, t) => api.sampleScene(api.from, t - 0.15) } });
