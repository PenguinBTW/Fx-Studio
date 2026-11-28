# THRESHOLD beige phone core. Real scale: about 24cm wide, 18cm deep, receiver on top.
import bpy, os, sys, math
sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
from _bl import *

reset()
BEIGE = mat('BeigeBakelite', (0.58, 0.49, 0.34), 0.5)
BEIGE_DARK = mat('BeigeShadow', (0.32, 0.25, 0.16), 0.58)
KEY = mat('KeyIvory', (0.78, 0.72, 0.58), 0.42)
INK = mat('KeyInk', (0.035, 0.03, 0.025), 0.5)
RUBBER = mat('CordRubber', (0.12, 0.09, 0.065), 0.72)
METAL = mat('BellMetal', (0.42, 0.34, 0.2), 0.3, metal=0.75)
GRIME = mat('OldGrime', (0.08, 0.065, 0.045), 0.82)

root = empty('beige_phone_root')
root['fx_part'] = 'root'
seen_parts = set()
def add(o, part=None):
    parent(o, root)
    if part and part not in seen_parts:
        o['fx_part'] = part
        seen_parts.add(part)
    return o

# Sloped base shell and underside lip.
add(box('base_lower', (0.12, 0.088, 0.026), (0, 0, 0.026), BEIGE, bev=0.012, seg=2), 'base')
add(box('base_shell', (0.116, 0.083, 0.027), (0, 0.002, 0.066), BEIGE, bev=0.014, seg=2, rot=(math.radians(-5), 0, 0)), 'base')
add(box('front_lip', (0.112, 0.012, 0.018), (0, -0.084, 0.042), BEIGE_DARK, bev=0.006), 'base')

# Cradle towers and receiver hooks.
for side in (-1, 1):
    add(box(f'cradle_{side}', (0.027, 0.046, 0.041), (side * 0.077, 0.034, 0.103), BEIGE, bev=0.009, seg=2), 'cradle')
    add(box(f'hook_{side}', (0.012, 0.028, 0.018), (side * 0.052, 0.022, 0.111), BEIGE_DARK, bev=0.005), 'hooks')

# Receiver: one continuous curved handset. The grip is a gently arched solid tube which
# overlaps the ear/mouth pods, with pod transition bulbs hiding every seam.
receiver_root = empty('receiver')
parent(receiver_root, root)
receiver_root['fx_part'] = 'receiver'
receiver_path = []
for i in range(7):
    u = i / 6
    x = -0.079 + u * 0.158
    z = 0.126 + math.sin(u * math.pi) * 0.011
    receiver_path.append((x, 0.029, z))
handle = add(curve('receiver_continuous_grip', receiver_path, 0.0152, BEIGE, resolution=2))
parent(handle, receiver_root)
# flattened central palm grip gives the tube a handset-like wider middle without breaking continuity
palm = add(sphere('receiver_palm_grip', 0.028, (0, 0.029, 0.137), BEIGE, scale=(1.65, 0.43, 0.42), segments=18, rings=9))
parent(palm, receiver_root)
for side in (-1, 1):
    neck = add(sphere(f'receiver_neck_{side}', 0.023, (side * 0.055, 0.029, 0.128), BEIGE, scale=(1.35, 0.72, 0.75), segments=18, rings=9))
    parent(neck, receiver_root)
    pod = add(sphere(f'receiver_pod_{side}', 0.034, (side * 0.081, 0.028, 0.124), BEIGE, scale=(1.12, 0.78, 0.72), segments=18, rings=9))
    parent(pod, receiver_root)
    pod.rotation_euler[1] = math.radians(side * 5)
    rim = add(torus(f'receiver_cap_rim_{side}', 0.0155, 0.0032, (side * 0.081, 0.0065, 0.122), BEIGE, rot=(math.radians(90), 0, 0), major_segments=28, minor_segments=6))
    parent(rim, receiver_root)
    cap = add(cyl(f'receiver_cap_{side}', 0.0135, 0.0035, (side * 0.081, 0.0048, 0.122), BEIGE_DARK, rot=(math.radians(90), 0, 0), verts=20))
    parent(cap, receiver_root)
    # shallow perforated speaker cluster, recessed into the dark cap rather than floating on the shell
    for h in range(5):
        ox = ((h % 2) - 0.5) * 0.006
        oz = (math.floor(h / 2) - 1) * 0.0045
        hole = add(cyl(f'receiver_hole_{side}_{h}', 0.00145, 0.0012, (side * 0.081 + ox, 0.0027, 0.122 + oz), GRIME, rot=(math.radians(90), 0, 0), verts=8))
        parent(hole, receiver_root)

# Twelve raised keys in a 3x4 grid, slightly forward on the sloped face.
digits = ['1','2','3','4','5','6','7','8','9','*','0','#']
for i, digit in enumerate(digits):
    col = i % 3
    row = i // 3
    x = (col - 1) * 0.034
    y = -0.046 - row * 0.018
    z = 0.094 - row * 0.002
    key = add(box(f'key_{digit}', (0.0125, 0.008, 0.0045), (x, y, z), KEY, bev=0.0035, seg=1, rot=(math.radians(-5), 0, 0)), 'keypad')
    key['digit'] = digit
    # Small dark numeral inset blocks, deliberately geometric rather than texture-dependent.
    add(box(f'key_mark_{digit}', (0.006 if digit != '0' else 0.008, 0.0008, 0.0007), (x, y - 0.0082, z + 0.0028), INK, bev=0.0005, rot=(math.radians(-5), 0, 0)), 'keypad')

# Bell holes and two metal bells partly visible through the underside vents.
for side in (-1, 1):
    add(cyl(f'bell_{side}', 0.025, 0.012, (side * 0.047, 0.012, 0.007), METAL, verts=40, bev=0.004), 'bell')
for i in range(9):
    add(box(f'vent_{i}', (0.003, 0.022, 0.002), ((i - 4) * 0.012, -0.01, 0.055), GRIME, bev=0.001), 'vents')

# Coiled cord as a deterministic helix leaving the receiver's left pod and entering the shell.
pts = []
turns = 13
for i in range(turns * 12 + 1):
    u = i / (turns * 12)
    a = u * turns * math.tau
    cx = -0.102 - u * 0.03
    cy = 0.026 - u * 0.08
    cz = 0.128 - u * 0.08
    pts.append((cx + math.cos(a) * 0.006, cy + math.sin(a) * 0.006, cz))
add(curve('coiled_cord', pts, 0.0021, RUBBER), 'cord')

# Wear: tiny darker nicks along the front lip and one pale edge rub.
for i, x in enumerate((-0.07, -0.018, 0.048, 0.084)):
    add(box(f'wear_nick_{i}', (0.006, 0.0015, 0.0018), (x, -0.091, 0.047 + 0.002 * (i % 2)), GRIME, bev=0.001), 'wear')

export(HERE)
