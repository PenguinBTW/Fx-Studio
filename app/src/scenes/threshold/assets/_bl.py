# Shared Blender helpers for THRESHOLD asset builds (run: blender -b -P assets/<id>/build.py).
# Blender Z-up; exported GLB is Y-up. 1 unit = 1 metre unless an asset manifest says otherwise.
import bpy, os, math

ASSETS = os.path.dirname(os.path.abspath(__file__))
FONTS = os.path.normpath(os.path.join(ASSETS, '..', '..', '..', '..', 'public', 'fonts'))

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)

def mat(name, col, rough=0.45, metal=0.0, emit=None, strength=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
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
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob

def assign(ob, material):
    ob.data.materials.clear()
    ob.data.materials.append(material)

def smooth(ob, angle=35):
    select(ob)
    bpy.ops.object.shade_smooth()
    try:
        bpy.ops.object.shade_auto_smooth(angle=math.radians(angle))
    except Exception:
        pass

def bevel(ob, width=0.02, segments=3):
    mod = ob.modifiers.new('bev', 'BEVEL')
    mod.width = width
    mod.segments = segments
    mod.limit_method = 'ANGLE'
    select(ob)
    bpy.ops.object.modifier_apply(modifier='bev')

def box(name, size, loc=(0, 0, 0), material=None, bev=0.0, seg=3, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    ob = bpy.context.active_object
    ob.name = name
    ob.scale = size
    select(ob)
    bpy.ops.object.transform_apply(scale=True)
    if bev > 0:
        bevel(ob, bev, seg)
    if material:
        assign(ob, material)
    smooth(ob)
    return ob

def cyl(name, radius, depth, loc=(0, 0, 0), material=None, rot=(0, 0, 0), verts=48, bev=0.0):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=radius, depth=depth, location=loc, rotation=rot)
    ob = bpy.context.active_object
    ob.name = name
    if bev > 0:
        bevel(ob, bev, 2)
    if material:
        assign(ob, material)
    smooth(ob)
    return ob

def sphere(name, radius, loc=(0, 0, 0), material=None, scale=(1, 1, 1), segments=32, rings=16):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, radius=radius, location=loc)
    ob = bpy.context.active_object
    ob.name = name
    ob.scale = scale
    select(ob)
    bpy.ops.object.transform_apply(scale=True)
    if material:
        assign(ob, material)
    smooth(ob)
    return ob

def torus(name, major, minor, loc=(0, 0, 0), material=None, rot=(0, 0, 0), major_segments=48, minor_segments=10):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, major_segments=major_segments, minor_segments=minor_segments, location=loc, rotation=rot)
    ob = bpy.context.active_object
    ob.name = name
    if material:
        assign(ob, material)
    smooth(ob)
    return ob

def parent(child, par):
    child.parent = par
    child.matrix_parent_inverse = par.matrix_world.inverted()

def empty(name, loc=(0, 0, 0)):
    ob = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(ob)
    ob.location = loc
    return ob

def curve(name, pts, bevel_depth, material, cyclic=False, resolution=2):
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.resolution_u = resolution
    sp = cu.splines.new('BEZIER')
    sp.bezier_points.add(len(pts) - 1)
    for p, co in zip(sp.bezier_points, pts):
        p.co = co
        p.handle_left_type = 'AUTO'
        p.handle_right_type = 'AUTO'
    sp.use_cyclic_u = cyclic
    cu.bevel_depth = bevel_depth
    cu.bevel_resolution = 2
    ob = bpy.data.objects.new(name, cu)
    bpy.context.collection.objects.link(ob)
    select(ob)
    bpy.ops.object.convert(target='MESH')
    ob = bpy.context.active_object
    ob.name = name
    assign(ob, material)
    smooth(ob)
    return ob

def text_mesh(body, font_file, size=1.0, extrude=0.02, bevel_d=0.0, name=None, align='CENTER'):
    cu = bpy.data.curves.new(name or body, 'FONT')
    cu.body = body
    cu.font = bpy.data.fonts.load(os.path.join(FONTS, font_file))
    cu.size = size
    cu.extrude = extrude
    cu.bevel_depth = bevel_d
    cu.bevel_resolution = 2
    cu.align_x = align
    cu.align_y = 'CENTER'
    ob = bpy.data.objects.new(name or body, cu)
    bpy.context.collection.objects.link(ob)
    select(ob)
    bpy.ops.object.convert(target='MESH')
    ob = bpy.context.active_object
    ob.name = name or body
    return ob

def join_named(name, objects):
    bpy.ops.object.select_all(action='DESELECT')
    for ob in objects:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    ob = bpy.context.active_object
    ob.name = name
    return ob

def tris():
    n = 0
    for ob in bpy.data.objects:
        if ob.type == 'MESH':
            ob.data.calc_loop_triangles()
            n += len(ob.data.loop_triangles)
    return n

def export(here):
    out = os.path.join(here, 'model.glb')
    bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_apply=True, export_yup=True, export_extras=True)
    print(f'[build] wrote {out} tris={tris()}')
