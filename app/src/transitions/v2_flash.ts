// v2_flash: agent_v2 seam (see scenes/agent_v2/tkit2.ts)
import { v2Transition } from '../scenes/agent_v2/tkit2';

const FRAG = `
void main(){ float s=exp(-pow((u-0.5)*7.0,2.0)); vec2 p=vUv-0.5; vec3 A=texture2D(texA,0.5+p*(1.0-0.1*u)).rgb,B=texture2D(texB,0.5+p*(1.0+0.15*(1.0-u))).rgb; vec3 c=u<0.5?A:B; c=mix(c,vec3(1.0,0.97,0.92),s); gl_FragColor=vec4(c,1.0);}`;

export default v2Transition(FRAG, { dur: 0.45 });
