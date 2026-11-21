# Corridor module for s7_tunnel: an octagonal beveled ring frame (r=3) with emissive inner strips and
# longitudinal rails running 2 units along Blender +y (= three.js -z), so modules tile every 2 units.
import bpy, os, sys, math
sys.dont_write_bytecode = True; HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.dirname(HERE))
from _bl import *
reset()
FRAME = mat('Frame', (0.07, 0.07, 0.075), rough=0.28, metal=0.85)
STRIP = mat('Strip', (1.0, 1.0, 1.0), rough=0.3, emit=(1.0, 1.0, 1.0), strength=4.0)
RAIL = mat('Rail', (0.5, 0.49, 0.46), rough=0.25, metal=0.9)
R, N = 3.0, 8
def beam(a0, a1, r, thick, depth, y, m, name):
    x0, z0 = r * math.cos(a0), r * math.sin(a0)
    x1, z1 = r * math.cos(a1), r * math.sin(a1)
    L = math.hypot(x1 - x0, z1 - z0)
    bpy.ops.mesh.primitive_cube_add(size=1, location=((x0 + x1) / 2, y, (z0 + z1) / 2))
    o = bpy.context.active_object
    o.name = name
    o.scale = (L * 1.04, depth, thick)
    o.rotation_euler = (0, -math.atan2(z1 - z0, x1 - x0), 0)
    bpy.ops.object.transform_apply(rotation=True, scale=True)
    b = o.modifiers.new('bev', 'BEVEL')
    b.width = min(thick, depth) * 0.25
    b.segments = 2
    bpy.ops.object.modifier_apply(modifier='bev')
    assign(o, m)
    return o
objs = []
for i in range(N):
    a0 = (i + 0.5) * 2 * math.pi / N
    a1 = (i + 1.5) * 2 * math.pi / N
    objs.append(beam(a0, a1, R, 0.34, 0.42, 0, FRAME, 'ring_%d' % i))
    objs.append(beam(a0 + 0.08, a1 - 0.08, R - 0.2, 0.05, 0.12, 0, STRIP, 'strip_%d' % i))
    a = (i + 1.0) * 2 * math.pi / N
    bpy.ops.mesh.primitive_cube_add(size=1, location=((R + 0.05) * math.cos(a), 1.0, (R + 0.05) * math.sin(a)))
    r = bpy.context.active_object
    r.name = 'rail_%d' % i
    r.scale = (0.12, 2.0, 0.12)
    bpy.ops.object.transform_apply(scale=True)
    assign(r, RAIL)
    objs.append(r)
groups = {nm: [o.name for o in objs if o.data.materials[0] == m] for m, nm in [(FRAME, 'frame'), (STRIP, 'strip'), (RAIL, 'rail')]}
for nm, names in groups.items():
    group = [bpy.data.objects[n] for n in names]
    bpy.ops.object.select_all(action='DESELECT')
    for o in group:
        o.select_set(True)
    bpy.context.view_layer.objects.active = group[0]
    bpy.ops.object.join()
    bpy.context.active_object.name = 'tunnel_' + nm
export(HERE)
