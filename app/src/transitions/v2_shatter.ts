// v2_shatter: agent_v2 seam (see scenes/agent_v2/tkit2.ts)
import { v2Transition } from '../scenes/agent_v2/tkit2';

const FRAG = `
void main(){ vec2 p=vUv*vec2(uAsp,1.0)*7.0; vec2 ip=floor(p), fp=fract(p); float md=9.0; vec2 cid=vec2(0.0);
for(int j=-1;j<=1;j++) for(int i=-1;i<=1;i++){ vec2 g=vec2(float(i),float(j)); vec2 o=vec2(th(ip+g),th(ip+g+7.1)); float d=length(g+o-fp); if(d<md){md=d;cid=ip+g;} }
float dl=th(cid+3.3)*0.45; float k=clamp((u-dl)/0.55,0.0,1.0); vec2 c=(cid+0.5)/7.0/vec2(uAsp,1.0); vec2 dir=normalize(c-0.5+1e-3);
vec2 uv=c+(vUv-c)*(1.0+k*2.0)-dir*k*k*0.25+vec2(0.0,k*k*0.35); vec3 A=texture2D(texA,uv).rgb*(1.0-k*0.7)+SIGNAL*k*(1.0-k)*2.5; vec3 B=texture2D(texB,vUv).rgb;
gl_FragColor=vec4(k<0.97?A:B,1.0);}`;

export default v2Transition(FRAG, { freezeA: true, dur: 0.6 });
