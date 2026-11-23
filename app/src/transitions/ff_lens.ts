// ff_lens: raindrop -> plankton. We dive into the drop: a single exponential camera zoom drives both sides, the drop
// at frame centre swelling at the same rate as A rushes past, with the plankton world refracted inside it (per-channel
// IOR) at matched scale, until the lens fills the frame and relaxes to B undistorted.
import { ffTransition, TG } from '../scenes/freefall/tkit';
export default ffTransition(`${TG}
void main() { vec2 p = P(); float e = smoothstep(0.0, 1.0, u); float z = diveZ(e); float R = 0.035 * z; float r = length(p) / R;
  vec3 A = radialA(p, z, 0.12 * e) * (1.0 - 0.6 * e); vec3 B = vec3(0.0); float s = diveS(R);
  if (r < 1.0) { float k = sqrt(1.0 - r * r); for (int c = 0; c < 3; c++) { float ior = 0.6 + 0.1 * float(c); vec2 q = p * mix(ior * (0.6 + 0.4 * k), 1.0, e * e); B[c] = tapB(q, s)[c]; } }
  float m = smoothstep(1.0, 0.97, r); float rim = exp(-pow((r - 0.985) * 40.0, 2.0)); vec3 rb = 0.5 + 0.5 * cos(6.2831 * (atan(p.y, p.x) / 6.2831 * 2.0 + vec3(0.0, 0.33, 0.67)));
  vec3 c = mix(A, B, m) + rb * rim * 0.8 * (1.0 - e); gl_FragColor = vec4(c, 1.0); }`, { dur: 0.8 });
