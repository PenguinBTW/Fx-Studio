// v2_vhs: the ocean rewinds on tape - tracking band rolls up, chroma splits, head-switch noise, a ghost of an earlier rewind frame, lines flip to the editor: agent_v2 seam (see scenes/agent_v2/tkit2.ts)
import { v2Transition } from '../scenes/agent_v2/tkit2';

const FRAG = `
void main(){ float s=sin(3.14159*u); float line=floor(vUv.y*240.0); float bandY=fract(0.15+uT*0.9); float dy=vUv.y-bandY; float band=exp(-dy*dy*500.0);
  float jit=(th(vec2(line,floor(uT*30.0)))-0.5)*0.035*s+band*0.07*s*sin(vUv.y*90.0+uT*40.0);
  float sw=smoothstep(0.38,0.62,u+0.2*(th(vec2(floor(vUv.y*40.0),floor(uT*15.0)))-0.5)); vec2 q=vec2(vUv.x+jit,vUv.y); float ca=0.005*s+0.012*band;
  vec3 A=vec3(texture2D(texA,q+vec2(ca,0.0)).r,texture2D(texA,q).g,texture2D(texA,q-vec2(ca,0.0)).b);
  vec3 B=vec3(texture2D(texB,q+vec2(ca,0.0)).r,texture2D(texB,q).g,texture2D(texB,q-vec2(ca,0.0)).b);
  vec3 G=texture2D(texG,q+vec2(0.015,0.0)).rgb; vec3 c=mix(mix(A,0.6*A+0.5*G,0.6*s),B,sw);
  float l=dot(c,vec3(0.3,0.59,0.11)); c=mix(c,vec3(l)*vec3(1.05,0.98,1.1),0.3*s); c*=0.88+0.12*sin(vUv.y*1620.0);
  c=mix(c,vec3(0.85)+(th(vUv*vec2(300.0,900.0)+uT)-0.5)*0.7,band*0.55*s);
  float hs=smoothstep(0.07,0.0,vUv.y); c=mix(c,vec3(th(vec2(floor(vUv.x*160.0+uT*90.0),line))),hs*0.75*s);
  c+=(th(vUv*900.0+uT)-0.5)*0.12*s; gl_FragColor=vec4(c,1.0);}`;

export default v2Transition(FRAG, { rewindA: 3, dur: 0.7, extra: { texG: (api, t0, t) => api.sampleScene(api.from, t0 - 3 * (t - t0) - 0.5) } });
