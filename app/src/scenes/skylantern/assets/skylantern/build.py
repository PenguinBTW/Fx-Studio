# SKYLANTERN — a faceted paper sky lantern (Khom Loy): tapered 12-sided
# paper envelope, open mouth at the bottom with a wire rim, and a small
# emissive flame hanging inside the throat. Authored with the mouth facing
# -Z? No — Blender +Z up means the lantern rises along +Z; glTF export maps
# it to +Y-up which is what the scene expects (lanterns rise in +Y).
#
# Deterministic: no random calls — every vertex is analytic.
# Run: blender -b --factory-startup --python build.py
import bpy, math, os, bmesh
HERE = os.path.dirname(os.path.abspath(__file__))
bpy.ops.wm.read_factory_settings(use_empty=True)

SIDES = 12          # faceted paper shell
H = 0.62            # lantern height, metres
R_BOT = 0.16        # mouth radius
R_TOP = 0.07        # crown radius
BULGE = 0.055       # paper belly

def sock(node, *names):
    for n in names:
        if n in node.inputs:
            return node.inputs[n]
    return None

def mat_paper():
    m = bpy.data.materials.new('Paper')
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    sock(b, 'Base Color').default_value = (0.94, 0.72, 0.42, 1)
    sock(b, 'Roughness').default_value = 0.92
    s = sock(b, 'Emission Color', 'Emission')
    if s: s.default_value = (1.0, 0.55, 0.18, 1)
    s = sock(b, 'Emission Strength')
    if s: s.default_value = 2.2
    return m

def mat_rim():
    m = bpy.data.materials.new('WireRim')
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    sock(b, 'Base Color').default_value = (0.12, 0.09, 0.07, 1)
    sock(b, 'Metallic').default_value = 0.75
    sock(b, 'Roughness').default_value = 0.45
    return m

def mat_flame():
    m = bpy.data.materials.new('Flame')
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    sock(b, 'Base Color').default_value = (1.0, 0.42, 0.06, 1)
    s = sock(b, 'Emission Color', 'Emission')
    if s: s.default_value = (1.0, 0.34, 0.03, 1)
    s = sock(b, 'Emission Strength')
    if s: s.default_value = 9.0
    return m

PAPER = mat_paper()
RIM = mat_rim()
FLAME = mat_flame()

# ---- paper shell -------------------------------------------------------------
# Lathe profile: z from 0 (mouth) to H (crown), radius R_BOT at the mouth,
# swelling to R_BOT+BULGE around the belly, pinching to R_TOP at the crown.
verts, faces = [], []
RINGS = 7
for j in range(RINGS + 1):
    u = j / RINGS
    z = u * H
    r = R_BOT + BULGE * math.sin(u * math.pi) * (1.0 - 0.35 * u)
    r = r * (1 - u) + R_TOP * u * (0.4 + 0.6 * min(1, u * 3))  # taper to crown
    for i in range(SIDES):
        a = 2 * math.pi * i / SIDES + (0.13 if j % 2 else 0.0)  # zigzag facet joints
        verts.append((r * math.cos(a), r * math.sin(a), z))
# crown cap apex
verts.append((0, 0, H))
apex = len(verts) - 1
for j in range(RINGS):
    for i in range(SIDES):
        a = j * SIDES + i
        b = j * SIDES + (i + 1) % SIDES
        c = (j + 1) * SIDES + (i + 1) % SIDES
        d = (j + 1) * SIDES + i
        faces.append((a, b, c, d))
for i in range(SIDES):
    faces.append((RINGS * SIDES + i, RINGS * SIDES + (i + 1) % SIDES, apex))

me = bpy.data.meshes.new('shell_mesh')
me.from_pydata(verts, [], faces)
me.update()
shell = bpy.data.objects.new('shell', me)
bpy.context.collection.objects.link(shell)
shell.data.materials.append(PAPER)
# flat shading sells the folded-paper facets
for p in me.polygons:
    p.use_smooth = False
shell['fx_part'] = 'shell'

# ---- wire rim at the mouth ----------------------------------------------------
bpy.ops.mesh.primitive_torus_add(major_radius=R_BOT, minor_radius=0.007,
                                 major_segments=12, minor_segments=4)
rim = bpy.context.object
rim.name = 'rim'
rim.data.materials.append(RIM)
rim['fx_part'] = 'rim'

# crossed suspension wires inside the mouth (two thin cylinders forming an X)
for k, ang in enumerate((0.0, math.pi / 2)):
    bpy.ops.mesh.primitive_cylinder_add(radius=0.003, depth=2 * R_BOT * 0.96,
                                        location=(0, 0, 0.02),
                                        rotation=(0, math.pi / 2, ang))
    w = bpy.context.object
    w.name = f'wire_{k}'
    w.data.materials.append(RIM)
    w['fx_part'] = f'wire_{k}'

# ---- flame --------------------------------------------------------------------
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.035)
flame = bpy.context.object
flame.name = 'flame'
flame.location = (0, 0, 0.09)  # hanging just inside the throat
flame.scale = (0.7, 0.7, 1.25)
flame.data.materials.append(FLAME)
flame['fx_part'] = 'flame'

# ---- export -------------------------------------------------------------------
for o in bpy.context.selected_objects:
    o.select_set(False)
for o in (shell, rim, flame):
    o.select_set(True)
for k in range(2):
    bpy.data.objects[f'wire_{k}'].select_set(True)

bpy.ops.export_scene.gltf(
    filepath=os.path.join(HERE, 'model.glb'),
    export_format='GLB',
    use_selection=True,
    export_extras=True,
    export_yup=True,
)
print('WROTE model.glb')
