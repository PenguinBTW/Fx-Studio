# f(x) logo: heavy Archivo Black extruded glyphs, each a separate part (f, lp, x, rp) with origin at its own
# centre so the engine can spin/slam them one at a time, plus a "STUDIO" wordmark. Chrome + bone.
import bpy, os, sys, math
sys.dont_write_bytecode = True; HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.dirname(HERE))
from _bl import *
reset()
CHROME = mat('Chrome', (0.92, 0.9, 0.86), rough=0.14, metal=1.0)
BONE = mat('Bone', (0.81, 0.78, 0.71), rough=0.45)
# One material slot per character, then split by material: four clean glyph objects in reading order.
cu = bpy.data.curves.new('logo', 'FONT'); cu.body = 'f(x)'
cu.font = bpy.data.fonts.load(os.path.join(FONTS, 'Archivo-w1000-900.ttf'))
cu.size = 1.0; cu.extrude = 0.16; cu.bevel_depth = 0.022; cu.bevel_resolution = 2; cu.resolution_u = 3
cu.align_x = 'CENTER'; cu.align_y = 'CENTER'
slots = [mat('slot%d' % i, (1, 1, 1)) for i in range(4)]
for m in slots: cu.materials.append(m)
for i in range(4): cu.body_format[i].material_index = i
ob = bpy.data.objects.new('logo', cu); bpy.context.collection.objects.link(ob); select(ob)
bpy.ops.object.convert(target='MESH'); ob = bpy.context.active_object
ob.rotation_euler = (math.radians(90), 0, 0); bpy.ops.object.transform_apply(rotation=True)
bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.mesh.separate(type='MATERIAL'); bpy.ops.object.mode_set(mode='OBJECT')
parts = sorted([o for o in bpy.data.objects if o.type == 'MESH'], key=lambda o: sum((o.matrix_world @ v.co).x for v in o.data.vertices) / len(o.data.vertices))
assert len(parts) == 4, f'expected 4 glyph pieces, got {len(parts)}'
for o, n in zip(parts, ['f', 'lp', 'x', 'rp']):
    o.name = f'glyph_{n}'; o['fx_part'] = n
    select(o); bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY', center='BOUNDS')
    assign(o, CHROME); shade_smooth_auto(o)
st = text_mesh('STUDIO', 'Archivo-w1250-700.ttf', size=0.26, extrude=0.03, bevel=0.006, name='wordmark')
st.location = (0, 0, -0.78); st['fx_part'] = 'studio'
assign(st, BONE); shade_smooth_auto(st)
export(HERE)
