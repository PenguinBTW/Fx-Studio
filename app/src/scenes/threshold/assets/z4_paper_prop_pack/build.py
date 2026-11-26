# THRESHOLD Z4 paper-library prop pack, deterministic Blender build.
import bpy,os,sys,math
sys.dont_write_bytecode=True
HERE=os.path.dirname(os.path.abspath(__file__));sys.path.insert(0,os.path.dirname(HERE))
from _bl import *
reset()
PAPER=mat('aged_ledger_paper',(.70,.64,.47),.88);PAPER2=mat('letter_paper pale',(.82,.77,.62),.9);EDGE=mat('paper_edge_dark',(.24,.18,.10),.9);WOOD=mat('dark_desk_wood',(.15,.065,.02),.65);BRASS=mat('aged_brass_prop',(.42,.25,.045),.32,metal=.55);INK=mat('black_ink',(.012,.009,.006),.9);GREEN=mat('bankers_lamp_green',(.02,.19,.065),.24,emit=(.01,.10,.025),strength=.3);RED=mat('red_string',(.45,.018,.012),.7);GLASS=mat('dim_glass',(.28,.38,.34),.12)
def root(n,x):r=empty(n,(x,0,0));r['fx_part']=n;return r
def add(o,r):o.location.x-=r.location.x;o.parent=r;return o

def ledger(x):
 r=root('open_ledger_root',x)
 add(box('ledger_cover',(.76,.52,.045),(x,0,.025),WOOD,.018,3),r)
 add(box('ledger_page_left',(.34,.46,.025),(x-.18,0,.062),PAPER,.012,3,rot=(0,0,.035)),r)
 add(box('ledger_page_right',(.34,.46,.025),(x+.18,0,.062),PAPER2,.012,3,rot=(0,0,-.035)),r)
 add(box('ledger_spine',(.055,.50,.065),(x,0,.07),EDGE,.01),r)
 for side in(-1,1):
  for i in range(8):add(box('ledger_ruled_line',(.25,.006,.003),(x+side*.18,-.17+i*.045,.079),INK,.0005),r)
 return r

def fountain_pen(x):
 r=root('fountain_pen_root',x)
 add(cyl('pen_barrel',.018,.28,(x,0,.02),INK,rot=(0,math.pi/2,0),verts=16),r)
 add(cyl('pen_cap_band',.019,.018,(x+.07,0,.02),BRASS,rot=(0,math.pi/2,0),verts=16),r)
 add(box('pen_nib',(.07,.025,.008),(x+.18,0,.02),BRASS,.003,2),r)
 add(box('pen_slit',(.035,.003,.002),(x+.19,0,.026),INK,.0005),r)
 return r

def lamp(x):
 r=root('bankers_lamp_root',x)
 add(cyl('lamp_base',.15,.045,(x,0,.025),BRASS,verts=28),r)
 add(cyl('lamp_stem',.025,.52,(x,0,.30),BRASS,verts=16),r)
 add(sphere('lamp_green_shade',.20,(x,0,.58),GREEN,scale=(1.35,.72,.55),segments=24),r)
 add(box('lamp_shade_rim',(.48,.16,.025),(x,0,.50),BRASS,.008),r)
 return r

def ink_bottle(x):
 r=root('ink_bottle_root',x)
 add(cyl('bottle_glass',.085,.15,(x,0,.075),GLASS,verts=24),r)
 add(cyl('bottle_ink',.072,.09,(x,0,.045),INK,verts=24),r)
 add(cyl('bottle_neck',.04,.055,(x,0,.17),GLASS,verts=20),r)
 add(cyl('bottle_cap',.048,.035,(x,0,.215),BRASS,verts=20),r)
 return r

def paper_moth(x):
 r=root('paper_moth_root',x)
 add(box('moth_body',(.018,.065,.018),(x,0,0),EDGE,.004),r)
 add(box('moth_wing_l',(.11,.065,.008),(x-.055,0,0),PAPER2,.006,rot=(0,0,-.28)),r)
 add(box('moth_wing_r',(.11,.065,.008),(x+.055,0,0),PAPER2,.006,rot=(0,0,.28)),r)
 for sx in(-.025,.025):add(cyl('moth_antenna',.002,.055,(x+sx,-.04,.025),INK,rot=(.7,0,sx*5),verts=6),r)
 return r

def letters_string(x):
 r=root('letters_string_root',x)
 for i in range(5):
  xx=x-.42+i*.21;zz=(i%2)*.04
  add(box('hanging_letter',(.16,.012,.22),(xx,0,zz-.22),PAPER2,.006,rot=(0,0,(i-2)*.05)),r)
  add(box('letter_ink_line',(.11,.004,.004),(xx,-.008,zz-.20),INK,.0005),r)
 add(cyl('string_line',.006,1.02,(x,0,0),RED,rot=(0,math.pi/2,0),verts=8),r)
 return r

def folded_phone(x):
 r=root('folded_paper_phone_root',x)
 add(box('phone_fold_left',(.22,.32,.025),(x-.09,0,.02),PAPER,.012,2,rot=(0,.0,.34)),r)
 add(box('phone_fold_right',(.22,.32,.025),(x+.09,0,.02),PAPER2,.012,2,rot=(0,0,-.34)),r)
 add(box('phone_receiver_fold',(.36,.09,.025),(x,0,.16),PAPER,.015,2),r)
 for i in range(9):add(box('phone_key',(.025,.018,.006),(x-.055+(i%3)*.055,-.065+math.floor(i/3)*.045,.045),INK,.001),r)
 return r

