// v2_ash: the frozen rush crumbles into flakes that grey, ember at the edges and lift away, uncovering the quiet act: agent_v2 seam (see scenes/agent_v2/tkit2.ts)
import { v2Transition } from '../scenes/agent_v2/tkit2';

const FRAG = `
void main(){ vec2 g=vec2(uAsp,1.0)*48.0; vec2 P=vUv*g; vec3 c=texture2D(texB,vUv).rgb; c*=0.75+0.25*u;
  for(int j=0;j<=4;j++){ vec2 cell=floor(P)-vec2(0.0,float(j)); float t0=th(cell)*0.55+(1.0-cell.y/g.y)*0.3; float k=clamp((u-t0)/0.35,0.0,1.0);
    vec2 ctr=cell+0.5+vec2(sin(th(cell+1.7)*6.28+k*5.0)*0.7*k,k*k*4.5); float sz=0.55*(1.0-0.8*k); vec2 d=P-ctr; float rh=th(cell+3.1), ra=rh*6.28+k*(3.0+4.0*rh); vec2 dr=mat2(cos(ra),-sin(ra),sin(ra),cos(ra))*d; dr.x*=1.0+0.7*rh; dr.y*=1.0+0.9*k*(1.0-rh); float an=atan(dr.y,dr.x); float m=length(dr)*(1.0+0.28*sin(an*3.0+rh*21.0)+0.16*sin(an*5.0+rh*9.0)+0.1*sin(an*9.0+rh*4.0));
    if(m<sz&&k<0.999){ vec3 A=texture2D(texA,(cell+0.5+d/(2.0*sz))/g).rgb; float l=dot(A,vec3(0.3,0.59,0.11)); A=mix(A,vec3(l)*vec3(0.95,0.93,0.9),smoothstep(0.0,0.5,k));
      A+=vec3(1.6,0.55,0.12)*smoothstep(sz*0.55,sz,m)*k*(1.0-k)*5.0; c=A; break; } }
  gl_FragColor=vec4(c,1.0);}`;

export default v2Transition(FRAG, { freezeA: true, dur: 1.0 });
