# Greenhouse — Blender headless build (Blender 3.0+).
# Victorian glasshouse interior: cast-iron arch ribs + ridge frame, glass panes,
# two staging benches with terracotta pots and clustered ferns, a hanging fern
# basket, a warm hanging lamp, watering can and hand tools on the bench.
# Every named part is a separate root object tagged fx_part. RULE: assign each
# sub-part's material BEFORE bpy.ops.object.join() or polys export material:null.
import bpy
import math
import os

HERE = os.path.dirname(os.path.abspath(__file__))
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.unit_settings.system = 'METRIC'
sc.unit_settings.scale_length = 1.0

def mat(name, col, rough=0.4, metal=0.0, emit=None, es=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*col, 1.0)
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
    if emit is not None:
        sock = bsdf.inputs.get('Emission') or bsdf.inputs.get('Emission Color')
        if sock is not None: sock.default_value = (*emit, 1.0)
        s = bsdf.inputs.get('Emission Strength')
        if s is not None: s.default_value = es
    return m

IRON     = mat('Iron',     (0.055, 0.060, 0.058), 0.38, 0.85)
IRON_EDGE= mat('IronEdge', (0.10, 0.10, 0.095),   0.30, 0.90)
GLASS    = mat('Glass',    (0.65, 0.72, 0.70),    0.06, 0.0)
WOOD     = mat('Wood',     (0.28, 0.17, 0.09),    0.62, 0.0)
WOOD_D   = mat('WoodDark', (0.17, 0.10, 0.055),   0.70, 0.0)
TERRA    = mat('Terra',    (0.42, 0.16, 0.075),   0.66, 0.0)
SOIL     = mat('Soil',     (0.055, 0.038, 0.025), 0.95, 0.0)
LEAF_A   = mat('LeafA',    (0.075, 0.20, 0.06),   0.50, 0.0)
LEAF_B   = mat('LeafB',    (0.12, 0.28, 0.075),   0.46, 0.0)
LEAF_C   = mat('LeafC',    (0.16, 0.30, 0.10),    0.44, 0.0)
BRASS    = mat('Brass',    (0.40, 0.22, 0.07),    0.34, 0.90)
STEEL    = mat('Steel',    (0.35, 0.37, 0.40),    0.38, 0.92)
LAMPM    = mat('LampGlow', (1.0, 0.62, 0.25),     0.40, 0.0, emit=(1.0, 0.5, 0.14), es=7.0)
WICKER   = mat('Wicker',   (0.30, 0.20, 0.10),    0.72, 0.0)
FLOOR    = mat('Floor',    (0.085, 0.075, 0.060), 0.82, 0.0)

def fxpart(ob, name):
    ob.name = name
    ob['fx_part'] = name
    return ob

def finish(ob, m=None, smooth=True, bevel=0.0, bevel_seg=3):
    if m is not None and len(ob.data.materials) == 0:
        ob.data.materials.append(m)
    if smooth:
        for p in ob.data.polygons: p.use_smooth = True
        try: ob.data.use_auto_smooth = True; ob.data.auto_smooth_angle = math.radians(60)
        except Exception: pass
    if bevel > 0:
        mod = ob.modifiers.new('bev', 'BEVEL')
        mod.width = bevel; mod.segments = bevel_seg
        mod.limit_method = 'ANGLE'
        bpy.context.view_layer.objects.active = ob
        try: bpy.ops.object.modifier_apply(modifier='bev')
        except Exception: pass
    return ob

def join_parts(ob, parts, m, bevel=0.0, bevel_seg=2):
    bpy.ops.object.select_all(action='DESELECT')
    for p in parts: p.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    return finish(ob, m, bevel=bevel, bevel_seg=bevel_seg)

def box(name, loc, scale, m, rot=(0,0,0), bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=loc, rotation=rot)
    ob = bpy.context.object
    ob.scale = scale
    ob.data.materials.append(m)
    finish(ob, bevel=bevel)
    return ob

def cyl(name, loc, r, d, m, verts=32, rot=(0,0,0), bevel=0.0):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=d,
        location=loc, rotation=rot)
    ob = bpy.context.object
    ob.data.materials.append(m)
    finish(ob, bevel=bevel)
    return ob

