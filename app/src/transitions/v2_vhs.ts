// v2_vhs: agent_v2 seam (see scenes/agent_v2/tkit2.ts)
import { v2Transition } from '../scenes/agent_v2/tkit2';

const FRAG = `
void main(){ float s=sin(3.14159*u); float y=fract(vUv.y+uT*1.7); float band=smoothstep(0.0,0.05,abs(y-0.5)); vec2 q=vUv+vec2((th(vec2(floor(vUv.y*240.0),floor(uT*30.0)))-0.5)*0.03*s,0.0);
vec3 c=u<0.5?texture2D(texA,q).rgb:texture2D(texB,q).rgb; c*=0.85+0.15*sin(vUv.y*1620.0); c=mix(c,vec3(1.0),(1.0-band)*0.4*s); c+=(th(vUv*900.0+uT)-0.5)*0.15*s; gl_FragColor=vec4(c,1.0);}`;

export default v2Transition(FRAG, { rewindA: 3, dur: 0.7 });
