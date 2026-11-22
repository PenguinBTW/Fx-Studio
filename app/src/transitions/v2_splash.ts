// v2_splash: the camera plunges after the dragon - a waving waterline rises through frame; below it the ocean refracts through ripples with caustics and bubbles: agent_v2 seam (see scenes/agent_v2/tkit2.ts)
import { v2Transition } from '../scenes/agent_v2/tkit2';

const FRAG = `
void main(){ vec2 p=vUv*vec2(uAsp,1.0); float wl=mix(-0.2,1.25,u*u*(3.0-2.0*u)); float wave=0.035*sin(p.x*9.0+uT*6.0)+0.02*sin(p.x*23.0-uT*9.0)+0.03*(tfbm(vec2(p.x*3.0,uT*2.0))-0.5);
  float y=vUv.y-(wl+wave); float k=1.0-smoothstep(0.7,1.0,u); vec3 c;
  if(y<0.0){ vec2 n=vec2(tfbm(p*6.0+uT*1.5)-0.5,tfbm(p*6.0+7.0-uT*1.2)-0.5); float depth=clamp(-y*3.0,0.0,1.0); vec2 q=vUv+n*0.06*(1.0-0.5*depth)*k;
    c=texture2D(texB,q).rgb; float ca=smoothstep(0.92,1.0,1.0-abs(tfbm(p*5.0+uT*0.8)*2.0-1.0)); c+=vec3(0.3,0.9,1.0)*ca*0.12*(1.0-depth)*k;
    vec2 bc=p*vec2(30.0,18.0)+vec2(0.0,uT*14.0); vec2 bi=floor(bc), bf=fract(bc)-0.5; float b=step(0.93,th(bi))*smoothstep(0.2,0.05,length(bf)); c+=vec3(0.7,0.95,1.0)*b*0.6*k;
    c=mix(c,vec3(0.02,0.1,0.14),0.25*(1.0-depth)*step(-0.03,y)*k); }
  else { vec2 q=vUv+vec2(0.0,-0.02*exp(-y*25.0)); c=texture2D(texA,q).rgb; float dr=step(0.985,th(floor(p*vec2(80.0,40.0)+vec2(0.0,uT*30.0))))*exp(-y*6.0); c+=vec3(0.8,0.95,1.0)*dr*0.5; }
  c+=vec3(0.6,0.95,1.0)*exp(-abs(y)*140.0)*0.9; gl_FragColor=vec4(c,1.0);}`;

export default v2Transition(FRAG, { dur: 0.6 });
