# MILLRIDGET hero: a 3D smock windmill, cinematic detail pass. 1 unit = 1 metre.
# Blender Z up, front (sail side) = -Y. Parts:
#   mill   (root)
#   body   (tapered smock body, stone base, weatherboarded timber)
#   cap    (ogee cap + fascia + finial)
#   capTop (cap dome)
#   sails  (hub + four lattice sails — rotates about the -Y axis)
#   tail   (fantail frame + vanes)
#   door   (door + frame)
#   win    (window frame + mullions + glass)
import bpy, os, sys, math, random
sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
from _bl import *

reset()
RNG = random.Random(7)

# ---------- materials (glTF exports factors only; scene adds noise maps) ----------
TIMBER   = mat('Timber',      (0.24, 0.17, 0.10), rough=0.8)
TIMBER_L = mat('TimberLight', (0.32, 0.24, 0.14), rough=0.75)
TIMBER_D = mat('TimberDark',  (0.11, 0.07, 0.045), rough=0.9)
STONE    = mat('Stone',       (0.30, 0.29, 0.27), rough=0.95)
SLATE    = mat('SlateCap',    (0.13, 0.15, 0.19), rough=0.5, metal=0.25)
IRON     = mat('Iron',        (0.09, 0.08, 0.08), rough=0.45, metal=0.8)
SAIL_WOOD= mat('SailWood',    (0.28, 0.21, 0.12), rough=0.75)
CANVAS   = mat('SailCanvas',  (0.72, 0.66, 0.52), rough=0.92)
GLASS    = mat('WindowGlass', (0.95, 0.60, 0.22), rough=0.3, emit=(1.0, 0.52, 0.16), strength=1.25)

root = empty('mill'); root['fx_part'] = 'mill'

# ---------- stone base course: rough ring under the timber ----------
bpy.ops.mesh.primitive_cone_add(vertices=16, radius1=2.25, radius2=2.12, depth=0.9, location=(0, 0, 0.45))
base = bpy.context.active_object; base.name = 'base'; base['fx_part'] = 'body'
assign(base, STONE); smooth(base); bevel(base, 0.04, 2); parent(base, root)
# a few proud stones for breakup
for i in range(10):
    a = i * math.tau / 10 + 0.13
    r = 2.2
    st = box(f'stone{i}', (0.34, 0.18, 0.22 + 0.06 * RNG.random()), (r * math.cos(a), r * math.sin(a), 0.16 + 0.02 * RNG.random()), STONE, bev=0.05)
    st.rotation_euler[2] = a
    st['fx_part'] = 'body'
    parent(st, root)

# ---------- smock body: tapered octagon, 4.2 m of timber over the stone ----------
bpy.ops.mesh.primitive_cone_add(vertices=8, radius1=2.05, radius2=1.48, depth=4.0, location=(0, 0, 2.9))
body = bpy.context.active_object; body.name = 'body'; body['fx_part'] = 'body'
assign(body, TIMBER); bevel(body, 0.05, 2)
# flat shading is intended on the 8 faces; the bevel rounds every edge
parent(body, root)

# weatherboard courses: thin octagon rings, alternating tone, fine bevel
for i in range(9):
    z = 1.05 + i * 0.42
    f = 1.0 - ((z - 0.9) / 4.0) * 0.28
    r = 2.05 * f + 0.015
    m = TIMBER_L if i % 2 == 0 else TIMBER
    ring = cyl(f'board{i}', r, 0.05, (0, 0, z), m, verts=8, bev=0.015)
    ring['fx_part'] = 'body'
    parent(ring, body)

# corner posts at the 8 corners, tilted to follow the body taper
from mathutils import Vector, Quaternion
TAPER = math.atan((2.05 - 1.48) / 4.0)   # ~8 deg inward lean
for i in range(8):
    a = math.radians(22.5 + i * 45)
    rr = 1.86  # mid-height face radius + post half-depth
    post = box(f'post{i}', (0.16, 0.16, 4.0), (rr * math.cos(a), rr * math.sin(a), 2.9), TIMBER_D, bev=0.03)
    post.rotation_mode = 'QUATERNION'
    post.rotation_quaternion = Quaternion(Vector((-math.sin(a), math.cos(a), 0)), -TAPER)
    post['fx_part'] = 'body'
    parent(post, body)

