# vaulted — ruined abbey nave kit, built headless.
#   ~/blender-4.2.3-linux-x64/blender -b --factory-startup --python build.py
# Authored axes: x = across the nave, y = up, z = along the nave (aisle runs
# along z). Blender maps (x, -z, y); export_yup gives y-up in three.js.
import bpy, math, random, os
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
TAU = math.tau
random.seed(11)


def mat(name, col, rough, metal=0.0, emit=None, es=0.0, alpha=1.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*col, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if emit:
        b.inputs['Emission Color'].default_value = (*emit, 1)
        b.inputs['Emission Strength'].default_value = es
    if alpha < 1.0:
        b.inputs['Alpha'].default_value = alpha
        m.surface_render_method = 'DITHERED'
    return m


STONE   = mat('StoneGrey',    (0.30, 0.30, 0.33), 0.88)
STONE_D = mat('StoneDark',    (0.20, 0.20, 0.23), 0.92)
FLOOR_M = mat('Flagstone',    (0.135, 0.14, 0.16), 0.85)
IVY_M   = mat('IvyGreen',     (0.075, 0.14, 0.055), 0.9)
IRON    = mat('IronDark',     (0.05, 0.052, 0.06), 0.5, 0.85)
WAX     = mat('CandleWax',    (0.78, 0.70, 0.55), 0.55)
FLAME   = mat('FlameCore',    (1.0, 0.55, 0.18), 0.4, 0.0, (1.0, 0.55, 0.16), 9.0)

parts = {}
def begin(name):
    parts[name] = {'objs': []}
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
        if bevel > 0:
            mod = o.modifiers.new('bev', 'BEVEL'); mod.width = bevel; mod.segments = 2
            bpy.context.view_layer.objects.active = o
            bpy.ops.object.modifier_apply(modifier='bev')
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
        # keep the frame continuous — an `up` swap between sections would
        # stitch opposite ring sides together
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
    for p in me.polygons: p.use_smooth = True
    add(name, o); return o


def lathe(name, profile, loc, rot=(0, 0, 0), matl=None, segs=40):
    """profile: list of (radius, height_offset); spun about authored +y."""
    F = []
    bl = P(*loc)
    V = []
    for (r, h) in profile:
        for i in range(segs):
            a = TAU * i / segs
            V.append((bl[0] + r * math.cos(a), bl[1] - r * math.sin(a), bl[2] + h))
    nr = len(profile)
    for j in range(nr - 1):
        for i in range(segs):
            a0 = j * segs + i; a1 = j * segs + (i + 1) % segs
            F.append((a0, a1, a1 + segs, a0 + segs))
    # caps
    V.append((bl[0], bl[1], bl[2] + profile[0][1])); bot = len(V) - 1
    V.append((bl[0], bl[1], bl[2] + profile[-1][1])); top = len(V) - 1
    for i in range(segs):
        F.append((bot, (i + 1) % segs, i))
        F.append((top, (nr - 1) * segs + i, (nr - 1) * segs + (i + 1) % segs))
    me = bpy.data.meshes.new(name); me.from_pydata(V, [], F); me.update()
    o = bpy.data.objects.new(name, me); sc.collection.objects.link(o)
    if rot != (0, 0, 0):
        o.rotation_euler = (rot[0], -rot[2], rot[1])
    if matl: me.materials.append(matl)
    for p in me.polygons: p.use_smooth = True
    add(name, o); return o


def displace(obj, amp, seed=0.0):
    for v in obj.data.vertices:
        c = v.co
        n = math.sin(c.x * 2.1 + c.z * 1.7 + seed) * 0.45 \
            + math.sin(c.y * 3.4 + c.x * 1.6) * 0.28 \
            + math.sin(c.z * 5.2 - c.y * 2.6) * 0.17 \
            + math.sin(c.x * 8.3 + c.z * 7.1 - c.y * 6.2 + seed) * 0.10
        v.co += c.normalized() * n * amp


def vcolor_noise(obj, seed, lo=0.55, tint=None):
    for a in list(obj.data.color_attributes):
        obj.data.color_attributes.remove(a)
    ca = obj.data.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT')
    for i, v in enumerate(obj.data.vertices):
        c = v.co + obj.location
        n = lo + (1.0 - lo) * (0.5 + 0.5 * math.sin(c.x * 2.6 + c.y * 1.9 + c.z * 3.9 + seed))
        if tint:
            g = lo * 0.8 + (1.0 - lo) * (0.5 + 0.5 * math.sin(c.z * 1.3 + c.x * 0.7 + seed))
            ca.data[i].color = (n * tint[0], max(n, g) * tint[1], n * tint[2], 1)
        else:
            ca.data[i].color = (n, n, n, 1)


def break_top(o, seed):
    """jagged displaced cap on a truncated column — reads as a snap, not a cut"""
    displace(o, 0.16, seed)
    for v in o.data.vertices:
        if v.co.z > 0.02:  # blender z = authored y; only shatter the top surface
            v.co.z += (0.5 + 0.5 * math.sin(v.co.x * 9.0 + v.co.y * 7.0 + seed)) * 0.22


# ================= floor =================
begin('floor')
prim('floor', 'box', (0, -0.2, 0), (19, 0.4, 42), matl=FLOOR_M, bevel=0.05)
# flagstone seams: thin dark strips sunk into the slab
for gx in range(-4, 5):
    prim('floor', 'box', (gx * 2.1, 0.005, 0), (0.05, 0.02, 40), matl=STONE_D)
for gz in range(-9, 10):
    prim('floor', 'box', (0, 0.005, gz * 2.1), (19, 0.02, 0.05), matl=STONE_D)

# ================= columns =================
begin('columns')
# (x, z, intact_height or None, break_height)
LAYOUT = [
    (-4.5, -12, 7.2, None), (-4.5, -6, 7.2, None), (-4.5, 0, None, 3.1),
    (-4.5, 6, 7.2, None), (-4.5, 12, 7.2, None),
    (4.5, -12, 7.2, None), (4.5, -6, None, 4.4), (4.5, 0, 7.2, None),
    (4.5, 6, 7.2, None), (4.5, 12, None, 1.9),
]
for (cx, cz, hi, bh) in LAYOUT:
    sd = cx * 3.1 + cz * 1.7
    lathe('columns', [(0.85, 0.0), (0.85, 0.22), (0.62, 0.5)], (cx, 0, cz), matl=STONE)  # plinth
    if hi:
        lathe('columns', [(0.56, 0.0), (0.52, hi - 1.1), (0.55, hi - 0.9)], (cx, 0.5, cz), matl=STONE)
        # capital: flared abacus
        lathe('columns', [(0.55, 0.0), (0.80, 0.34), (0.82, 0.5)], (cx, 0.5 + hi - 0.9, cz), matl=STONE)
        prim('columns', 'box', (cx, 0.5 + hi - 0.32, cz), (1.7, 0.18, 1.7), matl=STONE, bevel=0.03)
    else:
        h = bh
        shaft = lathe('columns', [(0.56, 0.0), (0.52, h)], (cx, 0.5, cz), matl=STONE)
        break_top(shaft, sd)
        # fallen drum beside the break
        prim('columns', 'cyl', (cx + 1.4, 0.5, cz + 1.2), (0.5, 1.7),
             rot=(math.pi / 2, 0.3, 0), matl=STONE_D, verts=18)

# ================= arches =================
begin('arches')
def pointed_arch(name, cx, z1, z2, spring=5.6, apex=8.6, r=0.20):
    mid = (z1 + z2) / 2
    pts = []
    for i in range(15):
        t = i / 14
        z = z1 + (z2 - z1) * t
        # two mirrored pointed arcs meeting at the apex
        u = abs(t - 0.5) * 2          # 1 at springs, 0 at apex
        y = spring + (apex - spring) * (1.0 - u ** 1.55)
        pts.append((cx, y, z))
    tube(name, pts, r, r * 0.85, STONE, ring=8)

# intact arcade bays along each row (skip bays at broken columns)
pointed_arch('arches', -4.5, -12, -6)
pointed_arch('arches', -4.5, 6, 12)
pointed_arch('arches', 4.5, 0, 6)
# broken transverse ribs overhead framing the breach — severed mid-span
def rib(name, z, x_from, x_to):
    pts = []
    for i in range(11):
        t = i / 10
        x = x_from + (x_to - x_from) * t
        u = 1 - abs(t - 0.5) * 2
        y = 7.4 + 3.2 * (u ** 0.7)
        pts.append((x, y, z))
    tube(name, pts, 0.16, 0.13, STONE, ring=8)
rib('arches', -9, -4.5, 1.4)   # severed
rib('arches', 3, -1.2, 4.5)    # severed other side

# ================= walls =================
begin('wall')
# ruined side walls: low, varying course height
for sx in (-7.2, 7.2):
    for i in range(9):
        z = -16 + i * 4.0
        h = 1.1 + 0.9 * abs(math.sin(i * 2.7 + sx))
        prim('wall', 'box', (sx, h / 2, z), (0.5, h, 4.05), matl=STONE_D, bevel=0.02)
        if i % 3 == 1:
            prim('wall', 'box', (sx, h + 0.25, z - 0.8), (0.55, 0.5, 2.2), matl=STONE_D, bevel=0.02)
# east end wall with a lancet opening (two piers + arc head + sill)
prim('wall', 'box', (-4.6, 4.4, -18.5), (8.0, 8.8, 0.6), matl=STONE_D, bevel=0.03)
prim('wall', 'box', (4.6, 4.4, -18.5), (8.0, 8.8, 0.6), matl=STONE_D, bevel=0.03)
prim('wall', 'box', (0, 7.9, -18.5), (2.6, 1.8, 0.6), matl=STONE_D, bevel=0.03)   # lancet head
prim('wall', 'box', (0, 0.5, -18.5), (3.0, 1.0, 0.7), matl=STONE_D, bevel=0.03)   # sill

# far (west) end wall — the tall gothic silhouette at the end of the nave:
# two heavy piers flanking a pointed lancet opening, broken mullion stub,
# crumbled upper courses
prim('wall', 'box', (-6.1, 5.0, 19.0), (7.8, 10.0, 0.9), matl=STONE_D, bevel=0.03)
prim('wall', 'box', (6.1, 5.0, 19.0), (7.8, 10.0, 0.9), matl=STONE_D, bevel=0.03)
prim('wall', 'box', (0, 0.55, 19.0), (4.6, 1.1, 1.0), matl=STONE_D, bevel=0.03)   # sill
# pointed head: two curved legs meeting at the apex (0, 10.5) — tubes, so the
# placement is absolute with no rotation ambiguity
tube('wall', [(-2.2, 6.3, 19.0), (-1.35, 8.6, 19.0), (0, 10.4, 19.0)], 0.34, 0.24, STONE_D, ring=7)
tube('wall', [(2.2, 6.3, 19.0), (1.35, 8.6, 19.0), (0, 10.4, 19.0)], 0.34, 0.24, STONE_D, ring=7)
# broken mullion stub rising from the sill, snapped off
tube('wall', [(0, 1.1, 19.0), (0.05, 2.4, 19.0), (-0.02, 3.8, 19.0)], 0.10, 0.06, STONE_D, ring=7)
# crumbled teeth along the wall tops
for i in range(7):
    x = -8 + i * 2.7 + (i % 2) * 0.4
    h = 0.5 + 0.7 * abs(math.sin(i * 2.9))
    prim('wall', 'box', (x, 10.0 + h / 2, 19.0), (1.7, h, 0.9), matl=STONE_D, bevel=0.04)

# ================= rubble =================
begin('rubble')
def rock(loc, r, seed, tint=True):
    o = prim('rubble', 'ico', loc, (r,), matl=STONE_D, verts=16)
    # angular chunks: stretch on a random axis, squash hard on y, then displace
    o.scale = (random.uniform(1.1, 1.7), random.uniform(0.45, 0.7), random.uniform(0.8, 1.2))
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.transform_apply(scale=True)
    displace(o, 0.55 * r, seed)
    vcolor_noise(o, seed, 0.45, (0.85, 1.0, 0.9) if tint else None)

random.seed(23)
for i in range(13):
    x = random.uniform(-5.5, 5.5)
    z = random.uniform(-14, 16)
    r = random.uniform(0.28, 0.85)
    rock((x, r * 0.4, z), r, i * 1.7)
# rubble mound under the breach edge
for i in range(5):
    rock((random.uniform(-2, 2), 0.2 + i * 0.15, 8.5 + random.uniform(-1.5, 1.5)),
         random.uniform(0.4, 0.9), 40 + i)

# ================= ivy =================
begin('ivy')
def ivy_climb(cx, cz, h, seed):
    pts = []
    for i in range(14):
        t = i / 13
        a = seed + t * 4.6
        pts.append((cx + math.cos(a) * 0.62, 0.3 + t * h, cz + math.sin(a) * 0.62))
    tube('ivy', pts, 0.045, 0.02, IVY_M, ring=6)
    # massed leaf clumps at irregular heights, not a strung row
    for i in range(7):
        t = 0.08 + 0.9 * (i / 7 + random.uniform(-0.04, 0.04))
        a = seed + t * 4.6
        bx, by, bz = cx + math.cos(a) * 0.58, 0.3 + t * h, cz + math.sin(a) * 0.58
        for k in range(random.randint(3, 5)):
            lf = prim('ivy', 'ico',
                      (bx + random.uniform(-0.3, 0.3), by + random.uniform(-0.25, 0.25),
                       bz + random.uniform(-0.3, 0.3)),
                      (random.uniform(0.06, 0.14),), matl=IVY_M, verts=8)
            lf.scale = (1.35, 0.16, 1.35)
            bpy.context.view_layer.objects.active = lf
            bpy.ops.object.transform_apply(scale=True)

ivy_climb(-4.5, -6, 6.4, 0.5)
ivy_climb(-4.5, 6, 5.2, 2.4)
ivy_climb(4.5, 0, 6.8, 4.1)
# ivy spilling down the east wall
for i in range(6):
    rock_ = prim('ivy', 'ico', (-1.5 + i * 0.9, 4.2 - i * 0.5, -18.1),
                 (random.uniform(0.15, 0.3),), matl=IVY_M, verts=8)
    rock_.scale = (1.4, 0.25, 0.9)
    bpy.context.view_layer.objects.active = rock_
    bpy.ops.object.transform_apply(scale=True)

# ================= sconce =================
begin('sconce')
# iron bracket arm off the south-east column + candle + flame
tube('sconce', [(4.45, 2.4, 6.0), (4.05, 2.45, 6.0), (4.0, 2.35, 6.0)], 0.035, 0.035, IRON, ring=6)
prim('sconce', 'cyl', (4.0, 2.42, 6.0), (0.09, 0.05), matl=IRON, verts=12)          # drip pan
prim('sconce', 'cyl', (4.0, 2.58, 6.0), (0.055, 0.28), matl=WAX, verts=12)          # candle
fl = prim('sconce', 'ico', (4.0, 2.84, 6.0), (0.055,), matl=FLAME, verts=10)        # flame teardrop
fl.scale = (0.65, 1.7, 0.65)
bpy.context.view_layer.objects.active = fl
bpy.ops.object.transform_apply(scale=True)

# ================= vertex colours =================
begin_done = parts

# ================= export =================
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
    if name in ('floor', 'columns', 'wall'):
        # stable seed — hash() varies per process (PYTHONHASHSEED)
        vcolor_noise(root, sum((i + 1) * ord(c) for i, c in enumerate(name)) % 10, 0.42)
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
