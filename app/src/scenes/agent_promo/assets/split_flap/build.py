# A8: split-flap frame counter housing (6 windows along x, facing -y), flap plate (hinge at top edge), orange playhead tower.
import bpy, os, sys, math
sys.dont_write_bytecode = True; HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.dirname(HERE))
from _bl import *
reset()
SH = mat('Shell', (0.06, 0.065, 0.07), rough=0.35, metal=0.6)
DK = mat('Dark', (0.015, 0.015, 0.018), rough=0.6)
SIG = mat('Signal', ORANGE, rough=0.3, emit=ORANGE, strength=4.0)
CH = mat('Chrome', (0.9, 0.9, 0.92), rough=0.15, metal=1.0)
box('housing', (6.6, 1.0, 1.7), (0, 0.5, 0), SH, bev=0.06)
for i in range(6):
    box(f'window_{i}', (0.9, 0.2, 1.3), (-2.5 + i * 1.0, 0.0, 0), DK, bev=0.03)
box('flap', (0.86, 0.02, 0.62), (20, 0, -0.31), DK, bev=0.01)
cyl('axle', 0.02, 6.4, (0, -0.05, 0), CH, rot=(0, math.pi / 2, 0), verts=12)
box('playhead_mast', (0.12, 0.12, 4.0), (30, 0, 2.0), SIG, bev=0.02)
bpy.ops.mesh.primitive_cone_add(vertices=3, radius1=0.4, radius2=0.0, depth=0.5, location=(30, 0, 4.2), rotation=(math.pi, 0, 0))
c = bpy.context.active_object; c.name = 'playhead_cap'; assign(c, SIG)
export(HERE)
