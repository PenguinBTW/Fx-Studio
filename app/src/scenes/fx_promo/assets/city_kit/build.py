# City kit for the city act: stackable floor modules (body + emissive window band, origin at the floor's base),
# roof crowns, a tower crane and a rubble chunk. The engine instances floors to grow, light, abandon and topple towers.
import bpy, os, sys, math
sys.dont_write_bytecode = True; HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.dirname(HERE))
from _bl import *
reset()
BODY = mat('CityBody', (0.42, 0.42, 0.44), rough=0.6, metal=0.1)
WIN = mat('CityWin', (1, 1, 1), rough=0.3, emit=(1, 1, 1), strength=1.0)
STEEL = mat('CitySteel', (0.75, 0.45, 0.08), rough=0.5, metal=0.6)
H = 0.3

def tag(ob, name):
    ob.name = name; ob['fx_part'] = name

def box(name, sx, sy, sz, z0=0.0, m=BODY, x=0.0, y=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x, y, z0 + sz / 2))
    o = bpy.context.active_object; o.scale = (sx, sy, sz); bpy.ops.object.transform_apply(scale=True)
    assign(o, m); tag(o, name); return o

def cyl(name, r, sz, z0=0.0, m=BODY, n=8):
    bpy.ops.mesh.primitive_cylinder_add(vertices=n, radius=r, depth=sz, location=(0, 0, z0 + sz / 2))
    o = bpy.context.active_object; assign(o, m); tag(o, name); return o

def place(objs, dx):
    for o in objs: o.location.x += dx

# floor_a: square glass box with a ribbon window band
a = [box('floor_a_body', 1.0, 1.0, H * 0.96), box('floor_a_win', 1.02, 1.02, H * 0.42, z0=H * 0.3, m=WIN)]
# floor_b: octagonal tower floor
b = [cyl('floor_b_body', 0.55, H * 0.96), cyl('floor_b_win', 0.565, H * 0.42, z0=H * 0.3, m=WIN)]
# floor_c: wide slab with punched windows (five vertical lights)
c = [box('floor_c_body', 1.6, 0.8, H * 0.96)]
for i in range(5):
    c.append(box(f'floor_c_win{i}', 0.22, 0.82, H * 0.5, z0=H * 0.25, m=WIN, x=-0.64 + i * 0.32))
bpy.ops.object.select_all(action='DESELECT')
for o in c[1:]: o.select_set(True)
bpy.context.view_layer.objects.active = c[1]; bpy.ops.object.join(); tag(bpy.context.active_object, 'floor_c_win')
c = [c[0], bpy.context.active_object]

def join(objs, name):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]; bpy.ops.object.join(); tag(bpy.context.active_object, name)
    return bpy.context.active_object
# Facade detail (shared body material): slab lips, corner piers and vertical mullions so towers read as architecture up close.
fa = [box('fa_lip', 1.06, 1.06, H * 0.08)]
for sx in (-1, 1):
    for sy in (-1, 1): fa.append(box('fa_pier', 0.07, 0.07, H, x=sx * 0.5, y=sy * 0.5))
for i in range(1, 6):
    u = -0.5 + i / 6
    for sgn in (-1, 1):
        fa.append(box('fa_m', 0.025, 0.04, H * 0.5, z0=H * 0.27, x=u, y=sgn * 0.515))
        fa.append(box('fa_m', 0.04, 0.025, H * 0.5, z0=H * 0.27, x=sgn * 0.515, y=u))
a.append(join(fa, 'floor_a_detail'))
fb = [cyl('fb_lip', 0.6, H * 0.08, n=8)]
for i in range(16):
    ang = i / 16 * math.tau
    o = box('fb_fin', 0.03, 0.08, H * 0.9, x=math.cos(ang) * 0.575, y=math.sin(ang) * 0.575); o.rotation_euler.z = ang
    fb.append(o)
b.append(join(fb, 'floor_b_detail'))
fc = [box('fc_lip', 1.7, 0.92, H * 0.07, z0=H * 0.0)]
for i in range(6): fc.append(box('fc_pier', 0.06, 0.86, H * 0.96, x=-0.8 + i * 0.32))
fc.append(box('fc_rail', 1.66, 0.03, H * 0.18, z0=H * 0.07, y=0.45))
c.append(join(fc, 'floor_c_detail'))
# roof crown: stepped cap + antenna
r = [box('roof_body', 0.8, 0.8, 0.18), box('roof_mast', 0.05, 0.05, 0.9, z0=0.18, m=STEEL), box('roof_win', 0.12, 0.12, 0.06, z0=1.06, m=WIN)]
bpy.ops.object.select_all(action='DESELECT')
for o in r[:2]: o.select_set(True)
bpy.context.view_layer.objects.active = r[0]; bpy.ops.object.join(); tag(bpy.context.active_object, 'roof_body')
r = [bpy.context.active_object, r[2]]
# crane: lattice-ish mast, jib and counter-jib (origin at mast base)
cr = [box('crane_mast', 0.12, 0.12, 3.0, m=STEEL), box('crane_jib', 2.6, 0.08, 0.08, z0=2.9, m=STEEL, x=0.9), box('crane_cab', 0.25, 0.2, 0.2, z0=2.75, m=STEEL), box('crane_weight', 0.3, 0.2, 0.22, z0=2.75, m=BODY, x=-0.45)]
bpy.ops.object.select_all(action='DESELECT')
for o in cr: o.select_set(True)
bpy.context.view_layer.objects.active = cr[0]; bpy.ops.object.join(); tag(bpy.context.active_object, 'crane')
cr = [bpy.context.active_object]
# rubble chunk
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.12)
rb = bpy.context.active_object; rb.scale = (1.3, 0.8, 0.6); bpy.ops.object.transform_apply(scale=True); assign(rb, BODY); tag(rb, 'rubble')
export(HERE)
