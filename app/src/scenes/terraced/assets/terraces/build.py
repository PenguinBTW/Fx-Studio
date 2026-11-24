# TERRACED hero: dry-stone terrace walls + a small stone barn + trees + a
# lantern figure, cinematic detail pass. 1 unit = 1 metre.
# Blender Z up, terraces step down toward -Z... mapped: ground heightfield
# terrH(x,z) is mirrored by the scene — the walls sit exactly on the steps.
#   terraces (root)
#   walls    (all dry-stone wall segments, segmented, beveled)
#   barn     (walls + roof + door + window)
#   path     (dirt steps + path slabs)
#   cypress  (one cloneable cypress at origin)
#   olive    (one cloneable olive at origin)
#   figure   (lantern figure at origin)
import bpy, os, sys, math, random
sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
from _bl import *

reset()
RNG = random.Random(41)

# ---------- materials (glTF exports factors only; scene adds noise maps) ----------
STONE   = mat('Stone',     (0.44, 0.36, 0.26), rough=0.95)
STONE2  = mat('StoneDark', (0.30, 0.26, 0.20), rough=0.97)
STONE3  = mat('StoneWarm', (0.48, 0.37, 0.25), rough=0.95)
STONE4  = mat('StonePale', (0.50, 0.42, 0.33), rough=0.93)
STONES  = [STONE, STONE2, STONE3, STONE4]
SLATE   = mat('Slate',     (0.15, 0.16, 0.20), rough=0.55, metal=0.15)
WOOD    = mat('WoodDoor',  (0.22, 0.15, 0.09), rough=0.85)
DIRT    = mat('DirtPath',  (0.42, 0.34, 0.24), rough=1.0)
CYP     = mat('Cypress',   (0.10, 0.16, 0.09), rough=0.9)
OLV     = mat('OliveLeaf', (0.26, 0.33, 0.20), rough=0.85)
TRUNK   = mat('Trunk',     (0.16, 0.11, 0.07), rough=0.95)
ROBE    = mat('Robe',      (0.16, 0.12, 0.10), rough=0.9)
SKIN    = mat('Skin',      (0.55, 0.40, 0.30), rough=0.7)
LANT    = mat('Lantern',   (0.9, 0.55, 0.18), rough=0.3, emit=(1.0, 0.55, 0.18), strength=5.0)
IRON    = mat('IronDark',  (0.08, 0.07, 0.07), rough=0.5, metal=0.8)
GLASS_B = mat('BarnGlass', (0.85, 0.55, 0.22), rough=0.35, emit=(1.0, 0.55, 0.2), strength=1.4)

LEVEL = 1.05   # terrace level height — MUST match the scene's terrH

def wander(x):  # same as the scene's heightfield wander
    return 0.5 * math.sin(x * 0.06) + 0.22 * math.sin(x * 0.17 + 1.3)

def bandZ_(x, k):  # z where level band k transitions (v crosses k*L at f=0.9)
    return ((k + 0.9) * LEVEL - wander(x)) / 0.18

root = empty('terraces'); root['fx_part'] = 'terraces'

# ---------- dry-stone walls: 8 levels, segmented, capstone row ----------
walls = empty('walls'); walls['fx_part'] = 'walls'; parent(walls, root)
seg = 6.0
for k in range(-1, -8, -1):
    x = -48.0
    while x < 48.0:
        x2 = x + seg + RNG.uniform(-0.8, 0.8)
        zm = bandZ_((x + x2) / 2, k)
        # wall base sits on the lower ledge; top proud of the upper ledge
        base = (k) * LEVEL - 0.15
        top = (k + 1) * LEVEL + 0.10 + RNG.uniform(-0.12, 0.30)
        if RNG.random() < 0.05: x = x2; continue  # collapsed gap
        m = RNG.choice(STONES)
        w = box(f'w{k}_{int(x*10)}', (x2 - x - 0.12, 0.55, top - base),
                ((x + x2) / 2, 0, (base + top) / 2), m, bev=0.05, seg=1)
        # tilt each segment to run along its local edge direction
        z1 = bandZ_(x, k); z2 = bandZ_(x2, k)
        w.location.y = (z1 + z2) / 2
        w.rotation_euler[2] = -math.atan2(z2 - z1, x2 - x)
        parent(w, walls)
        # capstone row: a thinner box on top, slightly proud
        c = box(f'c{k}_{int(x*10)}', (x2 - x - 0.08, 0.64, 0.13),
                ((x + x2) / 2, (z1 + z2) / 2, top + 0.05), STONE4 if RNG.random() < 0.4 else m, bev=0.04, seg=1)
        c.rotation_euler[2] = -math.atan2(z2 - z1, x2 - x)
        parent(c, walls)
        x = x2

