# f(x) STUDIO portal wordmark for the end card: every glyph is its own object (fx_part = f, lp, x, rp, s0..s5) so the
# engine can give each letter a different live world. Faces pointing at the viewer get material "Portal", the
# extruded sides/bevels/back get "Side". Plus the repo URL as thin extruded type ("url").
import bpy, os, sys, math
sys.dont_write_bytecode = True; HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.dirname(HERE))
from _bl import *
reset()
PORTAL = mat('Portal', (0.05, 0.05, 0.05), rough=0.2)
SIDE = mat('Side', (0.06, 0.06, 0.07), rough=0.12, metal=1.0)
URL = mat('Url', (0.9, 0.88, 0.84), rough=0.35)

def glyphs(body, font, size, extrude, bevel, names, z, space=1.0):
    cu = bpy.data.curves.new(body, 'FONT'); cu.body = body
    cu.font = bpy.data.fonts.load(os.path.join(FONTS, font))
    cu.size = size; cu.extrude = extrude; cu.bevel_depth = bevel; cu.bevel_resolution = 2; cu.resolution_u = 4
    cu.align_x = 'CENTER'; cu.align_y = 'CENTER'; cu.space_character = space
    slots = [mat(f'{body}_slot{i}', (1, 1, 1)) for i in range(len(body))]
    for m in slots: cu.materials.append(m)
    for i in range(len(body)): cu.body_format[i].material_index = i
    ob = bpy.data.objects.new(body, cu); bpy.context.collection.objects.link(ob); select(ob)
    bpy.ops.object.convert(target='MESH'); ob = bpy.context.active_object
    ob.rotation_euler = (math.radians(90), 0, 0); bpy.ops.object.transform_apply(rotation=True)
    ob.location.z = z; bpy.ops.object.transform_apply(location=True)
    before = set(bpy.data.objects)
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.separate(type='MATERIAL'); bpy.ops.object.mode_set(mode='OBJECT')
    parts = [o for o in bpy.data.objects if o.type == 'MESH' and (o in before and o.name.startswith(body) or o not in before)]
    parts = sorted(parts, key=lambda o: sum((o.matrix_world @ v.co).x for v in o.data.vertices) / len(o.data.vertices))
    assert len(parts) == len(names), (body, len(parts))
    for o, n in zip(parts, names):
        o.name = f'glyph_{n}'; o['fx_part'] = n
        select(o); bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY', center='BOUNDS')
        o.data.materials.clear(); o.data.materials.append(PORTAL); o.data.materials.append(SIDE)
        for p in o.data.polygons: p.material_index = 0 if p.normal.y < -0.97 else 1
        shade_smooth_auto(o, 30)
    return parts

glyphs('f(x)', 'Archivo-w1000-900.ttf', 1.0, 0.2, 0.018, ['f', 'lp', 'x', 'rp'], 0.12)
glyphs('STUDIO', 'Archivo-w1250-900.ttf', 0.4, 0.11, 0.01, [f's{i}' for i in range(6)], -0.78, 1.35)
u = text_mesh('github.com/PenguinBTW/Fx-Studio', 'Archivo-w1000-700.ttf', size=0.165, extrude=0.016, bevel=0.003, name='url')
u.location = (0, 0, -1.2); u['fx_part'] = 'url'; assign(u, URL)
export(HERE)
