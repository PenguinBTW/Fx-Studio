# THRESHOLD Z4 modular paper-library architecture kit, metres.
import bpy,os,sys,math
sys.dont_write_bytecode=True
HERE=os.path.dirname(os.path.abspath(__file__));sys.path.insert(0,os.path.dirname(HERE))
from _bl import *
reset()
PAPER=mat('aged_page_ivory',(.78,.71,.55),.9);PAPER2=mat('compressed_page_edge',(.66,.58,.42),.92);EDGE=mat('dark_page_edge',(.34,.25,.14),.9);WOOD=mat('dark_library_wood',(.16,.075,.025),.66);BRASS=mat('aged_brass',(.45,.28,.055),.32,metal=.55);INK=mat('ink_dark',(.025,.018,.012),.92);RED=mat('bookmark_red',(.42,.025,.018),.7);GREEN=mat('lamp_green_glass',(.025,.22,.08),.28,emit=(.01,.12,.03),strength=.25)
def root(n,x):r=empty(n,(x,0,0));r['fx_part']=n;return r
def add(o,r):o.location.x-=r.location.x;o.parent=r;return o

def join_local(name,objects,r,x):
 ob=join_named(name,objects)
 ob.location.x-=x;ob.parent=r
 return ob

def torn_sheet(name,loc,width,height,material,rot=(0,0,0)):
 x,y,z=loc
 # irregular deckled sheet silhouette: six uneven vertices with a torn upper edge.
 verts=[(-.5,0,0),(.5,0,.02),(.52,0,height*.64),(.28,0,height*.92),(.05,0,height*.78),(-.22,0,height),(-.5,0,height*.72)]
 verts=[(a*width,0,c*height) for a,y,c in verts]
 faces=[(0,1,2,3,4,5,6)]
 mesh=bpy.data.meshes.new(name+'_mesh');mesh.from_pydata(verts,[],faces);mesh.update()
 o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o);o.location=(x,y,z);o.rotation_euler=rot
 sol=o.modifiers.new('paper_thickness','SOLIDIFY');sol.thickness=.004
 bevel=o.modifiers.new('soft_torn_edge','BEVEL');bevel.width=.002;bevel.segments=1
 assign(o,material)
 return o

def stack_bay(x):
 r=root('paper_stack_bay_root',x)
 add(box('stack_back',(.66,.075,5.35),(x,.055,2.68),PAPER2,.012,2),r)
 slabs=[];lines=[];inserts=[]
 # Thin compressed sheaves, not wooden beams: many shallow lifts with ragged widths,
 # uneven offsets and fine exposed page-edge striations.
 for layer in range(46):
  z=.08+layer*.108+((layer*7)%5)*.004
  w=.48+((layer*5)%9)*.018+((layer*11)%5)*.010
  d=.17+((layer*3)%7)*.012
  h=.052+((layer*4)%6)*.008
  xx=x+(((layer*11)%13)-6)*.006
  yy=-.005+(((layer*13)%9)-4)*.005
  rotz=(((layer*17)%11)-5)*.009
  slabs.append(box('compressed_thin_sheave',(w,d,h),(xx,yy,z),PAPER if layer%3 else PAPER2,.0025,1,rot=(0,0,rotz)))
  # one dark compressed cut line and a lighter sheet line make each lift visibly laminated
  lines.append(box('compressed_page_edge_line',(w*.94,.008,.006),(xx,yy-d*.54,z+h*.28),EDGE,.0005,1,rot=(0,0,rotz)))
  if layer%2==0:
   lines.append(box('individual_sheet_edge',(w*(.78+((layer*3)%5)*.035),.006,.004),(xx+(((layer*7)%7)-3)*.008,yy-d*.55,z-h*.18),PAPER,.0004,1,rot=(0,0,rotz)))
  if layer%4==1:
   sx=x-.24+((layer*5)%6)*.09
   inserts.append(box('protruding_loose_signature',(.16,.020,.13),(sx,-.145,z+.025),PAPER,.0015,1,rot=(.04,0,(((layer*3)%7)-3)*.045)))
  if layer%5==2:
   sx=x-.25+((layer*7)%8)*.065
   inserts.append(box('leaning_card_insert',(.038,.13,.27),(sx,-.025,z+.10),PAPER2,.002,1,rot=(0,.07,(((layer*5)%7)-3)*.075)))
 join_local('compressed_thin_page_sheaves',slabs,r,x)
 join_local('dense_compressed_page_edges',lines,r,x)
 join_local('slipped_signatures_and_cards',inserts,r,x)
 # torn sheets crown the bay so the skyline reads as paper instead of machined timber.
 tops=[]
 for i in range(5):
  xx=x-.25+i*.12+(((i*7)%5)-2)*.008
  hh=.38+((i*11)%5)*.085
  tops.append(torn_sheet('torn_top_sheet',(xx,-.035+((i*3)%5)*.012,4.86+((i*5)%4)*.055),.11+((i*3)%4)*.025,hh,PAPER if i%2 else PAPER2,rot=(0,(((i*5)%7)-3)*.035,(((i*7)%9)-4)*.04)))
 join_local('torn_sheet_top_profile',tops,r,x)
 add(box('bay_index_label',(.24,.018,.12),(x,-.16,2.20),PAPER,.004),r)
 add(box('bay_red_bookmark',(.035,.012,.46),(x+.19,-.17,3.05),RED,.003),r)
 return r

