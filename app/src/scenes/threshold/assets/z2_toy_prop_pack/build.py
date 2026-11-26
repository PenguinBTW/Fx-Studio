# THRESHOLD Z2 toy prop pack. Deterministic Blender-built playroom objects, metres.
import bpy, os, sys, math
sys.dont_write_bytecode=True
HERE=os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0,os.path.dirname(HERE))
from _bl import *
reset()
RED=mat('toy_red_vinyl',(0.65,.025,.02),.3); YELLOW=mat('toy_yellow_vinyl',(.9,.55,.02),.28); BLUE=mat('toy_blue_vinyl',(.02,.16,.65),.3); GREEN=mat('toy_green_vinyl',(.02,.45,.1),.32)
WOOD=mat('worn_toy_wood',(.38,.18,.055),.58); CREAM=mat('aged_cream_plastic',(.72,.62,.42),.52); DARK=mat('toy_dark_detail',(.025,.025,.025),.7); PINK=mat('teddy_thread_pink',(.55,.08,.16),.78); WHITE=mat('eye_white',(.9,.88,.78),.5)
def root(name,x):
 r=empty(name,(x,0,0)); r['fx_part']=name; return r
def add(o,r): o.location.x-=r.location.x; o.parent=r; return o

def rocking_horse(x):
 r=root('rocking_horse_root',x)
 add(sphere('horse_body',.22,(x,0,.42),WOOD,scale=(1.45,.62,.85),segments=24),r)
 add(sphere('horse_head',.14,(x+.29,.0,.62),WOOD,scale=(.8,.65,1.15),segments=20),r)
 add(box('horse_muzzle',(.18,.13,.12),(x+.4,0,.56),CREAM,.025,3),r)
 for yy in (-.1,.1): add(cyl('horse_leg',.035,.38,(x-.12,yy,.22),WOOD,rot=(0,0,.18),verts=14),r); add(cyl('horse_leg',.035,.38,(x+.16,yy,.22),WOOD,rot=(0,0,-.18),verts=14),r)
 for yy in (-.16,.16): add(cyl('horse_rocker',.025,.86,(x,yy,.055),RED,rot=(0,math.pi/2,0),verts=16),r)
 add(box('horse_saddle',(.24,.2,.045),(x-.02,0,.59),RED,.025,3),r)
 for yy in (-.065,.065): add(sphere('horse_eye',.022,(x+.36,yy,.67),DARK,scale=(1,1,1),segments=12),r)
 return r

def robot(x):
 r=root('tin_robot_root',x)
 add(box('robot_body',(.30,.18,.38),(x,0,.42),BLUE,.025,3),r)
 add(box('robot_head',(.24,.20,.20),(x,0,.72),CREAM,.025,3),r)
 for sx in (-.065,.065): add(sphere('robot_eye',.025,(x+sx,-.105,.75),DARK,segments=12),r)
 for sx in (-.22,.22): add(cyl('robot_arm',.032,.32,(x+sx,0,.43),YELLOW,rot=(0,0,sx*1.8),verts=14),r)
 for sx in (-.09,.09): add(cyl('robot_leg',.04,.25,(x+sx,0,.13),RED,verts=14),r)
 for i in range(3): add(cyl('robot_chest_button',.018,.012,(x-.055+i*.055,-.095,.45),[RED,YELLOW,GREEN][i],rot=(math.pi/2,0,0),verts=12),r)
 add(cyl('robot_antenna',.009,.16,(x,0,.90),DARK,verts=8),r); add(sphere('robot_antenna_tip',.025,(x,0,.99),RED,segments=12),r)
 return r

def teddy(x):
 r=root('stitched_teddy_root',x)
 add(sphere('teddy_body',.20,(x,0,.32),WOOD,scale=(.85,.65,1.2),segments=24),r)
 add(sphere('teddy_head',.16,(x,0,.62),WOOD,scale=(1,.8,.9),segments=24),r)
 for sx in (-.11,.11): add(sphere('teddy_ear',.065,(x+sx,0,.74),WOOD,segments=16),r)
 for sx in (-.20,.20): add(cyl('teddy_arm',.045,.25,(x+sx,0,.38),WOOD,rot=(0,0,sx*2.8),verts=14),r)
 for sx in (-.09,.09): add(cyl('teddy_leg',.052,.22,(x+sx,0,.11),WOOD,rot=(math.pi/2,0,0),verts=14),r)
 for sx in (-.05,.05): add(sphere('teddy_eye',.018,(x+sx,-.13,.65),DARK,segments=12),r)
 for i in range(5): add(box('teddy_stitch',(.008,.006,.025),(x-.04+i*.02,-.205,.40),PINK,.001),r)
 return r

