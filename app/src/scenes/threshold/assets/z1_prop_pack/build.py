# THRESHOLD Z1 prop pack. Modular Blender-built office props, deterministic, real scale metres.
import bpy, os, sys, math
sys.dont_write_bytecode=True
HERE=os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0,os.path.dirname(HERE))
from _bl import *
reset()
BEIGE=mat('old_beige_plastic',(0.55,0.47,0.34),.55)
LAM=mat('worn_laminate',(0.31,0.29,0.24),.62)
EDGE=mat('worn_edge_dark',(0.08,0.07,0.055),.82)
METAL=mat('scuffed_office_metal',(0.28,0.29,0.28),.48,metal=.55)
DARK=mat('blackened_plastic',(0.025,0.028,0.026),.68)
FABRIC=mat('chair_fabric_bluegrey',(0.12,0.16,0.18),.86)
PAPER=mat('aged_paper',(0.72,0.68,0.55),.9)
CORK=mat('corkboard',(0.34,0.19,0.09),.9)
GREEN=mat('dead_ficus_green',(0.12,0.17,0.08),.82)
RED=mat('extinguisher_red',(0.42,0.025,0.018),.38,metal=.25)
GLASS=mat('cooler_bottle',(0.32,0.48,0.52),.2)
SCREEN=mat('crt_phosphor',(0.08,0.32,0.31),.28,emit=(0.12,0.75,0.68),strength=.8)

def root(name,x):
 r=empty(name,(x,0,0)); r['fx_part']=name; return r
def add(o,r,part=None):
 # Keep child transforms relative to the modular root; matrix_parent_inverse would bake lineup offsets into clones.
 o.location.x -= r.location.x
 o.parent=r
 if part: o['fx_part']=part
 return o

def build_desk(x):
 r=root('desk_root',x)
 add(box('desk_top',(1.64,0.84,0.07),(x,0,0.755),LAM,.012,3),r)
 add(box('desk_front_edge',(1.66,0.024,0.05),(x,-0.425,0.74),EDGE,.004),r)
 add(box('desk_modesty',(1.48,0.05,0.68),(x,0.28,0.48),METAL,.008),r)
 for sx in (-.72,.72):
  add(box('desk_leg',(0.07,0.68,0.7),(x+sx,0,0.37),METAL,.006),r)
  add(box('desk_foot',(0.22,0.76,0.036),(x+sx,0,0.018),METAL,.004),r)
 for i in range(7): add(box('desk_scratch',(0.06+i%3*.025,.0015,.001),(x-.55+i*.17,-.428,0.754),EDGE,.0005),r)
 return r

def build_chair(x,variant):
 r=root(f'chair_{variant}_root',x)
 add(box('chair_seat',(0.5,0.48,0.09),(x,0,0.43),FABRIC,.018,3),r)
 add(box('chair_back',(0.5,0.08,0.62),(x,0.22,0.73),FABRIC,.018,3,rot=(math.radians(-7),0,0)),r)
 add(cyl('chair_back_stem',.024,.34,(x,0.17,0.55),METAL,rot=(math.radians(-8),0,0),verts=16),r)
 add(box('chair_back_lower_bracket',(0.32,0.05,0.07),(x,0.14,0.48),METAL,.006),r)
 if variant!='missing_wheel':
  for sx in (-.29,.29):
   add(box('chair_arm',(0.05,0.36,0.05),(x+sx,0.02,0.58),DARK,.012,3),r)
   add(box('chair_arm_post',(0.04,0.04,0.18),(x+sx,0.11,0.49),METAL,.006),r)
 add(cyl('chair_post',.025,.32,(x,0,0.24),METAL,verts=20),r)
 for i in range(5):
  a=i*math.tau/5
  add(box('chair_spoke',(0.38,0.05,0.036),(x+math.cos(a)*.1,math.sin(a)*.1,0.08),METAL,.006,rot=(0,0,a)),r)
  if not(variant=='missing_wheel' and i==2): add(cyl('chair_caster',.032,.025,(x+math.cos(a)*.22,math.sin(a)*.22,0.035),DARK,rot=(math.pi/2,0,a),verts=16),r)
 if variant=='tipped': r.rotation_euler[1]=math.radians(72)
 return r

