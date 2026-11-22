// v2_print: agent_v2 seam (see scenes/agent_v2/tkit2.ts)
import { v2Transition } from '../scenes/agent_v2/tkit2';

const FRAG = `
void main(){ float e=smoothstep(0.0,1.0,u); float sc=mix(1.0,0.3,e); float ang=0.22*e; vec2 c=vec2(0.5)+vec2(0.1,-0.75)*e*e;
vec2 p=(vUv-c)*vec2(uAsp,1.0); p=mat2(cos(ang),sin(ang),-sin(ang),cos(ang))*p; vec2 q=p/vec2(uAsp,1.0)/sc+0.5; vec2 bq=abs(q-0.5);
float inner=step(max(bq.x,bq.y),0.5); float border=step(bq.x,0.5+0.035*e/sc)*step(bq.y,0.5+0.06*e/sc); float sh=step(bq.x,0.55)*step(bq.y,0.6)*e*(1.0-border);
vec3 col=texture2D(texB,vUv).rgb*(0.4+0.6*e)*(1.0-0.45*sh); col=mix(col,vec3(0.95,0.93,0.88),border*(1.0-inner)); col=mix(col,texture2D(texA,q).rgb,inner); gl_FragColor=vec4(col,1.0);}`;

export default v2Transition(FRAG, { freezeA: true, dur: 0.8 });
