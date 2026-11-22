// v2_glitch: agent_v2 seam (see scenes/agent_v2/tkit2.ts)
import { v2Transition } from '../scenes/agent_v2/tkit2';

const FRAG = `
void main(){ float row=floor(vUv.y*28.0); float r=th(vec2(row,floor(u*12.0))); float s=sin(3.14159*u); vec2 q=vUv+vec2((r-0.5)*0.25*s,0.0); float ca=0.012*s; vec3 c;
if(step(r*0.8+0.1,u)>0.5) c=vec3(texture2D(texB,q+vec2(ca,0.0)).r,texture2D(texB,q).g,texture2D(texB,q-vec2(ca,0.0)).b); else c=vec3(texture2D(texA,q+vec2(ca,0.0)).r,texture2D(texA,q).g,texture2D(texA,q-vec2(ca,0.0)).b);
gl_FragColor=vec4(c,1.0);}`;

export default v2Transition(FRAG, { dur: 0.45 });
