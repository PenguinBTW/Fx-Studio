// v2_cursor_bloom: agent_v2 seam (see scenes/agent_v2/tkit2.ts)
import { v2Transition } from '../scenes/agent_v2/tkit2';

const FRAG = `
void main(){ vec2 p=(vUv-0.5)*vec2(uAsp,1.0); float e=u*u*(3.0-2.0*u); vec2 h=vec2(0.018,0.034)*pow(70.0,e); vec2 q=abs(p)/h; float m=step(max(q.x,q.y),1.0);
vec3 A=texture2D(texA,vUv).rgb, B=texture2D(texB,0.5+(vUv-0.5)*(1.0+0.35*(1.0-e))).rgb; float edge=exp(-abs(max(q.x,q.y)-1.0)*25.0)*(1.0-e);
gl_FragColor=vec4(mix(A,B,m)+vec3(1.0,0.85,0.7)*edge*1.4,1.0);}`;

export default v2Transition(FRAG, { freezeA: true, dur: 0.5 });
