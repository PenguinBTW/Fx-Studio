// v2_flash: a camera flash - the galaxy's highlights blow out first with anamorphic streaks, white peak, the rush develops in with A's afterimage burnt on: agent_v2 seam (see scenes/agent_v2/tkit2.ts)
import { v2Transition } from '../scenes/agent_v2/tkit2';

const FRAG = `
void main(){ vec2 p=vUv-0.5; float s=exp(-pow((u-0.48)*9.0,2.0)); vec2 qa=0.5+p*(1.0-0.12*u); vec3 A=texture2D(texA,qa).rgb; vec3 B=texture2D(texB,0.5+p*(1.0+0.2*(1.0-u))).rgb;
  float la=dot(A,vec3(0.3,0.59,0.11)); A+=vec3(1.0,0.95,0.9)*smoothstep(0.85-u*0.9,1.0,la)*4.0*u*u;
  vec3 st=vec3(0.0); for(int i=-8;i<=8;i++){ vec3 sA=texture2D(texA,qa+vec2(float(i)*0.03,0.0)).rgb; st+=max(sA-0.55,0.0)*exp(-abs(float(i))*0.35); }
  A+=st*vec3(0.6,0.8,1.2)*0.35*(0.2+u);
  vec3 aft=texture2D(texA,0.5+p*0.94).rgb; float lf=dot(aft,vec3(0.3,0.59,0.11)); B=mix(B,B*vec3(0.55,0.75,1.1)+vec3(0.12,0.0,0.15)*lf,smoothstep(0.45,0.6,u)*(1.0-smoothstep(0.6,1.0,u))*0.5);
  vec3 c=mix(A,B,smoothstep(0.44,0.52,u)); c=mix(c,vec3(1.0,0.97,0.92),s); gl_FragColor=vec4(c,1.0);}`;

export default v2Transition(FRAG, { dur: 0.45 });
