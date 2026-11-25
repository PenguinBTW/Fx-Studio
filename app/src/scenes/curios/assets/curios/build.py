# curios: cabinet-of-curiosities shelf macro still-life.
# Blender (x=right, y=depth(back+), z=up); three maps x→x, y→-z(depth), z→y(up)
# NOT the same axis map as forge — verify part positions on stills.
import bpy, math, random
from mathutils import Vector

random.seed(7)

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for m in list(bpy.data.meshes): bpy.data.meshes.remove(m)
for m in list(bpy.data.materials): bpy.data.materials.remove(m)
for c in list(bpy.data.collections): bpy.data.collections.remove(c)

def mat(name, color, metal=0.0, rough=0.5, emit=None):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = color
    b.inputs['Metallic'].default_value = metal
    b.inputs['Roughness'].default_value = rough
    if emit:
        sk = b.inputs.get('Emission Color') or b.inputs.get('Emission')
        sk.default_value = emit[0]
        b.inputs['Emission Strength'].default_value = emit[1]
    return m

OAK   = mat('Oak',   (0.16, 0.10, 0.05, 1), 0.0, 0.75)
OAKD  = mat('OakD',  (0.10, 0.06, 0.03, 1), 0.0, 0.85)
BRASS = mat('Brass', (0.32, 0.20, 0.07, 1), 0.9, 0.35)
IRON  = mat('Iron',  (0.10, 0.10, 0.12, 1), 0.85, 0.5)
GLASS = mat('Glass', (0.5, 0.6, 0.62, 1), 0.0, 0.05)
AMETH = mat('Ameth', (0.30, 0.12, 0.45, 1), 0.1, 0.25, emit=((0.35, 0.10, 0.55, 1), 0.6))
AMET2 = mat('Ameth2', (0.18, 0.07, 0.28, 1), 0.05, 0.4, emit=((0.15, 0.05, 0.25, 1), 0.4))
GEODE = mat('Geode', (0.08, 0.07, 0.07, 1), 0.0, 0.9)
PAPER = mat('Paper', (0.45, 0.38, 0.28, 1), 0.0, 0.9)
FACE  = mat('Face',  (0.30, 0.26, 0.20, 1), 0.0, 0.7)
WAX   = mat('Wax',   (0.35, 0.03, 0.03, 1), 0.0, 0.4)
HERB  = mat('Herb',  (0.12, 0.14, 0.06, 1), 0.0, 0.9)
STRING= mat('String',(0.30, 0.26, 0.18, 1), 0.0, 0.9)
WING  = mat('Wing',  (0.35, 0.28, 0.20, 1), 0.0, 0.8)
WICK  = mat('Wick',  (0.02, 0.02, 0.02, 1), 0.0, 0.9)
FLAME = mat('Flame', (1.0, 0.45, 0.10, 1), 0.0, 0.3, emit=((1.0, 0.42, 0.08, 1), 8.0))
LENSE = mat('Lense', (0.5, 0.55, 0.6, 1), 0.0, 0.02)
INK   = mat('Ink',   (0.05, 0.04, 0.03, 1), 0.0, 0.8)

parts = []
def fxpart(ob, name):
    ob.name = name
    ob['fx_part'] = name
    for p in ob.data.polygons: p.use_smooth = True
    parts.append(ob)
    return ob

def box(name, loc, sc, m, rot=(0,0,0), bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.object
    o.scale = (sc[0] * 2, sc[1] * 2, sc[2] * 2)  # sc is authored half-extents
    bpy.ops.object.transform_apply(scale=True)
    if bevel:
        mod = o.modifiers.new('b', 'BEVEL'); mod.width = bevel; mod.segments = 2
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.modifier_apply(modifier='b')
    o.data.materials.append(m)
    return fxpart(o, name)

def cyl(name, loc, r, d, m, rot=(0,0,0), v=24):
    bpy.ops.mesh.primitive_cylinder_add(vertices=v, radius=r, depth=d, location=loc, rotation=rot)
    o = bpy.context.object; o.data.materials.append(m)
    if len(o.data.polygons) < 60:
        mod = o.modifiers.new('b', 'BEVEL'); mod.width = 0.008; mod.segments = 2
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.modifier_apply(modifier='b')
    return fxpart(o, name)

def sphere(name, loc, r, m, scale=(1,1,1), subdiv=2):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdiv, radius=r, location=loc)
    o = bpy.context.object; o.scale = scale
    bpy.ops.object.transform_apply(scale=True)
    o.data.materials.append(m)
    return fxpart(o, name)

