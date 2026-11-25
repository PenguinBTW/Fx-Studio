# escapement — watch-movement hero asset. Parametric gear train, balance wheel with
# hairspring, escape wheel, pallet fork, plate, jewel bearings. All hard-surface;
# no rigging: motion is closed-form rotation applied to named parts in the scene.
import bpy
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..'))
try:
    from _bl import reset, export  # noqa
except Exception:
    def reset():
        bpy.ops.wm.read_factory_settings(use_empty=True)
    def export(path):
        bpy.ops.export_scene.gltf(filepath=path, export_format='GLB',
                                  export_yup=True, export_apply=True,
                                  export_custom_properties=True)

reset()

def mat(name, color, metallic, roughness):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Metallic'].default_value = metallic
    bsdf.inputs['Roughness'].default_value = roughness
    return m

BRASS = mat('brass', (0.72, 0.53, 0.24), 0.95, 0.36)
STEEL = mat('steel', (0.62, 0.65, 0.72), 0.98, 0.16)
BLUED = mat('blued_steel', (0.10, 0.16, 0.34), 0.9, 0.22)
RUBY = mat('ruby', (0.55, 0.02, 0.05), 0.35, 0.08)
NICKEL = mat('nickel_plate', (0.30, 0.29, 0.27), 0.8, 0.68)

def gear_mesh(name, teeth, r_tip, r_root, thickness, material, pointed=False, hub=0.0):
    """Toothed wheel in the XY plane, extruded in Z. pointed=True gives escape-wheel
    asymmetric club teeth; otherwise symmetric trapezoid teeth."""
    verts, faces = [], []
    seg_per_tooth = 4 if pointed else 4
    n = teeth * seg_per_tooth
    # perimeter profile: list of (angle, radius)
    prof = []
    for i in range(teeth):
        a0 = 2 * math.pi * i / teeth
        step = 2 * math.pi / teeth
        if pointed:
            # asymmetric: slow rise, sharp drop — classic escape wheel silhouette
            prof.append((a0, r_root))
            prof.append((a0 + step * 0.45, r_root))
            prof.append((a0 + step * 0.85, r_tip))
            prof.append((a0 + step * 0.92, r_tip * 0.995))
        else:
            prof.append((a0, r_root))
            prof.append((a0 + step * 0.22, r_tip))
            prof.append((a0 + step * 0.52, r_tip))
            prof.append((a0 + step * 0.74, r_root))
    npts = len(prof)
    # build two rings (front/back) plus center caps
    for z in (-thickness / 2, thickness / 2):
        for (a, r) in prof:
            verts.append((r * math.cos(a), r * math.sin(a), z))
    # side quads
    for i in range(npts):
        j = (i + 1) % npts
        faces.append((i, j, npts + j, npts + i))
    # annulus caps: bridge perimeter to hub ring
    hr = max(hub, r_root * 0.28)
    for z in (-thickness / 2, thickness / 2):
        base = len(verts)
        for (a, r) in prof:
            verts.append((hr * math.cos(a), hr * math.sin(a), z))
        # ring faces between outer ring and hub ring
        outer_off = 0 if z < 0 else npts
        for i in range(npts):
            j = (i + 1) % npts
            if z < 0:
                faces.append((outer_off + i, base + i, base + j, outer_off + j))
            else:
                faces.append((outer_off + i, outer_off + j, base + j, base + i))
    # hub cylinder sides
    hubrings = len(verts) - 2 * npts
    front = len(verts) - npts  # front hub ring start
    back = len(verts) - 2 * npts  # back hub ring start
    for i in range(npts):
        j = (i + 1) % npts
        faces.append((back + i, back + j, front + j, front + i))
    # center caps (fan) — simple ngon
    c0 = len(verts); verts.append((0, 0, -thickness / 2))
    c1 = len(verts); verts.append((0, 0, thickness / 2))
    for i in range(npts):
        j = (i + 1) % npts
        faces.append((c0, back + j, back + i))
        faces.append((c1, front + i, front + j))

    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.update()
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    ob.data.materials.append(material)
    # bevel edges slightly for highlight rolloff
    bev = ob.modifiers.new('edge_bevel', 'BEVEL')
    bev.width = min(thickness * 0.08, 0.02)
    bev.segments = 2
    ob['fx_part'] = name
    return ob

def cyl(name, radius, depth, loc, material, part=None, verts=48):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=radius, depth=depth, location=loc)
    ob = bpy.context.object
    ob.name = name
    ob.data.materials.append(material)
    ob['fx_part'] = part or name
    bev = ob.modifiers.new('edge_bevel', 'BEVEL')
    bev.width = min(depth * 0.1, 0.02)
    bev.segments = 2
    bpy.ops.object.shade_smooth()
    return ob