def sphere(name, loc, r, m, seg=24, rings=16, scale=(1,1,1)):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=rings,
        radius=r, location=loc)
    ob = bpy.context.object
    ob.scale = scale
    ob.data.materials.append(m)
    finish(ob)
    return ob

def torus(name, loc, R, minor, m, rot=(0,0,0)):
    bpy.ops.mesh.primitive_torus_add(major_segments=40, minor_segments=10,
        major_radius=R, minor_radius=minor, location=loc, rotation=rot)
    ob = bpy.context.object
    ob.data.materials.append(m)
    finish(ob)
    return ob

def rotmat(rad, axis):
    import mathutils
    return mathutils.Matrix.Rotation(rad, 4, axis)

# ---------------------------------------------------------------- floor
# brick-ish slab inside the glasshouse footprint
f = box('floor', (0, 0, -0.03), (3.4, 4.4, 0.06), FLOOR, bevel=0.01)
fxpart(f, 'floor')

# ---------------------------------------------------------------- frame
# Six arch ribs spanning the width: each rib = two posts + semicircular arch
# polyline tube. Built as one joined object per rib so the scene can stagger
# subtle glint/parallax by index.
def arch_rib(idx, y, W=3.0, H_POST=1.55, R=1.5):
    """posts at x=±W/2, arch apex reaching H_POST+R."""
    parts = []
    parts.append(cyl('p', (-W/2, y, H_POST/2), 0.035, H_POST, IRON, verts=20))
    parts.append(cyl('p', ( W/2, y, H_POST/2), 0.035, H_POST, IRON, verts=20))
    # arch: tube along a semicircle over the posts
    segs = 24
    pts = []
    for i in range(segs + 1):
        a = math.pi * i / segs
        pts.append((math.cos(a) * W/2, y, H_POST + math.sin(a) * R))
    curve = bpy.data.curves.new('arch', 'CURVE')
    curve.dimensions = '3D'
    curve.bevel_depth = 0.030
    curve.bevel_resolution = 2
    sp = curve.splines.new('POLY')
    sp.points.add(len(pts) - 1)
    for i, p in enumerate(pts):
        sp.points[i].co = (*p, 1.0)
    arch = bpy.data.objects.new('arch', curve)
    sc.collection.objects.link(arch)
    arch.data.materials.append(IRON)
    bpy.ops.object.select_all(action='DESELECT')
    arch.select_set(True)
    bpy.context.view_layer.objects.active = arch
    bpy.ops.object.convert(target='MESH')
    arch = bpy.context.object
    parts.append(arch)
    # decorative collar rings at the springing points
    parts.append(torus('c', (-W/2, y, H_POST), 0.055, 0.016, IRON_EDGE))
    parts.append(torus('c', ( W/2, y, H_POST), 0.055, 0.016, IRON_EDGE))
    join_parts(parts[0], parts, IRON, bevel=0.004)
    return fxpart(parts[0], f'frame_{idx}')

RIB_Y = [-2.4, -1.44, -0.48, 0.48, 1.44, 2.4]
for i, y in enumerate(RIB_Y):
    arch_rib(i, y)

# Ridge beam + wall rails + door-frame uprights at the far (back) end
parts = []
parts.append(cyl('ridge', (0, 0, 3.05), 0.035, 4.8, IRON, verts=20,
                 rot=(math.radians(90), 0, 0)))
for sx in (-1, 1):
    parts.append(cyl('rail', (sx*1.5, 0, 1.55), 0.022, 4.8, IRON, verts=16,
                     rot=(math.radians(90), 0, 0)))
    parts.append(cyl('rail', (sx*1.5, 0, 0.72), 0.022, 4.8, IRON, verts=16,
                     rot=(math.radians(90), 0, 0)))
join_parts(parts[0], parts, IRON)
fxpart(parts[0], 'rails')

# ---------------------------------------------------------------- panes
# Wall panes (two rows each side) + roof panes between ribs: thin boxes so the
# scene can give them alpha/fresnel/condensation shading.
def pane(name, loc, scale, rot=(0,0,0)):
    ob = box(name, loc, scale, GLASS, rot=rot)
    return fxpart(ob, name)