def torus(name, loc, R, r, m, rot=(0,0,0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r, major_segments=32,
        minor_segments=10, location=loc, rotation=rot)
    o = bpy.context.object; o.data.materials.append(m)
    return fxpart(o, name)

def cone(name, loc, r1, r2, d, m, rot=(0,0,0), v=12):
    bpy.ops.mesh.primitive_cone_add(vertices=v, radius1=r1, radius2=r2, depth=d,
        location=loc, rotation=rot)
    o = bpy.context.object; o.data.materials.append(m)
    return fxpart(o, name)

def join_parts(name, obs):
    for o in bpy.context.selected_objects: o.select_set(False)
    for o in obs: o.select_set(True)
    bpy.context.view_layer.objects.active = obs[0]
    bpy.ops.object.join()
    obs[0].name = name
    obs[0]['fx_part'] = name
    # the merged-away objects are now invalid — drop them from the part list
    for o in obs[1:]:
        parts.remove(o)
    parts.append(obs[0])
    return obs[0]

# ------------------------------------------------------------- shelf unit
# three oak planks + side posts + back boards, centered x=0, wall at y=0.55
def shelves():
    ps = []
    for i, z in enumerate([0.55, 1.18, 1.82]):
        ps.append(box(f'plank_{i}', (0, 0.30, z), (1.30, 0.32, 0.035), OAK, bevel=0.015))
    for sx in (-1, 1):
        ps.append(box(f'post_{sx}', (sx*1.28, 0.30, 1.20), (0.05, 0.34, 1.05), OAKD, bevel=0.012))
    for i, z in enumerate([0.85, 1.50, 2.10]):
        ps.append(box(f'back_{i}', (0, 0.60, z), (1.30, 0.04, 0.33), OAKD, bevel=0.01))
    for sx in (-1, 1):  # little side lips on the planks
        for i, z in enumerate([0.55, 1.18, 1.82]):
            ps.append(box(f'lip_{i}_{sx}', (sx*1.22, 0.30, z+0.05), (0.045, 0.30, 0.02), OAKD, bevel=0.008))
    return join_parts('shelves', ps)
shelves()

# ------------------------------------------------------------- amethyst geode
# bottom shelf left: outer dome (stone) + inner crystal cluster
def geode():
    cx, cy, cz = -0.78, 0.22, 0.72
    o = sphere('geode_shell', (cx, cy, cz), 0.20, GEODE, scale=(1.0, 0.80, 0.85))
    # split-geode: a tilted disc of tightly packed crystals, tips out of the shell
    from mathutils import Vector
    n = Vector((0.15, -0.45, 0.88)).normalized()      # face normal: up + toward shelf front
    u = n.cross(Vector((0, 0, 1))).normalized()
    w = n.cross(u).normalized()
    # violet bed under the points so the patch reads as one crystal face
    q = n.to_track_quat('Z', 'Y')
    fb = Vector((cx, cy, cz)) + n * 0.095
    fob = sphere('geode_face', tuple(fb), 0.135, AMET2, subdiv=2)
    fob.scale = (1.0, 1.0, 0.45)
    fob.rotation_euler = q.to_euler()
    i = 0
    for a in range(-5, 6):
        for b in range(-5, 6):
            aa = a * 0.022 + random.uniform(-0.006, 0.006)
            bb = b * 0.022 + random.uniform(-0.006, 0.006)
            if aa * aa + bb * bb > 0.0165: continue
            base = Vector((cx, cy, cz)) + u * aa + w * bb + n * (0.10 + random.uniform(-0.012, 0.012))
            jit = Vector((random.uniform(-0.08, 0.08), random.uniform(-0.08, 0.08), random.uniform(-0.08, 0.08)))
            qq = (n + jit).normalized().to_track_quat('Z', 'Y')
            cone(f'xc_{i}', tuple(base), random.uniform(0.014, 0.032), 0.001,
                 random.uniform(0.05, 0.12), AMETH, rot=tuple(qq.to_euler()))
            i += 1
geode()

# ------------------------------------------------------------- specimen bottles
# mid shelf: three corked bottles, moths inside
def bottle(i, x, y, z, tall):
    body = cyl(f'bottle_{i}', (x, y, z), 0.075, tall, GLASS, v=20)
    neck = cyl(f'neck_{i}', (x, y, z + tall/2 + 0.04), 0.034, 0.08, GLASS, v=16)
    cork = cyl(f'cork_{i}', (x, y, z + tall/2 + 0.095), 0.040, 0.07, OAKD, v=12)
    # moth: body + two forewings folded in a pinned-specimen V
    my, mz = y + 0.02, z - 0.02
    body_m = cyl(f'moth_{i}', (x, my, mz), 0.007, 0.09, INK, rot=(math.pi/2,0,0), v=8)
    wl = box(f'mwing_l_{i}', (x-0.028, my+0.008, mz), (0.032, 0.0035, 0.052), WING, rot=(0, 0.55, 0.62))
    wr = box(f'mwing_r_{i}', (x+0.028, my+0.008, mz), (0.032, 0.0035, 0.052), WING, rot=(0, -0.55, -0.62))
bottle(0, -0.30, 0.22, 1.34, 0.30)
bottle(1, -0.02, 0.30, 1.38, 0.34)
bottle(2,  0.24, 0.16, 1.32, 0.27)

# ------------------------------------------------------------- pocket watch
# top shelf right: brass case + glass face + gears + tick hand + chain
def watch():
    cx, cy, cz = 0.72, 0.20, 1.95
    # case: fat brass disc standing upright (face toward camera, -y)
    cyl('watch_case', (cx, cy, cz), 0.14, 0.05, BRASS, rot=(math.pi/2, 0, 0))
    cyl('watch_face', (cx, cy-0.028, cz), 0.115, 0.012, FACE, rot=(math.pi/2,0,0), v=28)
    cyl('watch_glass',(cx, cy-0.036, cz), 0.125, 0.008, LENSE, rot=(math.pi/2,0,0), v=28)
    torus('watch_ring', (cx, cy-0.033, cz), 0.128, 0.012, BRASS, rot=(math.pi/2,0,0))
    torus('watch_bow',  (cx, cy, cz+0.155), 0.035, 0.010, BRASS, rot=(0,0,0))
    # hour marks around the rim
    for hi in range(12):
        ha = hi * math.pi / 6
        box(f'hr_{hi}', (cx + math.sin(ha)*0.095, cy-0.0338, cz + math.cos(ha)*0.095),
            (0.006, 0.004, 0.014), IRON, rot=(0, ha, 0))
    # inner gears on the face: hub + ring of teeth per gear
    for gi, (gx, gz, gr) in enumerate([(-0.038, -0.030, 0.038), (0.042, 0.018, 0.030), (0.002, 0.052, 0.024)]):
        core = cyl(f'gear_{gi}', (cx+gx, cy-0.0345, cz+gz), gr, 0.006, BRASS, rot=(math.pi/2,0,0), v=16)
        teeth = []
        for ti in range(8):
            ta = ti * math.pi / 4
            teeth.append(box(f'gt_{gi}_{ti}', (cx+gx+math.sin(ta)*gr*1.06, cy-0.0345, cz+gz+math.cos(ta)*gr*1.06),
                (0.006, 0.007, 0.010), BRASS, rot=(0, ta, 0)))
        join_parts(f'gear_{gi}', [core] + teeth)
    # tick hand + hub (hand origin at the hub so rotation sweeps the dial)
    hand_ob = box('tick_hand', (cx, cy-0.0358, cz+0.045), (0.007, 0.004, 0.055), IRON)
    bpy.context.scene.cursor.location = (cx, cy-0.0358, cz)
    bpy.context.view_layer.objects.active = hand_ob
    hand_ob.select_set(True)
    bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    hand_ob.select_set(False)
    cyl('tick_hub', (cx, cy-0.0358, cz), 0.012, 0.008, BRASS, rot=(math.pi/2,0,0), v=10)
    # chain: a few links arcing to the right
    for i in range(5):
        torus(f'link_{i}', (cx+0.16+i*0.05, cy+0.01, cz-0.02-i*0.02), 0.018, 0.005, BRASS,
              rot=(0, math.pi/2, i*0.5))
watch()

# ------------------------------------------------------------- key
# bottom shelf center: skeleton key lying flat
def key():
    kx, ky, kz = -0.40, 0.12, 0.60
    torus('key_bow', (kx, ky, kz), 0.035, 0.010, IRON, rot=(math.pi/2,0,0))
    cyl('key_shaft', (kx+0.09, ky, kz), 0.008, 0.12, IRON, rot=(0, math.pi/2, 0), v=10)
    box('key_tooth_0', (kx+0.13, ky, kz-0.015), (0.012, 0.006, 0.012), IRON)
    box('key_tooth_1', (kx+0.16, ky, kz-0.015), (0.012, 0.006, 0.012), IRON)
key()

# ------------------------------------------------------------- scroll + seal
# mid shelf right: rolled parchment + red wax blob + stamp
def scroll():
    sx, sy, sz = 0.62, 0.28, 1.30
    cyl('scroll', (sx, sy, sz), 0.045, 0.30, PAPER, rot=(math.pi/2, 0, 0), v=20)
    cyl('scroll_end_l', (sx, sy-0.15, sz), 0.050, 0.012, PAPER, rot=(math.pi/2,0,0), v=20)
    cyl('scroll_end_r', (sx, sy+0.15, sz), 0.050, 0.012, PAPER, rot=(math.pi/2,0,0), v=20)
    sphere('wax', (sx, sy-0.02, sz-0.04), 0.030, WAX, scale=(1.0,1.0,0.5), subdiv=2)
    cyl('stamp', (sx, sy-0.02, sz-0.058), 0.020, 0.006, WAX, v=12)
    # ribbon around the roll
    torus('ribbon', (sx, sy, sz), 0.047, 0.006, WAX, rot=(math.pi/2,0,0))
scroll()

# ------------------------------------------------------------- magnifying loupe
# bottom shelf right, leaning on the geode side
def loupe():
    lx, ly, lz = -0.02, 0.14, 0.62
    torus('loupe_ring', (lx, ly, lz+0.10), 0.085, 0.012, BRASS, rot=(0.35, 0, 0.1))
    cyl('loupe_lens', (lx, ly+0.005, lz+0.10), 0.078, 0.008, LENSE, rot=(0.35,0,0.1), v=28)
    cyl('loupe_handle', (lx, ly, lz-0.03), 0.012, 0.16, OAKD, rot=(0.35,0,0.1), v=10)
loupe()

# ------------------------------------------------------------- herb bundles
# hanging above the top shelf from a peg rail
def herbs():
    rail = cyl('rail', (0, 0.42, 2.45), 0.015, 1.9, OAKD, rot=(0, math.pi/2, 0), v=10)
    for i, x in enumerate([-0.85, -0.55, -0.25, 0.05, 0.95]):
        z0 = 2.44
        cyl(f'string_{i}', (x, 0.42, z0-0.10), 0.004, 0.20, STRING, v=6)
        # leaf clump: cluster of small squashed icospheres around a knot
        for j in range(7):
            a = j * 0.9 + i
            px = x + math.cos(a)*0.04
            pz = z0 - 0.22 - j*0.012
            py = 0.42 + math.sin(a)*0.03
            sphere(f'leaf_{i}_{j}', (px, py, pz), 0.022, HERB,
                   scale=(1.0, 0.5, 1.6), subdiv=1)
        torus(f'tie_{i}', (x, 0.42, z0-0.18), 0.02, 0.006, STRING)
herbs()

# ------------------------------------------------------------- oil lamp
# top shelf far left: reservoir + wick + flame bead
def lamp():
    lx, ly, lz = -0.95, 0.30, 1.95
    sphere('lamp_base', (lx, ly, lz), 0.09, BRASS, scale=(1,1,0.75))
    cyl('lamp_neck', (lx, ly, lz+0.07), 0.03, 0.06, BRASS, v=12)
    cyl('wick', (lx, ly, lz+0.10), 0.008, 0.04, WICK, v=6)
    sphere('flame', (lx, ly, lz+0.14), 0.028, FLAME, scale=(0.7,0.7,1.5), subdiv=2)
    torus('lamp_loop', (lx, ly, lz+0.02), 0.10, 0.008, BRASS, rot=(0,0,0))
lamp()

# ------------------------------------------------------------- misc micro-props
# top shelf center: small book stack + brass astrolabe ring
box('book_0', (-0.10, 0.30, 1.87), (0.14, 0.11, 0.018), WAX, rot=(0,0,0.06), bevel=0.006)
box('book_1', (-0.10, 0.30, 1.91), (0.12, 0.10, 0.016), OAKD, rot=(0,0,-0.10), bevel=0.005)
torus('astro_ring', (-0.42, 0.26, 1.98), 0.09, 0.008, BRASS, rot=(0.3,0.2,0))
torus('astro_in', (-0.42, 0.26, 1.98), 0.06, 0.006, BRASS, rot=(0.3,0.2,0.8))
# a quill feather lying on the mid shelf
box('quill', (0.45, 0.10, 1.24), (0.10, 0.012, 0.004), WING, rot=(0,0.4,0.35), bevel=0.004)

# ------------------------------------------------------------- manifest + export
import json, os
manifest = {'parts': {}}
for o in bpy.data.objects:
    if o.get('fx_part'):
        manifest['parts'][o.name] = o.name
bpy.ops.object.select_all(action='SELECT')
out_dir = os.path.dirname(os.path.abspath(__file__))
bpy.ops.export_scene.gltf(
    filepath=os.path.join(out_dir, 'model.glb'),
    export_format='GLB', export_yup=True, export_apply=True,
    export_materials='EXPORT', export_animations=False, export_extras=True)
with open(os.path.join(out_dir, 'manifest.json'), 'w') as f:
    json.dump({'parts': manifest['parts']}, f, indent=1, sort_keys=True)
print('curios: %d parts' % len(manifest['parts']))
