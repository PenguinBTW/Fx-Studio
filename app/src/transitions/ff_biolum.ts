// ff_biolum: plankton -> radiolarian. Every cell fires at once (cyan bloom on A's highlights) while the shared dive
// camera pushes into the organism at the centre: its glowing, ciliated membrane swells at the zoom rate with the
// skeleton waiting inside at matched scale.
import { ffTransition, TG } from '../scenes/freefall/tkit';
export default ffTransition(`${TG}
void main() { vec2 p = P(); float e = smoothstep(0.0, 1.0, u); float z = diveZ(e); float R = 0.035 * z; vec3 A = tapA(p, 1.0 + 0.4 * e);
  float la = dot(A, vec3(0.3, 0.6, 0.1)); A += vec3(0.2, 0.9, 1.3) * smoothstep(0.2, 0.9, la) * 1.4 * sin(3.14159 * min(1.0, u * 1.4));
  float r = length(p) / R, ang = atan(p.y, p.x); float wob = 0.06 * sin(ang * 9.0 + uT * 3.0); float m = max(smoothstep(1.0 + wob, 0.88 + wob, r), smoothstep(0.85, 1.0, u));
  vec3 B = tapB(p, diveS(R)); float rim = exp(-pow((r - 1.0 - wob) * 12.0, 2.0)) * (1.0 - e * e);
  float cil = pow(abs(sin(ang * 40.0 + uT * 4.0)), 20.0) * smoothstep(1.35, 1.02, r) * smoothstep(0.98, 1.05, r) * (1.0 - e);
  vec3 c = mix(A, B, m) + vec3(0.2, 0.9, 1.3) * (rim * 0.9 + cil * 0.5); gl_FragColor = vec4(c, 1.0); }`, { dur: 0.8 });