def box(name, scale, loc, material, part=None, rotz=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    ob = bpy.context.object
    ob.name = name
    ob.scale = scale
    if rotz:
        ob.rotation_euler[2] = rotz
    bpy.ops.object.transform_apply(scale=True, rotation=True)
    ob.data.materials.append(material)
    ob['fx_part'] = part or name
    bev = ob.modifiers.new('edge_bevel', 'BEVEL')
    bev.width = 0.02
    bev.segments = 2
    return ob

parts = []

# --- main plate: nickel disc the movement sits on
plate = cyl('plate', 2.2, 0.10, (0, 0, -0.08), NICKEL, part='plate', verts=96)
parts.append(plate)

# --- gear train: three brass wheels meshing, sizes by ratio
# center wheel (large), third wheel (medium), fourth wheel (small)
g_center = gear_mesh('center_wheel', 48, 1.05, 0.92, 0.07, BRASS)
g_center.location = (-0.55, -0.45, 0.05)
g_third = gear_mesh('third_wheel', 36, 0.72, 0.62, 0.06, BRASS)
g_third.location = (1.05, -0.15, 0.09)
g_fourth = gear_mesh('fourth_wheel', 30, 0.52, 0.44, 0.05, BRASS)
g_fourth.location = (1.08, 1.00, 0.13)
for g in (g_center, g_third, g_fourth):
    parts.append(g)
    # pinion arbor through center
    parts.append(cyl(g.name + '_arbor', 0.045, 0.30, (g.location.x, g.location.y, g.location.z), STEEL, part=g.name + '_arbor', verts=20))

# --- escape wheel: small blued-steel, pointed club teeth
esc = gear_mesh('escape_wheel', 15, 0.34, 0.26, 0.035, BLUED, pointed=True)
esc.location = (0.30, 0.95, 0.16)
parts.append(esc)
parts.append(cyl('escape_arbor', 0.035, 0.30, (0.30, 0.95, 0.16), STEEL, part='escape_arbor', verts=20))

# --- balance wheel: rim + crossing arms, oscillates. big visual hero.
bw_parts = []
bpy.ops.mesh.primitive_torus_add(major_radius=0.62, minor_radius=0.055, major_segments=64, minor_segments=12, location=(-0.85, 0.95, 0.30))
rim = bpy.context.object
rim.name = 'balance_rim'
rim.data.materials.append(BRASS)
rim['fx_part'] = 'balance'
bw_parts.append(rim)
for k in range(2):
    ang = k * math.pi / 2
    arm = box('balance_arm%d' % k, (0.60, 0.045, 0.030), (-0.85, 0.95, 0.30), BRASS, part='balance', rotz=ang)
    bw_parts.append(arm)
hub = cyl('balance_hub', 0.07, 0.10, (-0.85, 0.95, 0.30), STEEL, part='balance', verts=24)
bw_parts.append(hub)
# timing screws around the rim — brass cylinders pushed outward
for k in range(8):
    a = 2 * math.pi * k / 8 + 0.2
    sx, sy = -0.85 + 0.70 * math.cos(a), 0.95 + 0.70 * math.sin(a)
    sc = cyl('balance_screw%d' % k, 0.035, 0.09, (sx, sy, 0.30), STEEL, part='balance', verts=12)
    sc.rotation_euler[1] = math.pi / 2
    sc.rotation_euler[2] = a
    bw_parts.append(sc)

# --- hairspring: flat Archimedean spiral above the balance
spiral_pts = []
turns = 5
seg = 220
for i in range(seg + 1):
    f = i / seg
    ang = turns * 2 * math.pi * f
    r = 0.09 + 0.38 * f
    spiral_pts.append((-0.85 + r * math.cos(ang), 0.95 + r * math.sin(ang), 0.42))
cu = bpy.data.curves.new('hairspring_curve', 'CURVE')
cu.dimensions = '3D'
sp = cu.splines.new('POLY')
sp.points.add(len(spiral_pts) - 1)
for i, p in enumerate(spiral_pts):
    sp.points[i].co = (*p, 1)
cu.bevel_depth = 0.012
cu.resolution_u = 1
hs = bpy.data.objects.new('hairspring', cu)
bpy.context.collection.objects.link(hs)
hs.data.materials.append(BLUED)
hs['fx_part'] = 'hairspring'

# --- pallet fork: lever between escape wheel and balance — rocks side to side
pf = box('pallet_fork', (0.42, 0.05, 0.03), (0.06, 0.97, 0.17), STEEL, part='pallet', rotz=math.pi / 2)
pf2 = box('pallet_arm', (0.16, 0.045, 0.028), (0.02, 1.28, 0.17), STEEL, part='pallet', rotz=0.5)
# ruby pallet stones at the fork tip
for i, (px, py) in enumerate(((0.24, 0.82), (0.30, 1.10))):
    cyl('pallet_jewel%d' % i, 0.028, 0.06, (px, py, 0.17), RUBY, part='pallet', verts=12)

# --- jewel bearings: ruby donuts sitting in the plate under each arbor
for i, (jx, jy) in enumerate(((-0.55, -0.45), (0.72, -0.72), (1.05, 0.28), (0.30, 0.95))):
    bpy.ops.mesh.primitive_torus_add(major_radius=0.075, minor_radius=0.028, major_segments=24, minor_segments=8, location=(jx, jy, 0.02))
    jw = bpy.context.object
    jw.name = 'jewel%d' % i
    jw.data.materials.append(RUBY)
    jw['fx_part'] = 'jewels'

# --- balance cock: a steel bridge over the balance wheel (static)
box('balance_cock', (0.55, 0.16, 0.045), (-0.85, 0.95, 0.52), STEEL, part='cock', rotz=0.35)

# --- blued screws on the plate perimeter (static detail)
for k in range(6):
    a = 2 * math.pi * k / 6 + 0.4
    cyl('plate_screw%d' % k, 0.045, 0.06, (1.95 * math.cos(a), 1.95 * math.sin(a), 0.0), BLUED, part='plate', verts=16)

# select everything and export
bpy.ops.object.select_all(action='SELECT')
out = os.path.join(HERE, 'model.glb')
export(HERE)
print('exported', out)
