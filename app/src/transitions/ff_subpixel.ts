// ff_subpixel: quark -> your screen. The quark's red glow is quantised: RGB channel split in horizontal blocks
// (datamosh), the image snapping to a coarse cell grid, until the LCD subpixel stands there and the counter lands.
import { ffTransition, TG } from '../scenes/freefall/tkit';
export default ffTransition(`${TG}
void main() { vec2 p = P(); float blk = floor(vUv.y * 24.0); float g = step(0.5, ffth(vec2(blk, floor(uT * 20.0)))) * sin(3.14159 * u);
  vec2 off = vec2((ffth(vec2(blk, 3.0)) - 0.5) * 0.12 * g, 0.0); float cells = mix(400.0, 12.0, smoothstep(0.1, 0.7, u));
  vec2 gs = vec2(cells * uAsp, cells); vec2 qv = (floor(vUv * gs) + 0.5) / gs;
  vec3 A = vec3(texture2D(texA, qv + off).r, texture2D(texA, qv).g, texture2D(texA, qv - off).b); vec3 B = texture2D(texB, vUv + off * 0.5).rgb;
  float m = smoothstep(0.35, 0.8, u + 0.3 * (ffth(vec2(blk, 9.0)) - 0.5)); gl_FragColor = vec4(mix(A, B, m), 1.0); }`, { dur: 0.8 });
