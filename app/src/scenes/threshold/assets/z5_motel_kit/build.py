# THRESHOLD Z5 motel kit: CRTs, door hardware, corridor service props, signage and room 217 dressing.
import bpy, os, sys, math, random
sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
from _bl import *

reset()
R = random.Random(5217)
WOOD = mat('MotelDoorWood', (0.20, 0.065, 0.028), 0.58)
WOOD_DARK = mat('MotelDarkWood', (0.095, 0.035, 0.018), 0.68)
BRASS = mat('MotelBrass', (0.48, 0.27, 0.07), 0.28, metal=0.78)
BRASS_DARK = mat('OldBrassDark', (0.20, 0.11, 0.035), 0.42, metal=0.65)
CHROME = mat('MotelChrome', (0.42, 0.46, 0.48), 0.22, metal=0.85)
STEEL = mat('MachineSteel', (0.32, 0.36, 0.38), 0.42, metal=0.55)
PAINT = mat('MachinePaint', (0.20, 0.25, 0.28), 0.55, metal=0.18)
BLACK = mat('MotelBlack', (0.009, 0.011, 0.012), 0.72)
RUBBER = mat('MotelRubber', (0.025, 0.022, 0.019), 0.84)
CRT_BODY = mat('CRTPlastic', (0.055, 0.06, 0.065), 0.48)
CRT_GLASS = mat('CRTGlassDark', (0.025, 0.10, 0.16), 0.12, metal=0.05, emit=(0.015, 0.12, 0.22), strength=0.45)
CRT_KNOB = mat('CRTKnobs', (0.12, 0.13, 0.13), 0.35, metal=0.2)
BEIGE = mat('PayphoneBeige', (0.55, 0.48, 0.34), 0.48)
PAPER = mat('MotelPaper', (0.72, 0.62, 0.44), 0.88)
RED = mat('MotelRed', (0.48, 0.025, 0.025), 0.68)
WHITE = mat('MotelWhite', (0.72, 0.70, 0.64), 0.78)
TOWEL = mat('TowelCloth', (0.62, 0.58, 0.48), 0.96)
SHEET = mat('SheetCloth', (0.53, 0.47, 0.39), 0.94)
CURTAIN = mat('MotelCurtain', (0.15, 0.055, 0.075), 0.96)
CARPET_DARK = mat('CartBag', (0.06, 0.09, 0.10), 0.9)
BLUE = mat('VendingColdLight', (0.06, 0.24, 0.55), 0.35, emit=(0.02, 0.18, 0.55), strength=1.1)
ORANGE = mat('SconceWarmGlass', (0.85, 0.30, 0.055), 0.35, emit=(1.0, 0.19, 0.02), strength=1.6)
ICE = mat('IceCube', (0.55, 0.78, 0.86), 0.12, metal=0.02)
MAP_GREEN = mat('MapGreen', (0.18, 0.34, 0.22), 0.78)

root = empty('z5_motel_kit_root')
root['fx_part'] = 'root'
seen = set()
def group(name, part, loc=(0,0,0)):
    ob = empty(name, loc)
    ob.parent = root
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

def line(name, pts, par, width, material=BLACK):
    return add(curve(name, pts, width, material), par)

def label(body, name, loc, size, material, par, extrude=0.001, rot=(math.radians(90),0,0)):
    cu = bpy.data.curves.new(name, 'FONT')
    cu.body = body
    cu.font = bpy.data.fonts.load(os.path.join(FONTS, 'Archivo-w620-700.ttf'))
    cu.size = size
    cu.extrude = extrude
    cu.bevel_depth = 0
    cu.resolution_u = 2
    cu.align_x = 'CENTER'
    cu.align_y = 'CENTER'
    ob = bpy.data.objects.new(name, cu)
    bpy.context.collection.objects.link(ob)
    select(ob)
    bpy.ops.object.convert(target='MESH')
    ob = bpy.context.active_object
    ob.name = name
    assign(ob, material)
    ob.location = loc
    ob.rotation_euler = rot
    return add(ob, par)

