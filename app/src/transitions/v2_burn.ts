// v2_burn: agent_v2 seam (see scenes/agent_v2/tkit2.ts)
import { v2Transition } from '../scenes/agent_v2/tkit2';

const FRAG = `
void main(){ float n=tfbm(vUv*vec2(uAsp,1.0)*3.0+uT*0.3); float t=u*1.3-0.15; float m=smoothstep(t-0.02,t+0.02,n); vec3 A=texture2D(texA,vUv).rgb,B=texture2D(texB,vUv).rgb; float e=exp(-abs(n-t)*40.0)*sin(3.14159*u);
gl_FragColor=vec4(mix(B,A,m)+vec3(1.6,0.6,0.15)*e*1.5,1.0);}`;

export default v2Transition(FRAG, { dur: 0.6 });
