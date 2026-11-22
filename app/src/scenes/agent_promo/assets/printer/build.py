# A5: photo printer. Paper exits the slot along -y at z=0.42; tally lamp is orange.
import bpy, os, sys, math
sys.dont_write_bytecode = True; HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.dirname(HERE))
from _bl import *
reset()
SH = mat('Shell', (0.82, 0.8, 0.76), rough=0.45)
DK = mat('Dark', (0.03, 0.03, 0.035), rough=0.5, metal=0.2)
CH = mat('Chrome', (0.9, 0.9, 0.92), rough=0.15, metal=1.0)
SIG = mat('Signal', ORANGE, rough=0.3, emit=ORANGE, strength=5.0)
box('body', (1.6, 1.0, 0.6), (0, 0.2, 0.3), SH, bev=0.06)
box('slot', (1.25, 0.08, 0.04), (0, -0.3, 0.42), DK, bev=0.01)
box('tray', (1.3, 0.7, 0.025), (0, -0.62, 0.2), DK, bev=0.01, rot=(-0.12, 0, 0))
cyl('roller', 0.03, 1.2, (0, -0.31, 0.46), CH, rot=(0, math.pi / 2, 0))
cyl('tally', 0.04, 0.03, (0.62, -0.3, 0.56), SIG, rot=(math.pi / 2, 0, 0), verts=24)
box('panel', (0.4, 0.02, 0.12), (-0.5, -0.31, 0.53), DK, bev=0.005)
export(HERE)