# CRT television with rounded shell, convex-feeling curved glass, controls, vents and antenna.
g = group('crt_tv_root','crt_tv',(0,0,0))
add(box('crt_shell',(0.58,0.48,0.46),(0,0,0.42),CRT_BODY,bev=0.055,seg=2),g,'crt_shell')
add(box('crt_rear_taper',(0.42,0.30,0.34),(0,0.20,0.42),CRT_BODY,bev=0.045,seg=2),g,'crt_shell')
add(box('crt_screen_bezel',(0.44,0.035,0.32),(0,-0.255,0.45),BLACK,bev=0.045,seg=2),g,'screen_bezel')
add(box('crt_curved_glass',(0.37,0.028,0.25),(0,-0.278,0.46),CRT_GLASS,bev=0.055,seg=2),g,'screen_glass')
add(box('crt_scanline_glint',(0.31,0.006,0.012),(-0.01,-0.296,0.53),BLUE,bev=0.003),g,'scanlines')
for i in range(5): add(box(f'crt_scanline_{i}',(0.32,0.004,0.003),(0,-0.298,0.39+i*0.035),BLACK),g,'scanlines')
for i in range(2):
    add(cyl(f'crt_knob_{i}',0.025,0.025,(0.22,-0.285,0.34+i*0.075),CRT_KNOB,rot=(math.radians(90),0,0),verts=16,bev=0.003),g,'knobs')
for i in range(7): add(box(f'crt_speaker_slot_{i}',(0.012,0.008,0.07),(0.17+i*0.018,-0.284,0.57),BLACK,bev=0.001),g,'speaker')
for side in (-1,1):
    line(f'crt_antenna_{side}',[(side*0.08,0.05,0.66),(side*0.23,0.02,1.02)],g,0.006,CHROME)
add(sphere('crt_antenna_base',0.045,(0,0.03,0.66),CRT_KNOB,scale=(1,1,0.45),segments=12,rings=6),g,'antenna')
for x in (-0.2,0.2): add(box(f'crt_foot_{x}',(0.09,0.09,0.035),(x,-0.02,0.17),RUBBER,bev=0.01),g,'feet')

# Generic door hardware and hero room 217 number plate.
def make_door_hardware(name, part, x, numbered=False):
    g=group(name,part,(x,0,0))
    add(box('door_escutcheon',(0.055,0.015,0.23),(0,-0.012,0.42),BRASS_DARK,bev=0.012),g,'escutcheon')
    add(cyl('door_handle_round',0.035,0.08,(0,-0.07,0.44),BRASS,rot=(math.radians(90),0,0),verts=14,bev=0.004),g,'handle')
    add(box('door_handle_lever',(0.12,0.025,0.025),(0.06,-0.085,0.44),BRASS,bev=0.01),g,'handle')
    add(cyl('door_keyhole',0.012,0.008,(0,-0.025,0.34),BLACK,rot=(math.radians(90),0,0),verts=16),g,'keyhole')
    add(cyl('door_peephole',0.014,0.012,(0,-0.02,0.78),BRASS,rot=(math.radians(90),0,0),verts=16),g,'peephole')
    for i in range(5):
        line(f'handle_scratch_{i}',[(-0.04+R.random()*0.08,-0.031,0.28+R.random()*0.27),(-0.03+R.random()*0.08,-0.032,0.29+R.random()*0.27)],g,0.0008,BRASS)
    if numbered:
        add(box('room_number_plaque',(0.20,0.018,0.10),(0,-0.016,0.98),BRASS_DARK,bev=0.012),g,'number_plaque')
        label('217','room_number_217',(0,-0.033,0.98),0.065,BRASS,g)
    return g
make_door_hardware('door_hardware_root','door_hardware',1.2,False)
make_door_hardware('room217_hardware_root','room217_hardware',2.1,True)

