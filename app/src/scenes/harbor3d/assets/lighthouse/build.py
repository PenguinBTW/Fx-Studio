# HARBORLIGHT lighthouse: stone tower on a rock stack — tapered whitewashed
# drum with two dark bands, gallery deck + iron rail, glass lantern room with
# mullions and a warm lamp inside, domed cap + finial, a door and windows,
# and a wave-sculpted rock base. Origin = rock top centre (tower base y=0).
# Units: metres-ish (1 = one world unit in scene). Blender is Z-up; authored
# coords are (x, y=UP, z=depth) mapped via P().
# Run: blender -b --factory-startup --python build.py
import bpy, math, os, random
from mathutils import Vector
HERE = os.path.dirname(os.path.abspath(__file__))
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
TAU = math.tau
random.seed(7)

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

STONE_W  = mat('StoneWhite',  (0.66, 0.63, 0.58), 0.82, 0.0)
STONE_B  = mat('BandSlate',   (0.10, 0.11, 0.14), 0.78, 0.0)
ROCK     = mat('RockWet',     (0.055, 0.058, 0.068), 0.92, 0.0)
IRON     = mat('IronDark',    (0.045, 0.048, 0.055), 0.45, 0.9)
BRASS    = mat('BrassTrim',   (0.38, 0.26, 0.10), 0.30, 1.0)
GLASS    = mat('LensGlass',   (0.55, 0.62, 0.66), 0.08, 0.0, alpha=0.30)
LAMP     = mat('LampCore',    (1.0, 0.80, 0.45), 0.35, 0.0, (1.0, 0.72, 0.32), 8.0)
WINDOW_M = mat('WindowGlass', (0.05, 0.07, 0.09), 0.10, 0.3)
DOOR_M   = mat('DoorIron',    (0.06, 0.065, 0.075), 0.55, 0.8)

parts = {}
def begin(name):
    parts[name] = {'objs': []}
def add(name, o):
    parts[name]['objs'].append(o); return o

def P(x, y, z): return (x, -z, y)

