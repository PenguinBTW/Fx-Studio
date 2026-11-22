// v2_mosaic: agent_v2 seam (see scenes/agent_v2/tkit2.ts)
import { v2Transition } from '../scenes/agent_v2/tkit2';

const FRAG = `
void main(){ float s=u<0.5?u*2.0:(1.0-u)*2.0; float cells=mix(1080.0,9.0,pow(s,0.6)); vec2 q=(floor(vUv*vec2(uAsp,1.0)*cells)+0.5)/cells/vec2(uAsp,1.0);
gl_FragColor=vec4(u<0.5?texture2D(texA,q).rgb:texture2D(texB,q).rgb,1.0);}`;

export default v2Transition(FRAG, { dur: 0.7 });