def piano(x):
 r=root('toy_piano_root',x)
 add(box('piano_body',(.74,.32,.34),(x,0,.26),RED,.035,3),r)
 add(box('piano_keybed',(.68,.13,.055),(x,-.19,.25),CREAM,.012,2),r)
 for i in range(10): add(box('piano_white_key',(.055,.11,.025),(x-.29+i*.064,-.245,.29),WHITE,.004),r)
 for i in range(7):
  if i in (2,6): continue
  add(box('piano_black_key',(.032,.065,.035),(x-.26+i*.064,-.265,.315),DARK,.003),r)
 return r

def stacking_rings(x):
 r=root('stacking_rings_root',x)
 add(cyl('stacking_post',.035,.48,(x,0,.24),CREAM,verts=16),r)
 cols=[RED,YELLOW,BLUE,GREEN]
 for i in range(4): add(torus('stacking_ring',.19-i*.033,.035,(x,0,.08+i*.075),cols[i],major_segments=28,minor_segments=10),r)
 add(sphere('stacking_top',.07,(x,0,.52),RED,segments=16),r)
 return r

def toy_phone(x):
 r=root('toy_phone_root',x)
 add(box('toy_phone_base',(.34,.25,.16),(x,0,.10),RED,.035,3),r)
 add(box('toy_phone_receiver',(.40,.10,.085),(x,0,.23),CREAM,.035,3),r)
 for sx in (-.065,.065):
  add(sphere('toy_phone_eye',.035,(x+sx,-.115,.12),WHITE,segments=16),r)
  add(sphere('toy_phone_pupil',.014,(x+sx,-.143,.12),DARK,segments=10),r)
 add(cyl('toy_phone_rotary_dial',.072,.012,(x,-.132,.045),CREAM,rot=(math.pi/2,0,0),verts=28),r)
 for i in range(8):
  a=i*math.tau/8;add(cyl('toy_phone_dial_hole',.010,.014,(x+math.cos(a)*.043,-.141,.045+math.sin(a)*.043),DARK,rot=(math.pi/2,0,0),verts=10),r)
 for i in range(5):add(torus('toy_phone_cord_loop',.018,.004,(x+.19,-.02+i*.026,.19-i*.025),DARK,major_segments=14,minor_segments=5),r)
 return r

def toy_car(x):
 r=root('toy_car_root',x)
 add(box('car_body',(.42,.22,.14),(x,0,.14),BLUE,.04,3),r)
 add(box('car_cabin',(.20,.18,.12),(x-.02,0,.26),YELLOW,.035,3),r)
 for xx in (-.14,.14):
  for yy in (-.12,.12): add(cyl('car_wheel',.055,.035,(x+xx,yy,.065),DARK,rot=(math.pi/2,0,0),verts=16),r)
 return r

def jackbox(x):
 r=root('jack_in_box_root',x)
 add(box('jack_box',(.36,.36,.34),(x,0,.17),BLUE,.025,3),r)
 add(box('jack_lid_open',(.36,.035,.30),(x,.16,.43),YELLOW,.018,2,rot=(math.radians(-35),0,0)),r)
 add(cyl('jack_crank_arm',.018,.16,(x+.22,-.02,.2),METAL if (METAL:=DARK) else DARK,rot=(0,math.pi/2,0),verts=12),r)
 add(sphere('jack_crank_knob',.035,(x+.31,-.02,.2),RED,segments=12),r)
 add(sphere('jack_head',.09,(x,0,.49),CREAM,segments=18),r)
 add(box('jack_collar',(.18,.12,.06),(x,0,.39),RED,.015),r)
 return r

def xylophone(x):
 r=root('xylophone_root',x)
 cols=[RED,YELLOW,GREEN,BLUE,CREAM]
 for i in range(5): add(box('xylo_bar',(.10-i*.008,.34,.025),(x-.24+i*.12,0,.08),cols[i],.008,2),r)
 for yy in (-.14,.14): add(cyl('xylo_rail',.018,.58,(x,yy,.035),WOOD,rot=(0,math.pi/2,0),verts=12),r)
 return r

