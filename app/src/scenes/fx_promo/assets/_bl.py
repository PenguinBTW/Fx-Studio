# Shared Blender helpers for fx_promo asset builds (run via: blender -b -P <asset>/build.py).
import bpy, os, math
ASSETS = os.path.dirname(os.path.abspath(__file__))
FONTS = os.path.normpath(os.path.join(ASSETS, '..', '..', '..', '..', 'public', 'fonts'))

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)

def mat(name, col, rough=0.4, metal=0.0, emit=None, strength=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*col, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if emit:
        b.inputs['Emission Color'].default_value = (*emit, 1)
        b.inputs['Emission Strength'].default_value = strength
    return m

def text_mesh(body, font_file, size=1.0, extrude=0.12, bevel=0.02, name=None, align='CENTER', res=3):
    cu = bpy.data.curves.new(name or body, 'FONT')
    cu.body = body
    cu.font = bpy.data.fonts.load(os.path.join(FONTS, font_file))
    cu.size = size; cu.extrude = extrude; cu.bevel_depth = bevel; cu.bevel_resolution = 2
    cu.resolution_u = res; cu.align_x = align; cu.align_y = 'CENTER'
    ob = bpy.data.objects.new(name or body, cu)
    bpy.context.collection.objects.link(ob)
    select(ob)
    bpy.ops.object.convert(target='MESH')
    ob = bpy.context.active_object
    ob.name = name or body
    # Blender text extrudes symmetrically about z=0 and faces +z: keep it, glTF export maps z->-y? No: export_yup maps Blender +Z to glTF +Y.
    # We want type facing the viewer (+z in three.js), i.e. Blender -Y. Rotate +90deg about X so Blender text normal (+Z) -> -Y.
    ob.rotation_euler = (math.radians(90), 0, 0)
    bpy.ops.object.transform_apply(rotation=True)
    return ob

def select(ob):
    bpy.ops.object.select_all(action='DESELECT')
    ob.select_set(True); bpy.context.view_layer.objects.active = ob

def assign(ob, m):
    ob.data.materials.clear(); ob.data.materials.append(m)

def shade_smooth_auto(ob, angle=35):
    select(ob)
    bpy.ops.object.shade_smooth()
    try:
        bpy.ops.object.shade_auto_smooth(angle=math.radians(angle))
    except Exception:
        pass

def tris():
    n = 0
    for ob in bpy.data.objects:
        if ob.type == 'MESH':
            ob.data.calc_loop_triangles(); n += len(ob.data.loop_triangles)
    return n

def export(here):
    out = os.path.join(here, 'model.glb')
    bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_apply=True, export_yup=True, export_extras=True)
    print(f'[build] wrote {out} tris={tris()}')
