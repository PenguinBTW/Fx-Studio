# End chorus plant: knotted, bulbous purple stalks that branch at near-right angles, tipped with faceted
# luminous lilac blooms. Height ~1 unit; instanced with random yaw/scale in the scene.
import bpy, math, os, random
from mathutils import Vector, noise
HERE = os.path.dirname(os.path.abspath(__file__))
bpy.ops.wm.read_factory_settings(use_empty=True)
def mat(name, col, rough, emit=None, strength=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True; b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*col, 1); b.inputs['Roughness'].default_value = rough
    if emit: b.inputs['Emission Color'].default_value = (*emit, 1); b.inputs['Emission Strength'].default_value = strength
    return m
STEM = mat('ChorusStem', (0.3, 0.16, 0.36), 0.55)
FLOWER = mat('ChorusFlower', (0.92, 0.85, 1.0), 0.4, (0.8, 0.6, 1.0), 1.4)
objs = []
def seg(a, b, r):
    d = b - a; L = d.length
    bpy.ops.mesh.primitive_cylinder_add(vertices=10, radius=r, depth=L, location=(a + b) / 2); o = bpy.context.object
    o.rotation_mode = 'QUATERNION'; o.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(d.normalized())
    for v in o.data.vertices:  # bulge mid-segment, pinch at joints
        k = v.co.z / L + 0.5; s = 1 + 0.12 * math.sin(k * math.pi) + 0.05 * noise.noise(v.co * 9)
        v.co.x *= s; v.co.y *= s
    for p in o.data.polygons: p.use_smooth = True
    o.data.materials.append(STEM); objs.append(o)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=10, ring_count=6, radius=r * 1.25, location=b); j = bpy.context.object
    for p in j.data.polygons: p.use_smooth = True
    j.data.materials.append(STEM); objs.append(j)
def flower(p, r):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=r, location=p); o = bpy.context.object
    for v in o.data.vertices: v.co = v.co * Vector((1, 1, 0.8)) * (1 + 0.3 * noise.noise(v.co * 5))  # object-local: the sphere already sits at p
    o.data.materials.append(FLOWER); objs.append(o)
def grow(p, d, depth, s, r):
    for _ in range(2 + random.randint(0, 1)):
        q = p + d * s + Vector((random.uniform(-0.1, 0.1), random.uniform(-0.1, 0.1), 0)) * s
        seg(p, q, r); p = q
    if depth == 0: flower(p + d * r * 1.2, r * 1.7); return
    for _ in range(1 + random.randint(0, 2)):
        if d.z > 0.5:
            a = random.choice([0, 1.57, 3.14, 4.71]) + random.uniform(-0.25, 0.25); nd = Vector((math.cos(a), math.sin(a), random.uniform(0.0, 0.25))).normalized()
        else: nd = Vector((0, 0, 1))
        grow(p, nd, depth - 1, s * 0.85, r * 0.85)
random.seed(21)
grow(Vector((0, 0, 0)), Vector((0, 0, 1)), 3, 0.11, 0.026)
bpy.ops.object.select_all(action='DESELECT')
for o in objs: o.select_set(True)
bpy.context.view_layer.objects.active = objs[0]; bpy.ops.object.join()
o = bpy.context.object; o.name = 'Chorus'; o['fx_part'] = 'chorus'
bpy.ops.export_scene.gltf(filepath=os.path.join(HERE, 'model.glb'), export_format='GLB', export_extras=True, export_yup=True)
print('[export] ok', len(o.data.polygons), [round(x, 2) for x in o.dimensions])
