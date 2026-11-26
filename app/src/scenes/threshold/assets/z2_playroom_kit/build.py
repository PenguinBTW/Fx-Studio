# THRESHOLD Z2 modular padded playroom kit. Real scale metres, deterministic procedural build.
import bpy, os, sys, math
sys.dont_write_bytecode=True
HERE=os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0,os.path.dirname(HERE))
from _bl import *
reset()
FOAM=mat('foam_vinyl_ivory',(0.82,0.79,0.68),.58)
RED=mat('vinyl_red',(0.65,0.035,0.025),.3)
YELLOW=mat('vinyl_yellow',(0.9,0.55,0.025),.28)
BLUE=mat('vinyl_blue',(0.025,0.18,0.65),.28)
GREEN=mat('vinyl_green',(0.025,0.48,0.12),.3)
DARK=mat('net_dark_blue',(0.012,0.035,0.12),.7)
METAL=mat('painted_frame_metal',(0.08,0.15,0.42),.34,metal=.25)
LIGHT=mat('skylight_diffuser',(0.8,0.9,1.0),.22,emit=(0.7,0.85,1.0),strength=.7)

def root(name,x):
 r=empty(name,(x,0,0)); r['fx_part']=name; return r
def add(o,r):
 o.location.x-=r.location.x; o.parent=r; return o

def padded_panel(x):
 r=root('padded_wall_panel_root',x)
 add(box('panel_core',(1.2,.12,1.1),(x,0,.55),FOAM,.045,3),r)
 add(box('panel_top_seam',(1.14,.018,.018),(x,-.065,1.04),BLUE,.004),r)
 add(box('panel_bottom_seam',(1.14,.018,.018),(x,-.065,.06),BLUE,.004),r)
 for sx in (-.54,.54): add(box('panel_side_seam',(.018,.018,.96),(x+sx,-.065,.55),BLUE,.003),r)
 for xx in (-.28,.28):
  for zz in (.32,.78): add(cyl('panel_vinyl_button',.028,.014,(x+xx,-.073,zz),YELLOW,rot=(math.pi/2,0,0),verts=16),r)
 return r

def climbing_frame(x):
 r=root('climbing_frame_module_root',x)
 for xx in (-.7,.7):
  for yy in (-.55,.55): add(cyl('frame_post',.055,2.25,(x+xx,yy,1.125),METAL,verts=20),r)
 add(box('frame_deck',(1.55,1.25,.16),(x,0,1.2),YELLOW,.035,3),r)
 for yy in (-.58,.58):
  add(cyl('frame_rail',.032,1.5,(x,yy,1.72),BLUE,rot=(0,math.pi/2,0),verts=16),r)
  for xx in (-.55,0,.55): add(cyl('frame_rail_post',.024,.52,(x+xx,yy,1.46),BLUE,verts=14),r)
 for i in range(5): add(cyl('frame_ladder_rung',.022,1.1,(x-.78,-.48+i*.24,.55+i*.18),RED,rot=(math.pi/2,0,0),verts=14),r)
 return r

def straight_slide(x):
 r=root('straight_slide_root',x)
 rot=(math.radians(-18),0,0)
 add(box('slide_bed',(.78,2.45,.10),(x,0,.82),YELLOW,.04,3,rot=rot),r)
 for sx in (-.43,.43): add(box('slide_side_rail',(.10,2.45,.22),(x+sx,0,.91),RED,.035,3,rot=rot),r)
 add(box('slide_top_lip',(.86,.18,.12),(x,-1.12,1.22),RED,.035,3),r)
 add(box('slide_exit_wear',(.62,.15,.012),(x,1.08,.43),FOAM,.01),r)
 return r

def tunnel_rib(x):
 r=root('tunnel_rib_root',x)
 # axis across Y so repeated rings can form a crawl tube along Z after scene rotation.
 add(torus('rib_outer',.43,.055,(x,0,0),YELLOW,major_segments=40,minor_segments=12),r)
 add(torus('rib_grout_inner',.405,.012,(x,0,0),DARK,major_segments=40,minor_segments=8),r)
 for a in range(8):
  aa=a*math.tau/8; add(box('rib_mould_seam',(.035,.018,.018),(x+math.cos(aa)*.43,math.sin(aa)*.43,0),DARK,.003),r)
 return r

def step_block(x):
 r=root('stepping_block_root',x)
 add(box('block_body',(.72,.72,.30),(x,0,.15),BLUE,.055,4),r)
 add(box('block_top_pad',(.62,.62,.035),(x,0,.315),YELLOW,.025,3),r)
 for sx in (-.28,.28): add(box('block_side_scuff',(.025,.42,.018),(x+sx,0,.18),FOAM,.004),r)
 return r

def skylight(x):
 r=root('skylight_frame_root',x)
 add(box('skylight_diffuser',(1.55,1.05,.035),(x,0,0),LIGHT,.025,3),r)
 for xx in (-.82,.82): add(box('skylight_frame_side',(.07,1.16,.08),(x+xx,0,0),METAL,.012),r)
 for yy in (-.57,.57): add(box('skylight_frame_end',(1.7,.07,.08),(x,yy,0),METAL,.012),r)
 for xx in (-.28,.28): add(box('skylight_mullion',(.035,1.08,.055),(x+xx,0,-.01),METAL,.006),r)
 return r

def shelf(x):
 r=root('shelf_module_root',x)
 for z in (0,.55,1.1): add(box('shelf_board',(2.8,.32,.065),(x,0,z),FOAM,.018,2),r)
 for xx in (-1.34,1.34): add(box('shelf_side',(.07,.34,1.18),(x+xx,0,.55),BLUE,.014),r)
 return r

def net_panel(x):
 r=root('net_panel_root',x)
 for i in range(7): add(cyl('net_vertical',.012,1.25,(x-.72+i*.24,0,.65),DARK,verts=8),r)
 for i in range(5): add(cyl('net_horizontal',.012,1.48,(x,0,.18+i*.24),DARK,rot=(0,math.pi/2,0),verts=8),r)
 for xx in (-.78,.78): add(cyl('net_border_vertical',.028,1.38,(x+xx,0,.68),RED,verts=12),r)
 for zz in (.02,1.34): add(cyl('net_border_horizontal',.028,1.62,(x,0,zz),RED,rot=(0,math.pi/2,0),verts=12),r)
 return r

builders=[padded_panel,climbing_frame,straight_slide,tunnel_rib,step_block,skylight,shelf,net_panel]
x=0
for b in builders:
  b(x); x+=3
export(HERE)
