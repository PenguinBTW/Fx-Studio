# A1: paper-tape punch. Tape runs along +x over the deck at z=0.74; the orange punch head (punch) strikes down; sprocket spins.
import bpy, os, sys, math
sys.dont_write_bytecode = True; HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.dirname(HERE))
from _bl import *
reset()
STEEL = mat('Steel', (0.08, 0.085, 0.095), rough=0.35, metal=0.85)
DARK = mat('Dark', (0.02, 0.02, 0.025), rough=0.6, metal=0.3)
CHROME = mat('Chrome', (0.9, 0.9, 0.92), rough=0.12, metal=1.0)
SIG = mat('Signal', ORANGE, rough=0.3, emit=ORANGE, strength=2.0)
LBL = mat('Label', (0.85, 0.82, 0.75), rough=0.7)
box('body', (1.8, 1.0, 0.62), (0, 0, 0.31), STEEL, bev=0.04)
box('deck', (1.9, 0.5, 0.06), (0, 0, 0.65), DARK, bev=0.012)
box('guide_l', (1.9, 0.05, 0.05), (0, 0.16, 0.7), CHROME, bev=0.01)
box('guide_r', (1.9, 0.05, 0.05), (0, -0.16, 0.7), CHROME, bev=0.01)
box('bridge', (0.34, 0.6, 0.12), (0, 0, 1.02), STEEL, bev=0.02)
cyl('post_l', 0.035, 0.3, (0, 0.27, 0.85), CHROME); cyl('post_r', 0.035, 0.3, (0, -0.27, 0.85), CHROME)
p = box('punch', (0.18, 0.26, 0.16), (0, 0, 0.88), SIG, bev=0.02)
for i in range(8):
    cyl(f'pin_{i}', 0.012, 0.08, (0, -0.105 + i * 0.03, 0.78), CHROME, verts=12)
s = cyl('sprocket', 0.13, 0.04, (0.62, 0, 0.74), CHROME, rot=(math.pi / 2, 0, 0), verts=24)
for i in range(12):
    a = i / 12 * math.tau
    t = box(f'tooth_{i}', (0.025, 0.04, 0.025), (0.62 + math.cos(a) * 0.14, 0, 0.74 + math.sin(a) * 0.14), CHROME, rot=(0, -a, 0)); parent(t, s)
cyl('roller_in', 0.06, 0.4, (-0.85, 0, 0.74), CHROME, rot=(math.pi / 2, 0, 0))
cyl('reel', 0.42, 0.28, (-1.25, 0, 0.9), DARK, rot=(math.pi / 2, 0, 0), verts=64, bev=0.01)
box('label', (0.5, 0.005, 0.14), (0.4, -0.503, 0.38), LBL, bev=0.0)
for i in range(3):
    cyl(f'knob_{i}', 0.05, 0.05, (-0.55 + i * 0.16, -0.51, 0.22), CHROME, rot=(math.pi / 2, 0, 0))
cyl('lamp', 0.035, 0.03, (0.75, -0.505, 0.5), SIG, rot=(math.pi / 2, 0, 0), verts=16)
export(HERE)
