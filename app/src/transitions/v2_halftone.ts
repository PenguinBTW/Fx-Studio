// v2_halftone: agent_v2 seam (see scenes/agent_v2/tkit2.ts)
import { v2Transition } from '../scenes/agent_v2/tkit2';

const FRAG = `
void main(){ vec2 p=vUv*vec2(uAsp,1.0)*55.0; p=mat2(0.966,-0.259,0.259,0.966)*p; vec2 g=fract(p)-0.5; float r=clamp((u*1.7-(1.0-vUv.x)*0.6)*0.9,0.0,0.75);
float m=step(length(g),r); vec3 A=texture2D(texA,vUv).rgb,B=texture2D(texB,vUv).rgb; float ring=smoothstep(0.05,0.0,abs(length(g)-r))*step(0.01,r)*step(r,0.7);
gl_FragColor=vec4(mix(A,B,m)+vec3(1.0,0.1,0.55)*ring*0.8,1.0);}`;

export default v2Transition(FRAG, { dur: 0.6 });