def prim(name, kind, loc, scale=(1,1,1), rot=(0,0,0), matl=None, verts=32, bevel=0.0):
    bl = P(*loc)
    if kind == 'box':
        bpy.ops.mesh.primitive_cube_add(location=bl)
        o = bpy.context.object
        o.scale = (scale[0]/2, scale[2]/2, scale[1]/2)
        bpy.ops.object.transform_apply(scale=True)
        if bevel > 0:
            mod = o.modifiers.new('bev', 'BEVEL'); mod.width = bevel; mod.segments = 3
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
        bpy.ops.mesh.primitive_uv_sphere_add(segments=verts, ring_count=max(8, verts//2), radius=scale[0], location=bl)
        o = bpy.context.object
        for p in o.data.polygons: p.use_smooth = True
    elif kind == 'torus':
        bpy.ops.mesh.primitive_torus_add(major_radius=scale[0], minor_radius=scale[1], major_segments=verts, minor_segments=8, location=bl)
        o = bpy.context.object
        for p in o.data.polygons: p.use_smooth = True
    if rot != (0,0,0):
        o.rotation_euler = (rot[0], -rot[2], rot[1])
    if matl: o.data.materials.append(matl)
    add(name, o); return o

def tube(name, pts, r0, r1, matl, ring=8):
    pts = [P(*p) for p in pts]
    V, F = [], []
    n = len(pts)
    for i, p in enumerate(pts):
        t = (Vector(pts[min(i+1, n-1)]) - Vector(pts[max(i-1, 0)])).normalized()
        up = Vector((0,0,1)) if abs(t.z) < 0.9 else Vector((1,0,0))
        a = t.cross(up).normalized(); b = t.cross(a).normalized()
        r = r0 + (r1 - r0) * i / (n - 1)
        for k in range(ring):
            th = TAU * k / ring
            V.append(tuple(Vector(p) + a*math.cos(th)*r + b*math.sin(th)*r))
    for i in range(n-1):
        for k in range(ring):
            a0 = i*ring+k; a1 = i*ring+(k+1)%ring
            F.append((a0, a1, a1+ring, a0+ring))
    me = bpy.data.meshes.new(name); me.from_pydata(V, [], F); me.update()
    o = bpy.data.objects.new(name, me); sc.collection.objects.link(o)
    me.materials.append(matl)
    for p in me.polygons: p.use_smooth = True
    add(name, o); return o

def lathe(name, profile, loc, rot=(0,0,0), matl=None, segs=48):
    """profile: list of (radius, z) — spun around Z (my +y up after P map)."""
    V, F = [], []
    n = len(profile)
    for i, (r, z) in enumerate(profile):
        for k in range(segs):
            th = TAU * k / segs
            V.append((r*math.cos(th), r*math.sin(th), z))
    for i in range(n-1):
        for k in range(segs):
            a0 = i*segs+k; a1 = i*segs+(k+1)%segs
            F.append((a0, a0+segs, a1+segs, a1))
    me = bpy.data.meshes.new(name); me.from_pydata(V, [], F); me.update()
    me.materials.append(matl)
    for p in me.polygons: p.use_smooth = True
    o = bpy.data.objects.new(name, me); sc.collection.objects.link(o)
    o.location = P(*loc); o.rotation_euler = rot
    add(name, o); return o

# ---------- rock stack (origin sits on its top) ----------
begin('rock')
# displaced ico sphere squashed into a sea stack: wide below the waterline
# (y<0 reads as submerged skirt), shoulders above
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=4, radius=3.4, location=P(0, -1.1, 0))
rock = bpy.context.object
rock.scale = (1.15, 1.0, 1.0)
bpy.ops.object.transform_apply(scale=True)
for v in rock.data.vertices:
    c = v.co
    n = math.sin(c.x * 2.1 + c.z * 1.7) * 0.5 + math.sin(c.y * 3.3 + c.x * 1.1) * 0.3 \
        + math.sin(c.z * 4.1 - c.y * 1.9) * 0.2
    v.co += c.normalized() * n * 0.22
rock.data.materials.append(ROCK)
for p in rock.data.polygons: p.use_smooth = False  # craggy flat shading
add('rock', rock)
# a cap stone the tower sits on
prim('rock', 'cyl', (0, -0.25, 0), (2.6, 0.5), matl=ROCK, verts=24, bevel=0.08)
# scattered ledge stones
for i in range(6):
    a = i / 6 * TAU + 0.3
    r = 3.0 + random.uniform(-0.2, 0.4)
    prim('rock', 'sphere', (math.cos(a) * r, -0.9 + random.uniform(-0.6, 0.3), math.sin(a) * r),
         (random.uniform(0.5, 1.0),), matl=ROCK, verts=12)

# ---------- stone tower: white drum with two slate bands ----------
begin('tower')
# tapered drum: lathe profile (radius, height) — slight batter and a base plinth
lathe('tower', [(2.75, 0.0), (2.55, 0.25), (2.30, 0.5), (1.92, 0.6)], (0, 0, 0), matl=STONE_B, segs=48)  # plinth
lathe('tower', [(1.92, 0.6), (1.80, 3.0)], (0, 0.6, 0), matl=STONE_W, segs=48)                          # white lower
lathe('tower', [(1.80, 0.0), (1.70, 0.9)], (0, 3.0, 0), matl=STONE_B, segs=48)                          # band 1
lathe('tower', [(1.70, 0.0), (1.58, 2.4)], (0, 3.9, 0), matl=STONE_W, segs=48)                          # white middle
lathe('tower', [(1.58, 0.0), (1.50, 0.8)], (0, 6.3, 0), matl=STONE_B, segs=48)                          # band 2
lathe('tower', [(1.50, 0.0), (1.42, 1.4)], (0, 7.1, 0), matl=STONE_W, segs=48)                          # crown to gallery
lathe('tower', [(1.42, 0.0), (1.75, 0.28)], (0, 8.5, 0), matl=STONE_B, segs=48)                         # cornice flare
# stone coursing hint: thin recessed rings every ~0.9 on the white sections
for hy in (1.5, 2.4, 4.8, 5.7, 7.6):
    rad = {1.5: 1.83, 2.4: 1.80, 4.8: 1.67, 5.7: 1.63, 7.6: 1.47}[hy]
    prim('tower', 'torus', (0, hy, 0), (rad, 0.02), rot=(math.pi/2, 0, 0), matl=STONE_B, verts=48)
# door: arched recess at the front (+z)
prim('tower', 'box', (0, 0.85, 2.42), (0.85, 1.7, 0.12), matl=DOOR_M, verts=16, bevel=0.04)
prim('tower', 'sphere', (0, 1.72, 2.42), (0.43,), matl=DOOR_M, verts=20)
prim('tower', 'cyl', (0.28, 0.9, 2.50), (0.035, 0.06), rot=(math.pi/2, 0, 0), matl=BRASS, verts=12)
# window slots climbing the drum (two, offset)
for (wy, wz, wx) in ((2.2, 2.05, 0.55), (5.3, -1.55, -0.9)):
    prim('tower', 'box', (wx, wy, wz), (0.30, 0.55, 0.10), rot=(0, math.atan2(wx, wz) if abs(wz) > 0.1 else 0, 0),
         matl=WINDOW_M, verts=12, bevel=0.02)

# ---------- gallery deck + iron rail ----------
begin('rail')
lathe('rail', [(2.05, 0.0), (2.05, 0.14)], (0, 8.78, 0), matl=IRON, segs=48)            # deck plate
lathe('rail', [(1.55, 0.0), (2.10, 0.10)], (0, 8.62, 0), matl=IRON, segs=48)            # underside corbel
# rail posts + two rings
for i in range(18):
    a = i / 18 * TAU
    px, pz = math.cos(a) * 1.95, math.sin(a) * 1.95
    prim('rail', 'cyl', (px, 9.35, pz), (0.025, 0.85), matl=IRON, verts=10)
prim('rail', 'torus', (0, 9.78, 0), (1.95, 0.035), rot=(math.pi/2, 0, 0), matl=IRON, verts=48)
prim('rail', 'torus', (0, 9.35, 0), (1.95, 0.022), rot=(math.pi/2, 0, 0), matl=IRON, verts=48)

# ---------- lantern room ----------
begin('lantern')
# floor ring under the glazing
lathe('lantern', [(1.30, 0.0), (1.30, 0.12)], (0, 8.92, 0), matl=IRON, segs=40)
# glass drum: thin-walled cylinder via two lathes (outer wall only, alpha)
lathe('lantern', [(1.15, 0.0), (1.15, 1.35)], (0, 9.04, 0), matl=GLASS, segs=40)
# mullions: 8 vertical muntin bars
for i in range(8):
    a = i / 8 * TAU
    prim('lantern', 'box', (math.cos(a) * 1.16, 9.72, math.sin(a) * 1.16),
         (0.09, 1.4, 0.09), rot=(0, -a, 0), matl=IRON, verts=8)
# the lamp: brass pedestal + glowing lens drum + reflector cap
prim('lantern', 'cyl', (0, 9.25, 0), (0.42, 0.5), matl=BRASS, verts=24, bevel=0.03)
prim('lantern', 'cyl', (0, 9.85, 0), (0.34, 0.55), matl=LAMP, verts=24)
prim('lantern', 'torus', (0, 9.85, 0), (0.36, 0.05), rot=(math.pi/2, 0, 0), matl=BRASS, verts=24)
# domed cap + vent ball + finial spike
lathe('lantern', [(1.30, 0.0), (1.28, 0.15), (0.95, 0.55), (0.30, 0.85), (0.0, 0.9)],
      (0, 10.39, 0), matl=IRON, segs=40)
prim('lantern', 'sphere', (0, 11.32, 0), (0.16,), matl=BRASS, verts=16)
prim('lantern', 'cyl', (0, 11.62, 0), (0.03, 0.5), matl=IRON, verts=10)

# ---------- export ----------
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
    root.name = name
    root['fx_part'] = name

bpy.ops.object.select_all(action='DESELECT')
for p in parts.values():
    try: p['root'].select_set(True)
    except Exception: pass
print('[export] parts:', ', '.join(parts.keys()))
bpy.ops.export_scene.gltf(filepath=os.path.join(HERE, 'model.glb'), export_format='GLB',
                          export_extras=True, export_yup=True, use_selection=True)
