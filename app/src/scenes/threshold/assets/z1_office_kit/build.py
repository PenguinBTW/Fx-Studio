# THRESHOLD Z1 modular office architecture kit. Real scale metres, deterministic.
import bpy, os, sys, math, random
sys.dont_write_bytecode=True
HERE=os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0,os.path.dirname(HERE))
from _bl import *
random.seed(1102)
reset()
FABRIC=mat('cubicle_fabric_mustard',(0.48,0.40,0.25),.92)
FABRIC2=mat('cubicle_fabric_faded',(0.39,0.35,0.24),.94)
TRIM=mat('cubicle_trim_metal',(0.20,0.21,0.20),.48,metal=.55)
TILE=mat('ceiling_tile_fissured',(0.68,0.65,0.55),.82)
TILESTAIN=mat('tile_water_stain',(0.25,0.15,0.055),.9)
GRID=mat('ceiling_grid_oxidized',(0.18,0.18,0.16),.55,metal=.45)
LIGHT=mat('fluor_diffuser',(0.55,0.65,0.52),.24,emit=(0.55,0.9,0.55),strength=1.5)
DOOR=mat('firedoor_paint',(0.20,0.24,0.20),.58,metal=.15)
RED=mat('exit_red',(0.5,0.01,0.008),.3,emit=(1,0.02,0.01),strength=2.0)
PAPER=mat('aged_label',(0.7,0.66,0.52),.85)

def root(name,x):
 r=empty(name,(x,0,0)); r['fx_part']=name; return r
def add(o,r,part=None):
 parent(o,r)
 if part:o['fx_part']=part
 return o

def cubicle_panel(name,x,w=1.8,h=1.42):
 r=root(name,x)
 # core thickness, inset fabric faces, perimeter trim and scuffed base
 add(box('panel_core',(w/2,.045,h/2),(x,0,h/2),FABRIC,.012,2),r)
 add(box('panel_face_a',(w/2-.035,.006,h/2-.07),(x,-.049,h/2),FABRIC2,.006),r)
 add(box('panel_face_b',(w/2-.035,.006,h/2-.07),(x,.049,h/2),FABRIC2,.006),r)
 add(box('panel_toprail',(w/2+.025,.065,.028),(x,0,h+.025),TRIM,.007),r)
 add(box('panel_bottomrail',(w/2+.025,.06,.035),(x,0,.055),TRIM,.005),r)
 for sx in (-w/2,w/2): add(box('panel_endcap',(.025,.065,h/2),(x+sx,0,h/2),TRIM,.006),r)
 # stitched horizontal seam and modular vertical seams, both faces
 for zz in (.48,.92):
  add(box('fabric_hseam',(w/2-.05,.004,.006),(x,-.057,zz),TRIM,.001),r)
  add(box('fabric_hseam_b',(w/2-.05,.004,.006),(x,.057,zz),TRIM,.001),r)
 for j in range(max(2,int(w/.53))):
  xx=x-w/2+.28+j*.53
  for yy in (-.057,.057): add(box('fabric_vseam',(.004,.004,h/2-.12),(xx,yy,h/2),TRIM,.0008),r)
 # pinboard inset variant built into upper half
 if w>1.2:
  add(box('panel_pinboard',(w*.18,.008,h*.14),(x-w*.16,-.061,h*.67),mat('pinboard_cork',(0.34,0.18,0.075),.9),.004),r)
  for i in range(3): add(box('pin_note',(.028,.002,.036),(x-w*.16+(i-1)*.07,-.065,h*.65+(i%2)*.06),PAPER,.0006,rot=(0,0,(i-1)*.08)),r)
 return r

def ceiling_tile(name,x,kind):
 r=root(name,x)
 sag=-.035 if kind=='sagging' else 0
 tile=add(box('tile',(.295,.295,.018),(x,0,sag),TILE,.012,2),r)
 if kind=='sagging': tile.rotation_euler[1]=math.radians(2.5)
 # fissures/pits
 for i in range(9):
  xx=x+random.uniform(-.22,.22); yy=random.uniform(-.22,.22)
  add(box('tile_fissure',(random.uniform(.025,.08),.0015,.001),(xx,yy,sag-.019),mat('tile_dark_pit',(0.12,0.105,0.08),.95),.0004,rot=(0,0,random.uniform(-1.2,1.2))),r)
 if kind=='stained':
  for i,r0 in enumerate((.19,.14,.09)): add(torus('water_ring',r0,.004,(x+0.025*i,-.015*i,sag-.021),TILESTAIN,major_segments=36,minor_segments=6),r)
 if kind=='missing':
  tile['fx_part']='missing_tile_reference'; tile.scale=(.2,.2,.2)
 return r

def grid_module(x):
 r=root('ceiling_grid_root',x)
 for xx in (-.3,0,.3): add(box('grid_runner_x',(.305,.008,.012),(x+xx,0,0),GRID,.001),r)
 for yy in (-.3,0,.3): add(box('grid_runner_y',(.008,.305,.012),(x,yy,0),GRID,.001),r)
 return r

def troffer(x):
 r=root('troffer_root',x)
 add(box('troffer_housing',(.62,.20,.035),(x,0,0),TRIM,.01,2),r)
 add(box('troffer_diffuser',(.56,.16,.008),(x,0,-.04),LIGHT,.012,4),r)
 for yy in (-.065,.065): add(cyl('fluor_tube',.012,.52,(x,yy,-.025),LIGHT,rot=(0,math.pi/2,0),verts=20),r)
 for xx in (-.56,.56): add(box('troffer_endcap',(.012,.18,.03),(x+xx,0,-.01),TRIM,.004),r)
 return r

def doorframe(x):
 r=root('fire_door_root',x)
 add(box('door_leaf',(.48,.035,1.05),(x,0,1.05),DOOR,.012,2),r)
 add(box('door_pushbar',(.38,.025,.025),(x,-.055,1.02),TRIM,.008),r)
 for sx in (-.52,.52): add(box('door_jamb',(.045,.08,1.1),(x+sx,0,1.1),TRIM,.008),r)
 add(box('door_header',(.56,.08,.045),(x,0,2.18),TRIM,.008),r)
 add(box('exit_sign',(.19,.035,.07),(x,-.02,2.31),RED,.008),r)
 add(box('exit_text_bars',(.12,.006,.012),(x,-.058,2.31),PAPER,.001),r)
 return r

x=0
cubicle_panel('cubicle_panel_180_root',x,1.8); x+=2.2
cubicle_panel('cubicle_panel_120_root',x,1.2); x+=1.6
cubicle_panel('cubicle_panel_090_root',x,.9,1.35); x+=1.3
for kind in ('plain','stained','sagging','missing'): ceiling_tile('ceiling_tile_'+kind+'_root',x,kind); x+=.8
grid_module(x); x+=.9; troffer(x); x+=1.0; doorframe(x)
# skirting and pillar modules
r=root('skirting_root',x+1.1); add(box('skirting_board',(.9,.025,.05),(x+1.1,0,.05),TRIM,.004),r)
r=root('pillar_root',x+2.0)
add(box('pillar_core',(.22,.22,1.35),(x+2,0,1.35),FABRIC2,.015),r)
for yy in (-.225,.225): add(box('pillar_trim',(.23,.012,1.35),(x+2,yy,1.35),TRIM,.004),r)
export(HERE)
