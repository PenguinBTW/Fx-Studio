// ff_nucleus: atom -> quark. The nucleon in the centre goes white-hot and swallows the frame; A smears outward with a
// re-rendered echo of itself 0.15 s earlier (the speed trail), and the proton's interior blooms through the core.
import { ffTransition, TG } from '../scenes/freefall/tkit';
export default ffTransition(`${TG}
void main() { vec2 p = P(); float r = length(p); vec3 A = radialA(p, exp(u * 2.0), 0.35 * u); vec3 E = texture2D(texE, toUv(p / exp(u * 1.2))).rgb;
  A = max(A, E * 0.6 * (1.0 - u)); vec3 B = tapB(p, mix(0.8, 1.0, u)); float R = u * 1.5; float m = smoothstep(R, R - 0.3, r);
  float core = exp(-r * r / (0.02 + 0.3 * u)) * sin(3.14159 * u); vec3 c = mix(A, B, m) + vec3(1.4, 1.0, 1.2) * core * 0.5; gl_FragColor = vec4(c, 1.0); }`, { dur: 0.8, extra: { texE: (api, t0, t) => api.sampleScene(api.from, t - 0.15) } });
