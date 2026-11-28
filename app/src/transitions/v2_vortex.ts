// v2_vortex: agent_v2 seam (see scenes/agent_v2/tkit2.ts)
import { v2Transition } from '../scenes/agent_v2/tkit2';

const FRAG = `
void main(){ vec2 p=(vUv-0.5)*vec2(uAsp,1.0); float r=length(p); float s=sin(3.14159*u); float a=s*6.0*exp(-r*2.5); vec2 q=mat2(cos(a),-sin(a),sin(a),cos(a))*p; q=q/vec2(uAsp,1.0)*(1.0+0.6*s)+0.5;
vec3 A=texture2D(texA,q).rgb, B=texture2D(texB,q).rgb; float m=smoothstep(0.35,0.65,u+(tfbm(p*4.0)-0.5)*0.4); gl_FragColor=vec4(mix(A,B,m)+SIGNAL*s*exp(-r*6.0)*0.8,1.0);}`;

export default v2Transition(FRAG, { dur: 0.6 });