# ---------- the barn on the fourth terrace down ----------
BX, BZ = -11.0, -23.5
BY = -4 * LEVEL + 0.0
barn = empty('barn', (BX, BZ, BY)); barn['fx_part'] = 'barn'; parent(barn, root)
# walls
bw = box('barnWalls', (5.4, 3.6, 3.3), (BX, BZ, BY + 1.65), STONE, bev=0.05); parent(bw, barn)
# corner quoins
for sx in (-2.6, 2.6):
    for sy in (-1.7, 1.7):
        q = box(f'quoin{sx}_{sy}', (0.24, 0.24, 3.3), (BX + sx, BZ + sy, BY + 1.65), STONE2, bev=0.03)
        parent(q, barn)
# door (south face, -y toward downhill)
door = box('barnDoor', (1.05, 0.12, 2.1), (BX + 0.7, BZ - 1.82, BY + 1.05), WOOD, bev=0.02)
parent(door, barn)
lint = box('barnLint', (1.45, 0.18, 0.24), (BX + 0.7, BZ - 1.82, BY + 2.22), STONE2, bev=0.02)
parent(lint, barn)
# small glowing window on the west gable
bwin = box('barnWin', (0.08, 0.55, 0.6), (BX - 2.73, BZ + 0.3, BY + 2.1), GLASS_B, bev=0.01)
parent(bwin, barn)
# second small window on the uphill (camera-side) face
bwin2 = box('barnWin2', (0.55, 0.08, 0.6), (BX + 0.9, BZ + 1.83, BY + 2.3), GLASS_B, bev=0.01)
parent(bwin2, barn)
# recessed doorway on the uphill face (the side the camera sees)
door2 = box('barnDoor2', (1.05, 0.12, 2.0), (BX - 1.1, BZ + 1.82, BY + 1.0), WOOD, bev=0.02)
parent(door2, barn)
lint2 = box('barnLint2', (1.45, 0.18, 0.24), (BX - 1.1, BZ + 1.82, BY + 2.12), STONE2, bev=0.02)
parent(lint2, barn)
# two voussoir jamb stacks around that doorway
for sgn in (-0.75, 0.75):
    j = box(f'barnJamb{sgn}', (0.16, 0.14, 2.1), (BX - 1.1 + sgn, BZ + 1.80, BY + 1.05), STONE3, bev=0.02)
    parent(j, barn)
# four-bar frame ring around the pane (a solid slab would cover it)
for nm, (sy, sz, py, pz) in {
    'wT': (0.62, 0.08, 0.0, 0.33), 'wB': (0.62, 0.08, 0.0, -0.33),
    'wL': (0.10, 0.58, -0.32, 0.0), 'wR': (0.10, 0.58, 0.32, 0.0),
}.items():
    wbar = box(f'barnWF{nm}', (0.10, sy, sz), (BX - 2.71, BZ + 0.3 + py, BY + 2.1 + pz), STONE2, bev=0.015)
    parent(wbar, barn)
# pitched roof: two slabs + ridge cap
for sgn in (-1, 1):
    slab = box(f'roof{sgn}', (6.0, 2.4, 0.16), (BX, BZ + sgn * 0.88, BY + 3.98), SLATE, bev=0.03,
               rot=(math.radians(sgn * -38), 0, 0))
    parent(slab, barn)
ridge = box('ridge', (6.05, 0.24, 0.14), (BX, BZ, BY + 4.80), SLATE, bev=0.02)
parent(ridge, barn)
# gable triangles (east + west)
for sgn in (-1, 1):
    bpy.ops.mesh.primitive_cone_add(vertices=3, radius1=1.82, depth=0.18,
        location=(BX + sgn * 2.68, BZ, BY + 3.75), rotation=(0, math.radians(90), 0))
    g = bpy.context.active_object; g.name = f'gable{sgn}'
    g.scale = (1, 0.62, 1); bpy.ops.object.transform_apply(scale=True)
    assign(g, STONE); smooth(g); parent(g, barn)

# ---------- the path: dirt slabs stepping down between walls ----------
path = empty('path'); path['fx_part'] = 'path'; parent(path, root)
def pathX(z):
    return 7.0 + 9.0 * math.sin(z * 0.115 + 0.6)
for i, z in enumerate([0.5 - j * 3.3 for j in range(16)]):
    x = pathX(z)
    # approximate terrace height at the path point (same formula as scene)
    v = 0.18 * z + wander(x)
    q = v / LEVEL
    import math as _m
    kk = _m.floor(q); f = q - kk
    def ss_(a, b, x_):
        t = min(1, max(0, (x_ - a) / (b - a)))
        return t * t * (3 - 2 * t)
    y = LEVEL * (kk + ss_(0.80, 1.0, f)) - 0.02
    # skip slabs that would clip a wall band — the gap reads as a stile
    near_wall = any(abs(z - bandZ_(x, k)) < 0.75 for k in range(-1, -8, -1))
    if near_wall:
        continue
    p = box(f'path{i}', (2.8, 3.9, 0.07), (x, z, y + 0.035), DIRT, bev=0.025, seg=1)
    parent(p, path)