# left/right walls, two rows of panes between ribs
pane_id = 0
for sx in (-1, 1):
    for yi, y in enumerate([-1.92, -0.96, 0.0, 0.96, 1.92]):
        for zi, z in enumerate([0.75, 1.42]):
            pane(f'pane_{pane_id}', (sx*1.5, y, z), (0.012, 0.44, 0.30))
            pane_id += 1
# roof slope panes: half-arches approximated as two tilted slabs per side
for sx in (-1, 1):
    for yi, y in enumerate([-1.92, -0.96, 0.0, 0.96, 1.92]):
        pane(f'pane_{pane_id}', (sx*0.75, y, 2.55), (0.012, 0.44, 0.75),
             rot=(0, math.radians(-sx*38), 0))
        pane_id += 1
# back wall panes (far end, facing camera)
for xi, x in enumerate([-1.0, -0.5, 0.0, 0.5, 1.0]):
    for zi, z in enumerate([0.75, 1.42, 2.05]):
        pane(f'pane_{pane_id}', (x, -2.4, z), (0.46, 0.012, 0.30))
        pane_id += 1

# ---------------------------------------------------------------- benches
# Two staging benches along the walls: plank top + legs + lower shelf.
def bench(idx, cx, cy, ln=2.6):
    parts = []
    # three planks with small gaps
    for k in range(3):
        parts.append(box('plank', (cx + (k-1)*0.34, cy, 0.78),
                         (0.30, ln/2, 0.035), WOOD, bevel=0.008))
    for dy in (-ln/2 + 0.15, ln/2 - 0.15):
        for dx in (-0.42, 0.42):
            parts.append(box('leg', (cx + dx, cy + dy, 0.39),
                             (0.05, 0.06, 0.39), WOOD_D, bevel=0.006))
    parts.append(box('shelf', (cx, cy, 0.36), (0.95, ln/2, 0.025), WOOD_D, bevel=0.006))
    join_parts(parts[0], parts, WOOD, bevel=0.004)
    return fxpart(parts[0], f'bench_{idx}')

bench(0, -1.05, -0.4)
bench(1,  1.05,  0.9, ln=2.2)

# ---------------------------------------------------------------- pots+plants
# Terracotta pot with soil disc; plants as clustered leaf blades on stems.
def pot(name, x, y, z, r=0.13):
    parts = []
    bpy.ops.mesh.primitive_cone_add(vertices=28, radius1=r*0.72, radius2=r,
        depth=r*1.5, location=(x, y, z + r*0.75))
    p = bpy.context.object
    p.data.materials.append(TERRA)
    parts.append(p)
    # rim lip
    parts.append(torus('rim', (x, y, z + r*1.48), r*0.96, r*0.14, TERRA))
    # soil
    parts.append(cyl('soil', (x, y, z + r*1.44), r*0.82, 0.025, SOIL, verts=24))
    join_parts(parts[0], parts, TERRA, bevel=0.006)
    return fxpart(parts[0], name)

def leaf_mesh(name, length, width, m, droop=0.35, curl=0.3, seg=6):
    """Lanceolate leaf: centre-folded strip tapering to a point, bent along
    its length by `droop` (tip drop) and cupped by `curl` (V-section fold)."""
    verts, faces = [], []
    for i in range(seg + 1):
        u = i / seg                      # 0 at stem, 1 at tip
        w = width * math.sin(math.pi * min(u * 1.25, 1.0)) ** 0.8  # taper both ends
        y = -droop * u * u * length      # tip curves downward
        fwd = u * length * (1.0 - 0.28 * droop * u)
        # two half-width verts cupped around the midrib
        verts.append((-w, y - w * curl, fwd))
        verts.append((0.0, y, fwd))
        verts.append((w, y - w * curl, fwd))
    for i in range(seg):
        r0 = i * 3
        faces.append((r0, r0 + 3, r0 + 4, r0 + 1))
        faces.append((r0 + 1, r0 + 4, r0 + 5, r0 + 2))
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.update()
    ob = bpy.data.objects.new(name, me)
    sc.collection.objects.link(ob)
    ob.data.materials.append(m)
    finish(ob)
    return ob

