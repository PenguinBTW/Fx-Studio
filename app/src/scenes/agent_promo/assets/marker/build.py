# A6: red marker. Felt tip at origin, body up +z (three +y); orange cap is its own part.
import bpy, os, sys, math
sys.dont_write_bytecode = True; HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.dirname(HERE))
from _bl import *
reset()
BODY = mat('Body', (0.9, 0.88, 0.84), rough=0.4)
CAP = mat('Cap', ORANGE, rough=0.35, emit=ORANGE, strength=0.6)
FELT = mat('Felt', (0.75, 0.04, 0.05), rough=0.9)
RING = mat('Ring', (0.03, 0.03, 0.03), rough=0.4)
bpy.ops.mesh.primitive_cone_add(vertices=24, radius1=0.045, radius2=0.012, depth=0.12, location=(0, 0, 0.06), rotation=(math.pi, 0, 0))
t = bpy.context.active_object; t.name = 'felt'; assign(t, FELT); smooth(t)
cyl('collar', 0.07, 0.12, (0, 0, 0.17), RING)
cyl('body', 0.09, 1.1, (0, 0, 0.78), BODY, bev=0.02)
cyl('cap', 0.098, 0.3, (0, 0, 1.36), CAP, bev=0.02)
box('clip', (0.04, 0.03, 0.26), (0, 0.11, 1.32), CAP, bev=0.01)
export(HERE)
