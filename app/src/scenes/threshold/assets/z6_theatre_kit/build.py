# THRESHOLD Z6 felt theatre kit: puppets, recap miniatures, seat module and backstage hardware.
import bpy, os, sys, math, random
sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
from _bl import *

reset()
R = random.Random(6142)

FELT_RED = mat('TheatreFeltRed', (0.23, 0.018, 0.028), 0.97)
FELT_DARK = mat('TheatreFeltDark', (0.075, 0.018, 0.022), 0.98)
FELT_BEIGE = mat('PuppetFeltBeige', (0.68, 0.56, 0.39), 0.97)
FELT_BROWN = mat('PuppetFeltBrown', (0.25, 0.10, 0.055), 0.98)
FELT_BLACK = mat('PuppetFeltBlack', (0.018, 0.015, 0.014), 0.98)
FELT_BLUE = mat('PuppetFeltBlue', (0.035, 0.17, 0.42), 0.96)
FELT_YELLOW = mat('PuppetFeltYellow', (0.72, 0.46, 0.045), 0.95)
FELT_AQUA = mat('PuppetFeltAqua', (0.18, 0.52, 0.54), 0.94)
PAPER = mat('TheatrePaper', (0.74, 0.63, 0.43), 0.9)
WOOD = mat('TheatreWood', (0.22, 0.09, 0.04), 0.72)
GOLD = mat('StitchedGold', (0.75, 0.46, 0.10), 0.62, metal=0.12)
THREAD = mat('DarkThread', (0.018, 0.012, 0.01), 0.9)
BUTTON = mat('ButtonBlack', (0.008, 0.006, 0.005), 0.3)
WIRE = mat('ArmatureWire', (0.22, 0.24, 0.25), 0.28, metal=0.8)
GLOW = mat('TinyFlashlightGlow', (1.0, 0.76, 0.34), 0.35, emit=(1.0, 0.54, 0.16), strength=3.8)

root = empty('z6_theatre_kit_root')
root['fx_part'] = 'root'
seen = set()
def group(name, part, loc=(0,0,0), par=None):
    ob = empty(name, loc)
    parent(ob, par or root)
    if part not in seen:
        ob['fx_part'] = part
        seen.add(part)
    return ob

def add(o, par, part=None):
    o.parent = par
    if part and part not in seen:
        o['fx_part'] = part
        seen.add(part)
    return o

def stitch(name, pts, par, width=0.004):
    return add(curve(name, pts, width, THREAD), par)

def seam_rect(name, w, h, z, par, x=0, y=0):
    pts=[(-w/2+x,y,-h/2+z),(w/2+x,y,-h/2+z),(w/2+x,y,h/2+z),(-w/2+x,y,h/2+z)]
    return stitch(name, pts, par)

def button_eye(name, loc, par):
    eye=add(cyl(name,0.018,0.008,loc,BUTTON,rot=(math.radians(90),0,0),verts=20),par,'button_eyes')
    for a in (-35,35):
        add(box(name+'_thread'+str(a),(0.018,0.002,0.002),(loc[0],loc[1]-0.006,loc[2]),THREAD,rot=(0,math.radians(a),0)),par)
    return eye

def make_flashlight_puppet():
    g=group('flashlight_puppet_root','flashlight_puppet',(2,0,0))
    add(sphere('flash_puppet_torso',0.16,(0,0,0.48),FELT_BEIGE,scale=(0.75,0.45,1.25),segments=28,rings=14),g,'torso')
    add(sphere('flash_puppet_head',0.13,(0,0.01,0.84),FELT_BEIGE,scale=(0.88,0.78,1.02),segments=32,rings=16),g,'head')
    # Faceless: no facial features, only a vertical seam.
    stitch('faceless_head_seam',[(0,-0.095,0.75),(0,-0.105,0.84),(0,-0.09,0.93)],g,0.003)
    for side in (-1,1):
        add(cyl(f'flash_arm_{side}',0.035,0.25,(side*0.15,-0.005,0.52),FELT_BEIGE,rot=(0,math.radians(90),side*0.35),verts=16,bev=0.008),g,'arms')
        add(cyl(f'flash_leg_{side}',0.04,0.29,(side*0.065,0,0.17),FELT_BEIGE,rot=(0,0,side*0.12),verts=16,bev=0.008),g,'legs')
        stitch(f'flash_arm_stitch_{side}',[(side*0.09,-0.05,0.57),(side*0.22,-0.04,0.49)],g,0.0025)
    torch=add(cyl('tiny_flashlight',0.035,0.18,(0.18,-0.07,0.48),WIRE,rot=(math.radians(90),0,0),verts=20,bev=0.005),g,'flashlight')
    add(cyl('tiny_flashlight_lens',0.032,0.012,(0.18,-0.17,0.48),GLOW,rot=(math.radians(90),0,0),verts=20),g,'flashlight_lens')
    seam_rect('torso_blanket_stitch',0.19,0.32,-0.1,g)
    return g