def build_crt(x):
 r=root('crt_root',x)
 add(box('crt_case',(0.58,0.60,0.50),(x,0,0.25),BEIGE,.007,2),r)
 add(box('crt_rear_tube',(0.44,0.28,0.36),(x,0.29,0.27),BEIGE,.012,2),r)
 add(box('crt_bezel',(0.47,0.036,0.38),(x,-0.295,0.27),DARK,.006,2),r)
 add(box('crt_screen',(0.38,0.012,0.29),(x,-0.309,0.275),SCREEN,.005,2),r)
 add(box('crt_control_strip',(0.40,0.024,0.05),(x,-0.31,0.135),BEIGE,.003),r)
 add(box('crt_neck',(0.32,0.16,0.10),(x,0.18,0.12),BEIGE,.012),r)
 for i in range(4): add(cyl('crt_button',.009,.006,(x-.07+i*.045,-.313,0.115),DARK,rot=(math.pi/2,0,0),verts=16),r)
 for i in range(8): add(box('crt_vent',(0.006,0.05,0.0015),(x-.11+i*.032,0.02,0.505),DARK,.001),r)
 return r

def build_keyboard(x):
 r=root('keyboard_root',x)
 add(box('keyboard_case',(0.48,0.17,0.028),(x,0,0.018),BEIGE,.008,2,rot=(math.radians(4),0,0)),r)
 for row in range(4):
  for col in range(12): add(box('key',(0.024,0.022,0.008),(x-.204+col*.037,-.062+row*.036,0.037+row*.001),DARK,.0015),r)
 return r

def build_filecab(x):
 r=root('filing_cabinet_root',x)
 add(box('cabinet_body',(0.56,0.68,1.3),(x,0,0.65),METAL,.012,2),r)
 for j,z in enumerate((0.32,0.68,1.04)):
  add(box('cabinet_drawer',(0.50,0.036,0.30),(x,-0.345,z),METAL,.006),r)
  add(box('drawer_handle',(0.09,0.012,0.012),(x,-0.361,z),DARK,.003),r)
 add(box('open_drawer',(0.50,0.48,0.26),(x,-0.48,0.68),METAL,.006),r)
 for i in range(5): add(box('drawer_file',(0.22,0.008,0.10),(x,-0.52+i*.035,0.755),PAPER,.001),r)
 return r

