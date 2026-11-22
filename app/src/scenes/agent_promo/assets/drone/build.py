# A3/A4: sub-agent drone. Body at origin, rotors rotor_0..3 spin about +z, orange led underneath.
import bpy, os, sys, math
sys.dont_write_bytecode = True; HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.dirname(HERE))
from _bl import *
reset()
SH = mat('Shell', (0.12, 0.13, 0.15), rough=0.35, metal=0.6)
DK = mat('Carbon', (0.02, 0.02, 0.022), rough=0.5, metal=0.2)
ROT = mat('Rotor', (0.05, 0.05, 0.06), rough=0.3, metal=0.5)
SIG = mat('Signal', ORANGE, rough=0.3, emit=ORANGE, strength=6.0)
CH = mat('Chrome', (0.9, 0.9, 0.92), rough=0.15, metal=1.0)
box('body', (0.34, 0.24, 0.1), (0, 0, 0), SH, bev=0.03)
box('top', (0.2, 0.14, 0.04), (0, 0, 0.06), DK, bev=0.015)
for i in range(4):
    a = math.pi / 4 + i * math.pi / 2; x, y = math.cos(a) * 0.3, math.sin(a) * 0.3
    box(f'arm_{i}', (0.36, 0.035, 0.025), (x / 2, y / 2, 0.01), DK, bev=0.008, rot=(0, 0, a))
    cyl(f'motor_{i}', 0.035, 0.05, (x, y, 0.03), CH, verts=24)
    r = cyl(f'rotor_{i}', 0.13, 0.006, (x, y, 0.06), ROT, verts=48)
    box(f'blade_{i}', (0.26, 0.03, 0.004), (x, y, 0.064), ROT, rot=(0, 0, i))
bpy.ops.mesh.primitive_uv_sphere_add(radius=0.035, location=(0, 0, -0.06)); l = bpy.context.active_object; l.name = 'led'; assign(l, SIG); smooth(l)
cyl('clamp', 0.02, 0.08, (0, 0, -0.1), CH, verts=16)
export(HERE)