# sill ring at the timber/stone joint
sill = cyl('sill', 2.10, 0.14, (0, 0, 0.95), TIMBER_D, verts=8, bev=0.03)
sill['fx_part'] = 'body'; parent(sill, body)

# ---------- cap: fascia + dome + finial ----------
cap = cyl('cap', 1.70, 0.30, (0, 0, 5.02), SLATE, verts=16, bev=0.05)
cap['fx_part'] = 'cap'; parent(cap, root)
bpy.ops.mesh.primitive_cone_add(vertices=16, radius1=1.70, radius2=0.10, depth=1.6, location=(0, 0, 5.95))
capTop = bpy.context.active_object; capTop.name = 'capTop'; capTop['fx_part'] = 'capTop'
assign(capTop, SLATE); smooth(capTop); parent(capTop, root)
fin = cyl('finial', 0.05, 0.85, (0, 0, 7.15), IRON, verts=12)
fin['fx_part'] = 'capTop'; parent(fin, root)
ball = cyl('finialBall', 0.10, 0.16, (0, 0, 7.45), IRON, verts=12)
ball['fx_part'] = 'capTop'; parent(ball, root)

# ---------- door: recessed slab + frame + steps ----------
frame = box('doorFrame', (0.94, 0.16, 1.62), (0, -2.02, 0.95), TIMBER_D, bev=0.04)
frame['fx_part'] = 'door'; parent(frame, body)
door = box('door', (0.72, 0.10, 1.44), (0, -2.08, 0.90), TIMBER_L, bev=0.03)
door['fx_part'] = 'door'; parent(door, body)
knob = cyl('knob', 0.035, 0.05, (0.24, -2.14, 0.9), IRON, rot=(math.radians(90), 0, 0), verts=8)
knob['fx_part'] = 'door'; parent(knob, body)
# stone steps
step1 = box('step1', (1.0, 0.42, 0.16), (0, -2.45, 0.08), STONE, bev=0.03)
step2 = box('step2', (0.8, 0.30, 0.16), (0, -2.30, 0.24), STONE, bev=0.03)
for st in (step1, step2):
    st['fx_part'] = 'door'; parent(st, root)

# ---------- window: surround frame + mullions + warm glass ----------
# frame = 4 members around the opening (a solid slab would cover the pane)
for nm, (sx, sz, px, pz) in {
    'winTop':    (0.62, 0.07, 0.0,  0.365),
    'winBot':    (0.62, 0.07, 0.0, -0.365),
    'winL':      (0.07, 0.58, -0.275, 0.0),
    'winR':      (0.07, 0.58,  0.275, 0.0),
}.items():
    wbar = box(nm, (sx, 0.14, sz), (px, -1.70, 3.55 + pz), TIMBER_D, bev=0.025)
    wbar['fx_part'] = 'win'; parent(wbar, body)
# sill under the opening
wsill = box('winSill', (0.72, 0.18, 0.07), (0, -1.74, 3.55 - 0.42), TIMBER_D, bev=0.025)
wsill['fx_part'] = 'win'; parent(wsill, body)
glass = box('glass', (0.48, 0.06, 0.58), (0, -1.78, 3.55), GLASS, bev=0.015)
glass['fx_part'] = 'win'; parent(glass, body)
mullv = box('mullV', (0.04, 0.05, 0.58), (0, -1.76, 3.55), TIMBER_D)
mullh = box('mullH', (0.48, 0.05, 0.04), (0, -1.76, 3.55), TIMBER_D)
for m in (mullv, mullh):
    m['fx_part'] = 'win'; parent(m, body)

