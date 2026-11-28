# A4/A7: circuit-city kit: tower_a/b/c unit modules (1x1 footprint, 1 tall), pcb tile 4x4 with traces, chip with pins.
import bpy, os, sys, math
sys.dont_write_bytecode = True; HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.dirname(HERE))
from _bl import *
reset()
CON = mat('Concrete', (0.55, 0.56, 0.58), rough=0.7, metal=0.0)
GL = mat('Glass', (0.05, 0.07, 0.09), rough=0.08, metal=0.9)
WIN = mat('Window', (1.0, 0.78, 0.5), rough=0.4, emit=(1.0, 0.72, 0.42), strength=3.0)
PCB = mat('PCB', (0.03, 0.07, 0.05), rough=0.55, metal=0.1)
CU = mat('Copper', (0.85, 0.55, 0.3), rough=0.3, metal=1.0)
IC = mat('IC', (0.02, 0.02, 0.022), rough=0.45, metal=0.1)
def tower(name, x0, kind):
    core = box(f'{name}_core', (0.86, 0.86, 1.0), (x0, 0, 0.5), CON, bev=0.02)
    if kind == 0:
        for k in range(4):
            for j in range(3):
                a = k * math.pi / 2; dx, dy = math.cos(a), math.sin(a)
                o = -0.25 + j * 0.25
                box(f'{name}_w{k}{j}', (0.14 if dx == 0 else 0.02, 0.02 if dx == 0 else 0.14, 0.7), (x0 + dx * 0.435 + (o if dx == 0 else 0), dy * 0.435 + (o if dy == 0 else 0), 0.5), GL)
    elif kind == 1:
        box(f'{name}_band', (0.9, 0.9, 0.12), (x0, 0, 0.8), GL, bev=0.01)
        box(f'{name}_band2', (0.9, 0.9, 0.12), (x0, 0, 0.3), GL, bev=0.01)
    else:
        for k in range(5):
            box(f'{name}_fin{k}', (0.04, 0.92, 1.0), (x0 - 0.36 + k * 0.18, 0, 0.5), GL)
    return core
tower('tower_a', 0, 0); tower('tower_b', 2, 1); tower('tower_c', 4, 2)
box('lit_a', (0.88, 0.88, 0.06), (6, 0, 0.5), WIN)
box('pcb', (4, 4, 0.08), (0, 6, -0.04), PCB, bev=0.01)
for i in range(7):
    box(f'trace_{i}', (3.6, 0.035, 0.012), (0, 6 - 1.5 + i * 0.5, 0.006), CU)
for i in range(7):
    box(f'tracev_{i}', (0.035, 3.6, 0.012), (-1.5 + i * 0.5, 6, 0.008), CU)
box('chip', (1.0, 1.0, 0.16), (8, 0, 0.08), IC, bev=0.02)
for s in range(4):
    for i in range(8):
        a = s * math.pi / 2; dx, dy = math.cos(a), math.sin(a); o = -0.42 + i * 0.12
        box(f'chip_pin{s}{i}', (0.06 if dx == 0 else 0.18, 0.18 if dx == 0 else 0.06, 0.03), (8 + dx * 0.56 + (o if dx == 0 else 0), dy * 0.56 + (o if dy == 0 else 0), 0.03), CU)
export(HERE)
