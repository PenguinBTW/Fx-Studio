// ff_bolt: storm -> raindrop. A lightning channel tears down the frame; the drop shot is revealed along it and floods
// outward, with a look-ahead re-render of the drop (0.2 s later) burnt in as the afterimage of the strike.
import { ffTransition, TG } from '../scenes/freefall/tkit';
export default ffTransition(`${TG}
void main() { vec2 p = P(); float x = 0.0, amp = 0.25; for (int o = 0; o < 5; o++) { float f = pow(2.2, float(o)) * 2.5; x += amp * (fftn(vec2(p.y * f, float(o) * 7.0)) - 0.5); amp *= 0.5; }
  float d = abs(p.x - x); float w = u * u * 1.6; float m = smoothstep(w + 0.02, w - 0.02, d); float core = exp(-d * 120.0) * smoothstep(0.0, 0.2, u) * (1.0 - smoothstep(0.6, 1.0, u));
  vec3 A = tapA(p, 1.0 + 0.3 * u); vec3 B = tapB(p, 0.9 + 0.1 * u); vec3 G = texture2D(texG, vUv).rgb;
  vec3 c = mix(A, mix(B, max(B, G * 0.8), 0.4 * (1.0 - u)), m) + vec3(0.8, 0.85, 1.6) * (core * 3.0 + exp(-d * 10.0) * 0.4 * (1.0 - u) * smoothstep(0.0, 0.15, u));
  gl_FragColor = vec4(c, 1.0); }`, { dur: 0.8, extra: { texG: (api, t0, t) => api.sampleScene(api.to, t + 0.2) } });
