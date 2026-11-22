// v2_splash: agent_v2 seam (see scenes/agent_v2/tkit2.ts)
import { v2Transition } from '../scenes/agent_v2/tkit2';

const FRAG = `
void main(){ vec2 p=(vUv-0.5)*vec2(uAsp,1.0); float r=length(p); float R=u*1.3; float s=sin(3.14159*u); float w=sin((r-R)*40.0)*exp(-abs(r-R)*8.0)*0.02*s; vec2 q=vUv+normalize(p+1e-4)/vec2(uAsp,1.0)*w;
vec3 A=texture2D(texA,q).rgb,B=texture2D(texB,q).rgb; float m=smoothstep(R,R-0.05,r); gl_FragColor=vec4(mix(A,B,m)+vec3(0.2,0.9,1.0)*exp(-abs(r-R)*60.0)*0.6*s,1.0);}`;

export default v2Transition(FRAG, { dur: 0.6 });
