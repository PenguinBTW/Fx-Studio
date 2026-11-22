# A6: strip-chart recorder: paper drum, pen_pivot empty (swings about Blender y), red pen_tip.
import bpy, os, sys, math
sys.dont_write_bytecode = True; HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.dirname(HERE))
from _bl import *
reset()
SH = mat('Shell', (0.09, 0.095, 0.1), rough=0.4, metal=0.6)
PAP = mat('Paper', (0.94, 0.92, 0.86), rough=0.8)
CH = mat('Chrome', (0.9, 0.9, 0.92), rough=0.15, metal=1.0)
RED = mat('Ink', (0.8, 0.05, 0.06), rough=0.5)
SIG = mat('Signal', ORANGE, rough=0.3, emit=ORANGE, strength=3.0)
box('housing', (1.6, 0.8, 0.5), (0, 0, 0.25), SH, bev=0.04)
cyl('drum', 0.22, 1.3, (0, 0.15, 0.55), PAP, rot=(0, math.pi / 2, 0), verts=64)
pv = empty('pen_pivot', (0, -0.35, 0.62))
a = box('pen_arm', (0.03, 0.5, 0.03), (0, -0.12, 0.72), CH); parent(a, pv)
bpy.ops.mesh.primitive_cone_add(vertices=16, radius1=0.02, radius2=0.004, depth=0.06, location=(0, 0.12, 0.74), rotation=(math.pi, 0, 0))
p = bpy.context.active_object; p.name = 'pen_tip'; assign(p, RED); smooth(p); parent(p, pv)
cyl('lamp', 0.03, 0.03, (0.65, -0.405, 0.38), SIG, rot=(math.pi / 2, 0, 0), verts=16)
export(HERE)
