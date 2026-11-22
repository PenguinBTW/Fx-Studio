// v2_ash: agent_v2 seam (see scenes/agent_v2/tkit2.ts)
import { v2Transition } from '../scenes/agent_v2/tkit2';

const FRAG = `
void main(){ vec2 g=vec2(uAsp,1.0)*110.0; vec2 cell=floor(vUv*g); float t0=th(cell)*0.75+(1.0-vUv.y)*0.1; vec3 A=texture2D(texA,vUv).rgb; A=mix(A,vec3(dot(A,vec3(0.3,0.59,0.11))),u);
vec3 B=texture2D(texB,vUv).rgb; float age=u-t0; vec3 c=age<0.0?A:B; if(age>=0.0&&age<0.07) c=mix(vec3(1.4,1.3,1.2),B,age/0.07); gl_FragColor=vec4(c,1.0);}`;

export default v2Transition(FRAG, { freezeA: true, dur: 1.0 });