def fern(name, x, y, z, r=0.13, blades=13, tall=0.35, leafmat=LEAF_A):
    """Cluster of arching fronds radiating from the pot — each frond is a
    folded leaf strip, alternating leaf materials for depth."""
    parts = []
    for b in range(blades):
        a = 2 * math.pi * b / blades + (b % 3) * 0.21
        ln = tall * (0.75 + 0.5 * ((b * 7) % 5) / 5)
        lf = leaf_mesh('leaf', ln, 0.055 + 0.012 * (b % 3),
                       [leafmat, LEAF_B, LEAF_C][b % 3],
                       droop=0.45 + 0.15 * (b % 2), curl=0.55)
        lf.location = (x, y, z + 0.02)
        lf.rotation_euler = (math.radians(18 + (b % 5) * 7), 0, a)
        parts.append(lf)
        # thin stem under outer fronds
        if b % 2 == 0:
            parts.append(cyl('stem',
                (x + math.cos(a) * r * 0.35, y + math.sin(a) * r * 0.35,
                 z + tall * 0.24),
                0.006, tall * 0.55, LEAF_C, verts=8,
                rot=(math.radians(30) * math.sin(a), -math.radians(30) * math.cos(a), 0)))
    # a few upright heart fronds in the middle
    for b in range(4):
        a = 2 * math.pi * b / 4 + 0.5
        lf = leaf_mesh('heart', tall * 0.9, 0.05, leafmat,
                       droop=0.18, curl=0.5)
        lf.location = (x, y, z + 0.02)
        lf.rotation_euler = (math.radians(4 + b * 3), 0, a)
        parts.append(lf)
    join_parts(parts[0], parts, leafmat, bevel=0.0)
    return fxpart(parts[0], name)

# pots on bench_0 (left wall bench)
pot('pot_0', -1.15, -1.15, 0.80)
fern('fern_0', -1.15, -1.15, 0.88, tall=0.38, leafmat=LEAF_A)
pot('pot_1', -0.95, -0.25, 0.80, r=0.11)
fern('fern_1', -0.95, -0.25, 0.87, r=0.11, blades=7, tall=0.30, leafmat=LEAF_B)
pot('pot_2', -1.12, 0.62, 0.80, r=0.10)
fern('fern_2', -1.12, 0.62, 0.86, r=0.10, blades=8, tall=0.34, leafmat=LEAF_C)
# pots on bench_1 (right wall bench)
pot('pot_3', 0.95, 0.45, 0.80, r=0.12)
fern('fern_3', 0.95, 0.45, 0.87, r=0.12, tall=0.36, leafmat=LEAF_B)
pot('pot_4', 1.12, 1.35, 0.80)
fern('fern_4', 1.12, 1.35, 0.88, tall=0.40, leafmat=LEAF_A)
# a floor pot in the foreground
pot('pot_5', 0.75, -1.75, 0.0, r=0.17)
fern('fern_5', 0.75, -1.75, 0.10, r=0.17, blades=11, tall=0.5, leafmat=LEAF_A)
# mid-aisle floor pots — mid-ground subjects between camera and the far wall
pot('pot_6', -0.30, -0.95, 0.0, r=0.16)
fern('fern_8', -0.30, -0.95, 0.09, r=0.16, blades=13, tall=0.55, leafmat=LEAF_C)
pot('pot_7', 0.30, 0.15, 0.0, r=0.13)
fern('fern_9', 0.30, 0.15, 0.08, r=0.13, blades=10, tall=0.42, leafmat=LEAF_B)