# stone stile steps where the path meets a wall: 3 steps climbing the
# downhill face plus a capstone on the upper ledge
for i, z in enumerate([0.5 - j * 3.3 for j in range(16)]):
    x = pathX(z)
    for k in range(-1, -8, -1):
        zw = bandZ_(x, k)
        if abs(z - zw) < 1.7:
            for s_i in range(3):
                st = box(f'stile{i}_{k}_{s_i}', (1.6, 0.34, 0.2),
                         (x, zw + 0.55 + s_i * 0.38, k * LEVEL + 0.15 + s_i * 0.42), STONE2, bev=0.025, seg=1)
                parent(st, path)
            st2 = box(f'stile{i}_{k}u', (1.6, 0.4, 0.18),
                      (x, zw - 0.45, (k + 1) * LEVEL + 0.1), STONE2, bev=0.025, seg=1)
            parent(st2, path)
            break

# ---------- one cypress at origin (cloned by the scene) ----------
cyp = empty('cypress'); cyp['fx_part'] = 'cypress'; parent(cyp, root)
tr = cyl('cypTrunk', 0.09, 0.9, (0, 0, 0.45), TRUNK, verts=8)
parent(tr, cyp)
bpy.ops.mesh.primitive_cone_add(vertices=10, radius1=0.62, radius2=0.06, depth=3.4, location=(0, 0, 2.55))
c1 = bpy.context.active_object; c1.name = 'cypBody'
assign(c1, CYP); smooth(c1); bevel(c1, 0.06, 2); parent(c1, cyp)
bpy.ops.mesh.primitive_cone_add(vertices=10, radius1=0.45, radius2=0.02, depth=1.2, location=(0.05, 0, 4.3))
c2 = bpy.context.active_object; c2.name = 'cypTip'
assign(c2, CYP); smooth(c2); parent(c2, cyp)

# ---------- one olive at origin (cloned by the scene) ----------
olv = empty('olive'); olv['fx_part'] = 'olive'; parent(olv, root)
ot = cyl('olvTrunk', 0.16, 1.1, (0, 0, 0.55), TRUNK, verts=8, rot=(0.12, 0.05, 0))
parent(ot, olv)
for i, (px, py, pz, s) in enumerate([(0, 0, 1.55, 0.85), (0.55, 0.15, 1.35, 0.6), (-0.45, -0.1, 1.4, 0.65)]):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=s, location=(px, py, pz))
    oc = bpy.context.active_object; oc.name = f'olvBlob{i}'
    oc.scale = (1.25, 1.0, 0.72); bpy.ops.object.transform_apply(scale=True)
    assign(oc, OLV); smooth(oc); parent(oc, olv)

# ---------- the lantern figure at origin ----------
fig = empty('figure'); fig['fx_part'] = 'figure'; parent(fig, root)
bpy.ops.mesh.primitive_cone_add(vertices=12, radius1=0.30, radius2=0.16, depth=1.25, location=(0, 0, 0.63))
robe = bpy.context.active_object; robe.name = 'robe'
assign(robe, ROBE); smooth(robe); bevel(robe, 0.03, 2); parent(robe, fig)
bpy.ops.mesh.primitive_uv_sphere_add(segments=14, ring_count=10, radius=0.115, location=(0, 0, 1.38))
head = bpy.context.active_object; head.name = 'head'
assign(head, SKIN); smooth(head); parent(head, fig)
bpy.ops.mesh.primitive_cone_add(vertices=12, radius1=0.15, radius2=0.0, depth=0.34, location=(0, 0.02, 1.55))
hood = bpy.context.active_object; hood.name = 'hood'
assign(hood, ROBE); smooth(hood); parent(hood, fig)
# arm holding the lantern out to the right
arm = cyl('arm', 0.045, 0.52, (0.24, -0.06, 1.05), ROBE, rot=(0, math.radians(70), 0), verts=8)
parent(arm, fig)
# lantern: iron cage + glowing core
cage = box('cage', (0.16, 0.16, 0.26), (0.5, -0.16, 0.88), IRON, bev=0.015)
parent(cage, fig)
core = box('lcore', (0.10, 0.10, 0.17), (0.5, -0.16, 0.87), LANT, bev=0.01)
parent(core, fig)
handle = cyl('handle', 0.012, 0.16, (0.5, -0.16, 1.06), IRON, verts=6)
parent(handle, fig)

print('tris', tris())
export(HERE)
