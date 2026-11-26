# THRESHOLD Tenant shared arm-only LOD. Patchwork arm with five vending-coil fingers.
import bpy, os, sys, math, random
import mathutils
sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
from _bl import *

reset()
R = random.Random(1734)
CHROME = mat('TenantChrome', (0.30, 0.34, 0.38), 0.2, metal=0.9)
TILE = mat('TenantPoolTile', (0.055, 0.20, 0.24), 0.28, metal=0.08)
PAPER = mat('TenantPaper', (0.56, 0.48, 0.34), 0.84)
FELT = mat('TenantFelt', (0.19, 0.045, 0.028), 0.95)
BALL_RED = mat('TenantBallRed', (0.55, 0.025, 0.018), 0.32)
BALL_BLUE = mat('TenantBallBlue', (0.02, 0.17, 0.48), 0.28)
RUBBER = mat('TenantDarkRubber', (0.018, 0.015, 0.013), 0.78)

root = empty('tenant_arm_root')
# Children are parented before the export-axis rotation so their inverse matrices do not cancel it.
root.rotation_euler[0] = math.radians(0)
root['fx_part'] = 'arm_only'
seen_parts = set()
def add(o, part=None):
    parent(o, root)
    if part and part not in seen_parts:
        o['fx_part'] = part
        seen_parts.add(part)
    return o

# Authored down Blender -Z, then rotated so the exported engine-space arm reaches along -Z.
add(sphere('shoulder_collage', 0.34, (0, 0, 0.05), PAPER, scale=(1.0, 0.7, 0.8), segments=36, rings=18), 'shoulder')
segments = [
    ((0, 0, -0.05), (0.06, -0.03, -0.58), 0.13, TILE),
    ((0.06, -0.03, -0.58), (-0.04, 0.02, -1.08), 0.105, CHROME),
    ((-0.04, 0.02, -1.08), (0.025, -0.01, -1.52), 0.083, PAPER),
]
for i, (a, b, radius, material) in enumerate(segments):
    ax, ay, az = a; bx, by, bz = b
    dx, dy, dz = bx-ax, by-ay, bz-az
    length = math.sqrt(dx*dx + dy*dy + dz*dz)
    ob = cyl(f'arm_segment_{i}', radius, length, ((ax+bx)/2, (ay+by)/2, (az+bz)/2), material, verts=48, bev=0.012)
    # Cylinder local Z -> segment direction.
    direction = mathutils.Vector((dx, dy, dz)).normalized()
    ob.rotation_mode = 'QUATERNION'
    ob.rotation_quaternion = direction.to_track_quat('Z', 'Y')
    add(ob, f'arm_segment_{i}')

# Patchwork plates/balls fused onto the arm: readable materials even in silhouette.
patch_mats = [TILE, PAPER, FELT, CHROME]
for i in range(34):
    z = R.uniform(-1.48, -0.08)
    ang = R.uniform(0, math.tau)
    rad = 0.105 * (1 - 0.25 * (-z / 1.6)) + 0.025
    x, y = math.cos(ang) * rad, math.sin(ang) * rad
    if i % 5 == 0:
        patch = sphere(f'patch_ball_{i}', 0.035, (x, y, z), BALL_RED if i % 10 == 0 else BALL_BLUE, scale=(1, 1, 0.72), segments=20, rings=10)
    else:
        sx, sy, sz = R.uniform(0.035, 0.09), R.uniform(0.012, 0.032), R.uniform(0.04, 0.11)
        patch = box(f'patch_plate_{i}', (sx, sy, sz), (x, y, z), patch_mats[i % len(patch_mats)], bev=0.006, seg=2, rot=(R.uniform(-0.5, 0.5), R.uniform(-0.5, 0.5), ang))
    add(patch, 'patchwork')

# Palm and wrist cuff.
add(sphere('palm', 0.14, (0.025, -0.01, -1.61), CHROME, scale=(1.15, 0.7, 0.85), segments=32, rings=16), 'palm')
add(torus('wrist_cuff', 0.105, 0.018, (0.02, -0.005, -1.49), RUBBER, rot=(math.radians(90), 0, 0), major_segments=40, minor_segments=8), 'wrist')

# Five too-long fingers. Each is a helix/vending spiral ending in a blunt chrome tip.
fan_x = [-0.28, -0.17, 0.0, 0.17, 0.27]
fan_y = [-0.18, 0.015, 0.085, 0.025, -0.055]
for finger in range(5):
    spread = (finger - 2) / 2
    base = (0.025 + spread * 0.082, -0.02 + abs(spread) * 0.012, -1.69)
    length = 0.46 + (0.08 if finger == 2 else 0.0) - abs(spread) * 0.035
    pts = []
    coils = 5.2
    for j in range(80):
        u = j / 79
        z = -u * length
        coil_amp = 0.023 * (1 - 0.18*u)
        x = fan_x[finger] * u + math.sin(u * coils * math.tau) * coil_amp
        y = fan_y[finger] * u + math.cos(u * coils * math.tau) * coil_amp
        pts.append((base[0] + x, base[1] + y, base[2] + z))
    ob = curve(f'finger_coil_{finger}', pts, 0.0145, CHROME)
    add(ob, f'finger_{finger}')
    tip = pts[-1]
    add(sphere(f'finger_tip_{finger}', 0.023, tip, CHROME, scale=(0.75, 0.75, 1.3), segments=28, rings=14), f'finger_{finger}')

# Loose coins trapped inside the arm collage.
for i in range(9):
    add(cyl(f'trapped_coin_{i}', 0.018, 0.003, (R.uniform(-0.08, 0.08), R.uniform(-0.08, 0.08), R.uniform(-1.25, -0.25)), CHROME, rot=(R.random()*math.pi, R.random()*math.pi, R.random()*math.pi), verts=24), 'coins')

# Rotate only after parenting: authored Blender -Z becomes Blender +Y, which exports as engine/glTF -Z.
root.rotation_euler[0] = math.radians(90)
bpy.context.view_layer.update()
export(HERE)