# Payphone shell variant: metal box, beige handset, coin slot, instruction card and coiled cord.
g=group('payphone_root','payphone',(3.1,0,0))
add(box('payphone_backbox',(0.36,0.12,0.64),(0,0,0.62),PAINT,bev=0.025),g,'backbox')
add(box('payphone_faceplate',(0.31,0.035,0.55),(0,-0.075,0.64),STEEL,bev=0.018),g,'faceplate')
add(box('payphone_instruction_card',(0.16,0.008,0.10),(0,-0.099,0.84),PAPER,bev=0.003),g,'instruction')
add(box('payphone_coin_slot',(0.08,0.012,0.018),(0.07,-0.105,0.72),BLACK,bev=0.003),g,'coin_slot')
add(cyl('payphone_coin_return',0.028,0.015,(0.07,-0.108,0.62),BLACK,rot=(math.radians(90),0,0),verts=16),g,'coin_return')
add(box('payphone_handset_grip',(0.055,0.04,0.26),(-0.09,-0.12,0.66),BEIGE,bev=0.018,rot=(0,0,0.04)),g,'handset')
for z in (0.54,0.78): add(sphere(f'payphone_handset_pod_{z}',0.052,(-0.09,-0.12,z),BEIGE,scale=(0.8,0.75,1.15),segments=14,rings=7),g,'handset')
pts=[]
for i in range(55):
    u=i/54; a=u*math.tau*6
    pts.append((-0.12+math.cos(a)*0.012,-0.125+math.sin(a)*0.008,0.54-u*0.26))
