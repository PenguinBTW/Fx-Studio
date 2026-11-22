// v2_shatter: the finished planet cracks along glowing Voronoi seams; each shard keeps its own piece of the planet,
// tilts, catches light and falls away to reveal the crumble scene. agent_v2 seam (see scenes/agent_v2/tkit2.ts)
import { v2Transition } from '../scenes/agent_v2/tkit2';

const FRAG = `
void main(){ vec2 p=vUv*vec2(uAsp,1.0)*7.0; vec2 ip=floor(p), fp=fract(p); float md=9.0, md2=9.0; vec2 cid=vec2(0.0);
for(int j=-1;j<=1;j++) for(int i=-1;i<=1;i++){ vec2 g=vec2(float(i),float(j)); vec2 o=vec2(th(ip+g),th(ip+g+7.1)); float d=length(g+o-fp); if(d<md){md2=md;md=d;cid=ip+g;} else if(d<md2){md2=d;} }
float crack=1.0-smoothstep(0.0,0.07,md2-md); float h=th(cid+3.3), dl=h*0.4; float k=clamp((u-0.12-dl)/0.55,0.0,1.0);
vec2 c=(cid+0.5)/7.0/vec2(uAsp,1.0); vec2 dir=normalize(c-0.5+1e-3); float ra=(h-0.5)*2.4*k*k; mat2 R=mat2(cos(ra),-sin(ra),sin(ra),cos(ra));
vec2 uv=c+R*(vUv-c)*(1.0+0.35*k)-dir*k*k*0.3+vec2(0.0,k*k*0.45);
vec3 A=texture2D(texA,uv).rgb; float la=smoothstep(0.03,0.2,dot(A,vec3(0.3,0.59,0.11))); float facet=0.8+0.4*h; A*=mix(1.0,facet,smoothstep(0.0,0.3,k))*(1.0-0.55*k*k);
A+=vec3(1.0,0.9,0.8)*pow(max(0.0,sin(ra*3.0+h*6.28)),12.0)*0.35*k*la;
float pl=smoothstep(0.04,0.2,dot(texture2D(texA,vUv).rgb,vec3(0.3,0.59,0.11))); crack*=pl; float pre=smoothstep(0.0,0.15,u); A=mix(A,SIGNAL*2.2+vec3(0.6,0.3,0.1),crack*pre*(1.0-k));
vec3 B=texture2D(texB,vUv).rgb; float inb=step(0.0,uv.x)*step(uv.x,1.0)*step(0.0,uv.y)*step(uv.y,1.0); float gone=max(smoothstep(0.85,0.98,k),1.0-inb); vec3 col=mix(A,B,gone);
col=mix(col,B,crack*smoothstep(0.1,0.4,k));
gl_FragColor=vec4(col,1.0);}`;

export default v2Transition(FRAG, { freezeA: true, dur: 0.6 });