def music_box(x):
 r=root('music_box_root',x)
 add(cyl('music_box_base',.20,.16,(x,0,.08),WOOD,verts=28),r)
 add(cyl('music_box_key',.018,.12,(x+.22,0,.1),DARK,rot=(0,math.pi/2,0),verts=12),r)
 add(sphere('ballerina_body',.055,(x,0,.27),PINK,scale=(.7,.7,1.4),segments=16),r)
 add(sphere('ballerina_head',.04,(x,0,.39),CREAM,segments=14),r)
 for sx in (-.055,.055): add(cyl('ballerina_arm',.009,.13,(x+sx,0,.31),CREAM,rot=(0,0,sx*4),verts=8),r)
 return r


def alphabet_block(x):
 r=root('alphabet_block_root',x)
 add(box('block_core',(.28,.28,.28),(x,0,.14),YELLOW,.025,3),r)
 for z in(.02,.26):add(box('block_edge',(.30,.30,.025),(x,0,z),RED,.006),r)
 add(box('block_letter_stem',(.035,.018,.15),(x,-.151,.14),DARK,.002),r)
 add(box('block_letter_cross',(.11,.018,.035),(x,-.153,.15),DARK,.002),r)
 return r

def ball_cart(x):
 r=root('ball_cart_root',x)
 for sx in(-.34,.34):
  for sz in(-.24,.24):add(cyl('cart_post',.018,.52,(x+sx,sz,.26),METAL if (METAL:=DARK) else DARK,verts=10),r)
 for z in(.08,.48):
  add(box('cart_rail_x',(.72,.018,.018),(x,-.25,z),DARK,.003),r);add(box('cart_rail_x',(.72,.018,.018),(x,.25,z),DARK,.003),r)
  add(box('cart_rail_z',(.018,.52,.018),(x-.35,0,z),DARK,.003),r);add(box('cart_rail_z',(.018,.52,.018),(x+.35,0,z),DARK,.003),r)
 for i in range(9):add(sphere('cart_ball',.09,(x-.22+(i%3)*.22,-.14+(i//3)*.14,.24+(i%2)*.08),[RED,YELLOW,BLUE,GREEN][i%4],segments=16),r)
 return r

def shoe_cubby(x):
 r=root('shoe_cubby_root',x)
 add(box('cubby_case',(1.05,.34,.82),(x,0,.41),WOOD,.018,2),r)
 for row in range(2):
  for col in range(4):
   xx=x-.39+col*.26;zz=.22+row*.34
   add(box('cubby_opening',(.21,.025,.25),(xx,-.18,zz),DARK,.006),r)
   if (row+col)%2==0:add(box('small_shoe',(.16,.12,.055),(xx,-.22,zz-.06),[RED,BLUE,GREEN,YELLOW][col],.02,2),r)
 return r

def birthday_banner(x):
 r=root('birthday_banner_root',x)
 add(cyl('banner_string',.008,2.8,(x,0,0),DARK,rot=(0,math.pi/2,0),verts=8),r)
 for i in range(9):
  xx=x-1.25+i*.31
  add(box('banner_flag',(.22,.012,.30),(xx,0,-.18),[RED,YELLOW,BLUE,GREEN,CREAM][i%5],.004,rot=(0,0,(i%2-.5)*.08)),r)
 return r

def balloon_cluster(x):
 r=root('balloon_cluster_root',x)
 for i in range(5):
  xx=x-.28+(i%3)*.28;zz=.5+(i//3)*.32;yy=(i%2)*.08
  add(sphere('balloon',.16,(xx,yy,zz),[RED,YELLOW,BLUE,GREEN,CREAM][i],scale=(.9,.9,1.15),segments=18),r)
  add(cyl('balloon_string',.004,.75,(xx,yy,zz-.48),DARK,verts=6),r)
 return r

builders=[rocking_horse,robot,teddy,piano,stacking_rings,toy_phone,toy_car,jackbox,xylophone,music_box,alphabet_block,ball_cart,shoe_cubby,birthday_banner,balloon_cluster]
x=0
for b in builders:
 b(x); x+=2.2
export(HERE)