def build_small_props(x):
 for name,builder in [
  ('water_cooler_root',lambda r: [add(box('cooler_body',(0.18,0.18,0.48),(x,0,0.48),BEIGE,.018),r),add(cyl('cooler_bottle',.14,.34,(x,0,1.0),GLASS,verts=32),r),add(cyl('cooler_tap',.018,.035,(x,-.18,.62),DARK,rot=(math.pi/2,0,0),verts=16),r)]),
  ('ficus_root',lambda r: [add(cyl('ficus_pot',.15,.22,(x,0,.11),mat('pot_clay',(0.25,0.11,0.055),.8),verts=24),r)]+[add(cyl('ficus_stem',.012,.55,(x+(i-2)*.025,0,.45),mat('dead_stem',(0.14,0.09,0.035),.85),rot=(math.radians((i-2)*7),0,math.radians((i-2)*5)),verts=8),r) for i in range(5)]+[add(sphere('dead_leaf',.025,(x+math.sin(i)*.12,math.cos(i*2)*.1,.62+(i%4)*.06),GREEN,scale=(1,.35,.18),segments=10,rings=5),r) for i in range(18)]),
  ('corkboard_root',lambda r: [add(box('cork_frame',(0.48,0.018,0.32),(x,0,0.8),EDGE,.01),r),add(box('cork_face',(0.44,0.008,0.28),(x,-.012,0.8),CORK,.004),r)]+[add(box('pinned_note',(0.055,0.003,0.07),(x-.14+i*.09,-.019,0.75+(i%2)*.12),PAPER,.001,rot=(0,0,(i%3-1)*.08)),r) for i in range(5)]),
  ('clock_root',lambda r: [add(cyl('clock_case',.16,.025,(x,0,1.4),DARK,rot=(math.pi/2,0,0),verts=40),r),add(cyl('clock_face',.145,.008,(x,-.018,1.4),PAPER,rot=(math.pi/2,0,0),verts=40),r),add(box('clock_hand_hour',(0.012,0.004,0.07),(x,-.026,1.43),DARK,.001,rot=(0,0,math.radians(-50))),r),add(box('clock_hand_minute',(0.008,0.004,0.105),(x,-.027,1.45),DARK,.001,rot=(0,0,math.radians(18))),r)]),
  ('extinguisher_root',lambda r: [add(cyl('extinguisher_body',.065,.34,(x,0,.36),RED,verts=28),r),add(cyl('extinguisher_nozzle',.012,.16,(x+.06,0,.58),DARK,rot=(0,math.pi/2,0),verts=12),r),add(box('extinguisher_label',(0.045,0.003,0.1),(x,-.066,.38),PAPER,.001),r)]),
  ('wet_sign_root',lambda r: [add(box('wet_sign_a',(0.22,0.012,0.32),(x,0,.18),mat('wet_yellow',(0.75,0.57,0.04),.55),.008,rot=(math.radians(12),0,0)),r),add(box('wet_sign_b',(0.22,0.012,0.32),(x,.08,.18),mat('wet_yellow',(0.75,0.57,0.04),.55),.008,rot=(math.radians(-12),0,0)),r)]),
  ('power_strip_root',lambda r: [add(box('power_strip',(0.18,0.045,0.025),(x,0,.025),BEIGE,.008),r)]+[add(box('power_socket',(0.018,0.006,0.009),(x-.11+i*.055,-.047,.035),DARK,.001),r) for i in range(5)]+[add(curve('power_cable',[(x-.14,0,.03),(x-.24,.04,.02),(x-.35,-.06,.015)],.007,DARK),r)]),
  ('box_stack_root',lambda r: [add(box('cardboard_a',(0.25,0.22,0.18),(x,0,.18),mat('cardboard',(0.32,0.20,0.09),.86),.008),r),add(box('cardboard_b',(0.2,0.18,0.14),(x+.04,-.02,.44),mat('cardboard_dark',(0.24,0.14,0.06),.9),.006,rot=(0,0,.08)),r),add(box('tape_a',(0.025,0.222,0.002),(x,-0.001,.365),PAPER,.001),r)]),
  ('mug_root',lambda r: [add(cyl('mug_body',.045,.085,(x,0,.055),BEIGE,verts=28),r),add(torus('mug_handle',.033,.007,(x+.047,0,.065),BEIGE,rot=(math.pi/2,0,0),major_segments=24,minor_segments=8),r),add(cyl('mould_film',.039,.003,(x,0,.098),GREEN,verts=28),r)]),
 ]:
  rr=root(name,x); builder(rr); x+=1.0
 return x

x=0
x+=1.2; build_desk(x); x+=1.6
for v in ('upright','tipped','missing_wheel'): build_chair(x,v); x+=1.0
build_crt(x); x+=.9; build_keyboard(x); x+=.8; build_filecab(x); x+=1.0
build_small_props(x)
# loose curled printout and cable parts
r=root('printout_root',x)
for i in range(5): add(box('printout_sheet',(0.105,0.145,0.0007),(x+i*.015,i*.012,.006+i*.002),PAPER,.001,rot=(0,0,(i-2)*.06)),r)
r=root('cable_snake_root',x+.6)
add(curve('cable_snake',[(x+.6,0,.015),(x+.75,.1,.02),(x+.95,-.08,.015),(x+1.15,.02,.018)],.009,DARK),r)
export(HERE)
