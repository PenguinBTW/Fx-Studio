# THRESHOLD Lint: the small warm felt moth. Real scale: body about 5cm long.
import bpy, os, sys, math
sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
from _bl import *

reset()
FELT = mat('LintFeltBrown', (0.20, 0.105, 0.055), 0.92)
FELT_EDGE = mat('LintFeltEdge', (0.34, 0.18, 0.085), 0.96)
THREAD = mat('ThreadDark', (0.035, 0.022, 0.018), 0.86)
BUTTON = mat('ButtonEye', (0.025, 0.018, 0.014), 0.3)
GLOW = mat('AbdomenWarmGlow', (1.0, 0.38, 0.08), 0.38, emit=(1.0, 0.22, 0.035), strength=5.0)

root = empty('lint_root')
root['fx_part'] = 'root'
seen_parts = set()
def add(o, part=None):
    parent(o, root)
    if part and part not in seen_parts:
        o['fx_part'] = part
        seen_parts.add(part)
    return o

# Body axis is Blender Z forward; tiny enough to sit in a flashlight close-up.
add(sphere('body', 0.018, (0, 0, 0), FELT, scale=(0.72, 0.58, 1.55), segments=32, rings=16), 'body')
add(sphere('head', 0.014, (0, 0, 0.031), FELT, scale=(0.9, 0.78, 0.8), segments=28, rings=14), 'head')
add(sphere('abdomen_glow', 0.012, (0, -0.002, -0.03), GLOW, scale=(0.78, 0.58, 1.1), segments=28, rings=14), 'abdomen')

# Felt wings: flattened ellipsoids with stitched edge cords. Rest pose is half-open.
for side in (-1, 1):
    wing = add(sphere(f'wing_{side}', 0.025, (side * 0.026, 0.002, 0.006), FELT_EDGE, scale=(1.55, 0.12, 0.72), segments=32, rings=12), 'wing_l' if side < 0 else 'wing_r')
    wing.rotation_euler[1] = math.radians(side * 22)
    wing.rotation_euler[2] = math.radians(side * -12)
    seam_pts = [
        (side * 0.012, -0.002, 0.014),
        (side * 0.036, -0.003, 0.022),
        (side * 0.061, -0.003, 0.006),
        (side * 0.045, -0.003, -0.012),
    ]
    stitch = curve(f'wing_stitch_{side}', seam_pts, 0.00065, THREAD)
    parent(stitch, wing)

# Button eyes and thread crosses.
for side in (-1, 1):
    eye = add(cyl(f'eye_{side}', 0.0045, 0.0022, (side * 0.008, -0.011, 0.037), BUTTON, rot=(math.radians(90), 0, 0), verts=24), 'eyes')
    for rot in (-35, 35):
        add(box(f'eye_thread_{side}_{rot}', (0.0048, 0.00045, 0.00045), (side * 0.008, -0.013, 0.037), THREAD, rot=(0, math.radians(rot), 0)), 'eyes')

# Antennae and six bent legs as curves.
for side in (-1, 1):
    add(curve(f'antenna_{side}', [(side * 0.005, 0, 0.04), (side * 0.015, 0.002, 0.061), (side * 0.026, 0.003, 0.067)], 0.0008, THREAD), 'antennae')
    for j, z in enumerate((0.018, 0.002, -0.014)):
        add(curve(f'leg_{side}_{j}', [(side * 0.009, 0, z), (side * 0.021, -0.006, z - 0.004), (side * 0.031, -0.012, z - 0.011)], 0.0009, THREAD), 'legs')

# Macro felt scales: overlapping flattened pills across the wings and back. They are
# deliberately geometric fibres/scales rather than texture noise so the close-up silhouette holds.
wing_by_side = { -1: bpy.data.objects.get('wing_-1'), 1: bpy.data.objects.get('wing_1') }
for i in range(60):
    side = -1 if i % 2 == 0 else 1
    row = (i // 2) % 10
    band = i // 20
    x = side * (0.012 + row * 0.0046)
    z = 0.018 - band * 0.016 - row * 0.0015
    y = -0.004 + math.sin(i * 1.7) * 0.0015
    sc = sphere(f'felt_scale_{i}', 0.0024, (x, y, z), FELT_EDGE if i % 3 else FELT, scale=(1.8, 0.32, 0.72), segments=10, rings=5)
    sc.rotation_euler[1] = math.radians(side * (18 + row * 2))
    sc.rotation_euler[2] = math.radians(side * -10)
    if abs(x) > 0.018 and wing_by_side.get(side):
        parent(sc, wing_by_side[side])
    else:
        add(sc, 'body')

# Sparse felt fuzz: short stitches radiating from the body, deliberately geometric.
for i in range(24):
    a = i * math.tau / 24
    z = -0.026 + (i % 6) * 0.009
    x = math.cos(a) * 0.011
    y = math.sin(a) * 0.008
    add(curve(f'fuzz_{i}', [(x, y, z), (x * 1.28, y * 1.28, z + 0.002)], 0.00035, FELT_EDGE), 'body')

export(HERE)
