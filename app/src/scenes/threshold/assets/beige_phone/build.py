# THRESHOLD beige office desk phone. Real scale: about 26cm wide, 20cm deep,
# with a low sloped keypad base and a separate contoured receiver resting in the cradle.
import bpy, os, sys, math
sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
from _bl import *

reset()
BEIGE = mat('BeigeBakelite', (0.54, 0.445, 0.30), 0.56)
BEIGE_LIGHT = mat('BeigeWornEdges', (0.72, 0.63, 0.46), 0.42)
BEIGE_DARK = mat('BeigeShadow', (0.31, 0.24, 0.15), 0.62)
KEY = mat('KeyIvory', (0.64, 0.56, 0.40), 0.58)
INK = mat('KeyInk', (0.035, 0.03, 0.025), 0.55)
RUBBER = mat('CordRubber', (0.10, 0.075, 0.05), 0.76)
METAL = mat('BellMetal', (0.38, 0.31, 0.19), 0.34, metal=0.7)
GRIME = mat('OldGrime', (0.07, 0.055, 0.035), 0.84)

root = empty('beige_phone_root')
root['fx_part'] = 'root'
seen_parts = set()
def add(o, part=None):
    parent(o, root)
    if part and part not in seen_parts:
        o['fx_part'] = part
        seen_parts.add(part)
    return o

# Low rectangular underside, deeper sloped shell, front lip and rear cradle plinth.
# The base is visually substantial rather than a flat card: about 8cm tall at the rear.
add(box('base_lower', (0.130, 0.102, 0.026), (0, 0, 0.026), BEIGE, bev=0.0045, seg=1), 'base')
# Angular molded shell: a real wedge/trapezoid rather than a softened bar of soap.
xh, yf, yb = 0.126, -0.096, 0.098
zb, ztf, ztb = 0.046, 0.066, 0.099
verts = [
    (-xh, yf, zb), (xh, yf, zb), (xh, yb, zb), (-xh, yb, zb),
    (-xh, yf, ztf), (xh, yf, ztf), (xh, yb, ztb), (-xh, yb, ztb),
]
faces = [(0,1,2,3),(4,7,6,5),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)]
me = bpy.data.meshes.new('base_shell_mesh')
me.from_pydata(verts, [], faces); me.update()
shell_ob = bpy.data.objects.new('base_shell', me); bpy.context.collection.objects.link(shell_ob)
assign(shell_ob, BEIGE); bevel(shell_ob, 0.0022, 1); smooth(shell_ob, 42)
add(shell_ob, 'base')
add(box('front_lip', (0.124, 0.011, 0.018), (0, -0.096, 0.045), BEIGE_DARK, bev=0.005), 'base')
add(box('rear_cradle_plinth', (0.112, 0.043, 0.025), (0, 0.047, 0.101), BEIGE, bev=0.0065, seg=2), 'cradle')
# thin shadow seam around the shell makes the two-piece molded construction legible
add(box('base_shell_shadow_seam', (0.127, 0.098, 0.0025), (0, -0.001, 0.043), GRIME, bev=0.001), 'base')

# Cradle towers and small switch hooks. They support the receiver at its end pods;
# they are low mechanical details, not large vertical blocks.
for side in (-1, 1):
    add(box(f'cradle_{side}', (0.024, 0.038, 0.021), (side * 0.079, 0.035, 0.119), BEIGE, bev=0.007, seg=2), 'cradle')
    add(box(f'hook_{side}', (0.010, 0.023, 0.010), (side * 0.054, 0.020, 0.124), BEIGE_DARK, bev=0.003), 'hooks')
    add(box(f'cradle_shadow_{side}', (0.016, 0.026, 0.004), (side * 0.079, 0.026, 0.104), GRIME, bev=0.002), 'cradle')

# Receiver: a long narrow central grip with flattened oval end pods. The grip stays thin;
# the old inflated banana silhouette is avoided. It rests low across the cradle.
receiver_root = empty('receiver')
parent(receiver_root, root)
receiver_root['fx_part'] = 'receiver'
receiver_path = []
for i in range(9):
    u = i / 8
    x = -0.084 + u * 0.168
    z = 0.132 + math.sin(u * math.pi) * 0.006
    receiver_path.append((x, 0.027, z))
