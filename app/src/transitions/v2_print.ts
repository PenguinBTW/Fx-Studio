// v2_print: agent_v2 seam (see scenes/agent_v2/tkit2.ts)
import { v2Transition } from '../scenes/agent_v2/tkit2';

// the print drops onto the desk: shrinks and turns, its shadow tightens to contact as it lands, then it settles and fades
const FRAG = `
void main(){ float e=smoothstep(0.0,0.72,u); float sc=mix(1.0,0.3,e); float ang=0.22*e; vec2 c=vec2(0.5)+vec2(0.16,-0.24)*e;
vec2 p=(vUv-c)*vec2(uAsp,1.0); p=mat2(cos(ang),sin(ang),-sin(ang),cos(ang))*p; vec2 q=p/vec2(uAsp,1.0)/sc+0.5; vec2 bq=abs(q-0.5);
float inner=step(max(bq.x,bq.y),0.5); float bx=0.5+0.035*e/sc, by=0.5+0.06*e/sc; float border=step(bq.x,bx)*step(bq.y,by);
float k=1.0-smoothstep(0.8,1.0,u); vec2 so=vec2(0.05,-0.08)*(1.0-e)+vec2(0.012,-0.02); vec2 sb=abs(q-0.5-so);
float sh=(1.0-smoothstep(bx-0.02,bx+0.06+0.1*(1.0-e),sb.x))*(1.0-smoothstep(by-0.02,by+0.06+0.1*(1.0-e),sb.y))*(0.35+0.4*e)*(1.0-border)*k;
vec3 col=texture2D(texB,vUv).rgb*(0.4+0.6*e)*(1.0-0.6*sh); col=mix(col,vec3(0.95,0.93,0.88),border*(1.0-inner)*k); col=mix(col,texture2D(texA,q).rgb,inner*k); gl_FragColor=vec4(col,1.0);}`;

export default v2Transition(FRAG, { freezeA: true, dur: 0.8 });
