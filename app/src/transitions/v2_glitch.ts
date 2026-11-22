// v2_glitch: comic tears into the roulette - torn rows show B re-rendered one and two beats ahead, so three styles flicker through the tear: agent_v2 seam (see scenes/agent_v2/tkit2.ts)
import { v2Transition } from '../scenes/agent_v2/tkit2';
import { BEAT } from '../scenes/agent_promo/kit';

const FRAG = `
vec3 rgbS(sampler2D t, vec2 q, float ca){ return vec3(texture2D(t,q+vec2(ca,0.0)).r,texture2D(t,q).g,texture2D(t,q-vec2(ca,0.0)).b); }
void main(){ float s=sin(3.14159*u); float row=floor(vUv.y*mix(18.0,60.0,th(vec2(floor(u*14.0),3.0)))); float r=th(vec2(row,floor(u*14.0)));
  vec2 q=vUv+vec2((r-0.5)*0.22*s*step(0.6,th(vec2(row,floor(u*20.0)+5.0))),0.0); float ca=0.014*s;
  float pick=th(vec2(row*1.7,floor(u*9.0)+1.0)); vec3 c;
  if(r*0.85+0.08>u) c=rgbS(texA,q,ca); else if(pick<0.45+0.55*u) c=rgbS(texB,q,ca); else if(pick<0.8) c=rgbS(texB2,q,ca); else c=rgbS(texB3,q,ca);
  float edge=step(0.985,fract(vUv.y*mix(18.0,60.0,th(vec2(floor(u*14.0),3.0))))); c=mix(c,vec3(1.0,0.1,0.6),edge*s*0.6);
  gl_FragColor=vec4(c,1.0);}`;

export default v2Transition(FRAG, { dur: 0.45, extra: { texB2: (api, t0) => api.sampleScene(api.to, t0 + 0.45 + BEAT), texB3: (api, t0) => api.sampleScene(api.to, t0 + 0.45 + 2 * BEAT) } });
