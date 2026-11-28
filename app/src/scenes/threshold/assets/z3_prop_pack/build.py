# THRESHOLD Z3 pool prop pack, deterministic Blender build.
import bpy,os,sys,math
sys.dont_write_bytecode=True
HERE=os.path.dirname(os.path.abspath(__file__));sys.path.insert(0,os.path.dirname(HERE))
from _bl import *
reset()
WHITE=mat('aged_pool_white',(.72,.73,.66),.55);BLUE=mat('kickboard_blue',(.02,.25,.55),.34);YELLOW=mat('rescue_yellow',(.9,.55,.02),.35);RED=mat('rescue_red',(.65,.03,.02),.35);WOOD=mat('wet_bench_wood',(.32,.16,.055),.65);METAL=mat('wet_metal',(.3,.36,.36),.32,metal=.65);DARK=mat('drain_dark',(.025,.04,.04),.82);INK=mat('sign_ink_blue',(.01,.08,.22),.62)
def root(n,x):r=empty(n,(x,0,0));r['fx_part']=n;return r
def add(o,r):o.location.x-=r.location.x;o.parent=r;return o
def lifeguard(x):
 r=root('lifeguard_chair_root',x)
 for sx in(-.35,.35):add(cyl('chair_leg',.025,1.7,(x+sx,0,.85),METAL,rot=(0,0,sx*.16),verts=14),r)
 add(box('chair_seat',(.72,.48,.09),(x,0,1.48),WHITE,.025,3),r);add(box('chair_back',(.72,.09,.58),(x,.22,1.83),WHITE,.025,3),r)
 add(box('chair_step',(.55,.30,.055),(x,-.1,.82),METAL,.012),r);add(box('chair_step2',(.55,.30,.055),(x,-.06,.48),METAL,.012),r)
 return r
def kickboard(x):
 r=root('kickboard_root',x);add(box('kickboard_body',(.48,.72,.055),(x,0,.03),BLUE,.09,4),r);add(box('kickboard_grip_l',(.12,.05,.02),(x-.12,-.26,.065),DARK,.015),r);add(box('kickboard_grip_r',(.12,.05,.02),(x+.12,-.26,.065),DARK,.015),r);return r
def noodle(x):
 r=root('pool_noodle_root',x);add(cyl('noodle_foam',.045,1.5,(x,0,.05),YELLOW,rot=(0,math.pi/2,0),verts=20),r);return r
def duck(x):
 r=root('rubber_duck_root',x);add(sphere('duck_body',.13,(x,0,.12),YELLOW,scale=(1.25,.8,.8),segments=20),r);add(sphere('duck_head',.075,(x+.1,0,.23),YELLOW,segments=18),r);add(box('duck_beak',(.08,.05,.035),(x+.17,0,.22),RED,.012,2),r);add(sphere('duck_eye',.012,(x+.13,-.055,.26),DARK,segments=8),r);return r
def drain(x):
 r=root('pool_drain_root',x);add(cyl('drain_outer',.18,.025,(x,0,.012),METAL,verts=28),r)
 for i in range(8):a=i*math.tau/8;add(box('drain_slot',(.025,.10,.008),(x+math.cos(a)*.07,math.sin(a)*.07,.027),DARK,.002,rot=(0,0,a)),r)
 return r
def bench(x):
 r=root('pool_bench_root',x)
 for z in(0,.08,.16):add(box('bench_slat',(1.5,.11,.045),(x,z,.45),WOOD,.012,2),r)
 for sx in(-.6,.6):add(box('bench_leg',(.06,.28,.42),(x+sx,.08,.21),METAL,.01),r)
 return r
def towel(x):
 r=root('folded_towel_root',x)
 for i in range(3):add(box('towel_fold',(.52-i*.03,.28,.035),(x,0,.02+i*.034),WHITE,.018,3),r)
 return r
def sign(x):
 r=root('no_diving_sign_root',x);add(box('sign_tile',(.78,.035,.42),(x,0,.21),WHITE,.018,2),r);add(box('sign_bar',(.58,.04,.035),(x,-.025,.21),INK,.004,rot=(0,0,-.35)),r);add(cyl('sign_circle',.15,.018,(x,-.025,.21),RED,rot=(math.pi/2,0,0),verts=28),r);return r
def clock(x):
 r=root('handless_clock_root',x);add(cyl('clock_case',.24,.045,(x,0,0),WHITE,rot=(math.pi/2,0,0),verts=32),r);add(cyl('clock_face',.21,.012,(x,-.03,0),INK,rot=(math.pi/2,0,0),verts=32),r)
 for i in range(12):a=i*math.tau/12;add(box('clock_tick',(.012,.008,.035),(x+math.sin(a)*.17,-.04+math.cos(a)*.17,0),WHITE,.001,rot=(0,0,-a)),r)
 return r
def ring(x):
 r=root('rescue_ring_root',x);add(torus('rescue_ring',.24,.055,(x,0,0),RED,major_segments=32,minor_segments=12),r)
 for i in range(4):a=i*math.pi/2;add(box('ring_white_band',(.10,.12,.125),(x+math.cos(a)*.24,math.sin(a)*.24,0),WHITE,.012,rot=(0,0,a)),r)
 return r

def flipflops(x):
 r=root('flipflops_root',x)
 for sx in(-.09,.09):
  add(sphere('flipflop_sole',.16,(x+sx,0,.025),BLUE if sx<0 else RED,scale=(.48,1.0,.13),segments=20),r)
  add(cyl('flipflop_strap_l',.009,.12,(x+sx-.035,-.035,.065),WHITE,rot=(.72,.2,0),verts=8),r)
  add(cyl('flipflop_strap_r',.009,.12,(x+sx+.035,-.035,.065),WHITE,rot=(.72,-.2,0),verts=8),r)
  add(cyl('flipflop_toe_post',.010,.035,(x+sx,-.095,.045),WHITE,verts=8),r)
 return r

def shower_head(x):
 r=root('shower_head_root',x)
 add(cyl('shower_pipe',.025,.72,(x,0,.36),METAL,verts=16),r)
 add(cyl('shower_arm',.022,.32,(x,0,.72),METAL,rot=(0,math.pi/2,0),verts=16),r)
 add(cyl('shower_head_cone',.11,.10,(x+.17,0,.67),METAL,rot=(math.pi/2,0,0),verts=24),r)
 for i in range(7):add(cyl('shower_nozzle',.006,.012,(x+.17-.045+(i%3)*.045,-.055,.67-.025+(i//3)*.025),DARK,rot=(math.pi/2,0,0),verts=8),r)
 return r

def floating_phone(x):
 r=root('floating_pool_phone_root',x)
 add(box('pool_phone_body',(.22,.07,.38),(x,0,0),DARK,.035,3),r)
 add(box('pool_phone_screen',(.16,.012,.24),(x,.041,0),mat('phone_screen_glow',(.05,.22,.26),.2,emit=(.1,.5,.6),strength=.5),.015,2),r)
 add(cyl('pool_phone_antenna',.008,.22,(x+.08,.12,-.16),METAL,rot=(.25,0,0),verts=8),r)
 return r

builders=[lifeguard,kickboard,noodle,duck,drain,bench,towel,sign,clock,ring,flipflops,shower_head,floating_phone];x=0
for b in builders:b(x);x+=2.4
export(HERE)
