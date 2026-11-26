# THRESHOLD Z8 home kit: family photos, wall-phone mount, entryway/hallway domestic props.
import bpy, os, sys, math, random
sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
from _bl import *

reset()
R = random.Random(8198)
WOOD = mat('HomeDarkWood', (0.20, 0.075, 0.028), 0.62)
WOOD_WORN = mat('HomeWornWood', (0.43, 0.20, 0.085), 0.72)
BRASS = mat('HomeBrass', (0.55, 0.31, 0.08), 0.32, metal=0.72)
BLACK = mat('HomeBlack', (0.012, 0.01, 0.008), 0.72)
PAPER = mat('HomePaper', (0.78, 0.68, 0.48), 0.88)
CREAM = mat('HomeCream', (0.72, 0.63, 0.48), 0.86)
GLASS = mat('PhotoGlass', (0.055, 0.07, 0.065), 0.12, metal=0.08)
RED = mat('PhotoTheatreRed', (0.42, 0.018, 0.028), 0.88)
BLUE = mat('PhotoCathedralBlue', (0.08, 0.34, 0.68), 0.42, emit=(0.04, 0.18, 0.5), strength=0.8)
TEAL = mat('PhotoPoolTeal', (0.18, 0.52, 0.54), 0.65)
MUSTARD = mat('PhotoOfficeMustard', (0.52, 0.42, 0.18), 0.82)
PINK = mat('PhotoNeonPink', (0.8, 0.035, 0.25), 0.42, emit=(0.8, 0.01, 0.12), strength=1.1)
GREEN = mat('HomePlantGreen', (0.08, 0.24, 0.075), 0.86)
FABRIC_BLUE = mat('CoatBlueWool', (0.035, 0.07, 0.14), 0.95)
FABRIC_RED = mat('CoatRedWool', (0.20, 0.035, 0.028), 0.95)
FABRIC_GREEN = mat('CoatGreenWool', (0.055, 0.12, 0.055), 0.95)
RUBBER = mat('ShoeRubber', (0.035, 0.025, 0.018), 0.82)
STEEL = mat('KettleSteel', (0.48, 0.52, 0.52), 0.24, metal=0.78)
KEY_METAL = mat('KeyMetal', (0.62, 0.48, 0.16), 0.24, metal=0.8)
RED_INK = mat('CalendarRedInk', (0.42, 0.018, 0.012), 0.82)

root = empty('z8_home_kit_root')
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

def frame_module(key, x, backing, motif):
    g = group(f'photo_{key}_root', f'photo_{key}', (x,0,0))
    add(box(f'{key}_backing',(0.41,0.018,0.54),(0,0.018,0),backing,bev=0.006),g,'backing')
    add(box(f'{key}_frame_top',(0.47,0.035,0.05),(0,-0.002,0.28),WOOD,bev=0.008),g,'frame')
    add(box(f'{key}_frame_bottom',(0.47,0.035,0.05),(0,-0.002,-0.28),WOOD,bev=0.008),g,'frame')
    add(box(f'{key}_frame_l',(0.05,0.035,0.56),(-0.22,-0.002,0),WOOD,bev=0.008),g,'frame')
    add(box(f'{key}_frame_r',(0.05,0.035,0.56),(0.22,-0.002,0),WOOD,bev=0.008),g,'frame')
    # imperfect hanging tilt and worn lower gilt edge
    add(box(f'{key}_gilt_wear',(0.32,0.006,0.008),(0.005,-0.025,-0.255),BRASS,bev=0.001),g,'wear')
    motif(g)
    add(box(f'{key}_glass_strip_a',(0.026,0.006,0.40),(-0.07,-0.028,0.01),GLASS,bev=0.002,rot=(0,0.32,0)),g,'glass')
    add(box(f'{key}_glass_strip_b',(0.016,0.006,0.28),(0.09,-0.028,-0.03),GLASS,bev=0.002,rot=(0,0.32,0)),g,'glass')
    return g

