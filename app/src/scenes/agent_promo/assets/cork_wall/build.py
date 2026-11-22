# A5/A6: cork review wall 8x4 (front face y=-0.05 faces -y); pushpin; clip lamp.
import bpy, os, sys, math
sys.dont_write_bytecode = True; HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.dirname(HERE))
from _bl import *
reset()
CORK = mat('Cork', (0.42, 0.29, 0.18), rough=0.95)
WOOD = mat('Frame', (0.12, 0.08, 0.05), rough=0.6)
PIN = mat('PinHead', (0.85, 0.83, 0.78), rough=0.35)
CH = mat('Chrome', (0.9, 0.9, 0.92), rough=0.15, metal=1.0)
BLK = mat('Enamel', (0.03, 0.03, 0.035), rough=0.3, metal=0.4)
box('board', (8, 0.1, 4), (0, 0, 2), CORK)
for (n, s, l) in [('frame_t', (8.3, 0.16, 0.15), (0, 0, 4.07)), ('frame_b', (8.3, 0.16, 0.15), (0, 0, -0.07)), ('frame_l', (0.15, 0.16, 4.2), (-4.07, 0, 2)), ('frame_r', (0.15, 0.16, 4.2), (4.07, 0, 2))]:
    box(n, s, l, WOOD, bev=0.02)
cyl('pin_head', 0.05, 0.05, (10, -0.06, 0), PIN, rot=(math.pi / 2, 0, 0), verts=24, bev=0.01)
cyl('pin_needle', 0.006, 0.08, (10, 0, 0), CH, rot=(math.pi / 2, 0, 0), verts=8)
bpy.ops.mesh.primitive_cone_add(vertices=40, radius1=0.2, radius2=0.06, depth=0.26, location=(12, -0.3, 0), rotation=(math.pi / 2 + 0.6, 0, 0))
sh = bpy.context.active_object; sh.name = 'lamp_shade'; m = sh.modifiers.new('sol', 'SOLIDIFY'); m.thickness = 0.01; select(sh); bpy.ops.object.modifier_apply(modifier='sol'); assign(sh, BLK); smooth(sh)
cyl('lamp_arm', 0.015, 0.4, (12, -0.12, 0.12), CH, rot=(math.pi / 2 - 0.4, 0, 0))
export(HERE)
