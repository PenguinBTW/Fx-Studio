// v2_viewport: agent_v2 seam (see scenes/agent_v2/tkit2.ts)
import { v2Transition } from '../scenes/agent_v2/tkit2';

const FRAG = `
void main(){ float e=u*u*(3.0-2.0*u); vec4 R=vec4(316.0/1920.0,1.0-735.0/1080.0,1200.0/1920.0,675.0/1080.0); vec2 qa=mix(R.xy+vUv*R.zw,vUv,0.0); qa=mix(vUv,R.xy+vUv*R.zw,e);
vec3 A=texture2D(texA,qa).rgb, B=texture2D(texB,vUv).rgb; A*=1.0-0.35*smoothstep(0.75,1.0,dot(A,vec3(0.3,0.59,0.11))); gl_FragColor=vec4(mix(A,B,smoothstep(0.55,1.0,u)),1.0);}`;

export default v2Transition(FRAG, { dur: 0.8 });
