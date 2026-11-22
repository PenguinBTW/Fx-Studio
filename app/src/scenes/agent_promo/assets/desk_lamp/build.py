# A2: anglepoise desk lamp; base at origin, shade points at -x; bulb emits.
import bpy, os, sys, math
sys.dont_write_bytecode = True; HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.dirname(HERE))
from _bl import *
reset()
BLK = mat('Enamel', (0.03, 0.03, 0.035), rough=0.3, metal=0.4)
CH = mat('Chrome', (0.9, 0.9, 0.92), rough=0.15, metal=1.0)
BULB = mat('Bulb', (1, 0.85, 0.6), rough=0.2, emit=(1, 0.82, 0.55), strength=8)
cyl('base', 0.32, 0.06, (0, 0, 0.03), BLK, bev=0.015)
cyl('arm1', 0.022, 1.2, (-0.2, 0, 0.6), CH, rot=(0, -0.35, 0))
cyl('arm2', 0.022, 1.0, (-0.7, 0, 1.25), CH, rot=(0, 1.2, 0))
cyl('joint', 0.05, 0.08, (-0.41, 0, 1.15), BLK, rot=(math.pi / 2, 0, 0))
bpy.ops.mesh.primitive_cone_add(vertices=48, radius1=0.26, radius2=0.08, depth=0.32, location=(-1.12, 0, 1.2), rotation=(0, -2.2, 0))
sh = bpy.context.active_object; sh.name = 'shade'; m = sh.modifiers.new('sol', 'SOLIDIFY'); m.thickness = 0.012; select(sh); bpy.ops.object.modifier_apply(modifier='sol'); assign(sh, BLK); smooth(sh)
bpy.ops.mesh.primitive_uv_sphere_add(radius=0.07, location=(-1.16, 0, 1.12)); b = bpy.context.active_object; b.name = 'bulb'; assign(b, BULB); smooth(b)
export(HERE)
