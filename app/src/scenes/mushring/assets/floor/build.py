# Blender -> GLB: forest-floor macro kit for `mushring`.
# Authored space: x right, y up, z toward camera. All seeds deterministic.
import bpy, math, random, json, os
from mathutils import Vector

TAU = math.tau

for o in list(bpy.data.objects): bpy.data.objects.remove(o)
for m in list(bpy.data.meshes): bpy.data.meshes.remove(m)
for m in list(bpy.data.materials): bpy.data.materials.remove(m)
sc = bpy.context.scene.collection


def mat(name, color, rough=0.8, metal=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
    return m


CAP_RED = mat('CapRed',      (0.30, 0.035, 0.022), 0.48)
WART    = mat('WartCream',   (0.86, 0.79, 0.62), 0.62)
GILL    = mat('GillCream',   (0.62, 0.55, 0.40), 0.9)
STEM    = mat('StemCream',   (0.60, 0.53, 0.40), 0.92)
BOL     = mat('BoletusTan',  (0.40, 0.27, 0.15), 0.7)
PORE    = mat('PoreOchre',   (0.40, 0.28, 0.10), 0.9)
OYS     = mat('OysterGrey',  (0.42, 0.40, 0.46), 0.7)
MOSS    = mat('Moss',        (0.10, 0.18, 0.05), 0.95)
BARK    = mat('Bark',        (0.15, 0.10, 0.06), 0.9)
SHEEN   = mat('SlimeSheen',  (0.05, 0.07, 0.05), 0.15)
LITTER_A= mat('LitterRust',  (0.22, 0.10, 0.04), 0.9)
LITTER_B= mat('LitterBrown', (0.15, 0.09, 0.05), 0.95)
LITTER_C= mat('LitterGold',  (0.30, 0.17, 0.05), 0.9)
WEB     = mat('WebSilk',     (0.70, 0.72, 0.68), 0.45)
DEW     = mat('Dew',         (0.55, 0.65, 0.60), 0.05)
GROUND  = mat('GroundMoss',  (0.055, 0.075, 0.03), 0.95)
FERN    = mat('Fern',        (0.10, 0.20, 0.06), 0.9)
GRASS   = mat('GrassBlade',  (0.14, 0.22, 0.07), 0.9)
SNAIL   = mat('SnailBody',   (0.28, 0.20, 0.13), 0.7)
SHELL   = mat('ShellSpiral', (0.42, 0.30, 0.16), 0.55)
TWIG    = mat('Twig',        (0.18, 0.12, 0.07), 0.95)
ACORN   = mat('Acorn',       (0.35, 0.22, 0.09), 0.75)

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
    elif kind == 'torus':
        bpy.ops.mesh.primitive_torus_add(major_radius=scale[0], minor_radius=scale[1],
                                         major_segments=verts, minor_segments=8,
                                         location=bl)
        o = bpy.context.object
        for p in o.data.polygons: p.use_smooth = True
    if rot != (0, 0, 0):
        o.rotation_euler = (rot[0], -rot[2], rot[1])
    if matl: o.data.materials.append(matl)
    add(name, o); return o


def lathe(name, prof, segs, matl, a0=0.0, a1=TAU, cap_ends=False):
    """Spin a (r, y) authored profile about the authored Y axis.
    prof: list of (r, y). a0..a1 limits the arc (fans/shells)."""
    V, F = [], []
    n = len(prof)
    for i in range(segs + 1):
        a = a0 + (a1 - a0) * i / segs
        for (r, y) in prof:
            V.append(P(r * math.cos(a), y, r * math.sin(a)))
    for i in range(segs):
        for j in range(n - 1):
            a0i = i * n + j
            a1i = (i + 1) * n + j
            F.append((a0i, a1i, a1i + 1, a0i + 1))
    me = bpy.data.meshes.new(name); me.from_pydata(V, [], F); me.update()
    o = bpy.data.objects.new(name, me); sc.objects.link(o)
    me.materials.append(matl)
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
    o = bpy.data.objects.new(name, me); sc.objects.link(o)
    me.materials.append(matl)
    add(name, o); return o


def leaf_card(name, cx, cy, cz, w, l, rot_y, curl, matl):
    """Bent leaf: 4x5 grid curved along its length — reads as a real leaf at macro."""
    V, F = [], []
    NX, NY = 4, 5
    cr, sr = math.cos(rot_y), math.sin(rot_y)
    for j in range(NY + 1):
        v = j / NY
        yl = math.sin(v * math.pi) * curl * 0.25 + v * curl * 0.55
        for i in range(NX + 1):
            u = (i / NX - 0.5) * 2
            lx = u * w * (1.0 - 0.25 * v) * 0.5
            ly = yl - abs(u) * curl * 0.12
            lz = (v - 0.5) * l
            x = cx + lx * cr + lz * sr
            z = cz - lx * sr + lz * cr
            V.append(P(x, cy + ly, z))
    for j in range(NY):
        for i in range(NX):
            a = j * (NX + 1) + i
            F.append((a, a + 1, a + NX + 2, a + NX + 1))
    me = bpy.data.meshes.new(name); me.from_pydata(V, [], F); me.update()
    o = bpy.data.objects.new(name, me); sc.objects.link(o)
    me.materials.append(matl)
    add(name, o); return o


def seed_of(s):
    return sum((i + 1) * ord(c) for i, c in enumerate(s))


# ================= ground =================
begin('ground')
ground = prim('ground', 'box', (0, -0.18, 0), (17, 0.36, 15), matl=GROUND, bevel=0.02)
random.seed(seed_of('ground'))
for v in ground.data.vertices:
    bco = v.co
    bco.z += random.uniform(-0.05, 0.05) * (1.0 - min(1.0, (abs(bco.x) + abs(bco.y)) / 9.0))
# moss cushions mottling the floor
random.seed(seed_of('moss'))
for i in range(22):
    a = random.uniform(0, TAU); r = random.uniform(1.2, 7.5)
    m = prim('ground', 'ico', (math.cos(a) * r, 0.0, math.sin(a) * r),
             (random.uniform(0.08, 0.24),), matl=MOSS, verts=8)
    m.scale = (1.4, 0.45, 1.4); bpy.context.view_layer.objects.active = m
    bpy.ops.object.transform_apply(scale=True)


# ================= the fairy ring =================
begin('ring')
RING_R = 2.6
random.seed(seed_of('ring'))

def agaric(px, pz, s, lean=0.0):
    """Fly agaric: lathed cap w/ margin lip + gill slats + wart speckles + skirt."""
    # stem: cream lathe, slight foot flare
    lathe('ring', [(0.11*s, 0), (0.13*s, 0.05*s), (0.10*s, 0.35*s),
                   (0.085*s, 0.55*s), (0.09*s, 0.62*s)],
          20, STEM).location = P(px, 0, pz)
    # skirt ring
    prim('ring', 'torus', (px, 0.40*s, pz), (0.095*s, 0.02*s), matl=STEM, verts=20)
    # cap: dome with a downturned margin lip
    cap = lathe('ring', [
        (0.0, 0.60*s), (0.18*s, 0.595*s), (0.40*s, 0.60*s), (0.55*s, 0.63*s),
        (0.62*s, 0.70*s), (0.60*s, 0.82*s), (0.50*s, 0.93*s), (0.30*s, 1.00*s),
        (0.0, 1.03*s)],
        36, CAP_RED)
    cap.location = P(px, 0, pz)
    if lean: cap.rotation_euler = (lean * 0.6, 0, 0)
    # gills: radial slats under the cap
    random.seed(seed_of('gills' + str(px)))
    for k in range(20):
        a = TAU * k / 20
        g = prim('ring', 'box',
                 (px + 0.28*s * math.cos(a), 0.585*s, pz + 0.28*s * math.sin(a)),
                 (0.26*s, 0.028*s, 0.016*s), rot=(0, -a, 0), matl=GILL)
    # warts: cream flecks sitting ON the dome — flattened, proud of the skin
    random.seed(seed_of('warts' + str(px)))
    for k in range(24):
        a = random.uniform(0, TAU); r = random.uniform(0.06, 0.58*s)
        rr = r / (0.62*s)
        wy = 0.60*s + 0.43*s * math.sqrt(max(0.0, 1.0 - rr * rr)) * 0.97
        w = prim('ring', 'ico', (px + r * math.cos(a), wy, pz + r * math.sin(a)),
                 (random.uniform(0.038, 0.075)*s,), matl=WART, verts=8)
        w.scale = (1, 0.5, 1)   # flattened fleck, not a bead
        bpy.context.view_layer.objects.active = w
        bpy.ops.object.transform_apply(scale=True)


def boletus(px, pz, s):
    lathe('ring', [(0.13, 0), (0.17, 0.08), (0.14, 0.30), (0.13, 0.44)], 20, STEM
          ).location = P(px, 0, pz)
    lathe('ring', [(0.0, 0.42), (0.22, 0.41), (0.44, 0.43), (0.50, 0.50),
                   (0.44, 0.60), (0.28, 0.67), (0.0, 0.70)], 28, BOL
          ).location = P(px, 0, pz)
    # pore surface: dark underside disc
    prim('ring', 'cyl', (px, 0.425, pz), (0.42, 0.02), matl=PORE, verts=24)


def seedling(px, pz):
    lathe('ring', [(0.03, 0), (0.04, 0.05), (0.03, 0.14)], 12, STEM
          ).location = P(px, 0, pz)
    lathe('ring', [(0.0, 0.13), (0.09, 0.13), (0.11, 0.17), (0.07, 0.21), (0.0, 0.22)],
          16, CAP_RED).location = P(px, 0, pz)


# ring members: hero agarics on the camera arc — varied heights, one big
# off-center hero; boletus behind, buttons inside
for i, (a, s) in enumerate([(-0.7, 0.82), (-0.25, 1.18), (0.25, 0.95), (0.75, 0.70)]):
    x, z = math.sin(a) * RING_R, -math.cos(a) * RING_R
    agaric(x, z, s, lean=random.uniform(-0.07, 0.07))
for i, a in enumerate([1.35, 2.1, 2.9]):
    x, z = math.sin(a) * RING_R * 0.95, -math.cos(a) * RING_R * 0.95
    boletus(x, z, 1.0)
random.seed(seed_of('seedlings'))
for i in range(7):
    a = random.uniform(-1.2, 1.2); r = random.uniform(0.8, 2.1)
    seedling(math.sin(a) * r, -math.cos(a) * r + 0.4)
# a couple of strays outside the ring — rings leak
agaric(3.6, -2.9, 0.8)
seedling(-3.3, -2.2)


# ================= fallen log + snail =================
begin('log')
log = prim('log', 'cyl', (-3.4, 0.5, 0.9), (0.55, 4.4), rot=(0, 0, math.pi / 2), matl=BARK, verts=28)
random.seed(seed_of('log'))
for v in log.data.vertices:
    d = Vector((random.uniform(-1, 1), random.uniform(-1, 1), random.uniform(-1, 1)))
    v.co += d * 0.035 * random.uniform(0.4, 1.0)
# bark ridges: thin tubes wrapping along the log
random.seed(seed_of('bark'))
for i in range(6):
    y0 = 0.5 + random.uniform(-0.28, 0.28)
    z0 = 0.9 + random.uniform(-0.30, 0.30)
    tube('log', [(-5.3, y0 + random.uniform(-0.1, 0.1), z0),
                 (-3.4, y0 + random.uniform(-0.1, 0.1), z0 + random.uniform(-0.15, 0.15)),
                 (-1.5, y0 + random.uniform(-0.1, 0.1), z0)], 0.02, 0.015, BARK, ring=6)
# moss pads colonising the log top
random.seed(seed_of('logmoss'))
for i in range(12):
    x = random.uniform(-5.1, -1.7)
    m = prim('log', 'ico', (x, 0.95 + random.uniform(-0.06, 0.1), 0.9 + random.uniform(-0.3, 0.3)),
             (random.uniform(0.08, 0.2),), matl=MOSS, verts=8)
    m.scale = (1.5, 0.4, 1.5); bpy.context.view_layer.objects.active = m
    bpy.ops.object.transform_apply(scale=True)
# slime sheen: glossy ribbon along the log crown
sheen = prim('log', 'box', (-3.4, 1.04, 0.9), (3.6, 0.012, 0.5),
             rot=(0, 0, 0.02), matl=SHEEN, bevel=0.005)
# snail on the log: spiral shell + foot
sx, sz = -2.3, 0.75
tube('log', [(sx - 0.25, 1.02, sz), (sx, 1.04, sz), (sx + 0.22, 1.05, sz)],
     0.05, 0.035, SNAIL, ring=8)
shell = prim('log', 'ico', (sx - 0.02, 1.13, sz), (0.10,), matl=SHELL, verts=16)
shell.scale = (1.1, 0.9, 0.65); bpy.context.view_layer.objects.active = shell
bpy.ops.object.transform_apply(scale=True)
# eye stalks
tube('log', [(sx + 0.18, 1.06, sz), (sx + 0.24, 1.16, sz - 0.03)], 0.008, 0.006, SNAIL, ring=5)
tube('log', [(sx + 0.20, 1.06, sz), (sx + 0.27, 1.15, sz + 0.04)], 0.008, 0.006, SNAIL, ring=5)
# snail trail: glossy ribbon on the bark behind
tube('log', [(sx - 1.3, 1.02, sz + 0.1), (sx - 0.9, 1.045, sz - 0.05),
             (sx - 0.5, 1.03, sz + 0.04), (sx - 0.25, 1.035, sz)],
     0.018, 0.012, SHEEN, ring=6)


# ================= spider web =================
begin('web')
HUB = (1.95, 0.78, -1.55)
ANCHORS = [(2.75, 0.30, -1.30), (2.65, 0.85, -1.75), (2.4, 1.45, -1.5),
           (1.35, 1.35, -2.05), (1.15, 0.72, -1.9), (1.4, 0.25, -1.35)]
for a_pt in ANCHORS:
    mid = tuple((a_pt[k] + HUB[k]) / 2 for k in range(3))
    mid = (mid[0], mid[1] + (0.02 if a_pt[1] > HUB[1] else -0.01), mid[2])
    tube('web', [a_pt, mid, HUB], 0.004, 0.004, WEB, ring=5)
# capture spiral between the radials
random.seed(seed_of('web'))
for turn in range(4):
    frac = 0.30 + turn * 0.18
    pts = []
    for k in range(len(ANCHORS)):
        a_pt = ANCHORS[k]
        p = tuple(HUB[j] + (a_pt[j] - HUB[j]) * frac - (0.03 * (1 - frac) if j == 1 else 0)
                  for j in range(3))
        pts.append(p)
    pts.append(pts[0])
    tube('web', pts, 0.003, 0.003, WEB, ring=4)
# dew beads strung on the spiral
random.seed(seed_of('dew'))
for i in range(34):
    a = random.uniform(0, TAU); fr = random.uniform(0.30, 0.86)
    ang = a
    x = HUB[0] + math.cos(ang) * fr * 0.85
    y = HUB[1] + math.sin(ang) * fr * 0.55 - 0.02
    z = HUB[2] + math.sin(ang * 0.5) * fr * 0.15
    prim('web', 'ico', (x, y, z), (random.uniform(0.010, 0.020),), matl=DEW, verts=8)


# ================= ferns =================
begin('ferns')
def frond(bx, by, bz, yaw, pitch, scale=1.0):
    pts = [(bx, by, bz)]
    for k in range(1, 6):
        v = k / 5
        pts.append((bx + math.sin(yaw) * v * 1.1 * scale,
                    by + v * (1.4 * scale) * math.sin(pitch + 0.7),
                    bz - math.cos(yaw) * v * 1.1 * scale))
    tube('ferns', pts, 0.016 * scale, 0.008 * scale, FERN, ring=6)
    # leaflet pairs along the midrib
    random.seed(seed_of('frond' + str(bx) + str(bz)))
    for k in range(1, 6):
        v = k / 5
        px = pts[k][0]; py = pts[k][1]; pz = pts[k][2]
        ll = (1 - v * 0.65) * 0.16 * scale
        for sgn in (-1, 1):
            lf = prim('ferns', 'ico',
                      (px + math.cos(yaw) * sgn * ll * 0.6, py,
                       pz + math.sin(yaw) * sgn * ll * 0.6),
                      (ll,), matl=FERN, verts=8)
            lf.scale = (1.0, 0.18, 0.42)
            bpy.context.view_layer.objects.active = lf
            bpy.ops.object.transform_apply(scale=True)


random.seed(seed_of('ferns'))
for i, (bx, bz) in enumerate([(-5.2, -3.4), (4.9, -4.1), (-4.6, 3.0), (5.3, 2.2)]):
    for k in range(3):
        frond(bx + random.uniform(-0.3, 0.3), 0, bz + random.uniform(-0.3, 0.3),
              random.uniform(0, TAU), random.uniform(0.5, 0.9),
              random.uniform(0.8, 1.3))


# ================= grass blades =================
begin('blades')
random.seed(seed_of('blades'))
for i in range(26):
    # clumps biased to the near field — these are the bokeh fodder
    a = random.uniform(-0.9, 0.9); r = random.uniform(2.2, 5.5)
    bx = math.sin(a) * r + random.uniform(-0.4, 0.4)
    bz = -math.cos(a) * r - 1.6
    h = random.uniform(0.5, 1.4)
    lean = random.uniform(0.15, 0.55)
    yaw = random.uniform(0, TAU)
    tube('blades', [(bx, 0, bz),
                    (bx + math.sin(yaw) * lean * 0.4, h * 0.55, bz - math.cos(yaw) * lean * 0.4),
                    (bx + math.sin(yaw) * lean, h, bz - math.cos(yaw) * lean)],
         0.007, 0.0012, GRASS, ring=5)


# ================= background trunks =================
# far tree trunks — DoF smears them into soft vertical masses; the forest
# needs to exist behind the floor
begin('trunks')
random.seed(seed_of('trunks'))
for i in range(6):
    tx = random.uniform(-6.5, 6.5)
    tz = random.uniform(3.2, 7.0)
    tr = random.uniform(0.22, 0.5)
    tube('trunks', [(tx, -0.2, tz),
                    (tx + random.uniform(-0.3, 0.3), 3.0, tz + random.uniform(-0.2, 0.2)),
                    (tx + random.uniform(-0.5, 0.5), 6.5, tz + random.uniform(-0.3, 0.3))],
         tr, tr * 0.8, BARK, ring=8)


# ================= litter =================
begin('litter')
random.seed(seed_of('litter'))
for i in range(46):
    a = random.uniform(0, TAU); r = random.uniform(0.4, 7.2)
    lx, lz = math.cos(a) * r, math.sin(a) * r
    if -4.8 < lz < -3.0:
        continue    # keep the near-camera lane clean — cards there read as shards
    m = random.choice([LITTER_A, LITTER_B, LITTER_C])
    leaf_card('litter', lx, 0.02, lz,
              random.uniform(0.08, 0.17), random.uniform(0.12, 0.24),
              random.uniform(0, TAU), random.uniform(0.2, 1.0), m)
for i in range(10):
    a = random.uniform(0, TAU); r = random.uniform(1.0, 6.8)
    x, z = math.cos(a) * r, math.sin(a) * r
    tube('litter', [(x, 0.02, z), (x + random.uniform(-0.3, 0.3), 0.03,
                    z + random.uniform(-0.3, 0.3))],
         random.uniform(0.012, 0.02), 0.008, TWIG, ring=5)
for i in range(6):
    a = random.uniform(0, TAU); r = random.uniform(0.8, 5.0)
    prim('litter', 'ico', (math.cos(a) * r, 0.04, math.sin(a) * r),
         (random.uniform(0.03, 0.05),), matl=ACORN, verts=8)


# ================= export =================
roots = []
for name, part in parts.items():
    empty = bpy.data.objects.new(name, None)
    sc.objects.link(empty)
    for o in part['objs']:
        o.parent = empty
    roots.append(empty)

manifest = {
    'id': 'floor', 'version': 1, 'source': 'build.py',
    'budgets': {'tris': 90000, 'textureMB': 0},
    'parts': {n: n for n in parts},
}
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'manifest.json')
with open(out, 'w') as f:
    json.dump(manifest, f, indent=1)

bpy.ops.export_scene.gltf(
    filepath=os.path.join(os.path.dirname(os.path.abspath(__file__)), 'model.glb'),
    export_format='GLB',
    export_apply=True,
    export_vertex_color='ACTIVE',
    export_all_vertex_colors=False,
    export_yup=True,
)
print('FLOOR_KIT_EXPORTED parts=', list(parts.keys()))
