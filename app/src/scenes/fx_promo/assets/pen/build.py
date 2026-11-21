# Plotter pen for s1_boot / s9_plotter: matte body, signal grip ring, chrome cone nib.
# Tip at the origin, body up Blender +z (= three.js +y).
import bpy, os, sys
sys.dont_write_bytecode = True; HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.dirname(HERE))
from _bl import *
reset()
BODY = mat('PenBody', (0.035, 0.035, 0.04), rough=0.5, metal=0.2)
RING = mat('PenRing', (1.0, 0.3, 0.07), rough=0.35, emit=(1.0, 0.3, 0.07), strength=1.5)
TIP = mat('PenTip', (0.95, 0.93, 0.9), rough=0.12, metal=1.0)
bpy.ops.mesh.primitive_cone_add(vertices=48, radius1=0.09, radius2=0.004, depth=0.32, location=(0, 0, 0.16), rotation=(3.14159265, 0, 0))
t = bpy.context.active_object
t.name = 'pen_tip'
assign(t, TIP)
shade_smooth_auto(t)
bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=0.1, depth=0.22, location=(0, 0, 0.42))
r = bpy.context.active_object
r.name = 'pen_ring'
assign(r, RING)
shade_smooth_auto(r)
bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=0.12, depth=1.6, location=(0, 0, 1.33))
b = bpy.context.active_object
b.name = 'pen_body'
m = b.modifiers.new('bev', 'BEVEL')
m.width = 0.03
m.segments = 3
bpy.ops.object.modifier_apply(modifier='bev')
assign(b, BODY)
shade_smooth_auto(b)
export(HERE)