line('payphone_coiled_cord',pts,g,0.0022,RUBBER)
for i in range(4): add(box(f'payphone_button_{i}',(0.025,0.009,0.018),(0.02+(i%2)*0.04,-0.108,0.48+(i//2)*0.035),BLACK,bev=0.002),g,'buttons')

# Ice machine with insulated door, chute, vent grille, scoop, drip tray and ice cubes.
g=group('ice_machine_root','ice_machine',(4.1,0,0))
add(box('ice_machine_body',(0.82,0.64,1.38),(0,0,0.69),PAINT,bev=0.035),g,'body')
add(box('ice_machine_door',(0.62,0.055,0.58),(0,-0.34,0.88),STEEL,bev=0.018),g,'door')
add(box('ice_machine_chute',(0.32,0.11,0.20),(0,-0.40,0.48),BLACK,bev=0.018),g,'chute')
add(box('ice_machine_drip_tray',(0.44,0.18,0.035),(0,-0.40,0.30),CHROME,bev=0.012),g,'drip_tray')
for i in range(8): add(box(f'ice_vent_{i}',(0.55,0.012,0.015),(0,-0.337,1.18+i*0.025),BLACK),g,'vents')
add(cyl('ice_scoop_bowl',0.075,0.035,(0.22,-0.43,0.36),CHROME,rot=(math.radians(90),0,0),verts=14),g,'scoop')
line('ice_scoop_handle',[(0.22,-0.45,0.36),(0.31,-0.46,0.46)],g,0.012,CHROME)
for i in range(7): add(sphere(f'ice_cube_{i}',0.025,(-0.13+(i%4)*0.07,-0.43,0.34+(i//4)*0.035),ICE,scale=(1,0.8,0.75),segments=10,rings=5),g,'ice_cubes')
for i in range(3): line(f'ice_drip_{i}',[(0.08+i*0.05,-0.43,0.27),(0.08+i*0.05,-0.43,0.16-i*0.02)],g,0.002,ICE)

# Housekeeping cart with shelves, towels, bottles, amenity boxes, laundry bag and wheels.
g=group('housekeeping_cart_root','housekeeping_cart',(5.3,0,0))
for z in (0.26,0.65): add(box(f'cart_shelf_{z}',(0.92,0.48,0.055),(0,0,z),STEEL,bev=0.015),g,'shelves')
for x in (-0.42,0.42):
    for y in (-0.20,0.20):
        add(box(f'cart_post_{x}_{y}',(0.025,0.025,0.72),(x,y,0.43),CHROME,bev=0.004),g,'posts')
        add(cyl(f'cart_wheel_{x}_{y}',0.055,0.035,(x,y,0.055),RUBBER,rot=(math.radians(90),0,0),verts=14),g,'wheels')
line('cart_handle',[(-0.46,0.23,0.72),(-0.50,0.28,0.92),(0.50,0.28,0.92),(0.46,0.23,0.72)],g,0.018,CHROME)
for i in range(5): add(box(f'folded_towel_{i}',(0.26,0.18,0.045),(-0.22+(i%2)*0.28,-0.03+(i//2)*0.11,0.71+i*0.012),TOWEL,bev=0.018),g,'towels')
for i in range(3):
    add(cyl(f'spray_bottle_{i}',0.035,0.18,(0.24+i*0.09,-0.12,0.78),[BLUE,RED,WHITE][i],verts=16),g,'spray_bottles')
    add(box(f'spray_trigger_{i}',(0.045,0.03,0.035),(0.24+i*0.09,-0.13,0.90),BLACK,bev=0.004),g,'spray_bottles')
for i in range(4): add(box(f'amenity_box_{i}',(0.13,0.09,0.06),(-0.30+i*0.16,0.11,0.34),PAPER,bev=0.006),g,'amenities')
add(sphere('laundry_bag',0.24,(0.16,0.02,0.42),CARPET_DARK,scale=(0.9,0.75,1.25),segments=14,rings=7),g,'laundry_bag')

# Room-service tray with covered plate, cup, utensils, napkin and key fobs.
g=group('service_tray_root','service_tray',(6.6,0,0))
add(box('tray_base',(0.58,0.38,0.025),(0,0,0.035),WOOD_DARK,bev=0.012),g,'tray')
for x in (-0.27,0.27): add(box(f'tray_side_{x}',(0.025,0.38,0.055),(x,0,0.07),WOOD_DARK,bev=0.006),g,'tray')
for y in (-0.17,0.17): add(box(f'tray_end_{y}',(0.58,0.025,0.055),(0,y,0.07),WOOD_DARK,bev=0.006),g,'tray')
add(cyl('plate_base',0.13,0.018,(-0.10,0.02,0.095),WHITE,verts=22),g,'plate')
add(sphere('plate_cover',0.13,(-0.10,0.02,0.13),CHROME,scale=(1,1,0.45),segments=12,rings=6),g,'plate_cover')
add(sphere('plate_cover_knob',0.025,(-0.10,0.02,0.20),BRASS,segments=12,rings=6),g,'plate_cover')
add(cyl('cup',0.045,0.075,(0.14,-0.08,0.12),WHITE,verts=16),g,'cup')
line('cup_handle',[(0.18,-0.08,0.13),(0.21,-0.08,0.13),(0.21,-0.08,0.09),(0.18,-0.08,0.09)],g,0.008,WHITE)
for i in range(2): add(box(f'utensil_{i}',(0.012,0.19,0.006),(0.04+i*0.035,0.07,0.10),CHROME,rot=(0,0,0.08*(i*2-1)),bev=0.002),g,'utensils')
add(box('crumpled_napkin',(0.12,0.08,0.018),(0.12,0.10,0.10),PAPER,rot=(0.1,0.2,0.3),bev=0.008),g,'napkin')
for i in range(2):
    add(cyl(f'key_ring_{i}',0.018,0.004,(0.20+i*0.035,0.08,0.11),BRASS,verts=16),g,'keys')
    add(box(f'plastic_fob_{i}',(0.035,0.055,0.008),(0.21+i*0.035,0.12,0.11),[RED,MAP_GREEN][i],bev=0.005),g,'key_fobs')

# Signage set: do-not-disturb hanger, motel map frame and fire-hose cabinet.
g=group('signage_root','signage',(7.7,0,0))
add(box('dnd_sign',(0.12,0.010,0.22),(-0.34,0,0.45),PAPER,bev=0.012),g,'do_not_disturb')
label('DO NOT','dnd_do',(-0.34,-0.012,0.49),0.035,RED,g,extrude=0.001)
label('DISTURB','dnd_disturb',(-0.34,-0.012,0.41),0.033,RED,g,extrude=0.001)
line('dnd_hook',[(-0.34,0,0.57),(-0.34,0,0.64),(-0.29,0,0.66)],g,0.006,PAPER)
add(box('motel_map_frame',(0.34,0.025,0.28),(0.15,0,0.52),WOOD_DARK,bev=0.012),g,'map_frame')
add(box('motel_map_paper',(0.29,0.008,0.23),(0.15,-0.018,0.52),PAPER),g,'map_paper')
line('map_corridor_line',[(0.04,-0.026,0.48),(0.25,-0.026,0.48),(0.25,-0.026,0.59)],g,0.003,MAP_GREEN)
add(box('fire_hose_cabinet',(0.30,0.10,0.45),(0.52,0,0.48),RED,bev=0.015),g,'fire_hose')
add(box('fire_hose_glass',(0.23,0.012,0.31),(0.52,-0.056,0.50),CRT_GLASS,bev=0.008),g,'fire_glass')
line('fire_hose_coil',[(0.46,-0.065,0.47),(0.52,-0.065,0.55),(0.58,-0.065,0.47),(0.52,-0.065,0.40),(0.46,-0.065,0.47)],g,0.012,WHITE)

# Small vending machine foreshadowing Z7.
g=group('vending_small_root','vending_small',(9.0,0,0))
add(box('vend_body',(0.54,0.48,1.28),(0,0,0.64),PAINT,bev=0.028),g,'vend_body')
add(box('vend_glass',(0.34,0.025,0.82),(-0.06,-0.255,0.77),CRT_GLASS,bev=0.012),g,'vend_glass')
for row in range(4):
    add(box(f'vend_shelf_{row}',(0.32,0.025,0.012),(-0.06,-0.273,0.48+row*0.19),CHROME),g,'shelves')
    for col in range(3):
        add(box(f'vend_product_{row}_{col}',(0.055,0.035,0.10),(-0.17+col*0.105,-0.285,0.52+row*0.19),[RED,BLUE,PAPER,ORANGE][(row+col)%4],bev=0.006),g,'products')
add(box('vend_coin_panel',(0.10,0.035,0.42),(0.20,-0.255,0.75),BLACK,bev=0.01),g,'coin_panel')
add(box('vend_coin_slot',(0.045,0.01,0.012),(0.20,-0.279,0.87),CHROME),g,'coin_slot')
add(box('vend_pickup',(0.36,0.08,0.16),(0,-0.25,0.19),BLACK,bev=0.015),g,'pickup')

# Raincoat on a hook and a dripping umbrella.
g=group('raincoat_umbrella_root','raincoat_umbrella',(10.1,0,0))
add(cyl('raincoat_hook',0.018,0.10,(-0.20,0,0.92),BRASS,rot=(math.radians(90),0,0),verts=16,bev=0.003),g,'hook')
add(sphere('raincoat_body',0.20,(-0.20,-0.04,0.55),CURTAIN,scale=(0.70,0.32,1.50),segments=14,rings=7),g,'raincoat')
add(box('raincoat_sleeve_l',(0.07,0.06,0.33),(-0.31,-0.04,0.47),CURTAIN,rot=(0,0,-0.12),bev=0.025),g,'sleeves')
add(box('raincoat_sleeve_r',(0.07,0.06,0.30),(-0.09,-0.04,0.50),CURTAIN,rot=(0,0,0.16),bev=0.025),g,'sleeves')
for i in range(5): line(f'raincoat_drip_{i}',[(-0.27+i*0.035,-0.07,0.22),(-0.27+i*0.035,-0.07,0.10-R.random()*0.04)],g,0.0015,ICE)
add(cyl('umbrella_shaft',0.010,0.82,(0.20,-0.02,0.43),BLACK,rot=(0,0,0.18),verts=12),g,'umbrella')
add(cyl('umbrella_canopy',0.045,0.52,(0.28,-0.02,0.16),BLACK,rot=(0,0,0.18),verts=14,bev=0.006),g,'umbrella')
for i in range(4): add(sphere(f'umbrella_drop_{i}',0.009,(0.25+i*0.025,-0.03,0.03+0.02*i),ICE,scale=(0.7,0.7,1.5),segments=10,rings=5),g,'drips')

# Detailed sconce and broken variant.
def make_sconce(name,part,x,broken=False):
    g=group(name,part,(x,0,0))
    add(box('sconce_backplate',(0.12,0.035,0.32),(0,0,0.55),BRASS_DARK,bev=0.015),g,'backplate')
    add(cyl('sconce_arm',0.018,0.16,(0,-0.08,0.54),BRASS,rot=(math.radians(90),0,0),verts=16),g,'arm')
    shade_mat=BRASS_DARK
    add(cyl('sconce_shade',0.10,0.16,(0,-0.17,0.55),shade_mat,rot=(math.radians(90),0,0),verts=14,bev=0.008),g,'shade')
    if broken:
        add(box('sconce_cracked_glass',(0.08,0.01,0.035),(0.03,-0.255,0.60),CRT_GLASS,rot=(0,0,0.4),bev=0.002),g,'broken_glass')
        line('sconce_hanging_wire',[(0.02,-0.18,0.49),(0.04,-0.19,0.35)],g,0.002,BLACK)
    else:
        add(sphere('sconce_bulb',0.045,(0,-0.20,0.55),ORANGE,scale=(1,0.8,1),segments=12,rings=6),g,'bulb')
    return g
make_sconce('sconce_root','sconce',11.2,False)
make_sconce('broken_sconce_root','broken_sconce',12.0,True)

# Room 217 bed/dresser/lamp/curtain kit, scaled for the small motel room.
g=group('room217_kit_root','room217_kit',(13.7,0,0))
add(box('bed_frame',(1.65,0.90,0.30),(0,0,0.25),WOOD_DARK,bev=0.035),g,'bed_frame')
add(box('mattress',(1.55,0.82,0.18),(0,-0.02,0.47),SHEET,bev=0.055),g,'mattress')
add(box('blanket',(1.48,0.72,0.08),(0,-0.06,0.57),CURTAIN,bev=0.04),g,'blanket')
for i in range(5): add(sphere(f'blanket_wrinkle_{i}',0.06,(-0.55+i*0.27,-0.39,0.62),CURTAIN,scale=(1.8,0.35,0.28),segments=12,rings=6),g,'wrinkles')
add(sphere('pillow',0.22,(-0.42,0.24,0.62),WHITE,scale=(1.55,0.72,0.42),segments=14,rings=7),g,'pillow')
add(box('headboard',(1.65,0.08,0.62),(0,0.45,0.62),WOOD_DARK,bev=0.025),g,'headboard')
add(box('dresser',(0.82,0.52,0.70),(1.15,-0.05,0.35),WOOD,bev=0.025),g,'dresser')
for i in range(3):
    add(box(f'dresser_drawer_{i}',(0.70,0.025,0.15),(1.15,-0.325,0.20+i*0.18),WOOD_DARK,bev=0.008),g,'drawers')
    add(cyl(f'drawer_pull_{i}',0.018,0.05,(1.15,-0.35,0.20+i*0.18),BRASS,rot=(math.radians(90),0,0),verts=16),g,'drawer_pulls')
add(box('nightstand',(0.46,0.40,0.48),(-1.10,0.18,0.24),WOOD,bev=0.02),g,'nightstand')
add(cyl('lamp_stem',0.025,0.36,(-1.10,0.18,0.66),BRASS,verts=16),g,'lamp')
add(cyl('lamp_shade',0.16,0.20,(-1.10,0.18,0.88),ORANGE,verts=14,bev=0.008),g,'lamp')
for i in range(7): add(box(f'curtain_fold_{i}',(0.055,0.045,1.25),(0.72+i*0.075,0.44,0.83),CURTAIN,rot=(0,0,0.05*math.sin(i)),bev=0.018),g,'curtain')

export(HERE)