def make_tenant_puppet():
    g=group('tenant_puppet_root','tenant_puppet',(4.2,0,0))
    add(sphere('tenant_puppet_torso',0.20,(0,0,0.55),FELT_BLACK,scale=(0.82,0.48,1.7),segments=32,rings=16),g,'torso')
    add(sphere('tenant_puppet_head',0.095,(0,0.01,1.10),FELT_BEIGE,scale=(0.8,0.72,1.15),segments=28,rings=14),g,'head')
    add(box('tenant_face_slit',(0.025,0.008,0.10),(0,-0.075,1.10),FELT_BLACK),g,'face_slit')
    for side in (-1,1):
        # arms nearly reach the floor, deliberately too long
        add(cyl(f'tenant_long_arm_{side}',0.032,0.78,(side*0.24,0,0.48),FELT_BLACK,rot=(0,math.radians(90),side*0.1),verts=14,bev=0.006),g,'long_arms')
        add(cyl(f'tenant_leg_{side}',0.04,0.40,(side*0.08,0,0.17),FELT_BLACK,rot=(0,0,side*0.06),verts=14,bev=0.006),g,'legs')
        for j in range(3):
            add(box(f'tenant_patch_{side}_{j}',(0.055,0.009,0.08),(side*(0.08+j*0.035),-0.105,0.50+j*0.18),[FELT_RED,FELT_AQUA,PAPER][j],rot=(0.2*j,0.1*side,0.2*side)),g,'patches')
    for i in range(5):
        stitch(f'tenant_side_stitch_{i}',[(-0.12,-0.105,0.35+i*0.12),(0.12,-0.105,0.38+i*0.12)],g,0.0025)
    return g

def make_seat():
    g=group('theatre_seat_root','seat_module',(0,0,0))
    add(box('seat_cushion',(0.62,0.50,0.16),(0,0,0.48),FELT_RED,bev=0.09,seg=5),g,'cushion')
    add(box('seat_back',(0.62,0.15,0.72),(0,0.22,0.88),FELT_RED,bev=0.075,seg=5,rot=(math.radians(-7),0,0)),g,'backrest')
    # inset front/back panels and darker piping make the seat read upholstered rather than salmon blocks
    add(box('seat_front_inset',(0.52,0.025,0.10),(0,-0.255,0.48),FELT_DARK,bev=0.025,seg=3),g,'inset')
    add(box('seat_back_inset',(0.51,0.018,0.55),(0,0.135,0.88),FELT_DARK,bev=0.025,seg=3,rot=(math.radians(-7),0,0)),g,'inset')
    for side in (-1,1):
        add(box(f'seat_arm_{side}',(0.09,0.56,0.15),(side*0.36,-0.01,0.66),WOOD,bev=0.025,seg=3),g,'armrest')
        add(box(f'seat_arm_top_{side}',(0.11,0.58,0.055),(side*0.36,-0.01,0.77),WOOD,bev=0.018,seg=3),g,'armrest')
    for sx in (-1, 1):
        for sz in (-1, 1):
            add(cyl(f'seat_leg_{sx}_{sz}',0.025,0.42,(sx*0.24,sz*0.17,0.19),WIRE,verts=12,bev=0.004),g,'legs')
    add(box('seat_floor_rail',(0.56,0.32,0.035),(0,0,0.035),WIRE,bev=0.008),g,'legs')
    # vertical upholstered channels and thick dark piping remain readable in a close auditorium shot.
    for ix in (-0.21, -0.07, 0.07, 0.21):
        stitch(f'back_channel_{ix}',[(ix,-0.075,0.62),(ix,-0.105,1.17)],g,0.005)
    stitch('back_top_piping',[(-0.27,-0.105,1.18),(0.27,-0.105,1.18)],g,0.007)
    stitch('cushion_front_piping',[(-0.27,-0.265,0.55),(0.27,-0.265,0.55)],g,0.007)
    for sx in (-1,1):
        add(sphere(f'armrest_bolt_{sx}',0.018,(sx*0.36,-0.25,0.805),GOLD,scale=(1,0.4,1),segments=14,rings=7),g,'armrest_bolts')
    # stitched perimeter and tuft dimples
    seam_rect('seat_cushion_stitch',0.53,0.39,0.0,g,y=-0.255)
    for ix in (-0.16,0,0.16):
        for iz in (0.72,0.91,1.1):
            add(sphere('seat_tuft',0.014,(ix,0.118,iz),FELT_DARK,scale=(1,0.3,1),segments=14,rings=7),g,'tufts')
    return g