def motif_office(g):
    for i in range(4): add(box(f'office_tube_{i}',(0.055,0.008,0.008),(-0.11+i*0.075,-0.036,0.17),CREAM),g,'office_tubes')
    add(box('office_desk',(0.13,0.012,0.035),(0,-0.04,-0.12),WOOD_WORN,bev=0.005),g,'office_desk')
    add(box('office_partition',(0.16,0.008,0.02),(0,-0.041,0.015),BLACK),g,'office_lines')
    for i in range(3): add(box(f'office_file_{i}',(0.018,0.01,0.04),(0.07+i*0.025,-0.045,-0.05),PAPER),g,'office_papers')
def motif_ballpit(g):
    cols=[RED,PINK,TEAL,BLUE,BRASS]
    for i in range(18): add(sphere(f'pit_ball_{i}',0.018,(-0.15+(i%6)*0.06,-0.047,-0.13+(i//6)*0.055),cols[i%len(cols)],scale=(1,0.35,1),segments=12,rings=6),g,'pit_balls')
    add(box('pit_slide',(0.025,0.012,0.17),(0.11,-0.045,0.08),RED,rot=(0,0,-0.35),bev=0.008),g,'pit_slide')
def motif_pool(g):
    for i in range(5): line(f'pool_tile_v_{i}',[(-0.15+i*0.075,-0.045,-0.2),(-0.15+i*0.075,-0.045,0.2)],g,0.002,CREAM)
    for i in range(4): line(f'pool_tile_h_{i}',[(-0.18,-0.045,-0.15+i*0.1),(0.18,-0.045,-0.15+i*0.1)],g,0.002,CREAM)
    line('pool_arch',[(-0.1,-0.05,-0.1),(-0.1,-0.05,0.06),(0,-0.05,0.15),(0.1,-0.05,0.06),(0.1,-0.05,-0.1)],g,0.01,CREAM)
def motif_library(g):
    for i in range(7): add(box(f'book_page_{i}',(0.018,0.01,0.18),(-0.14+i*0.045,-0.045,0.0),PAPER,rot=(0,0,(i-3)*0.025)),g,'book_pages')
    add(box('book_silhouette',(0.028,0.014,0.12),(0,-0.055,-0.02),BLACK,bev=0.012),g,'book_figure')
def motif_motel(g):
    add(box('motel_corridor',(0.12,0.012,0.018),(0,-0.045,-0.08),BLACK),g,'motel_shapes')
    for side in (-1,1):
        add(box(f'motel_door_{side}',(0.025,0.01,0.14),(side*0.13,-0.045,0.01),WOOD,bev=0.003),g,'motel_doors')
    add(box('motel_neon_pink',(0.08,0.01,0.009),(-0.02,-0.052,0.18),PINK),g,'motel_neon')
    add(box('motel_neon_teal',(0.055,0.01,0.008),(0.035,-0.052,0.145),TEAL),g,'motel_neon')
def motif_theatre(g):
    for side in (-1,1): add(box(f'theatre_curtain_{side}',(0.06,0.012,0.18),(side*0.13,-0.045,0.02),RED,bev=0.008),g,'theatre_curtains')
    add(box('theatre_stage',(0.13,0.012,0.025),(0,-0.05,-0.14),WOOD_WORN),g,'theatre_stage')
    for i in range(3): add(sphere(f'theatre_seat_{i}',0.018,(-0.06+i*0.06,-0.055,-0.06),RED,scale=(1,0.35,1),segments=12,rings=6),g,'theatre_seats')
def motif_cathedral(g):
    for ix in range(5):
        for iz in range(5):
            if (ix+iz)%4 != 3: add(box(f'cat_light_{ix}_{iz}',(0.012,0.009,0.018),(-0.12+ix*0.06,-0.045,-0.12+iz*0.055),BLUE),g,'cathedral_grid')

photo_specs=[('office',0,MUSTARD,motif_office),('ballpit',1.0,CREAM,motif_ballpit),('pool',2.0,TEAL,motif_pool),('library',3.0,PAPER,motif_library),('motel',4.0,BLACK,motif_motel),('theatre',5.0,RED,motif_theatre),('cathedral',6.0,BLACK,motif_cathedral)]
for spec in photo_specs: frame_module(*spec)

# Wall-phone mounting plate with screws, warning card and cord strain relief.
g=group('wall_phone_mount_root','wall_phone_mount',(7.2,0,0))
add(box('phone_mount_plate',(0.34,0.025,0.62),(0,0,0),WOOD,bev=0.018),g,'plate')
for x in (-0.11,0.11):
    for z in (-0.22,0.22): add(cyl(f'mount_screw_{x}_{z}',0.012,0.008,(x,-0.025,z),BRASS,rot=(math.radians(90),0,0),verts=16),g,'screws')
add(box('phone_note_card',(0.075,0.006,0.05),(0.045,-0.034,-0.19),PAPER,bev=0.002,rot=(0,0,-0.06)),g,'note')
line('phone_note_string',[(0.02,-0.04,-0.14),(0.045,-0.04,-0.18)],g,0.0015,RED_INK)
add(cyl('cord_strain_relief',0.018,0.028,(-0.11,-0.035,-0.23),BLACK,rot=(math.radians(90),0,0),verts=16),g,'cord_relief')

# Entryway props: four asymmetric coats, shoes, umbrella stand and umbrellas.
g=group('entryway_props_root','entryway_props',(8.4,0,0))
coat_mats=[FABRIC_BLUE,FABRIC_RED,FABRIC_GREEN,BLACK]
for i,cm in enumerate(coat_mats):
    x=-0.45+i*0.3
    add(cyl(f'coat_hook_{i}',0.018,0.09,(x,-0.01,0.92),BRASS,rot=(math.radians(90),0,0),verts=16,bev=0.003),g,'hooks')
    add(sphere(f'coat_body_{i}',0.18,(x,-0.06,0.48),cm,scale=(0.72,0.30,1.45),segments=20,rings=10),g,'coats')
    add(box(f'coat_cuff_l_{i}',(0.035,0.04,0.10),(x-0.09,-0.06,0.20),cm,bev=0.01),g,'cuffs')
    if i!=2: add(box(f'coat_cuff_r_{i}',(0.035,0.04,0.10),(x+0.09,-0.06,0.20),cm,bev=0.01),g,'cuffs')
for i in range(4):
    x=-0.36+(i%2)*0.28; y=-0.05+(i//2)*0.11
    add(box(f'shoe_sole_{i}',(0.14,0.22,0.036),(x,y,0.035),RUBBER,bev=0.012),g,'shoes')
    add(sphere(f'shoe_upper_{i}',0.065,(x,y-0.01,0.07),RUBBER,scale=(0.9,1.25,0.45),segments=16,rings=8),g,'shoes')
add(cyl('umbrella_stand',0.12,0.38,(0.72,-0.02,0.19),BRASS,verts=24,bev=0.008),g,'umbrella_stand')
for i in range(3):
    add(cyl(f'umbrella_shaft_{i}',0.009,0.65,(0.69+i*0.035,-0.02,0.55),BLACK,rot=(0,0,0.12*(i-1)),verts=10),g,'umbrellas')
    add(sphere(f'umbrella_tip_{i}',0.035,(0.69+i*0.035,-0.02,0.88),[FABRIC_RED,FABRIC_BLUE,FABRIC_GREEN][i],scale=(0.7,0.7,1.5),segments=12,rings=6),g,'umbrellas')

# Hall table with drawer, letters, key dish and individual keys.
g=group('hall_table_root','hall_table',(10.0,0,0))
add(box('table_top',(0.86,0.44,0.07),(0,0,0.72),WOOD_WORN,bev=0.015),g,'table')
add(box('table_drawer',(0.68,0.32,0.14),(0,-0.01,0.63),WOOD,bev=0.01),g,'drawer')
add(cyl('drawer_pull',0.018,0.05,(0,-0.18,0.63),BRASS,rot=(math.radians(90),0,0),verts=16),g,'drawer_pull')
for sx in (-1,1):
    for sy in (-1,1): add(box(f'table_leg_{sx}_{sy}',(0.07,0.07,0.70),(sx*0.34,sy*0.15,0.35),WOOD,bev=0.006),g,'legs')
for i in range(4): add(box(f'letter_{i}',(0.11,0.065,0.004),(-0.1+i*0.045,-0.04+i*0.008,0.77+i*0.003),PAPER,rot=(0,0,(i-1.5)*0.09),bev=0.001),g,'post')
add(cyl('key_dish',0.075,0.018,(0.2,0.0,0.77),BRASS,verts=24),g,'key_dish')
for i in range(3):
    add(cyl(f'key_ring_{i}',0.018,0.004,(0.18+i*0.025,-0.02+i*0.015,0.79),KEY_METAL,verts=16),g,'keys')
    add(box(f'key_stem_{i}',(0.006,0.028,0.003),(0.18+i*0.025,-0.045+i*0.015,0.79),KEY_METAL,bev=0.001),g,'keys')

# Mirror, radiator and crossed-out calendar as separate usable dressing modules.
g=group('mirror_calendar_root','mirror_calendar',(11.4,0,0))
add(box('mirror_frame',(0.25,0.035,0.43),(-0.25,0,0.45),WOOD,bev=0.018),g,'mirror_frame')
add(box('mirror_dark_glass',(0.21,0.012,0.38),(-0.25,-0.025,0.45),GLASS,bev=0.008),g,'mirror_glass')
add(box('calendar_page',(0.36,0.012,0.50),(0.27,-0.01,0.46),PAPER,bev=0.004),g,'calendar')
for ix in range(4): line(f'calendar_grid_v_{ix}',[(0.16+ix*0.07,-0.025,0.31),(0.16+ix*0.07,-0.025,0.59)],g,0.0012,BLACK)
for iz in range(5): line(f'calendar_grid_h_{iz}',[(0.14,-0.025,0.32+iz*0.055),(0.40,-0.025,0.32+iz*0.055)],g,0.0012,BLACK)
for i in range(13):
    x=0.17+(i%4)*0.065; z=0.34+(i//4)*0.055
    line(f'calendar_cross_{i}',[(x-0.018,-0.031,z-0.012),(x+0.018,-0.031,z+0.012)],g,0.002,RED_INK)

g=group('radiator_root','radiator',(12.5,0,0))
for i in range(7): add(box(f'radiator_fin_{i}',(0.035,0.10,0.30),(-0.24+i*0.08,0,0.32),CREAM,bev=0.015),g,'fins')
add(cyl('radiator_pipe_top',0.025,0.58,(0,0,0.56),STEEL,rot=(0,math.radians(90),0),verts=16),g,'pipes')
add(cyl('radiator_pipe_bottom',0.022,0.58,(0,0,0.08),STEEL,rot=(0,math.radians(90),0),verts=16),g,'pipes')
add(cyl('radiator_valve',0.045,0.05,(0.34,0,0.48),BRASS,verts=16),g,'valve')

# Stair toys and kitchen kettle.
g=group('stair_toys_root','stair_toys',(13.5,0,0))
for i,(c,x) in enumerate([(RED,-0.16),(BLUE,0.02),(BRASS,0.18)]):
    add(box(f'toy_block_{i}',(0.075,0.075,0.075),(x,0,0.075),c,bev=0.012),g,'toy_blocks')
    add(box(f'toy_letter_{i}',(0.035,0.006,0.035),(x,-0.078,0.075),PAPER,bev=0.001),g,'toy_letters')
add(cyl('toy_wheel_a',0.055,0.035,(-0.02,0.1,0.055),RUBBER,rot=(math.radians(90),0,0),verts=20),g,'toy_wheels')
add(cyl('toy_wheel_b',0.055,0.035,(0.12,0.1,0.055),RUBBER,rot=(math.radians(90),0,0),verts=20),g,'toy_wheels')

g=group('kitchen_kettle_root','kitchen_kettle',(14.5,0,0))
add(sphere('kettle_body',0.17,(0,0,0.23),STEEL,scale=(1,0.82,1.05),segments=28,rings=14),g,'kettle')
add(cyl('kettle_lid',0.07,0.025,(0,0,0.40),STEEL,verts=24),g,'lid')
add(cyl('kettle_spout',0.035,0.22,(0.18,-0.02,0.29),STEEL,rot=(0,math.radians(62),0),verts=16,bev=0.004),g,'spout')
line('kettle_handle',[(-0.12,0,0.29),(-0.08,0,0.51),(0.08,0,0.51),(0.12,0,0.29)],g,0.018,BLACK)
for i in range(3):
    pts=[]
    for j in range(12):
        u=j/11; pts.append((0.02*math.sin(u*math.tau*1.4+i),0,0.47+u*0.42+i*0.02))
    line(f'kettle_steam_{i}',pts,g,0.006,CREAM)

export(HERE)
