# THRESHOLD Z3 modular tiled pool-hall kit, metres.
import bpy,os,sys,math
sys.dont_write_bytecode=True
HERE=os.path.dirname(os.path.abspath(__file__));sys.path.insert(0,os.path.dirname(HERE))
from _bl import *
reset()
TILE=mat('pool_tile_ivory',(.62,.72,.68),.32);GROUT=mat('pool_grout_dark',(.08,.14,.14),.82);BLUE=mat('waterline_tile_blue',(.03,.25,.48),.28);METAL=mat('wet_galvanized_metal',(.32,.38,.38),.3,metal=.65);LIGHT=mat('pool_skylight',(.65,.9,.95),.2,emit=(.5,.8,.9),strength=.6)
def root(n,x):r=empty(n,(x,0,0));r['fx_part']=n;return r
def add(o,r):o.location.x-=r.location.x;o.parent=r;return o
def tile_panel(x):
 r=root('tiled_wall_panel_root',x);add(box('tile_panel_core',(1.8,.10,1.8),(x,0,.9),TILE,.018,2),r)
 for i in range(7):add(box('tile_vertical_grout',(.012,.008,1.72),(x-.78+i*.26,-.055,.9),GROUT,.001),r)
 for i in range(7):add(box('tile_horizontal_grout',(1.72,.008,.012),(x,-.055,.12+i*.26),GROUT,.001),r)
 add(box('waterline_mosaic',(1.78,.018,.12),(x,-.061,1.28),BLUE,.004),r)
 return r
def pillar(x):
 r=root('tiled_pillar_root',x);add(box('pillar_core',(.44,.44,2.8),(x,0,1.4),TILE,.025,3),r)
 for z in (.25,.55,.85,1.15,1.45,1.75,2.05,2.35,2.65):add(box('pillar_grout_band',(.46,.012,.014),(x,-.225,z),GROUT,.001),r)
 add(box('pillar_waterline',(.47,.018,.12),(x,-.226,1.18),BLUE,.003),r)
 return r
def arch(x):
 r=root('pool_arch_module_root',x)
 for sx in(-1.4,1.4):add(box('arch_jamb',(.34,.42,2.1),(x+sx,0,1.05),TILE,.025,3),r)
 add(box('arch_header',(3.15,.42,.38),(x,0,2.28),TILE,.035,3),r)
 for i in range(9):add(box('arch_tile_joint',(.018,.43,.30),(x-1.25+i*.31,-.01,2.28),GROUT,.001),r)
 return r
def steps(x):
 r=root('pool_steps_root',x)
 for i in range(4):add(box('pool_step',(1.4-i*.12,.34,.16),(x,i*.28,.08+i*.16),TILE,.018,2),r)
 return r
def ladder(x):
 r=root('pool_ladder_root',x)
 for sx in(-.24,.24):
  add(cyl('ladder_rail',.025,1.35,(x+sx,0,.68),METAL,verts=16),r)
  add(cyl('ladder_curve',.025,.38,(x+sx,0,1.34),METAL,rot=(math.pi/2,0,0),verts=16),r)
 for i in range(4):add(cyl('ladder_rung',.022,.48,(x,0,.28+i*.24),METAL,rot=(0,math.pi/2,0),verts=14),r)
 return r
def skylight(x):
 r=root('pool_skylight_root',x);add(box('skylight_diffuser',(1.6,1.1,.035),(x,0,0),LIGHT,.025,3),r)
 for xx in(-.84,.84):add(box('skylight_frame',(.06,1.2,.07),(x+xx,0,0),METAL,.01),r)
 for yy in(-.59,.59):add(box('skylight_end',(1.74,.06,.07),(x,yy,0),METAL,.01),r)
 return r
builders=[tile_panel,pillar,arch,steps,ladder,skylight];x=0
for b in builders:b(x);x+=3.2
export(HERE)
