// v2_ink: the quiet act bleaches to washi, then sumi ink blooms across the paper - and the logo world lives inside the ink: agent_v2 seam (see scenes/agent_v2/tkit2.ts)
import { v2Transition } from '../scenes/agent_v2/tkit2';

const FRAG = `
void main(){ vec2 p=vUv*vec2(uAsp,1.0); vec2 cp=(vUv-0.5)*vec2(uAsp,1.0); float n=tfbm(p*2.2), n2=tfbm(p*7.0+3.0);
  vec3 paper=vec3(0.93,0.9,0.83)-0.05*tfbm(p*vec2(30.0,90.0))-0.03*th(floor(p*700.0));
  float a=smoothstep(0.0,0.06,u*2.4-length(cp)*0.9-0.25*n);
  float rad=(u-0.38)*2.3; float f=length(cp)*0.8+0.35*n+0.08*n2; float b=smoothstep(f-0.02,f+0.02,rad);
  float edge=exp(-abs(rad-f)*30.0)*step(0.0,rad);
  vec3 c=mix(texture2D(texA,vUv).rgb,paper,a); vec3 ink=texture2D(texB,vUv).rgb; c=mix(c,vec3(0.04,0.035,0.04),smoothstep(f-0.12,f-0.0,rad)*(1.0-b)*0.9);
  c=mix(c,ink,b); c=mix(c,vec3(0.02,0.015,0.02)+vec3(0.08,0.02,0.0)*n2,edge*0.7*(1.0-step(0.999,u)));
  gl_FragColor=vec4(c,1.0);}`;

export default v2Transition(FRAG, { dur: 0.8, freezeA: true });