def reading_desk(x):
 r=root('reading_desk_root',x)
 add(box('desk_top',(1.75,.78,.10),(x,0,.76),WOOD,.025,3),r)
 add(box('desk_modesty',(1.48,.055,.46),(x,.28,.47),WOOD,.012),r)
 for sx in(-.73,.73):
  add(box('desk_leg',(.10,.62,.72),(x+sx,0,.37),WOOD,.012),r)
  add(box('desk_foot',(.24,.70,.055),(x+sx,0,.028),WOOD,.008),r)
 for i in range(5):add(box('desk_edge_wear',(.12+i*.025,.008,.012),(x-.65+i*.28,-.39,.79),PAPER2,.002),r)
 return r

def spiral_stair(x):
 r=root('spiral_paper_stair_root',x)
 add(cyl('stair_center_post',.055,2.4,(x,0,1.2),WOOD,verts=20),r)
 for i in range(10):
  a=i*.48;zz=.18+i*.20
  add(box('folded_paper_step',(.72,.28,.045),(x+math.cos(a)*.34,math.sin(a)*.34,zz),PAPER if i%2 else PAPER2,.012,2,rot=(0,0,a)),r)
 return r

def lantern(x):
 r=root('hanging_lantern_root',x)
 add(cyl('lantern_cord',.008,.85,(x,0,1.15),INK,verts=8),r)
 add(cyl('lantern_cap',.16,.08,(x,0,.72),BRASS,verts=24),r)
 add(sphere('lantern_paper_globe',.22,(x,0,.48),PAPER,scale=(1,1,1.2),segments=24),r)
 add(cyl('lantern_base',.13,.05,(x,0,.24),BRASS,verts=24),r)
 for a in range(6):
  aa=a*math.tau/6;add(box('lantern_paper_rib',(.012,.012,.36),(x+math.cos(aa)*.20,math.sin(aa)*.20,.48),EDGE,.002),r)
 return r

def hinged_wall(x):
 r=root('hinged_stack_wall_root',x)
 add(box('hinged_panel',(.72,.16,3.1),(x,0,1.55),PAPER2,.018,2),r)
 for z in(.4,1.1,1.8,2.5):
  add(cyl('wall_hinge_knuckle',.045,.22,(x-.39,.0,z),BRASS,verts=16),r)
  add(box('wall_layer_band',(.68,.018,.018),(x,-.085,z+.18),EDGE,.001),r)
 add(box('wall_cracked_edge',(.025,.025,2.8),(x+.35,-.09,1.48),PAPER,.003),r)
 return r

def ladder(x):
 r=root('library_ladder_root',x)
 for sx in(-.28,.28):add(cyl('ladder_side',.028,3.8,(x+sx,0,1.9),WOOD,rot=(.12,0,0),verts=14),r)
 for i in range(9):add(cyl('ladder_rung',.020,.56,(x,0,.34+i*.38),WOOD,rot=(0,math.pi/2,0),verts=12),r)
 add(box('ladder_top_hook',(.68,.08,.08),(x,0,3.82),BRASS,.012),r)
 return r

def architrave(x):
 r=root('paper_canyon_cap_root',x)
 add(box('cap_compressed_pages',(1.1,.65,.22),(x,0,.11),PAPER2,.018,2),r)
 for i in range(7):add(box('cap_page_line',(1.04,.012,.008),(x,-.33+i*.105,.23),EDGE,.001),r)
 return r
builders=[stack_bay,reading_desk,spiral_stair,lantern,hinged_wall,ladder,architrave];x=0
for b in builders:b(x);x+=3.4
export(HERE)
