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

# Receiver: central grip with two rounded ear/mouth pods.
add(box('receiver_grip', (0.082, 0.022, 0.018), (0, 0.028, 0.136), BEIGE, bev=0.012, seg=6, rot=(0, 0, math.radians(1.5))), 'receiver')
for side in (-1, 1):
    pod = add(sphere(f'receiver_pod_{side}', 0.031, (side * 0.082, 0.03, 0.132), BEIGE, scale=(1.18, 0.72, 0.62), segments=22, rings=11), 'receiver')
    pod.rotation_euler[1] = math.radians(side * 4)
    add(cyl(f'receiver_cap_{side}', 0.019, 0.006, (side * 0.083, 0.012, 0.127), BEIGE_DARK, rot=(math.radians(90), 0, 0), verts=32), 'receiver')

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
