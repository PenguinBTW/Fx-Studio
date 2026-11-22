# Shared Blender helpers for agent_promo asset builds (run: blender -b -P assets/<id>/build.py).
import bpy, os, math, bmesh
ASSETS = os.path.dirname(os.path.abspath(__file__))
FONTS = os.path.normpath(os.path.join(ASSETS, '..', '..', '..', '..', 'public', 'fonts'))
ORANGE = (1.0, 0.1, 0.012)

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

def select(ob):
    bpy.ops.object.select_all(action='DESELECT')
    ob.select_set(True); bpy.context.view_layer.objects.active = ob

def assign(ob, m):
    ob.data.materials.clear(); ob.data.materials.append(m)

def smooth(ob, angle=35):
    select(ob); bpy.ops.object.shade_smooth()
    try: bpy.ops.object.shade_auto_smooth(angle=math.radians(angle))
    except Exception: pass

def bevel(ob, w=0.02, seg=3):
    m = ob.modifiers.new('bev', 'BEVEL'); m.width = w; m.segments = seg; m.limit_method = 'ANGLE'
    select(ob); bpy.ops.object.modifier_apply(modifier='bev')

def box(name, size, loc=(0, 0, 0), m=None, bev=0.0, seg=3, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    ob = bpy.context.active_object; ob.name = name; ob.scale = size
    select(ob); bpy.ops.object.transform_apply(scale=True)
    if bev > 0: bevel(ob, bev, seg)
    if m: assign(ob, m)
    smooth(ob)
    return ob

def cyl(name, r, depth, loc=(0, 0, 0), m=None, rot=(0, 0, 0), verts=48, bev=0.0):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth, location=loc, rotation=rot)
    ob = bpy.context.active_object; ob.name = name
    if bev > 0: bevel(ob, bev, 2)
    if m: assign(ob, m)
    smooth(ob)
    return ob

def parent(child, par):
    child.parent = par; child.matrix_parent_inverse = par.matrix_world.inverted()

def empty(name, loc=(0, 0, 0)):
    ob = bpy.data.objects.new(name, None); bpy.context.collection.objects.link(ob); ob.location = loc
    return ob

def text_mesh(body, font_file, size=1.0, extrude=0.12, bevel_d=0.02, name=None, align='CENTER'):
    cu = bpy.data.curves.new(name or body, 'FONT')
    cu.body = body; cu.font = bpy.data.fonts.load(os.path.join(FONTS, font_file))
    cu.size = size; cu.extrude = extrude; cu.bevel_depth = bevel_d; cu.bevel_resolution = 2
    cu.resolution_u = 3; cu.align_x = align; cu.align_y = 'CENTER'
    ob = bpy.data.objects.new(name or body, cu); bpy.context.collection.objects.link(ob)
    select(ob); bpy.ops.object.convert(target='MESH'); ob = bpy.context.active_object; ob.name = name or body
    ob.rotation_euler = (math.radians(90), 0, 0); bpy.ops.object.transform_apply(rotation=True)
    return ob

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