def drawer_unit(x):
 r=root('card_catalog_drawer_root',x)
 add(box('drawer_case',(.64,.42,.72),(x,0,.36),WOOD,.018,2),r)
 for row in range(3):
  for col in range(2):
   xx=x-.16+col*.32;zz=.18+row*.18
   add(box('catalog_drawer_face',(.27,.025,.14),(xx,-.225,zz),PAPER2,.008),r)
   add(box('drawer_label',(.12,.008,.045),(xx,-.242,zz+.018),PAPER,.002),r)
   add(cyl('drawer_pull',.018,.012,(xx,-.252,zz-.035),BRASS,rot=(math.pi/2,0,0),verts=12),r)
 return r

def globe(x):
 r=root('paper_globe_root',x)
 add(sphere('globe_sphere',.20,(x,0,.38),PAPER2,scale=(1,1,1),segments=28),r)
 add(torus('globe_meridian',.21,.012,(x,0,.38),BRASS,major_segments=32,minor_segments=8),r)
 add(cyl('globe_stem',.025,.22,(x,0,.13),BRASS,verts=14),r)
 add(cyl('globe_base',.12,.035,(x,0,.02),WOOD,verts=24),r)
 for i in range(5):add(box('globe_paper_seam',(.008,.004,.32),(x-.12+i*.06,-.195,.38),EDGE,.0005),r)
 return r

def glasses(x):
 r=root('reading_glasses_root',x)
 for sx in(-.075,.075):add(torus('glasses_lens',.065,.006,(x+sx,0,0),GLASS,major_segments=24,minor_segments=6),r)
 add(cyl('glasses_bridge',.006,.035,(x,0,0),BRASS,rot=(0,math.pi/2,0),verts=8),r)
 for sx in(-.15,.15):add(cyl('glasses_temple',.005,.16,(x+sx,.07,0),BRASS,rot=(math.pi/2,0,0),verts=8),r)
 return r

def scissors(x):
 r=root('scissors_root',x)
 for sx in(-.035,.035):add(torus('scissor_handle',.045,.009,(x+sx,0,0),BRASS,major_segments=20,minor_segments=7),r)
 add(box('scissor_blade_l',(.018,.20,.006),(x-.02,.15,0),METAL if (METAL:=BRASS) else BRASS,.002,rot=(0,0,-.18)),r)
 add(box('scissor_blade_r',(.018,.20,.006),(x+.02,.15,0),BRASS,.002,rot=(0,0,.18)),r)
 return r

def paper_clock(x):
 r=root('paper_clock_root',x)
 add(cyl('clock_paper_face',.22,.025,(x,0,0),PAPER2,rot=(math.pi/2,0,0),verts=32),r)
 add(cyl('clock_edge',.225,.018,(x,-.012,0),EDGE,rot=(math.pi/2,0,0),verts=32),r)
 for i in range(12):
  a=i*math.tau/12;add(box('clock_fold_tick',(.012,.008,.04),(x+math.sin(a)*.17,-.025+math.cos(a)*.17,0),INK,.001,rot=(0,0,-a)),r)
 return r

def scroll(x):
 r=root('tied_scroll_root',x)
 add(cyl('scroll_roll',.065,.48,(x,0,.065),PAPER2,rot=(0,math.pi/2,0),verts=24),r)
 add(torus('scroll_red_tie',.067,.008,(x,0,.065),RED,major_segments=24,minor_segments=8),r)
 add(box('scroll_loose_end',(.18,.015,.28),(x+.26,0,.02),PAPER,.005),r)
 return r


def library_chair(x):
 r=root('library_chair_root',x)
 add(box('chair_seat',(.48,.45,.07),(x,0,.47),WOOD,.018,3),r)
 add(box('chair_back',(.48,.07,.72),(x,.20,.87),WOOD,.018,3,rot=(.08,0,0)),r)
 for sx in(-.19,.19):
  for sy in(-.16,.16):add(box('chair_leg',(.055,.055,.47),(x+sx,sy,.235),WOOD,.008),r)
 for i in range(3):add(box('chair_back_slat',(.38,.035,.045),(x,.155,.66+i*.15),PAPER2,.006),r)
 return r

def paper_vine(x):
 r=root('paper_vine_root',x)
 for i in range(9):
  zz=i*.16;xx=x+math.sin(i*.9)*.06
  add(cyl('vine_stem',.008,.20,(xx,0,zz),EDGE,rot=(.35,0,.2*math.sin(i)),verts=7),r)
  if i%2==0:add(box('vine_paper_leaf',(.12,.015,.06),(xx+.045,0,zz+.05),PAPER2,.012,rot=(0,0,.5)),r)
 return r

builders=[ledger,fountain_pen,lamp,ink_bottle,paper_moth,letters_string,folded_phone,drawer_unit,globe,glasses,scissors,paper_clock,scroll,library_chair,paper_vine];x=0
for b in builders:b(x);x+=2.4
export(HERE)
