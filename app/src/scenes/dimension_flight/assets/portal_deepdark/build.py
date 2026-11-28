# Deep Dark gateway (ancient-city portal to the Sift): a colossal deepslate arch around a 16 x 11 opening with
# sculk-cyan inlays. three: x right, y up, z travel; Blender: opening in the XZ plane (Y=0).
import bpy, bmesh, math, os, random
HERE = os.path.dirname(os.path.abspath(__file__))
bpy.ops.wm.read_factory_settings(use_empty=True)
random.seed(7)
def mat(name, col, rough, emit=None, strength=0.0, metal=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True; b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*col, 1); b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
    if emit: b.inputs['Emission Color'].default_value = (*emit, 1); b.inputs['Emission Strength'].default_value = strength
    return m
SLATE = mat('Deepslate', (0.07, 0.075, 0.09), 0.72)
TILE = mat('DeepslateTile', (0.11, 0.115, 0.13), 0.55)
SCULK = mat('SculkGlow', (0.02, 0.35, 0.4), 0.3, (0.1, 0.85, 1.0), 5.0)
HX, HY = 8.0, 5.5
parts = []
def block(loc, size, m, bevel=0.18, jitter=0.0, chip=0.04):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc); o = bpy.context.object
    o.scale = size; o.rotation_euler = (random.uniform(-jitter, jitter), random.uniform(-jitter, jitter), random.uniform(-jitter, jitter))
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    md = o.modifiers.new('bev', 'BEVEL'); md.width = bevel; md.segments = 2; md.limit_method = 'ANGLE'
    bpy.context.view_layer.objects.active = o; bpy.ops.object.modifier_apply(modifier='bev')
    bm = bmesh.new(); bm.from_mesh(o.data)
    for v in bm.verts: v.co += v.co.normalized() * random.uniform(-chip, chip)
    bm.to_mesh(o.data); bm.free(); o.data.materials.append(m); parts.append(o); return o
# two pillars of stacked, slightly offset deepslate courses
for s in (-1, 1):
    x = s * (HX + 2.0)
    for k in range(6):
        h = (2 * HY + 2) / 6; z = -HY - 1 + h * (k + 0.5)
        block((x + random.uniform(-0.15, 0.15), 0, z), (4.0 - 0.2 * (k % 2), 4.4, h * 0.96), SLATE if k % 2 else TILE, 0.2, 0.015)
    block((x, -2.3, 0), (0.35, 0.3, 2 * HY - 1.0), SCULK, 0.08, 0, 0.0)          # glowing vein up each pillar face
    block((x, 0, HY + 2.6), (5.0, 5.0, 1.6), TILE, 0.25)                           # capital
# stepped lintel with a horned crest (warden-like silhouette) and sculk band
block((0, 0, HY + 1.4), (2 * HX + 9, 4.8, 2.4), SLATE, 0.25)
block((0, 0, HY + 3.4), (2 * HX + 4, 4.2, 1.8), TILE, 0.22)
block((0, -2.25, HY + 1.4), (2 * HX + 2, 0.3, 0.35), SCULK, 0.08, 0, 0.0)
for s in (-1, 1):
    for k in range(4):
        block((s * (HX - 1 - k * 1.9), 0, HY + 4.8 + k * 0.9), (2.0, 3.2, 1.4), SLATE, 0.2, 0.06)
block((0, -1.9, HY + 3.4), (1.6, 0.8, 1.6), SCULK, 0.2, 0.2, 0.0)                  # central eye
# broad stepped base
for k in range(3): block((0, 0, -HY - 1.6 - k * 1.1), (2 * HX + 10 + k * 4, 6 + k * 2.5, 1.1), TILE if k % 2 else SLATE, 0.2)
for o in parts:
    for p in o.data.polygons: p.use_smooth = False
bpy.ops.object.select_all(action='SELECT'); bpy.context.view_layer.objects.active = parts[0]; bpy.ops.object.join()
o = bpy.context.object; o.name = 'Arch'; o['fx_part'] = 'arch'
bpy.ops.export_scene.gltf(filepath=os.path.join(HERE, 'model.glb'), export_format='GLB', export_extras=True, export_yup=True)
print('[export] ok', len(o.data.polygons))
