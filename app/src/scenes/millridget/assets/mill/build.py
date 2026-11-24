# MILLRIDGET hero: a 3D smock windmill. 1 unit = 1 metre; mill ~11 m to cap peak.
# Blender Z up, front (sail side) = -Y. Parts:
#   mill   (root)
#   body   (8-sided tapered smock body, weathered timber)
#   cap    (ogee cap + finial)
#   sails  (hub + four lattice sails — rotates about the -Y axis)
#   tail   (fantail pole + ladder)
import bpy, os, sys, math
sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
from _bl import *

reset()

TIMBER = mat('Timber', (0.16, 0.11, 0.07), rough=0.85)
TIMBER_D = mat('TimberDark', (0.09, 0.06, 0.04), rough=0.9)
SLATE = mat('SlateCap', (0.10, 0.11, 0.14), rough=0.55, metal=0.15)
SAIL_WOOD = mat('SailWood', (0.20, 0.15, 0.09), rough=0.8)
CANVAS = mat('SailCanvas', (0.55, 0.50, 0.40), rough=0.95)
GLASS = mat('Window', (0.9, 0.55, 0.2), rough=0.4, emit=(1.0, 0.5, 0.15), strength=3.0)

root = empty('mill'); root['fx_part'] = 'mill'

# ---- smock body: tapered octagon, 4.6 m tall ----
bpy.ops.mesh.primitive_cone_add(vertices=8, radius1=2.1, radius2=1.5, depth=4.6, location=(0, 0, 2.3))
body = bpy.context.active_object; body.name = 'body'; body['fx_part'] = 'body'
assign(body, TIMBER); bevel(body, 0.06, 2); smooth(body)
# horizontal weather-boarding shadow lines: thin dark rings
for i in range(6):
    z = 0.75 + i * 0.68
    f = 1.0 - (z / 4.6) * 0.29  # taper follows the cone
    ring = cyl(f'board{i}', 2.1 * f + 0.012, 0.05, (0, 0, z), TIMBER_D, verts=8)
    parent(ring, body)
parent(body, root)

# ---- cap: ogee dome + finial ----
cap = cyl('cap', 1.62, 0.5, (0, 0, 4.75), SLATE, verts=8)
bpy.ops.mesh.primitive_cone_add(vertices=8, radius1=1.62, radius2=0.12, depth=1.5, location=(0, 0, 5.75))
capTop = bpy.context.active_object; capTop.name = 'capTop'; assign(capTop, SLATE); smooth(capTop)
fin = cyl('finial', 0.06, 0.9, (0, 0, 6.7), TIMBER_D, verts=8)
cap['fx_part'] = 'cap'; capTop['fx_part'] = 'cap'
parent(cap, root); parent(capTop, root); parent(fin, root)

# ---- door + window ----
door = box('door', (0.7, 0.12, 1.3), (0, -2.06, 0.65), TIMBER_D, bev=0.03)
parent(door, body)
win = box('window', (0.45, 0.1, 0.55), (0, -1.62, 3.6), GLASS, bev=0.02)
parent(win, body)

# ---- sails: hub + 4 lattice sails, pivot = hub on the front face ----
sails = empty('sails', (0, -1.75, 4.1)); sails['fx_part'] = 'sails'
hub = cyl('hub', 0.32, 0.5, (0, -1.75, 4.1), TIMBER_D, rot=(math.radians(90), 0, 0), verts=16)
parent(hub, sails)
for k in range(4):
    ang = math.radians(45 + k * 90)          # X-set sails read well at rest
    arm = box(f'arm{k}', (0.14, 0.14, 3.9), (0, -1.9, 4.1 + 1.95), SAIL_WOOD, bev=0.02)
    # lattice frame: outer spar + 5 cross slats, canvas panels on the upper half
    spar = box(f'spar{k}', (1.0, 0.05, 0.06), (0.5, -1.92, 4.1 + 2.6), SAIL_WOOD, bev=0.01)
    slats = []
    for j in range(5):
        slats.append(box(f'slat{k}_{j}', (0.95, 0.04, 0.05), (0.5, -1.92, 4.1 + 1.7 + j * 0.42), SAIL_WOOD, bev=0.01))
    for j in range(4):
        slats.append(box(f'cloth{k}_{j}', (0.85, 0.015, 0.34), (0.5, -1.90, 4.1 + 1.9 + j * 0.42), CANVAS))
    grp = [arm, spar] + slats
    for ob in grp:
        ob.rotation_euler[1] = ang   # rotate about Blender Y (the -Y axis through the hub)
        # rotate the position about the hub in the XZ plane
        dx, dz = ob.location.x, ob.location.z - 4.1
        ob.location.x = dx * math.cos(ang) + dz * math.sin(ang)
        ob.location.z = 4.1 - dx * math.sin(ang) + dz * math.cos(ang)
        parent(ob, sails)
parent(sails, root)

# ---- fantail pole + ladder stub ----
pole = cyl('tailpole', 0.05, 3.2, (0, 2.4, 5.4), TIMBER_D, rot=(math.radians(90), 0, 0), verts=8)
parent(pole, root)
ladder = box('ladder', (0.4, 0.08, 1.6), (0, 3.6, 4.6), TIMBER_D, bev=0.02)
ladder.rotation_euler[0] = math.radians(18)
parent(ladder, root)

export(HERE)
