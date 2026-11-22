// v2_ink: agent_v2 seam (see scenes/agent_v2/tkit2.ts)
import { v2Transition } from '../scenes/agent_v2/tkit2';

const FRAG = `
void main(){ float n=tfbm(vUv*vec2(uAsp,1.0)*2.5); float a=smoothstep(n-0.1,n+0.1,u*2.0-0.3); float b=smoothstep(n-0.1,n+0.1,(u-0.5)*2.2-0.1);
vec3 c=mix(texture2D(texA,vUv).rgb,vec3(0.0),a); c=mix(c,texture2D(texB,vUv).rgb,b); gl_FragColor=vec4(c,1.0);}`;

export default v2Transition(FRAG, { dur: 0.8 });
