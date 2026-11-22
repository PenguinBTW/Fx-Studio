// v2_mosaic: the player frame breaks into screen tiles that card-flip from the centre out; their backs are the LCD subpixels the zoom starts on: agent_v2 seam (see scenes/agent_v2/tkit2.ts)
import { v2Transition } from '../scenes/agent_v2/tkit2';

const FRAG = `
void main(){ vec2 g=vec2(uAsp,1.0)*14.0; vec2 p=vUv*g; vec2 cell=floor(p), f=fract(p); vec2 cc=(cell+0.5)/g;
  float d=length((cc-0.5)*vec2(uAsp,1.0)); float t0=d*0.55+th(cell)*0.15; float k=clamp((u-t0)/0.3,0.0,1.0);
  float fl=cos(k*3.14159); float w=abs(fl); float fx=(f.x-0.5)/max(w,1e-3)+0.5; float gap=0.04;
  vec3 c=vec3(0.0); if(fx>gap&&fx<1.0-gap&&f.y>gap&&f.y<1.0-gap){ vec2 q=(cell+vec2(fx,f.y))/g; c=fl>0.0?texture2D(texA,q).rgb:texture2D(texB,q).rgb; c*=0.55+0.45*w; c+=vec3(1.0,0.6,0.3)*pow(1.0-w,8.0)*0.4; }
  if(k<=0.0) c=texture2D(texA,vUv).rgb; if(k>=1.0) c=texture2D(texB,vUv).rgb; gl_FragColor=vec4(c,1.0);}`;

export default v2Transition(FRAG, { dur: 0.7 });