# ---------------------------------------------------------------- hanging
# hanging fern basket on a chain from the ridge, plus the warm lamp.
def hang_fern(name, x, y, z, drop):
    parts = []
    # chain
    parts.append(cyl('chain', (x, y, z + drop/2), 0.008, drop, STEEL, verts=8))
    # wicker basket (squashed sphere shell)
    bask = sphere('bask', (x, y, z), 0.20, WICKER, seg=24, rings=14,
                  scale=(1, 1, 0.55))
    parts.append(bask)
    # trailing fronds spilling over the rim
    for b in range(14):
        a = 2 * math.pi * b / 14 + (b % 3) * 0.2
        lf = leaf_mesh('leaf', 0.30 + 0.10 * (b % 3), 0.045,
                       [LEAF_A, LEAF_B, LEAF_C][b % 3],
                       droop=0.9, curl=0.55)
        lf.location = (x + math.cos(a) * 0.15, y + math.sin(a) * 0.15, z - 0.05)
        lf.rotation_euler = (math.radians(95 + (b % 4) * 8), 0, a)
        parts.append(lf)
    # upright crown
    for b in range(6):
        a = 2 * math.pi * b / 6 + 0.3
        lf = leaf_mesh('heart', 0.24, 0.045, LEAF_A, droop=0.35, curl=0.5)
        lf.location = (x, y, z + 0.05)
        lf.rotation_euler = (math.radians(22), 0, a)
        parts.append(lf)
    join_parts(parts[0], parts, LEAF_A, bevel=0.0)
    return fxpart(parts[0], name)

hang_fern('fern_6', -0.35, -1.6, 2.05, 0.95)
hang_fern('fern_7',  0.55,  1.6, 2.15, 0.80)

# Lamp: brass pendant + glowing bulb on a cord at the ridge, near camera-side.
def lamp():
    parts = []
    parts.append(cyl('cord', (0.55, -1.4, 2.55), 0.006, 1.00, STEEL, verts=8))
    # shade: flattened cone
    bpy.ops.mesh.primitive_cone_add(vertices=32, radius1=0.16, radius2=0.045,
        depth=0.12, location=(0.55, -1.4, 2.02))
    sh = bpy.context.object
    sh.data.materials.append(BRASS)
    parts.append(sh)
    # glowing bulb
    parts.append(sphere('bulb', (0.55, -1.4, 1.94), 0.055, LAMPM, seg=20, rings=12))
    join_parts(parts[0], parts, BRASS, bevel=0.004)
    return fxpart(parts[0], 'lamp')

lamp()

# ---------------------------------------------------------------- tools
# watering can on bench_0: body cylinder + spout + handle
def watering_can(x, y, z):
    parts = []
    parts.append(cyl('body', (x, y, z + 0.10), 0.10, 0.20, STEEL, verts=28, bevel=0.008))
    parts.append(cyl('spout', (x + 0.16, y, z + 0.16), 0.022, 0.34, STEEL, verts=16,
                     rot=(0, math.radians(55), 0)))
    parts.append(torus('handle', (x - 0.10, y, z + 0.16), 0.10, 0.014, STEEL,
                       rot=(0, math.radians(90), 0)))
    join_parts(parts[0], parts, STEEL, bevel=0.005)
    return fxpart(parts[0], 'watering_can')

watering_can(-0.98, -0.75, 0.80)

# hand tools on bench_1: trowel + snips lying flat
def tools():
    parts = []
    # trowel: handle + blade
    parts.append(cyl('th', (0.90, 1.15, 0.83), 0.016, 0.16, WOOD_D, verts=12,
                     rot=(0, math.radians(90), math.radians(20))))
    parts.append(box('tb', (0.90 + 0.14, 1.15 + 0.05, 0.83),
                     (0.09, 0.05, 0.012), STEEL, rot=(0, 0, math.radians(20)), bevel=0.006))
    # snips: two thin handles crossing a pivot sphere
    for sgn in (-1, 1):
        parts.append(cyl('sn', (1.02 + sgn*0.04, 1.7, 0.83), 0.009, 0.22, STEEL, verts=10,
                         rot=(0, math.radians(90), math.radians(sgn*14))))
    parts.append(sphere('piv', (1.02, 1.7, 0.83), 0.018, BRASS, seg=12, rings=8))
    join_parts(parts[0], parts, STEEL, bevel=0.004)
    return fxpart(parts[0], 'tools')

tools()

# ---------------------------------------------------------------- export
for ob in sc.objects:
    ob.select_set(True)

bpy.ops.export_scene.gltf(
    filepath=os.path.join(HERE, 'model.glb'),
    export_format='GLB',
    export_extras=True,
    export_yup=True,
    export_apply=True,
)
print('exported model.glb')
