# Aether gateway: a frame of cut, faceted glowstone around a 8.4 x 12.8 opening (three: x right, y up, z travel).
# Blender: opening in the XZ plane (Y=0). Run: blender -b --factory-startup --python build.py
import bpy, bmesh, math, os, random
HERE = os.path.dirname(os.path.abspath(__file__))
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene; random.seed(13)
def mat(name, col, rough, emit=None, strength=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True; b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*col, 1); b.inputs['Roughness'].default_value = rough
    if emit: b.inputs['Emission Color'].default_value = (*emit, 1); b.inputs['Emission Strength'].default_value = strength
    return m
GLOW = mat('Glowstone', (0.95, 0.72, 0.32), 0.45, (1.0, 0.68, 0.25), 2.2)
CORE = mat('GlowCore', (1.0, 0.9, 0.6), 0.3, (1.0, 0.85, 0.5), 6.0)
STONE = mat('Holystone', (0.78, 0.8, 0.82), 0.8)
HX, HY = 4.2, 6.4
def block(name, loc, size, m, bevel=0.12, jitter=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc); o = bpy.context.object; o.name = name
    o.scale = size; o.rotation_euler = [random.uniform(-jitter, jitter) for _ in range(3)]
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    bm = bmesh.new(); bm.from_mesh(o.data)
    for v in bm.verts: v.co += v.co.normalized() * random.uniform(-0.05, 0.05) * max(size)
    bm.to_mesh(o.data); bm.free()
    md = o.modifiers.new('bev', 'BEVEL'); md.width = bevel; md.segments = 2; md.limit_method = 'ANGLE'
    o.data.materials.append(m); return o
parts = []
# frame cells: chunky glowstone blocks stepping around the opening, deeper at the corners
B = 1.7
xs = [-HX - B / 2] + [-HX + B / 2 + i * (2 * HX - B) / 4 for i in range(5)] + [HX + B / 2]
zs = [-HY - B / 2] + [-HY + B / 2 + i * (2 * HY - B) / 6 for i in range(7)] + [HY + B / 2]
cells = [(x, -HY - B / 2) for x in xs] + [(x, HY + B / 2) for x in xs] + [(-HX - B / 2, z) for z in zs[1:-1]] + [(HX + B / 2, z) for z in zs[1:-1]]
for i, (x, z) in enumerate(cells):
    s = B * random.uniform(0.92, 1.08)
    parts.append(block(f'cell{i}', (x, random.uniform(-0.08, 0.08), z), (s, B * random.uniform(1.0, 1.25), s), GLOW, 0.14, 0.04))
    if random.random() < 0.5:  # bright crystal facet set into the face
        parts.append(block(f'core{i}', (x + random.uniform(-0.3, 0.3), -B * 0.58, z + random.uniform(-0.3, 0.3)), (0.5, 0.25, 0.5), CORE, 0.06, 0.5))
# holystone plinth the frame rests on
parts.append(block('plinth', (0, 0, -HY - B - 0.6), (2 * HX + 2 * B + 2.0, B * 2.2, 1.2), STONE, 0.2))
for s in (-1, 1): parts.append(block(f'step{s}', (s * (HX + B + 0.4), 0, -HY - B - 1.7), (2.4, B * 2.6, 1.0), STONE, 0.2, 0.05))
for o in parts:
    bpy.context.view_layer.objects.active = o; bpy.ops.object.modifier_apply(modifier='bev')
    for p in o.data.polygons: p.use_smooth = False
bpy.ops.object.select_all(action='SELECT'); bpy.context.view_layer.objects.active = parts[0]; bpy.ops.object.join()
frame = bpy.context.object; frame.name = 'Frame'; frame['fx_part'] = 'frame'
bpy.ops.export_scene.gltf(filepath=os.path.join(HERE, 'model.glb'), export_format='GLB', export_extras=True, export_yup=True)
print('[export] ok', len(frame.data.polygons))
