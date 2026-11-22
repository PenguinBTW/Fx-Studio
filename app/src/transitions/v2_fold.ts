// v2_fold: agent_v2 seam (see scenes/agent_v2/tkit2.ts)
import { v2Transition } from '../scenes/agent_v2/tkit2';

const FRAG = `
void main(){ vec2 n=normalize(vec2(0.8,0.6)); float d=dot(vUv,n); float L=mix(1.45,-0.2,u*u*(3.0-2.0*u)); vec3 col=d>L?texture2D(texB,vUv).rgb:texture2D(texA,vUv).rgb;
vec2 m=vUv+2.0*(L-d)*n; if(d<L&&m.x>=0.0&&m.x<=1.0&&m.y>=0.0&&m.y<=1.0){ float sh=0.7+0.3*smoothstep(0.0,0.2,L-d); col=mix(vec3(0.94,0.91,0.85),texture2D(texA,m).rgb,0.12)*sh; }
if(d>L) col*=1.0-0.55*exp(-(d-L)*22.0); gl_FragColor=vec4(col,1.0);}`;

export default v2Transition(FRAG, { dur: 0.7 });