# ---------- sails: hub + four lattice sails (X set) ----------
sails = empty('sails', (0, -1.85, 4.25)); sails['fx_part'] = 'sails'
hub = cyl('hub', 0.30, 0.55, (0, -1.85, 4.25), IRON, rot=(math.radians(90), 0, 0), verts=16, bev=0.03)
hub['fx_part'] = 'sails'; parent(hub, sails)
nose = cyl('nose', 0.12, 0.35, (0, -2.2, 4.25), TIMBER_D, rot=(math.radians(90), 0, 0), verts=12, bev=0.03)
nose['fx_part'] = 'sails'; parent(nose, sails)

def sailparts(k):
    ang = math.radians(45 + k * 90)
    grp = []
    # main stock (long spar)
    grp.append(box(f'arm{k}', (0.16, 0.16, 4.4), (0, -2.0, 4.25 + 2.2), SAIL_WOOD, bev=0.025))
    # leading + trailing rails
    grp.append(box(f'railL{k}', (0.05, 0.07, 3.0), (0.02, -2.0, 4.25 + 2.9), SAIL_WOOD, bev=0.015))
    grp.append(box(f'railT{k}', (0.05, 0.07, 3.0), (0.98, -2.0, 4.25 + 2.9), SAIL_WOOD, bev=0.015))
    # cross slats
    for j in range(7):
        grp.append(box(f'slat{k}_{j}', (1.0, 0.035, 0.045), (0.5, -2.0, 4.25 + 1.45 + j * 0.44), SAIL_WOOD, bev=0.012))
    # canvas panels on the upper 2/3, slight billow via small z-rot on alternates
    for j in range(4):
        p = box(f'cloth{k}_{j}', (0.86, 0.02, 0.40), (0.52, -2.02, 4.25 + 2.55 + j * 0.44), CANVAS)
        p.rotation_euler[2] = math.radians(1.2 if j % 2 else -1.2)
        grp.append(p)
    # diagonal braces across the lattice (tilt in the sail's x-z plane = rot.y)
    brace_ang = math.atan(0.98 / 3.0)
    grp.append(box(f'brace{k}u', (0.045, 0.05, 3.3), (0.5, -2.04, 4.25 + 2.9), SAIL_WOOD, bev=0.012, rot=(0, brace_ang, 0)))
    grp.append(box(f'brace{k}l', (0.045, 0.05, 3.3), (0.5, -2.04, 4.25 + 2.9), SAIL_WOOD, bev=0.012, rot=(0, -brace_ang, 0)))
    return grp, ang

for k in range(4):
    grp, ang = sailparts(k)
    for ob in grp:
        ob['fx_part'] = 'sails'
        ob.rotation_euler[1] += ang
        dx, dz = ob.location.x, ob.location.z - 4.25
        ob.location.x = dx * math.cos(ang) + dz * math.sin(ang)
        ob.location.z = 4.25 - dx * math.sin(ang) + dz * math.cos(ang)
        parent(ob, sails)
parent(sails, root)

# ---------- fantail: rear pole + frame + vanes ----------
pole = cyl('tailpole', 0.06, 3.4, (0, 2.5, 5.3), TIMBER_D, rot=(math.radians(90), 0, 0), verts=10)
pole['fx_part'] = 'tail'; parent(pole, root)
tf = box('tailFrame', (1.0, 0.08, 1.0), (0, 4.1, 5.3), SAIL_WOOD, bev=0.02)
tf['fx_part'] = 'tail'; parent(tf, root)
for j in range(6):
    v = box(f'vane{j}', (0.9, 0.02, 0.12), (0, 4.12, 5.3 - 0.4 + j * 0.16), CANVAS, bev=0.01)
    v['fx_part'] = 'tail'; parent(v, root)

# ---------- ladder to the door landing ----------
for sx in (-0.22, 0.22):
    rail = box(f'ladderRail{sx}', (0.06, 0.06, 1.9), (sx, -2.35, 0.95), TIMBER_D, bev=0.015)
    rail['fx_part'] = 'door'; parent(rail, root)
for j in range(5):
    t = j / 4
    rung = box(f'rung{j}', (0.44, 0.05, 0.05), (0, -2.35 - 0.10 * (1 - t), 0.35 + 1.3 * t), TIMBER_D, bev=0.012)
    rung['fx_part'] = 'door'; parent(rung, root)

print('tris', tris())
export(HERE)
