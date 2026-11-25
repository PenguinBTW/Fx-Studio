# brookside — autumn woodland brook kit, built headless.
#   ~/blender-4.2.3-linux-x64/blender -b --factory-startup --python build.py
# Authored axes: x = across the brook, y = up, z = along the brook (flow to -z).
import bpy, math, random, os
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
TAU = math.tau
random.seed(31)


def mat(name, col, rough, metal=0.0, emit=None, es=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*col, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if emit:
        b.inputs['Emission Color'].default_value = (*emit, 1)
        b.inputs['Emission Strength'].default_value = es
    return m


STONE   = mat('FieldStone',   (0.34, 0.32, 0.29), 0.9)
STONE_D = mat('WetStone',     (0.20, 0.19, 0.17), 0.75)
EARTH   = mat('BankEarth',    (0.16, 0.12, 0.08), 0.95)
LITTER  = mat('LeafLitter',   (0.30, 0.16, 0.06), 0.9)
MOSS    = mat('Moss',         (0.10, 0.20, 0.06), 0.95)
FERN    = mat('FernGreen',    (0.09, 0.24, 0.10), 0.9)
BARK    = mat('Bark',         (0.14, 0.10, 0.07), 0.95)
CANOPY_A = mat('CanopyAmber', (0.30, 0.15, 0.04), 0.9)
CANOPY_B = mat('CanopyOlive', (0.13, 0.14, 0.05), 0.95)
CANOPY_C = mat('CanopyRust',  (0.34, 0.20, 0.06), 0.9)
CANOPY = CANOPY_A
BEDROCK = mat('BedGravel',    (0.22, 0.18, 0.13), 0.9)
ARCH_ST = mat('ArchStone',    (0.42, 0.38, 0.32), 0.85)

parts = {}
def begin(name): parts[name] = {'objs': []}
def add(name, o):
    parts[name]['objs'].append(o); return o

def P(x, y, z): return (x, -z, y)


def prim(name, kind, loc, scale=(1, 1, 1), rot=(0, 0, 0), matl=None, verts=24, bevel=0.0):
    bl = P(*loc)
    if kind == 'box':
        bpy.ops.mesh.primitive_cube_add(location=bl)
        o = bpy.context.object
        o.scale = (scale[0] / 2, scale[2] / 2, scale[1] / 2)
        bpy.ops.object.transform_apply(scale=True)
        if bevel > 0:
            mod = o.modifiers.new('bev', 'BEVEL'); mod.width = bevel; mod.segments = 2
            bpy.context.view_layer.objects.active = o
            bpy.ops.object.modifier_apply(modifier='bev')
            for p in o.data.polygons: p.use_smooth = False
    elif kind == 'cyl':
        bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=scale[0], depth=scale[1], location=bl)
        o = bpy.context.object
        for p in o.data.polygons: p.use_smooth = True
    elif kind == 'sphere':
        bpy.ops.mesh.primitive_uv_sphere_add(segments=verts, ring_count=max(8, verts // 2), radius=scale[0], location=bl)
        o = bpy.context.object
        for p in o.data.polygons: p.use_smooth = True
    elif kind == 'ico':
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=scale[0], location=bl)
        o = bpy.context.object
        for p in o.data.polygons: p.use_smooth = True
    if rot != (0, 0, 0):
        o.rotation_euler = (rot[0], -rot[2], rot[1])
    if matl: o.data.materials.append(matl)
    add(name, o); return o


def tube(name, pts, r0, r1, matl, ring=8):
    pts = [P(*p) for p in pts]
    V, F = [], []
    n = len(pts)
    prev_a = None
    for i, p in enumerate(pts):
        t = (Vector(pts[min(i + 1, n - 1)]) - Vector(pts[max(i - 1, 0)])).normalized()
        up = Vector((0, 0, 1)) if abs(t.z) < 0.9 else Vector((1, 0, 0))
        a = t.cross(up).normalized()
        if prev_a is not None and a.dot(prev_a) < 0:
            a = -a
        b = t.cross(a).normalized()
        prev_a = a
        r = r0 + (r1 - r0) * i / (n - 1)
        for k in range(ring):
            th = TAU * k / ring
            V.append(tuple(Vector(p) + a * math.cos(th) * r + b * math.sin(th) * r))
    for i in range(n - 1):
        for k in range(ring):
            a0 = i * ring + k; a1 = i * ring + (k + 1) % ring
            F.append((a0, a1, a1 + ring, a0 + ring))
    me = bpy.data.meshes.new(name); me.from_pydata(V, [], F); me.update()
    o = bpy.data.objects.new(name, me); sc.collection.objects.link(o)
    me.materials.append(matl)
    add(name, o); return o


def displace(o, amp, seed):
    random.seed(seed)
    for v in o.data.vertices:
        d = Vector((random.uniform(-1, 1), random.uniform(-1, 1), random.uniform(-1, 1)))
        v.co += d * amp * random.uniform(0.4, 1.0)


def vcolor_noise(o, seed, lo=0.75, tint=None):
    me = o.data
    if 'Col' not in me.color_attributes:
        me.color_attributes.new(name='Col', type='FLOAT_COLOR', domain='POINT')
    ca = me.color_attributes['Col']
    random.seed(seed)
    n = random.uniform(0, 100)
    for i, v in enumerate(me.vertices):
        c = lo + 0.35 * math.sin(v.co.x * 3.1 + n) * math.sin(v.co.y * 2.7 + n * 1.3) \
            + 0.12 * math.sin(v.co.z * 5.3 + n * 0.7)
        c = max(0.15, min(1.0, c))
        g = c * (tint[1] if tint else 1.0)
        ca.data[i].color = (min(1, c * (tint[0] if tint else 1.0)),
                            min(1, g), min(1, c * (tint[2] if tint else 1.0)), 1)


# ================= bridge =================
begin('bridge')
# single arch footbridge spanning x across the channel at z ~ 0.
# arch ring: voussoir blocks along a half-arc, springing from the abutments.
SPRING_X, RISE, APR_Y = 3.4, 2.9, 1.3      # arc centre height & span
random.seed(41)
for side in (-1, 1):
    # abutment: battered stone pier rooted in the bank
    # outboard so the inner face sits just outside the spring line (+-3.4)
    prim('bridge', 'box', (side * 4.6, 2.0, 0), (2.0, 4.0, 2.6),
         rot=(0, 0, side * math.radians(3)), matl=STONE_D, bevel=0.06)
# voussoir ring — wedge blocks along the arc, slightly uneven
N_V = 13
for i in range(N_V):
    a = math.pi * (i + 0.5) / N_V
    cx = math.cos(a) * SPRING_X
    cy = APR_Y + math.sin(a) * RISE
    tang = a + math.pi / 2                       # block aligns to the arc
    w = 0.85 + 0.15 * math.sin(i * 2.3)
    # ring stands proud of the spandrel face so the arch silhouette reads
    prim('bridge', 'box', (cx, cy, 0), (w, 0.75 + 0.1 * (i % 2), 2.8),
         rot=(0, 0, -tang), matl=ARCH_ST, bevel=0.05)
# spandrel face courses — uneven blocks laid on the backing
for side in (-1, 1):
    for j in range(3):
        n = 4 - j
        for i in range(n):
            bx = side * (1.2 + i * 0.95 + j * 0.35)
            by = 4.55 + j * 0.42 + 0.05 * math.sin(i * 1.7 + j)
            prim('bridge', 'box', (bx, by, 1.0), (0.95, 0.45, 0.5),
                 matl=STONE, bevel=0.04)
            prim('bridge', 'box', (bx, by, -1.0), (0.95, 0.45, 0.5),
                 matl=STONE, bevel=0.04)
# deck slab + parapet cap stones (uneven heights — the hand-laid read)
prim('bridge', 'box', (0, 5.45, 0), (10.6, 0.5, 2.4), matl=LITTER, bevel=0.05)
random.seed(43)
for side in (-1, 1):
    x = -5.0
    while x < 5.2:
        w = random.uniform(0.7, 1.1)
        h = random.uniform(0.55, 0.85)
        prim('bridge', 'box', (x + w / 2, 5.7 + h / 2, side * 1.0),
             (w, h, 0.42), rot=(0, 0, random.uniform(-0.04, 0.04)),
             matl=STONE, bevel=0.05)
        x += w + random.uniform(0.02, 0.12)
# moss pads in the arch underside + on parapet joints
random.seed(47)
for i in range(14):
    # keep to the ring's mid-span — arc-end pads float off the abutment faces
    a = random.uniform(0.55, math.pi - 0.55)
    cx = math.cos(a) * (SPRING_X - 0.15)
    cy = APR_Y + math.sin(a) * (RISE - 0.15) - 0.28
    m = prim('bridge', 'ico', (cx, cy, random.uniform(-1.0, 1.0)),
             (random.uniform(0.15, 0.34),), matl=MOSS, verts=8)
    m.scale = (1.2, 0.35, 1.2); bpy.context.view_layer.objects.active = m
    bpy.ops.object.transform_apply(scale=True)
for i in range(8):
    m = prim('bridge', 'ico', (random.uniform(-5, 5), 6.25, random.choice((-1, 1))),
             (random.uniform(0.12, 0.25),), matl=MOSS, verts=8)
    m.scale = (1.3, 0.3, 1.3); bpy.context.view_layer.objects.active = m
    bpy.ops.object.transform_apply(scale=True)

# ================= ferns =================
begin('ferns')
def fern(cx, cy, cz, seed, n=6):
    random.seed(seed)
    for k in range(n):
        a = k / n * math.pi * 1.1 - math.pi * 0.55 + random.uniform(-0.15, 0.15)
        ln = random.uniform(0.45, 0.75)
        pts = [(cx, cy, cz),
               (cx + math.sin(a) * ln * 0.5, cy + ln * 0.7, cz + math.cos(a) * ln * 0.5),
               (cx + math.sin(a) * ln, cy + ln * 0.85, cz + math.cos(a) * ln)]
        tube('ferns', pts, 0.018, 0.008, FERN, ring=5)
        # leaflets as small flats along the frond tip
        for s in range(3):
            t = 0.55 + s * 0.16
            lx = cx + math.sin(a) * ln * t; ly = cy + ln * (0.5 + 0.4 * t); lz = cz + math.cos(a) * ln * t
            lf = prim('ferns', 'ico', (lx, ly, lz), (random.uniform(0.05, 0.09),), matl=FERN, verts=8)
            lf.scale = (1.6, 0.12, 0.8); bpy.context.view_layer.objects.active = lf
            bpy.ops.object.transform_apply(scale=True)

fern(-4.4, 3.6, 1.2, 3)
fern(4.5, 3.7, -1.0, 7)
fern(-3.9, 0.4, 3.5, 11)
fern(4.2, 0.5, -4.0, 13)

# ================= bed =================
begin('bed')
# channel floor strip + bed stones that read through the surface.
prim('bed', 'box', (0, -0.45, 0), (8.4, 0.9, 46), matl=BEDROCK, bevel=0.0)
random.seed(53)
BED_STONES = []
for i in range(26):
    x = random.uniform(-3.0, 3.0)
    z = random.uniform(-20, 20)
    r = random.uniform(0.3, 0.85)
    o = prim('bed', 'ico', (x, -0.05 + r * 0.12, z), (r,), matl=STONE_D, verts=10)
    o.scale = (random.uniform(1.0, 1.5), random.uniform(0.45, 0.7), random.uniform(0.9, 1.4))
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.transform_apply(scale=True)
    displace(o, 0.3 * r, i * 2.1)
    BED_STONES.append((x, z, r))
# named hero stones — the water shader traces foam around these
for i, (x, z, r) in enumerate([(-1.1, -4.5, 0.75), (1.4, -1.0, 0.9), (-0.4, 2.8, 0.7), (0.9, 6.2, 0.8)]):
    o = prim('bed', 'ico', (x, 0.08, z), (r,), matl=STONE, verts=12)
    o.scale = (1.35, 0.62, 1.2); bpy.context.view_layer.objects.active = o
    bpy.ops.object.transform_apply(scale=True)
    displace(o, 0.35 * r, 90 + i)

# ================= banks =================
begin('banks')
# sloped earth banks flanking the channel, leaf-littered tops
for side in (-1, 1):
    b = prim('banks', 'box', (side * 6.4, 1.0, 0), (5.2, 2.2, 46),
             rot=(0, 0, side * math.radians(-18)), matl=EARTH, bevel=0.1)
    # litter shelf along the top edge
    prim('banks', 'box', (side * 7.8, 2.05, 0), (3.2, 0.25, 44), matl=LITTER, bevel=0.05)
    displace(b, 0.25, side * 3 + 5)
# exposed roots reaching from the bank lip to the water
random.seed(59)
for i in range(7):
    side = -1 if i % 2 == 0 else 1
    x0 = side * random.uniform(4.0, 4.6)
    z0 = random.uniform(-14, 14)
    tube('banks', [(x0, 1.8, z0), (x0 - side * 0.5, 0.9, z0 + 0.3),
                   (x0 - side * 0.9, 0.15, z0 + 0.8)], 0.05, 0.015, BARK, ring=5)

# ================= stones (loose) =================
begin('stones')
random.seed(61)
for i in range(12):
    side = -1 if i % 2 == 0 else 1
    x = side * random.uniform(3.6, 4.4)
    z = random.uniform(-18, 18)
    r = random.uniform(0.25, 0.6)
    o = prim('stones', 'ico', (x, 0.15 + r * 0.2, z), (r,), matl=STONE_D, verts=10)
    o.scale = (random.uniform(1.0, 1.4), random.uniform(0.6, 0.9), random.uniform(0.9, 1.3))
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.transform_apply(scale=True)
    displace(o, 0.4 * r, 120 + i)

# ================= trees =================
begin('trees')
# leaning trunks + autumn canopy masses; two depth layers.
random.seed(67)
TRUNKS = [(-5.8, -6.5, -0.5), (5.9, -3.0, 0.6), (-6.2, 5.5, 0.4), (6.1, 9.0, -0.3)]
for i, (tx, tz, lean) in enumerate(TRUNKS):
    tube('trees', [(tx, 0, tz), (tx + lean * 0.8, 3.0, tz + 0.2),
                   (tx + lean * 1.6, 6.0, tz + 0.5)], 0.28, 0.12, BARK, ring=8)
    # canopy mass above — clustered flattened icos
    cxx, cyy, czz = tx + lean * 1.8, 7.2, tz + 0.6
    for k in range(5):
        a = k / 5 * TAU
        cm = (CANOPY_A, CANOPY_B, CANOPY_C)[k % 3]
        o = prim('trees', 'ico',
                 (cxx + math.cos(a) * 1.4, cyy + random.uniform(-0.4, 0.6), czz + math.sin(a) * 1.4),
                 (random.uniform(1.1, 1.8),), matl=cm, verts=10)
        o.scale = (1.25, 0.55, 1.25); bpy.context.view_layer.objects.active = o
        bpy.ops.object.transform_apply(scale=True)
        displace(o, 0.45, 200 + i * 9 + k)
# far canopy wall — big dark masses closing the background, mixed hues
for i in range(7):
    x = -14 + i * 4.5 + (i % 2) * 1.2
    cm = (CANOPY_B, CANOPY_A, CANOPY_C)[i % 3]
    o = prim('trees', 'ico', (x, 10.0 + (i % 3), 24 + (i % 2) * 3),
             (random.uniform(3.0, 4.5),), matl=cm, verts=10)
    o.scale = (1.3, 0.75, 1.1); bpy.context.view_layer.objects.active = o
    bpy.ops.object.transform_apply(scale=True)
    displace(o, 0.9, 300 + i)
for i in range(7):
    x = -13 + i * 4.2
    cm = (CANOPY_A, CANOPY_B, CANOPY_B)[i % 3]
    o = prim('trees', 'ico', (x, 10.2 + (i % 2), -23 - (i % 3) * 2),
             (random.uniform(3.2, 4.6),), matl=cm, verts=10)
    o.scale = (1.3, 0.75, 1.1); bpy.context.view_layer.objects.active = o
    bpy.ops.object.transform_apply(scale=True)
    displace(o, 0.9, 330 + i)

# ================= vertex colours =================
for name, p in parts.items():
    if len(p['objs']) > 1:
        bpy.ops.object.select_all(action='DESELECT')
        for o in p['objs']:
            if o.name in bpy.context.view_layer.objects: o.select_set(True)
        bpy.context.view_layer.objects.active = p['objs'][0]
        try:
            bpy.ops.object.join()
            parts[name]['root'] = bpy.context.view_layer.objects.active
        except RuntimeError:
            parts[name]['root'] = p['objs'][0]
    else:
        parts[name]['root'] = p['objs'][0]
    root = parts[name]['root']
    if name == 'bridge':
        vcolor_noise(root, 7, 0.5, (0.85, 1.05, 0.8))   # mossy cast
    elif name == 'trees':
        vcolor_noise(root, 11, 0.55, (1.15, 0.85, 0.55))  # amber/autumn cast
    elif name in ('banks', 'bed', 'stones'):
        vcolor_noise(root, 13, 0.5)
    root.name = name
    root['fx_part'] = name

bpy.ops.object.select_all(action='DESELECT')
for p in parts.values():
    try: p['root'].select_set(True)
    except Exception: pass
print('[export] parts:', ', '.join(parts.keys()))
bpy.ops.export_scene.gltf(filepath=os.path.join(HERE, 'model.glb'), export_format='GLB',
                          export_extras=True, export_yup=True, use_selection=True,
                          export_vertex_color='ACTIVE', export_all_vertex_colors=False)