handle = add(curve('receiver_continuous_grip', receiver_path, 0.0105, BEIGE, resolution=2))
parent(handle, receiver_root)
# subtle flattened palm thickening in the middle only
palm = add(sphere('receiver_palm_grip', 0.018, (0, 0.027, 0.138), BEIGE, scale=(1.75, 0.50, 0.48), segments=18, rings=9))
parent(palm, receiver_root)
for side in (-1, 1):
    neck = add(sphere(f'receiver_neck_{side}', 0.018, (side * 0.058, 0.027, 0.132), BEIGE, scale=(1.42, 0.70, 0.66), segments=18, rings=9))
    parent(neck, receiver_root)
    pod = add(sphere(f'receiver_pod_{side}', 0.027, (side * 0.083, 0.026, 0.128), BEIGE, scale=(1.16, 0.76, 0.66), segments=22, rings=11))
    parent(pod, receiver_root)
    pod.rotation_euler[1] = math.radians(side * 4)
    rim = add(torus(f'receiver_cap_rim_{side}', 0.0125, 0.0022, (side * 0.083, 0.0068, 0.126), BEIGE_LIGHT, rot=(math.radians(90), 0, 0), major_segments=28, minor_segments=6))
    parent(rim, receiver_root)
    cap = add(cyl(f'receiver_cap_{side}', 0.0108, 0.0028, (side * 0.083, 0.0053, 0.126), BEIGE_DARK, rot=(math.radians(90), 0, 0), verts=20))
    parent(cap, receiver_root)
    for h in range(6):
        ox = ((h % 3) - 1) * 0.0042
        oz = (math.floor(h / 3) - 0.5) * 0.0048
        hole = add(cyl(f'receiver_hole_{side}_{h}', 0.00115, 0.0011, (side * 0.083 + ox, 0.0038, 0.126 + oz), GRIME, rot=(math.radians(90), 0, 0), verts=8))
        parent(hole, receiver_root)

# Recessed keypad field on the forward sloped face. Keys sit inside the base footprint,
# raised only slightly, with tiny printed marks rather than loose floating tablets.
add(box('keypad_recess', (0.060, 0.043, 0.004), (0, -0.044, 0.078), BEIGE_DARK, bev=0.006, seg=2, rot=(math.radians(-6), 0, 0)), 'keypad')
digits = ['1','2','3','4','5','6','7','8','9','*','0','#']
for i, digit in enumerate(digits):
    col = i % 3
    row = i // 3
    x = (col - 1) * 0.024
    y = -0.027 - row * 0.0170
    z = 0.0805 - row * 0.0029
    key = add(box(f'key_{digit}', (0.0105, 0.0055, 0.0022), (x, y, z), KEY, bev=0.0012, seg=1, rot=(math.radians(-6), 0, 0)), 'keypad')
    key['digit'] = digit
    add(box(f'key_mark_{digit}', (0.0048 if digit != '0' else 0.0068, 0.0007, 0.0005), (x, y - 0.0061, z + 0.0025), INK, bev=0.0003, rot=(math.radians(-6), 0, 0)), 'keypad')

# Bell holes and metal bells partly visible through the underside.
for side in (-1, 1):
    add(cyl(f'bell_{side}', 0.023, 0.010, (side * 0.047, 0.012, 0.007), METAL, verts=32, bev=0.003), 'bell')
for i in range(9):
    add(box(f'vent_{i}', (0.0025, 0.018, 0.0018), ((i - 4) * 0.011, -0.006, 0.053), GRIME, bev=0.0007), 'vents')

# Coiled receiver cord: leaves the left pod, droops in compact loops, then enters the shell.
pts = []
turns = 11
for i in range(turns * 10 + 1):
    u = i / (turns * 10)
    a = u * turns * math.tau
    cx = -0.100 - u * 0.018
    cy = 0.018 - u * 0.050
    cz = 0.126 - u * 0.067 + math.sin(u * math.pi) * -0.012
    pts.append((cx + math.cos(a) * 0.0042, cy + math.sin(a) * 0.0042, cz + math.cos(a + math.pi / 2) * 0.002))
add(curve('coiled_cord', pts, 0.0017, RUBBER), 'cord')

# Wear nicks and pale rubbed edges, small enough to read as age rather than decoration.
for i, x in enumerate((-0.082, -0.026, 0.041, 0.088)):
    add(box(f'wear_nick_{i}', (0.005, 0.0014, 0.0015), (x, -0.102, 0.049 + 0.002 * (i % 2)), GRIME, bev=0.0006), 'wear')
for side in (-1, 1):
    add(box(f'edge_rub_{side}', (0.018, 0.0012, 0.0012), (side * 0.096, -0.091, 0.072), BEIGE_LIGHT, bev=0.0005), 'wear')

export(HERE)
