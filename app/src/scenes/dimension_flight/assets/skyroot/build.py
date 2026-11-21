# Aether trees: a Skyroot (pale bark, mint-green canopy) and a Golden Oak (gold canopy), same builder as assets/trees.
# Trunk/branches are bevelled curves; canopies are clusters of displaced, lobed blobs. Height ~ 1 unit (scaled in scene).
import bpy, bmesh, math, os, random
from mathutils import Vector, noise
HERE = os.path.dirname(os.path.abspath(__file__))
bpy.ops.wm.read_factory_settings(use_empty=True)
def mat(name, col, rough):
    m = bpy.data.materials.new(name); m.use_nodes = True; b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*col, 1); b.inputs['Roughness'].default_value = rough; return m
BARK = mat('SkyrootBark', (0.78, 0.74, 0.66), 0.8)
CHBARK = mat('GoldenBark', (0.45, 0.32, 0.18), 0.8)
LEAF = mat('SkyrootLeaves', (0.36, 0.78, 0.55), 0.6)
BLOSSOM = mat('GoldenLeaves', (1.0, 0.72, 0.2), 0.45)
def branch(pts, r0, r1, m):
    cu = bpy.data.curves.new('b', 'CURVE'); cu.dimensions = '3D'; cu.bevel_depth = 1; cu.bevel_resolution = 2
    sp = cu.splines.new('BEZIER'); sp.bezier_points.add(len(pts) - 1)
    for i, p in enumerate(pts):
        bp = sp.bezier_points[i]; bp.co = p; bp.handle_left_type = bp.handle_right_type = 'AUTO'
        bp.radius = r0 + (r1 - r0) * i / (len(pts) - 1)
    o = bpy.data.objects.new('b', cu); bpy.context.scene.collection.objects.link(o)
    bpy.context.view_layer.objects.active = o; o.select_set(True); bpy.ops.object.convert(target='MESH'); o.select_set(False)
    o.data.materials.append(m); return o
def blob(c, r, m, seed):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3, radius=r, location=c); o = bpy.context.object
    for v in o.data.vertices:
        d = v.co.normalized(); n = noise.noise(d * 2.2 + Vector((seed, seed * 1.3, 0)))
        v.co = d * r * (1 + 0.28 * n) * Vector((1, 1, 0.78))
    for p in o.data.polygons: p.use_smooth = True
    o.data.materials.append(m); return o
def tree(name, seed, bark, foliage, spread, lobes):
    random.seed(seed); objs = []
    trunk = [Vector((0, 0, 0)), Vector((0.02, 0.01, 0.25)), Vector((-0.02, 0.03, 0.5))]
    objs.append(branch(trunk, 0.06, 0.035, bark))
    tips = []
    for k in range(5):
        a = k * 2.4 + random.uniform(-0.3, 0.3); L = spread * random.uniform(0.7, 1.0)
        p0 = trunk[-1] + Vector((0, 0, random.uniform(-0.1, 0.05)))
        p1 = p0 + Vector((math.cos(a) * L * 0.5, math.sin(a) * L * 0.5, 0.15)); p2 = p0 + Vector((math.cos(a) * L, math.sin(a) * L, 0.28))
        objs.append(branch([p0, p1, p2], 0.03, 0.012, bark)); tips.append(p2)
    for i in range(lobes):
        c = random.choice(tips) + Vector((random.uniform(-0.12, 0.12), random.uniform(-0.12, 0.12), random.uniform(-0.02, 0.14)))
        objs.append(blob(c, random.uniform(0.13, 0.2), foliage, seed + i))
    objs.append(blob(trunk[-1] + Vector((0, 0, 0.26)), 0.24, foliage, seed + 99))
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]; bpy.ops.object.join()
    t = bpy.context.object; t.name = name; t['fx_part'] = name.lower(); return t
oak = tree('Skyroot', 31, BARK, LEAF, 0.3, 18)
cherry = tree('Golden', 17, CHBARK, BLOSSOM, 0.4, 16); cherry.location.x = 2
bpy.ops.export_scene.gltf(filepath=os.path.join(HERE, 'model.glb'), export_format='GLB', export_extras=True, export_yup=True)
print('[export] ok', len(oak.data.polygons), len(cherry.data.polygons))
