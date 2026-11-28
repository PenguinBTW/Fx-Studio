// v2_shatter: world -> crumble seam. agent_v2 seam (see scenes/agent_v2/tkit2.ts)
import { v2Transition } from '../scenes/agent_v2/tkit2';

// S2 opens on the same intact planet and does the real crack on bar 10, so this seam must not fracture anything:
// a short heat dissolve, brightest mid-seam, from the frozen world into the crumble scene
const FRAG = `
void main(){ vec3 A=texture2D(texA,vUv).rgb, B=texture2D(texB,vUv).rgb; float k=smoothstep(0.1,0.9,u);
float l=dot(B,vec3(0.3,0.59,0.11)); vec3 col=mix(A,B,k)+vec3(1.0,0.45,0.15)*smoothstep(0.08,0.4,l)*sin(3.14159*k)*0.12;
gl_FragColor=vec4(col,1.0);}`;

export default v2Transition(FRAG, { freezeA: true, dur: 0.6 });
