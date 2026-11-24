# Forge — Blender headless build (Blender 3.0+).
# Blacksmith's forge interior at dark: worn stump + horn anvil, brick hearth
# with coal bed, tool rack (tongs + hammers), quench tub, timber post with
# leather apron, stone floor + walls, small high window.
# Every piece becomes a named fx_part so the scene can sway/glow by name.
import bpy, math, json, os
from mathutils import Vector

OUT = os.path.dirname(os.path.abspath(__file__))
GLB = os.path.join(OUT, 'model.glb')

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for c in (bpy.data.curves, bpy.data.meshes, bpy.data.materials, bpy.data.cameras, bpy.data.lights):
    pass  # keep materials we create below

# ---------------------------------------------------------------- materials
def mat(name, rgb, rough=0.5, met=0.0, emit=None, es=0.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value = (*rgb, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = met
    if emit:
        e = b.inputs.get('Emission') or b.inputs.get('Emission Color')
        if e: e.default_value = (*emit, 1)
        s = b.inputs.get('Emission Strength')
        if s: s.default_value = es
    return m

STONE   = mat('Stone',   (0.10, 0.09, 0.085), 0.95, 0.0)
STONE_D = mat('StoneD',  (0.065, 0.06, 0.055), 0.98, 0.0)
BRICK   = mat('Brick',   (0.16, 0.07, 0.05), 0.85, 0.0)
WOOD    = mat('Wood',    (0.14, 0.075, 0.04), 0.8, 0.0)
WOOD_D  = mat('WoodD',   (0.09, 0.05, 0.028), 0.9, 0.0)
STUMP   = mat('Stump',   (0.11, 0.07, 0.045), 0.85, 0.0)
IRON    = mat('Iron',    (0.10, 0.10, 0.11), 0.45, 0.85)
IRON_D  = mat('IronD',   (0.06, 0.06, 0.065), 0.55, 0.8)
STEEL   = mat('Steel',   (0.16, 0.17, 0.18), 0.35, 0.95)
LEATHER = mat('Leather', (0.10, 0.05, 0.028), 0.7, 0.0)
COAL    = mat('Coal',    (0.015, 0.012, 0.012), 0.9, 0.2)
COALG   = mat('CoalGlow',(0.05, 0.01, 0.0), 0.6, 0.0, emit=(1.0, 0.18, 0.01), es=6.0)
HOT     = mat('Hot',     (0.25, 0.02, 0.0), 0.4, 0.7, emit=(1.0, 0.30, 0.02), es=7.0)
WATER   = mat('Water',   (0.02, 0.035, 0.045), 0.05, 0.0)
BRASS   = mat('Brass',   (0.30, 0.18, 0.06), 0.4, 0.9)
CANVAS_ = mat('Canvas',  (0.10, 0.085, 0.06), 0.9, 0.0)

# ---------------------------------------------------------------- helpers
def finish(ob, m):
    if not ob.data.materials:
        ob.data.materials.append(m)
    if hasattr(ob.data, 'polygons'):
        for p in ob.data.polygons: p.use_smooth = True
    return ob

def box(name, loc, scale, m, bevel=0.015, rot=(0,0,0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    ob = bpy.context.object; ob.scale = scale
    bpy.ops.object.transform_apply(scale=True)
    if bevel:
        mod = ob.modifiers.new('b', 'BEVEL'); mod.width = bevel; mod.segments = 2
    ob.data.materials.append(m)
    ob.name = name
    return ob

def cyl(name, loc, r, depth, m, verts=20, rot=(0,0,0)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth,
        location=loc, rotation=rot)
    ob = bpy.context.object; ob.name = name
    ob.data.materials.append(m)
    for p in ob.data.polygons: p.use_smooth = True
    return ob

def sphere(name, loc, r, m, seg=20, rings=12, scale=(1,1,1)):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=rings,
        radius=r, location=loc)
    ob = bpy.context.object; ob.scale = scale
    bpy.ops.object.transform_apply(scale=True)
    ob.name = name; ob.data.materials.append(m)
    for p in ob.data.polygons: p.use_smooth = True
    return ob

def ico(name, loc, r, m, subdiv=2, scale=(1,1,1)):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdiv, radius=r, location=loc)
    ob = bpy.context.object; ob.scale = scale
    bpy.ops.object.transform_apply(scale=True)
    ob.name = name; ob.data.materials.append(m)
    for p in ob.data.polygons: p.use_smooth = True
    return ob

def torus(name, loc, major, minor, m, rot=(0,0,0), seg=28, mseg=10):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor,
        major_segments=seg, minor_segments=mseg, location=loc, rotation=rot)
    ob = bpy.context.object; ob.name = name
    ob.data.materials.append(m)
    for p in ob.data.polygons: p.use_smooth = True
    return ob

def join_parts(root, parts, m=None, bevel=0.0):
    bpy.ops.object.select_all(action='DESELECT')
    for p in parts: p.select_set(True)
    bpy.context.view_layer.objects.active = root
    bpy.ops.object.join()
    if bevel:
        mod = root.modifiers.new('bev', 'BEVEL'); mod.width = bevel; mod.segments = 2

def fxpart(ob, name):
    ob.name = name
    ob['fx_part'] = name
    return ob

# ---------------------------------------------------------------- room
# floor slab + back/left walls (right & front stay open to the camera void)
fxpart(box('floor', (0, 0, -0.05), (3.4, 2.8, 0.05), STONE_D, bevel=0.0), 'floor')
wall = box('wb', (0, 2.6, 1.8), (3.4, 0.12, 1.9), STONE, bevel=0.0)
fxpart(wall, 'wall_b')
wall_l = box('wl', (-3.2, 0.4, 1.8), (0.12, 2.4, 1.9), STONE, bevel=0.0)
fxpart(wall_l, 'wall_l')
# timber lintel + posts (forge shed structure)
fxpart(box('lintel', (-0.4, 0.4, 3.45), (2.8, 0.10, 0.11), WOOD_D, bevel=0.02), 'lintel')
fxpart(box('post_0', (-2.9, 0.3, 1.7), (0.09, 0.09, 1.75), WOOD, bevel=0.015), 'post_0')
fxpart(box('post_1', (1.9, 2.45, 1.7), (0.09, 0.09, 1.75), WOOD, bevel=0.015), 'post_1')

# window frame high on the left wall — the shaft of pale light comes from here
def window():
    parts = [
        box('sill', (-3.05, -0.9, 2.15), (0.10, 0.55, 0.045), WOOD, bevel=0.01),
        box('top',  (-3.05, -0.9, 3.05), (0.10, 0.55, 0.045), WOOD, bevel=0.01),
        box('l',    (-3.05, -1.42, 2.6), (0.10, 0.045, 0.50), WOOD, bevel=0.01),
        box('r',    (-3.05, -0.38, 2.6), (0.10, 0.045, 0.50), WOOD, bevel=0.01),
        box('mull', (-3.05, -0.9, 2.6), (0.10, 0.03, 0.50), WOOD, bevel=0.008),
        box('mull2',(-3.05, -0.9, 2.6), (0.10, 0.55, 0.03), WOOD, bevel=0.008),
    ]
    join_parts(parts[0], parts)
    return fxpart(parts[0], 'window')
window()

# ---------------------------------------------------------------- hearth
# brick hearth box on the left, coal bed inside
def hearth():
    parts = [
        box('base', (-1.7, 1.9, 0.45), (0.95, 0.75, 0.45), BRICK, bevel=0.03),
        box('lip_f', (-1.7, 1.10, 0.90), (0.95, 0.16, 0.14), BRICK, bevel=0.02),
        box('lip_b', (-1.7, 2.62, 0.90), (0.95, 0.16, 0.14), BRICK, bevel=0.02),
        box('lip_l', (-2.68, 1.9, 0.90), (0.16, 0.75, 0.14), BRICK, bevel=0.02),
        box('lip_r', (-0.74, 1.9, 0.90), (0.16, 0.75, 0.14), BRICK, bevel=0.02),
        # chimney hood
        box('hood', (-1.7, 1.95, 2.6), (0.85, 0.55, 0.55), IRON_D, bevel=0.04),
        box('flue', (-1.7, 2.05, 3.4), (0.30, 0.28, 0.50), IRON_D, bevel=0.02),
    ]
    join_parts(parts[0], parts)
    return fxpart(parts[0], 'hearth')
hearth()

# coal bed: dark lumps + glowing embers as separate named part
def coalbed():
    import random
    rng = random.Random(11)
    dark, glow = [], []
    for i in range(30):
        x = -1.7 + rng.uniform(-0.75, 0.75)
        y = 1.9 + rng.uniform(-0.5, 0.5)
        z = 0.90 + rng.uniform(-0.02, 0.10)
        s = rng.uniform(0.05, 0.10)
        ob = ico('c', (x, y, z), s, COAL, subdiv=2,
                 scale=(1, 1, rng.uniform(0.5, 0.8)))
        ob.rotation_euler = (rng.uniform(0, 3), rng.uniform(0, 3), rng.uniform(0, 3))
        dark.append(ob)
    for i in range(9):
        x = -1.7 + rng.uniform(-0.55, 0.55)
        y = 1.9 + rng.uniform(-0.38, 0.38)
        z = 0.92 + rng.uniform(0.02, 0.09)
        glow.append(ico('g', (x, y, z), rng.uniform(0.035, 0.07), COALG, subdiv=2,
                        scale=(1, 1, rng.uniform(0.45, 0.7))))
    join_parts(dark[0], dark)
    fxpart(dark[0], 'coals')
    join_parts(glow[0], glow)
    fxpart(glow[0], 'embers')
coalbed()

# ---------------------------------------------------------------- anvil
def stump_anvil():
    # worn stump
    st = cyl('st', (0.55, 0.6, 0.32), 0.30, 0.64, STUMP, verts=24)
    st.scale = (1.0, 1.0, 1.0)
    fxpart(st, 'stump')
    # anvil: foot flange, waist, body, horn, heel, face plate
    parts = [
        box('foot', (0.55, 0.6, 0.68), (0.24, 0.17, 0.045), IRON_D, bevel=0.02),
        box('waist', (0.55, 0.6, 0.80), (0.17, 0.13, 0.09), IRON_D, bevel=0.02),
        box('body', (0.55, 0.6, 0.93), (0.30, 0.15, 0.09), IRON, bevel=0.02),
    ]
    # horn: cone pointing +x
    bpy.ops.mesh.primitive_cone_add(vertices=24, radius1=0.115, radius2=0.015,
        depth=0.38, location=(0.89, 0.6, 0.93), rotation=(0, math.pi/2, 0))
    horn = bpy.context.object; horn.data.materials.append(IRON)
    for p in horn.data.polygons: p.use_smooth = True
    parts.append(horn)
    parts.append(box('heel', (0.33, 0.6, 0.93), (0.10, 0.15, 0.09), IRON, bevel=0.015))
    # face plate (the hammer-worn surface)
    parts.append(box('face', (0.58, 0.6, 1.035), (0.24, 0.145, 0.025), STEEL, bevel=0.01))
    join_parts(parts[0], parts, bevel=0.0)
    return fxpart(parts[0], 'anvil')
stump_anvil()

# glowing workpiece resting on the anvil face
def workpiece():
    parts = [
        cyl('bar', (0.62, 0.62, 1.085), 0.022, 0.42, HOT, verts=12,
            rot=(0, math.pi/2, 0.10)),
        # tang still dark at the near end
        cyl('tang', (0.42, 0.635, 1.088), 0.017, 0.10, IRON_D, verts=10,
            rot=(0, math.pi/2, 0.10)),
    ]
    join_parts(parts[0], parts)
    return fxpart(parts[0], 'workpiece')
workpiece()

# hammer resting head-down on the anvil face edge
def hammer_on_anvil():
    parts = [
        cyl('hd', (0.68, 0.48, 1.05), 0.030, 0.14, IRON_D, verts=12,
            rot=(math.pi/2, 0, 0)),
        cyl('hh', (0.68, 0.48, 0.90), 0.014, 0.30, WOOD, verts=10,
            rot=(0.25, 0, 0)),
    ]
    join_parts(parts[0], parts)
    return fxpart(parts[0], 'hammer')
hammer_on_anvil()

# ---------------------------------------------------------------- rack
# tool rack: timber beam on the back wall + hooks, tongs, hammers
def rack():
    parts = [box('beam', (0.4, 2.45, 2.2), (1.6, 0.06, 0.09), WOOD_D, bevel=0.015)]
    join_parts(parts[0], parts)
    return fxpart(parts[0], 'rack')
rack()

def tongs(name, x, hang):
    parts = []
    for s in (-1, 1):
        parts.append(cyl('arm', (x + s*0.018, 2.44, hang - 0.30), 0.012, 0.60,
            STEEL, verts=8, rot=(s*0.10, 0, 0)))
        parts.append(torus('jaw', (x + s*0.030, 2.44, hang - 0.62), 0.035, 0.012,
            STEEL, rot=(math.pi/2, 0, 0), seg=16, mseg=6))
    join_parts(parts[0], parts)
    return fxpart(parts[0], name)
tongs('tongs_0', -0.3, 2.2)
tongs('tongs_1', 0.5, 2.2)

def hang_hammer(name, x, hang, s=1.0):
    parts = [
        cyl('hndl', (x, 2.44, hang - 0.28), 0.016*s, 0.56*s, WOOD, verts=10),
        cyl('head', (x, 2.44, hang - 0.02), 0.045*s, 0.16*s, IRON_D, verts=12,
            rot=(math.pi/2, 0, 0)),
    ]
    join_parts(parts[0], parts)
    return fxpart(parts[0], name)
hang_hammer('hham_0', 0.0, 2.2)
hang_hammer('hham_1', 0.9, 2.2, s=0.8)
hang_hammer('hham_2', 1.3, 2.2, s=0.7)

# ---------------------------------------------------------------- quench tub
def tub():
    # half-barrel: lathe profile slightly bulged
    pts = []
    prof = [(0.0, 0.0), (0.34, 0.0), (0.40, 0.30), (0.36, 0.62), (0.30, 0.62)]
    bpy.ops.mesh.primitive_cylinder_add(vertices=28, radius=0.36, depth=0.62,
        location=(1.75, 1.3, 0.33))
    t = bpy.context.object
    t.scale = (1.0, 1.0, 1.0)
    t.data.materials.append(WOOD_D)
    for p in t.data.polygons: p.use_smooth = True
    parts = [t,
        torus('b0', (1.75, 1.3, 0.12), 0.345, 0.02, IRON_D, rot=(0,0,0)),
        torus('b1', (1.75, 1.3, 0.52), 0.35, 0.02, IRON_D, rot=(0,0,0)),
    ]
    join_parts(parts[0], parts)
    fxpart(parts[0], 'tub')
    # dark water disc inside
    w = cyl('wat', (1.75, 1.3, 0.56), 0.30, 0.015, WATER, verts=24)
    return fxpart(w, 'water')
tub()

# ---------------------------------------------------------------- apron + stool
def apron():
    # leather apron hanging on post_0: a subdivided plane, slight belly
    import bmesh
    bpy.ops.mesh.primitive_plane_add(size=1, location=(-2.82, 0.32, 1.32),
        rotation=(0, math.pi/2, 0.14))
    ob = bpy.context.object
    me = ob.data
    bm = bmesh.new(); bm.from_mesh(me)
    for v in bm.verts:
        u = v.co.x + 0.5  # 0..1 top→bottom in plane local
        # taper: narrower at top (bib), flare slightly at skirt
        w = 0.28 + 0.14 * abs(u - 0.55)
        v.co.x *= w * 2
        v.co.z *= 0.62
        v.co.y += 0.05 * math.sin(u * math.pi)  # belly
    bm.to_mesh(me); bm.free()
    ob.data.materials.append(LEATHER)
    for p in ob.data.polygons: p.use_smooth = True
    sol = ob.modifiers.new('sol', 'SOLIDIFY'); sol.thickness = 0.01
    return fxpart(ob, 'apron')
apron()

# stool
def stool():
    parts = [
        cyl('seat', (1.15, -0.35, 0.42), 0.20, 0.05, WOOD, verts=20),
        cyl('l0', (1.06, -0.43, 0.20), 0.025, 0.40, WOOD_D, verts=8, rot=(0.10, 0.10, 0)),
        cyl('l1', (1.24, -0.43, 0.20), 0.025, 0.40, WOOD_D, verts=8, rot=(0.10, -0.10, 0)),
        cyl('l2', (1.15, -0.27, 0.20), 0.025, 0.40, WOOD_D, verts=8, rot=(-0.10, 0, 0)),
    ]
    join_parts(parts[0], parts)
    return fxpart(parts[0], 'stool')
stool()

# scattered horseshoes + an iron bar on the floor for story
def shoes():
    parts = []
    for i, (x, y, r) in enumerate([(0.1, -0.9, 0.0), (0.55, -1.15, 0.8), (-0.4, -0.5, 1.9)]):
        t = torus('sh', (x, y, 0.025), 0.075, 0.015, IRON_D,
                  rot=(r, 0, 0), seg=20, mseg=8)
        parts.append(t)
    join_parts(parts[0], parts)
    return fxpart(parts[0], 'shoes')
shoes()

# ---------------------------------------------------------------- export
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(
    filepath=GLB, export_format='GLB',
    export_extras=True, export_yup=True, export_apply=True,
)
print('exported', GLB)
