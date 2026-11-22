// v2_burn: the roulette frame chars brown, an ember front eats through it with heat haze and rising sparks, the fire scene behind: agent_v2 seam (see scenes/agent_v2/tkit2.ts)
import { v2Transition } from '../scenes/agent_v2/tkit2';

const FRAG = `
void main(){ vec2 P=vUv*vec2(uAsp,1.0); float n=tfbm(P*3.0+uT*0.3)+0.15*tfbm(P*12.0-uT); float t=u*1.45-0.25; float d=n-t;
  vec2 hz=vec2(tfbm(P*8.0+uT*3.0)-0.5,tfbm(P*8.0+5.0+uT*3.0)-0.5)*0.04*exp(-abs(d)*6.0)*sin(3.14159*u);
  vec3 A=texture2D(texA,vUv+hz*0.3).rgb, B=texture2D(texB,vUv+hz).rgb;
  A=mix(A,vec3(0.07,0.035,0.015),1.0-smoothstep(0.02,0.16,d)); A*=1.0-0.4*smoothstep(0.3,0.0,d)*u;
  vec3 c=d>0.0?A:B; float fl=0.8+0.4*tfbm(P*20.0+uT*8.0); c+=vec3(1.8,0.7,0.18)*exp(-abs(d)*55.0)*fl*sin(3.14159*u)*1.6;
  vec2 sc=P*vec2(60.0,30.0)+vec2(0.0,-uT*25.0); vec2 si=floor(sc); float sp=step(0.97,th(si))*smoothstep(0.25,0.0,length(fract(sc)-0.5))*exp(-abs(d+0.08)*10.0);
  c+=vec3(1.6,0.8,0.3)*sp*sin(3.14159*u); gl_FragColor=vec4(c,1.0);}`;

export default v2Transition(FRAG, { dur: 0.6 });
