# Nether hero props: crimson and warped huge fungi (curved ribbed stems, lumpy domed caps, hanging vines,
# shroomlights) and a glowstone cluster. Stem height ~1 unit, scaled per instance in the scene.
import bpy, math, os, random
from mathutils import Vector, noise
HERE = os.path.dirname(os.path.abspath(__file__))
bpy.ops.wm.read_factory_settings(use_empty=True)
def mat(name, col, rough, emit=None, strength=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True; b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*col, 1); b.inputs['Roughness'].default_value = rough
    if emit: b.inputs['Emission Color'].default_value = (*emit, 1); b.inputs['Emission Strength'].default_value = strength
    return m
M = dict(cs=mat('CrimsonStem', (0.3, 0.05, 0.08), 0.75), cc=mat('CrimsonCap', (0.42, 0.02, 0.04), 0.5),
         ws=mat('WarpedStem', (0.08, 0.12, 0.16), 0.75), wc=mat('WarpedCap', (0.02, 0.36, 0.33), 0.5),
         vine=mat('Vines', (0.5, 0.04, 0.06), 0.6, (0.6, 0.03, 0.05), 0.6), tvine=mat('TwistVines', (0.03, 0.5, 0.42), 0.6, (0.02, 0.6, 0.5), 0.6),
         sl=mat('Shroomlight', (1.0, 0.6, 0.25), 0.5, (1.0, 0.5, 0.15), 8.0), gs=mat('Glowstone', (1.0, 0.85, 0.5), 0.4, (1.0, 0.72, 0.3), 6.0))
def tube(pts, r0, r1, m, res=3):
    cu = bpy.data.curves.new('t', 'CURVE'); cu.dimensions = '3D'; cu.bevel_depth = 1; cu.bevel_resolution = res; cu.resolution_u = 8
    sp = cu.splines.new('BEZIER'); sp.bezier_points.add(len(pts) - 1)
    for i, p in enumerate(pts):
        bp = sp.bezier_points[i]; bp.co = p; bp.handle_left_type = bp.handle_right_type = 'AUTO'; bp.radius = r0 + (r1 - r0) * i / (len(pts) - 1)
    o = bpy.data.objects.new('t', cu); bpy.context.scene.collection.objects.link(o)
    bpy.context.view_layer.objects.active = o; o.select_set(True); bpy.ops.object.convert(target='MESH'); o.select_set(False)
    o.data.materials.append(m); return o
def blob(c, r, m, sq=1.0, amp=0.25, sub=3, seed=0.0, flat=False):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=sub, radius=r, location=c); o = bpy.context.object
    for v in o.data.vertices:
        d = v.co.normalized(); n = noise.noise(d * 2.5 + Vector((seed, 0, seed)))
        v.co = d * r * (1 + amp * n) * Vector((1, 1, sq))
    for p in o.data.polygons: p.use_smooth = not flat
    o.data.materials.append(m); return o
def join(objs, name):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]; bpy.ops.object.join()
    o = bpy.context.object; o.name = name; o['fx_part'] = name.lower(); return o
def fungus(name, stem, cap, vine, seed, x):
    random.seed(seed); objs = []
    pts = [Vector((0, 0, 0)), Vector((0.06, 0.02, 0.35)), Vector((-0.04, 0.05, 0.7)), Vector((0.02, 0, 1.0))]
    objs.append(tube(pts, 0.09, 0.06, stem))
    for k in range(5):  # ribbed root flare
        a = k * 1.26; objs.append(tube([Vector((math.cos(a) * 0.22, math.sin(a) * 0.22, -0.02)), Vector((math.cos(a) * 0.08, math.sin(a) * 0.08, 0.2))], 0.035, 0.02, stem, 2))
    capo = blob(Vector((0.02, 0, 1.08)), 0.62, cap, 0.42, 0.18, 4, seed)
    objs.append(capo)
    for k in range(7):  # secondary lumps on the dome
        a = random.uniform(0, 6.28); objs.append(blob(Vector((math.cos(a) * 0.35, math.sin(a) * 0.35, 1.12)), 0.22, cap, 0.5, 0.2, 2, seed + k))
    for k in range(10):  # shroomlights tucked under the rim
        a = random.uniform(0, 6.28); rr = random.uniform(0.3, 0.55)
        objs.append(blob(Vector((math.cos(a) * rr, math.sin(a) * rr, 0.97)), 0.06, M['sl'], 1, 0.3, 1, k, True))
    for k in range(14):  # hanging vines
        a = random.uniform(0, 6.28); rr = random.uniform(0.35, 0.6); L = random.uniform(0.15, 0.55)
        p0 = Vector((math.cos(a) * rr, math.sin(a) * rr, 0.98))
        objs.append(tube([p0, p0 + Vector((0.02, 0, -L * 0.5)), p0 + Vector((-0.02, 0.02, -L))], 0.012, 0.006, vine, 1))
    o = join(objs, name); o.location.x = x; return o
fungus('Crimson', M['cs'], M['cc'], M['vine'], 3, 0)
fungus('Warped', M['ws'], M['wc'], M['tvine'], 9, 3)
random.seed(5); gs = [blob(Vector((random.uniform(-0.4, 0.4), random.uniform(-0.4, 0.4), random.uniform(-0.5, 0.2))), random.uniform(0.15, 0.35), M['gs'], 1.0, 0.35, 1, i, True) for i in range(14)]
g = join(gs, 'Glowstone'); g.location.x = 6
bpy.ops.export_scene.gltf(filepath=os.path.join(HERE, 'model.glb'), export_format='GLB', export_extras=True, export_yup=True)
print('[export] ok')