def make_office_recap():
    g=group('office_recap_root','office_recap',(7,0,0))
    add(box('office_backdrop',(1.5,0.08,1.0),(0,0.18,0.78),FELT_BEIGE,bev=0.02),g)
    for x in (-0.45,0.45): add(box('office_partition',(0.08,0.34,0.62),(x,0,0.54),PAPER,bev=0.015),g)
    add(box('office_desk',(0.9,0.48,0.12),(0,-0.05,0.38),WOOD,bev=0.025),g)
    add(box('office_phone',(0.18,0.14,0.07),(0.22,-0.21,0.48),FELT_BEIGE,bev=0.018),g,'phone')
    # tiny puppet is a simplified clone language rather than a reusable nested asset
    add(sphere('office_puppet_head',0.09,(-0.2,-0.1,0.76),FELT_BEIGE,scale=(0.9,0.75,1.05),segments=24,rings=12),g,'puppet')
    add(box('office_puppet_body',(0.18,0.10,0.28),(-0.2,-0.08,0.53),FELT_BEIGE,bev=0.025),g,'puppet')
    add(cyl('office_tiny_torch',0.018,0.10,(0.02,-0.22,0.56),GLOW,rot=(math.radians(90),0,0),verts=14),g,'flashlight')
    return g

def make_ballpit_recap():
    g=group('ballpit_recap_root','ballpit_recap',(10,0,0))
    add(box('pit_box',(1.35,0.78,0.36),(0,0,0.34),FELT_BLUE,bev=0.05),g)
    for i in range(18):
        add(sphere(f'pit_ball_{i}',0.075,(-0.52+(i%6)*0.21,-0.22+(i%3)*0.18,0.56+(i//6)*0.08),[FELT_RED,FELT_YELLOW,FELT_BLUE][i%3],segments=18,rings=9),g)
    add(sphere('pit_swimmer_head',0.10,(0.18,-0.05,0.88),FELT_RED,scale=(0.9,0.8,1.0),segments=24,rings=12),g,'swimmer')
    add(box('pit_swimmer_body',(0.24,0.10,0.22),(0.18,-0.02,0.68),FELT_RED,bev=0.035),g,'swimmer')
    return g

def make_pool_recap():
    g=group('pool_recap_root','pool_recap',(13,0,0))
    add(box('pool_water',(1.55,0.82,0.08),(0,0,0.42),FELT_AQUA,bev=0.025),g)
    add(box('pool_tile_wall',(1.55,0.08,0.82),(0,0.38,0.82),PAPER,bev=0.02),g)
    for x in [-0.6,-0.3,0,0.3,0.6]: stitch('pool_grout_v',[(x,0.33,0.46),(x,0.33,1.18)],g,0.003)
    add(sphere('mirrorling_head',0.095,(0.28,-0.08,0.82),FELT_BLACK,scale=(0.85,0.7,1.1),segments=24,rings=12),g,'mirrorling')
    add(box('mirrorling_body',(0.17,0.09,0.38),(0.28,-0.03,0.57),FELT_BLACK,bev=0.03),g,'mirrorling')
    return g

def make_book_recap():
    g=group('book_recap_root','book_recap',(16,0,0))
    add(box('book_left_page',(0.75,0.08,1.05),(-0.34,0,0.78),PAPER,bev=0.018,rot=(0,math.radians(-18),0)),g,'pages')
    add(box('book_right_page',(0.75,0.08,1.05),(0.34,0,0.78),PAPER,bev=0.018,rot=(0,math.radians(18),0)),g,'pages')
    for side in (-1,1):
        for i in range(5): stitch('book_line',[(side*0.12,-0.05,0.43+i*0.12),(side*0.52,-0.05,0.47+i*0.12)],g,0.002)
    add(sphere('archivist_head',0.10,(0,-0.08,0.86),FELT_BLACK,scale=(0.9,0.72,1.1),segments=24,rings=12),g,'archivist')
    add(box('archivist_body',(0.18,0.08,0.42),(0,-0.04,0.55),FELT_BLACK,bev=0.02),g,'archivist')
    return g

def make_house_tableau():
    g=group('house_tableau_root','house_tableau',(19.5,0,0))
    add(box('house_body',(1.00,0.62,0.72),(0.38,0.18,0.70),FELT_RED,bev=0.025),g,'house')
    add(box('house_roof',(1.16,0.72,0.25),(0.38,0.18,1.17),FELT_DARK,bev=0.035,rot=(0,0,0.08)),g,'house')
    add(box('house_door',(0.25,0.035,0.42),(0.38,-0.13,0.52),FELT_BLACK,bev=0.008),g,'door')
    add(box('house_window_l',(0.16,0.025,0.16),(0.08,-0.14,0.78),GLOW,bev=0.008),g,'windows')
    add(box('house_window_r',(0.16,0.025,0.16),(0.68,-0.14,0.78),GLOW,bev=0.008),g,'windows')
    stitch('house_roof_stitch',[(-0.16,-0.18,1.08),(0.38,-0.21,1.31),(0.92,-0.18,1.08)],g,0.006)
    # faceless flashlight puppet left, felt Tenant right, both chase-readable
    add(sphere('house_flash_head',0.10,(-0.35,-0.05,0.72),FELT_BEIGE,scale=(0.9,0.75,1.05),segments=24,rings=12),g,'flashlight_puppet')
    add(box('house_flash_body',(0.18,0.09,0.34),(-0.35,-0.02,0.43),FELT_BEIGE,bev=0.025),g,'flashlight_puppet')
    add(cyl('house_torch',0.018,0.13,(-0.18,-0.15,0.43),GLOW,rot=(math.radians(90),0,0),verts=14),g,'flashlight')
    add(sphere('house_tenant_head',0.07,(-0.78,-0.02,0.91),FELT_BEIGE,scale=(0.8,0.65,1.15),segments=20,rings=10),g,'tenant_puppet')
    add(box('house_tenant_body',(0.18,0.08,0.56),(-0.78,0,0.55),FELT_BLACK,bev=0.02),g,'tenant_puppet')
    for side in (-1,1): add(cyl('house_tenant_arm',0.022,0.52,(-0.78+side*0.14,0,0.43),FELT_BLACK,rot=(0,math.radians(90),side*0.08),verts=12),g,'tenant_puppet')
    return g

def make_backstage_props():
    g=group('backstage_props_root','backstage_props',(23,0,0))
    # wire armature with joints
    for i,z in enumerate((0.25,0.55,0.85)):
        add(torus(f'armature_joint_{i}',0.035,0.006,(0,0,z),WIRE,major_segments=16,minor_segments=5),g,'wire_armature')
    add(curve('armature_spine',[(0,0,0.12),(0,0,1.02)],0.008,WIRE),g,'wire_armature')
    add(curve('armature_arm_l',[(0,0,0.78),(-0.25,0,0.48)],0.007,WIRE),g,'wire_armature')
    add(curve('armature_arm_r',[(0,0,0.78),(0.25,0,0.48)],0.007,WIRE),g,'wire_armature')
    # hooks, rope, sandbags, ladder, prompt box, music box
    for i in range(5):
        x=0.65+i*0.24
        add(torus(f'hook_{i}',0.055,0.009,(x,0,1.18),WIRE,rot=(math.radians(90),0,0),major_segments=20,minor_segments=6),g,'hooks')
        add(curve(f'rope_{i}',[(x,0,1.22),(x+0.02,0,0.22)],0.009,PAPER),g,'ropes')
        add(box(f'sandbag_{i}',(0.14,0.10,0.24),(x+0.02,0,0.12),FELT_BROWN,bev=0.035),g,'sandbags')
    add(box('prompt_box',(0.48,0.35,0.25),(1.95,0,0.28),WOOD,bev=0.025),g,'prompt_box')
    add(box('music_box',(0.30,0.24,0.18),(2.45,0,0.22),GOLD,bev=0.025),g,'music_box')
    add(cyl('music_box_crank',0.025,0.18,(2.62,0,0.28),WIRE,rot=(0,math.radians(90),0),verts=14),g,'music_box')
    for i in range(6):
        add(box('ladder_rail',(0.04,0.06,1.0),(3.0+i*0.09,0,0.55),WOOD,rot=(0,0,0.28)),g,'ladder')
    return g

make_seat(); make_flashlight_puppet(); make_tenant_puppet(); make_office_recap(); make_ballpit_recap(); make_pool_recap(); make_book_recap(); make_house_tableau(); make_backstage_props()
export(HERE)
