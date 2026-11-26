# THRESHOLD Tenant full/upper-body LOD. A 4.2 m patchwork collage creature built from zone materials.
import bpy, os, sys, math, random
import mathutils
sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
from _bl import *

reset()
R = random.Random(4177)

TILE = mat('TenantPoolTile', (0.34, 0.55, 0.52), 0.28, metal=0.03)
GROUT = mat('TenantTileGrout', (0.025, 0.045, 0.045), 0.72)
PAPER = mat('TenantPaper', (0.64, 0.54, 0.36), 0.84)
PAPER_DARK = mat('TenantPaperEdge', (0.31, 0.22, 0.13), 0.9)
FELT = mat('TenantFelt', (0.20, 0.055, 0.035), 0.96)
CHROME = mat('TenantChrome', (0.42, 0.47, 0.51), 0.18, metal=0.88)
DARK_METAL = mat('TenantVendingMetal', (0.025, 0.04, 0.05), 0.38, metal=0.72)
GLASS = mat('TenantRibcageGlass', (0.035, 0.12, 0.15), 0.16, metal=0.08)
try:
    GLASS.diffuse_color = (0.035, 0.12, 0.15, 0.48)
    GLASS.node_tree.nodes['Principled BSDF'].inputs['Alpha'].default_value = 0.48
    GLASS.surface_render_method = 'DITHERED'
except Exception:
    pass
BALL_RED = mat('TenantBallRed', (0.095, 0.012, 0.008), 0.46)
BALL_YELLOW = mat('TenantBallYellow', (0.14, 0.085, 0.018), 0.5)
BALL_BLUE = mat('TenantBallBlue', (0.01, 0.028, 0.055), 0.48)
BALL_DARK = mat('TenantBallDark', (0.035, 0.028, 0.026), 0.48)
BALL_GREEN = mat('TenantBallGreen', (0.018, 0.07, 0.038), 0.5)
BLACK = mat('TenantFaceSlot', (0.002, 0.003, 0.003), 0.92)
RUBBER = mat('TenantDarkRubber', (0.012, 0.01, 0.009), 0.8)

seen_parts = set()
root = empty('tenant_full_root')
root['fx_part'] = 'root'
upper = empty('upper_body')
upper['fx_part'] = 'upper_body'
parent(upper, root)
lower = empty('lower_body')
lower['fx_part'] = 'lower_body'
parent(lower, root)

def group(name, par, part=None, loc=(0, 0, 0)):
    ob = empty(name, loc)
    parent(ob, par)
    if part and part not in seen_parts:
        ob['fx_part'] = part
        seen_parts.add(part)
    return ob

def add(o, par, part=None):
    parent(o, par)
    if part and part not in seen_parts:
        o['fx_part'] = part
        seen_parts.add(part)
    return o

def group_local(name, par, part=None, loc=(0, 0, 0)):
    # Unlike the world-preserving mesh parenting helper, control empties must use true
    # parent-relative transforms so exported pivots land at shoulders/elbows/knees/wrists.
    ob = empty(name, loc)
    ob.parent = par
    if part and part not in seen_parts:
        ob['fx_part'] = part
        seen_parts.add(part)
    return ob

# Head control: small smooth pool-tile ovoid, too small for the body, face reduced to one black slot.
head_g = group('head_control', upper, 'head', (0, 0.08, 3.55))
add(sphere('head_tile_ovoid', 0.16, (0, 0.16, 3.86), TILE, scale=(0.78, 0.68, 1.12), segments=48, rings=24), head_g)
# Grout lines are raised dark curves crossing the ovoid rather than texture noise.
for i, z in enumerate((3.76, 3.86, 3.96)):
    pts = []
    for j in range(25):
        a = j / 24 * math.tau
        pts.append((math.cos(a) * 0.118, 0.16 + math.sin(a) * 0.102, z))
    add(curve(f'head_grout_ring_{i}', pts, 0.0065, GROUT, cyclic=True), head_g, 'head_grout')
for i, x in enumerate((-0.055, 0.0, 0.055)):
    pts = []
    for j in range(19):
        u = j / 18
        z = 3.73 + u * 0.27
        y = 0.16 + math.sin(u * math.pi) * 0.104
        pts.append((x, y, z))
    add(curve(f'head_grout_vertical_{i}', pts, 0.0055, GROUT), head_g, 'head_grout')
add(box('head_black_face_slot', (0.052, 0.014, 0.16), (0, 0.274, 3.87), BLACK, bev=0.004, rot=(math.radians(4), 0, 0)), head_g, 'face_slot')

# Felt neck segments, deliberately visible as stacked wrong material.
neck_g = group('neck_control', upper, 'neck', (0, 0.06, 3.02))
for i in range(4):
    z = 3.58 - i * 0.14
    add(cyl(f'neck_{i+1}', 0.058 + i * 0.004, 0.15, (0, 0.08 - i * 0.012, z), FELT, verts=32, bev=0.006), neck_g, 'neck_segments')
    add(torus(f'neck_thread_{i+1}', 0.061 + i * 0.004, 0.004, (0, 0.08 - i * 0.012, z + 0.055), PAPER_DARK, major_segments=32, minor_segments=6), neck_g, 'neck_segments')

# Ribcage: bent vending-machine glass front with visible coils, shelves, frames, and rattling coins.
rib_g = group('ribcage_control', upper, 'ribcage', (0, 0, 2.78))
add(box('ribcage_backplate_upper', (0.62, 0.15, 0.48), (-0.025, -0.025, 3.04), DARK_METAL, bev=0.03, rot=(math.radians(-10), math.radians(2), math.radians(2.5))), rib_g)
add(box('ribcage_backplate_mid', (0.58, 0.15, 0.38), (0.035, -0.015, 2.73), DARK_METAL, bev=0.028, rot=(math.radians(2), math.radians(-2.5), math.radians(-2))), rib_g)
add(box('ribcage_backplate_lower', (0.52, 0.14, 0.42), (-0.035, -0.005, 2.43), DARK_METAL, bev=0.026, rot=(math.radians(9), math.radians(3), math.radians(-4))), rib_g)
add(box('ribcage_inner_occluding_darkness', (0.52, 0.024, 0.78), (0, 0.045, 2.77), BLACK, bev=0.012, rot=(math.radians(-4), 0, 0)), rib_g, 'inner_darkness')
add(box('ribcage_glass_front', (0.54, 0.024, 0.35), (-0.02, 0.112, 3.05), GLASS, bev=0.014, rot=(math.radians(-13), math.radians(2), math.radians(3))), rib_g, 'glass_front')
add(box('ribcage_glass_front_mid', (0.51, 0.024, 0.31), (0.025, 0.122, 2.76), GLASS, bev=0.012, rot=(math.radians(1), math.radians(-3), math.radians(-2.5))), rib_g, 'glass_front')
add(box('ribcage_glass_front_lower', (0.45, 0.024, 0.34), (-0.04, 0.108, 2.47), GLASS, bev=0.012, rot=(math.radians(12), math.radians(4), math.radians(-5))), rib_g, 'glass_front')
for x in (-0.33, 0.33):
    add(box(f'ribcage_side_frame_{x}', (0.055, 0.09, 1.08), (x, 0.075, 2.78), CHROME, bev=0.012, rot=(0, 0, math.radians(3 if x < 0 else -4))), rib_g, 'door_frame')
for z in (2.27, 3.29):
    add(box(f'ribcage_horizontal_frame_{z}', (0.68, 0.09, 0.055), (0, 0.075, z), CHROME, bev=0.012, rot=(0, 0, math.radians(2 if z < 2.8 else -2))), rib_g, 'door_frame')
for shelf in range(5):
    z = 2.43 + shelf * 0.17
    add(box(f'ribcage_shelf_{shelf}', (0.55, 0.18, 0.025), (0, 0.02, z), CHROME, bev=0.006), rib_g, 'shelves')
# Internal vending spirals, three vertical columns.
for col, x in enumerate((-0.18, 0, 0.18)):
    pts = []
    turns = 8.5
    for j in range(150):
        u = j / 149
        z = 2.39 + u * 0.78
        pts.append((x + math.sin(u * turns * math.tau) * 0.035, 0.06 + math.cos(u * turns * math.tau) * 0.035, z))
    add(curve(f'ribcage_spiral_coil_{col}', pts, 0.009, CHROME), rib_g, 'spiral_coils')
# Bent/cracked lower corner and missing panel shards.
for i in range(7):
    add(box(f'ribcage_cracked_shard_{i}', (R.uniform(0.035, 0.09), 0.012, R.uniform(0.05, 0.14)),
            (R.uniform(-0.28, 0.28), 0.124, R.uniform(2.32, 3.18)), GLASS,
            bev=0.003, rot=(R.uniform(-0.25, 0.25), R.uniform(-0.25, 0.25), R.uniform(-0.7, 0.7))), rib_g, 'broken_glass')
for i in range(18):
    add(cyl(f'coin_rattle_{i}', 0.019, 0.004, (R.uniform(-0.22, 0.22), R.uniform(-0.02, 0.07), R.uniform(2.35, 2.63)), CHROME,
            rot=(R.random() * math.pi, R.random() * math.pi, R.random() * math.pi), verts=20), rib_g, 'coins')

# Spine is a exposed sequence of vending coils climbing the back.
spine_g = group('spine_control', upper, 'spine', (0, -0.16, 2.75))
for seg in range(8):
    z0 = 2.16 + seg * 0.15
    pts = []
    for j in range(40):
        u = j / 39
        pts.append((math.sin(u * math.tau * 2.2) * 0.045, -0.18 + math.cos(u * math.tau * 2.2) * 0.035, z0 + u * 0.17))
    add(curve(f'spine_{seg+1}', pts, 0.012, CHROME), spine_g, 'spine_coils')

# Pelvis: folded card wedges and torn paper seams.
pelvis_g = group('pelvis_control', lower, 'pelvis', (0, 0, 2.03))
add(box('pelvis_folded_card', (0.5, 0.28, 0.34), (0, -0.02, 2.03), PAPER, bev=0.018, rot=(math.radians(-8), 0, math.radians(4))), pelvis_g)
for i in range(9):
    add(box(f'pelvis_torn_seam_{i}', (0.025, 0.012, R.uniform(0.12, 0.28)),
            (R.uniform(-0.24, 0.24), 0.14, R.uniform(1.9, 2.15)), PAPER_DARK,
            rot=(R.uniform(-0.3, 0.3), R.uniform(-0.3, 0.3), R.uniform(-0.8, 0.8))), pelvis_g, 'torn_seams')

# Arms are longer than legs: fused toy balls over chrome coil cores. They arc forward
# and sag to the floor as one interpenetrating mass, with the left arm planted lower
# than the right so the resting silhouette is asymmetric rather than a robot stack.
def build_ball_arm(side):
    sx = -1 if side == 'l' else 1
    arm_g = group(f'arm_{side}_control', upper, f'arm_{side}', (sx * 0.38, 0.02, 3.23))
    upper_g = group_local(f'arm_{side}_upper_control', arm_g, f'arm_{side}_upper')
    lower_g = group_local(f'arm_{side}_lower_control', arm_g, f'arm_{side}_lower', (sx * 0.26, 0.09, -0.81))
    centers = []
    count = 22
    for i in range(count):
        u = i / (count - 1)
        if side == 'l':
            x = sx * (0.38 + 0.18 * math.sin(u * math.pi) + 0.08 * u)
            y = 0.02 + 1.35 * (u ** 1.24) - 0.10 * math.sin(u * math.pi)
            z = 3.23 - 3.02 * u + 0.13 * math.sin(u * math.pi)
        else:
            x = sx * (0.38 + 0.27 * math.sin(u * math.pi * 0.84) + 0.03 * u)
            y = 0.02 + 0.92 * (u ** 1.16) - 0.04 * math.sin(u * math.pi)
            z = 3.23 - 2.38 * u + 0.25 * math.sin(u * math.pi)
        centers.append((x, y, z))
    add(curve(f'arm_{side}_coil_core', centers, 0.027, CHROME), upper_g, 'coil_core')
    for bi in range(len(centers) - 1):
        add(curve(f'arm_{side}_fused_bridge_{bi}', [centers[bi], centers[bi + 1]], 0.031, RUBBER), upper_g if bi < 14 else lower_g, 'melted_seams')
    mats = [BALL_RED, BALL_DARK, BALL_DARK, BALL_YELLOW, BALL_DARK, BALL_BLUE, BALL_GREEN, BALL_DARK, BALL_DARK]
    for i, c in enumerate(centers):
        u = i / (len(centers) - 1)
        radius = 0.145 - 0.048 * u + R.uniform(-0.007, 0.007)
        # Aggressive overlap reads as melted/fused mass rather than a chain of separate beads.
        ball_mat = mats[int(R.random() * len(mats)) % len(mats)]
        ob = sphere(f'arm_{side}_fused_ball_{i}', radius, c, ball_mat,
                    scale=(1.10 + 0.08 * R.random(), 0.9 + 0.16 * R.random(), 1.08 + 0.08 * R.random()), segments=32, rings=16)
        add(ob, upper_g if i < 11 else lower_g, 'ball_pit_shell')
        if i % 3 != 1:
            sat_r = radius * (0.58 + 0.18 * R.random())
            sat = (c[0] + sx * R.uniform(-0.075, 0.115), c[1] + R.uniform(-0.075, 0.075), c[2] + R.uniform(-0.075, 0.075))
            sat_ob = sphere(f'arm_{side}_compressed_satellite_{i}', sat_r, sat, mats[int(R.random() * len(mats)) % len(mats)],
                            scale=(1.05, 0.72 + 0.2 * R.random(), 1.0), segments=24, rings=12)
            add(sat_ob, upper_g if i < 11 else lower_g, 'ball_pit_shell')
        if i % 3 == 1:
            add(torus(f'arm_{side}_melted_seam_{i}', radius * 0.9, 0.007, c, RUBBER,
                      rot=(math.radians(90), 0, 0), major_segments=24, minor_segments=5), upper_g if i < 11 else lower_g, 'melted_seams')
        if i in (4, 9, 14, 18):
            # Sagging melted blobs bridge neighbouring balls and remove the toylike gaps.
            add(sphere(f'arm_{side}_sag_mass_{i}', radius * 0.82, (c[0], c[1] - 0.025, c[2] - 0.055), RUBBER,
                       scale=(0.9, 0.62, 1.35), segments=24, rings=12), upper_g if i < 11 else lower_g, 'melted_seams')
    return arm_g, lower_g, centers[-1]

arm_l_g, arm_l_lower_g, wrist_l = build_ball_arm('l')
arm_r_g, arm_r_lower_g, wrist_r = build_ball_arm('r')

# Left hand: one vending spiral coil splitting into curling metal fingers.
hand_l_g = group_local('hand_l_control', arm_l_lower_g, 'hand_l', (wrist_l[0] + 0.64 if wrist_l[0] < 0 else wrist_l[0] - 0.64, wrist_l[1] - 0.11, wrist_l[2] - 2.42))
add(sphere('hand_l_palm_cuff', 0.095, wrist_l, CHROME, scale=(1.1, 0.75, 0.9), segments=32, rings=16), hand_l_g, 'palm')
for finger in range(5):
    spread = (finger - 2) / 2
    pts = []
    length = 0.54 - abs(spread) * 0.055 + (0.08 if finger == 2 else 0)
    for j in range(82):
        u = j / 81
        pts.append((wrist_l[0] + spread * 0.085 * u + math.sin(u * math.tau * 5.4) * 0.018,
                    wrist_l[1] + 0.06 * u + math.cos(u * math.tau * 5.4) * 0.018,
                    wrist_l[2] - length * u))
    add(curve(f'hand_l_coil_finger_{finger}', pts, 0.011, CHROME), hand_l_g, 'coil_fingers')
    add(sphere(f'hand_l_finger_tip_{finger}', 0.018, pts[-1], CHROME, scale=(0.75, 0.75, 1.35), segments=20, rings=10), hand_l_g, 'coil_fingers')

# Right hand: folded paper strips, each finger curled and torn at the tip.
hand_r_g = group_local('hand_r_control', arm_r_lower_g, 'hand_r', (wrist_r[0] - 0.64 if wrist_r[0] > 0 else wrist_r[0] + 0.64, wrist_r[1] - 0.11, wrist_r[2] - 2.42))
add(box('hand_r_paper_palm', (0.18, 0.08, 0.16), wrist_r, PAPER, bev=0.012, rot=(0.1, 0.0, -0.08)), hand_r_g, 'paper_palm')
for finger in range(5):
    spread = (finger - 2) / 2
    for seg in range(4):
        z = wrist_r[2] - 0.11 * (seg + 0.5)
        x = wrist_r[0] + spread * (0.045 + seg * 0.018)
        y = wrist_r[1] + 0.02 * seg
        ob = box(f'hand_r_paper_finger_{finger}_{seg}', (0.025, 0.025, 0.14), (x, y, z), PAPER if seg < 3 else PAPER_DARK,
                 bev=0.003, rot=(0.15 * seg, 0.05 * spread, -0.1 * spread))
        add(ob, hand_r_g, 'paper_fingers')

# Legs: stacked pool tiles and folded card, thin enough that the arms dominate the silhouette.
def build_leg(side):
    sx = -1 if side == 'l' else 1
    leg_g = group(f'leg_{side}_control', lower, f'leg_{side}', (sx * 0.18, 0, 1.95))
    upper_g = group_local(f'leg_{side}_upper_control', leg_g, f'leg_{side}_upper')
    lower_g = group_local(f'leg_{side}_lower_control', leg_g, f'leg_{side}_lower', (sx * 0.10, 0.04, -1.0))
    for i in range(6):
        z = 1.84 - i * 0.16
        x = sx * (0.18 + 0.018 * i)
        ybend = -0.02 + 0.012 * i + (0.10 if side == 'l' else -0.06) * (i / 5)
        ob = box(f'leg_{side}_upper_tile_{i}', (0.22, 0.20, 0.23), (x, ybend, z), TILE if i % 2 == 0 else PAPER,
                 bev=0.012, rot=(0.02 * i, 0.03 * sx, 0.025 * sx * i))
        add(ob, upper_g, 'stacked_tiles')
    for i in range(6):
        z = 0.94 - i * 0.14
        x = sx * (0.28 + 0.01 * i)
        ybend = 0.04 + 0.012 * i + (0.20 if side == 'l' else -0.10) * (i / 5)
        ob = box(f'leg_{side}_lower_tile_{i}', (0.20, 0.18, 0.22), (x, ybend, z), TILE if i % 2 else PAPER,
                 bev=0.01, rot=(-0.025 * i, -0.02 * sx, -0.018 * sx * i))
        add(ob, lower_g, 'stacked_tiles')
        if i % 2 == 0:
            add(box(f'leg_{side}_grout_slip_{i}', (0.17, 0.012, 0.018), (x, 0.125 + 0.012 * i, z), GROUT,
                    rot=(0, 0, 0.05 * sx)), lower_g, 'cracked_grout')
    foot = box(f'foot_{side}', (0.22, 0.38, 0.12), (sx * 0.31, 0.17 + (0.24 if side == 'l' else -0.12), 0.08), PAPER_DARK, bev=0.018, rot=(0, 0.05 * sx, 0))
    add(foot, lower_g, f'foot_{side}')
    return leg_g

build_leg('l')
build_leg('r')

# Static predator posture: hunched forward, head low, ribcage pitched into the
# fluorescents, slight sideways imbalance. These rotations remain on parent control
# nodes so scene-level stop-start rotations compose instead of replacing the silhouette.
rib_g.rotation_euler[0] = math.radians(-22)
rib_g.rotation_euler[1] = math.radians(3.5)
spine_g.rotation_euler[0] = math.radians(-24)
spine_g.rotation_euler[1] = math.radians(2.5)
neck_g.rotation_euler[0] = math.radians(-25)
neck_g.rotation_euler[1] = math.radians(-3)
head_g.rotation_euler[0] = math.radians(-18)
head_g.rotation_euler[1] = math.radians(-5)
head_g.scale = (0.78, 0.78, 0.78)
pelvis_g.rotation_euler[0] = math.radians(5)

# Collage patches over shoulders, ribs and hips: torn paper, cracked tiles and melted plastic transitions.
patch_mats = [TILE, PAPER, FELT, CHROME]
for i in range(56):
    zone = R.choice(['shoulder_l', 'shoulder_r', 'rib', 'hip'])
    if zone == 'shoulder_l':
        loc = (-0.34 + R.uniform(-0.08, 0.08), R.uniform(-0.05, 0.14), 3.22 + R.uniform(-0.12, 0.12))
        par = upper
    elif zone == 'shoulder_r':
        loc = (0.34 + R.uniform(-0.08, 0.08), R.uniform(-0.05, 0.14), 3.22 + R.uniform(-0.12, 0.12))
        par = upper
    elif zone == 'rib':
        loc = (R.uniform(-0.3, 0.3), R.uniform(0.1, 0.16), R.uniform(2.35, 3.2))
        par = rib_g
    else:
        loc = (R.uniform(-0.26, 0.26), R.uniform(-0.1, 0.14), R.uniform(1.9, 2.12))
        par = pelvis_g
    if i % 6 == 0:
        ob = sphere(f'patch_ball_{i}', R.uniform(0.025, 0.045), loc, [BALL_RED, BALL_YELLOW, BALL_BLUE][i % 3], scale=(1, 0.75, 1), segments=18, rings=9)
    else:
        ob = box(f'patch_plate_{i}', (R.uniform(0.035, 0.09), R.uniform(0.008, 0.022), R.uniform(0.04, 0.12)), loc,
                 patch_mats[i % len(patch_mats)], bev=0.003, rot=(R.uniform(-0.4, 0.4), R.uniform(-0.4, 0.4), R.uniform(-0.8, 0.8)))
    add(ob, par, 'patchwork')

# Bake a continuous forward sag into the finished mesh transforms. The amount grows
# with height, so the torso/head cantilever forward while the feet stay planted; this
# is silhouette craft rather than animation state and survives the GLB export.
bpy.context.view_layer.update()
for ob in list(bpy.data.objects):
    if ob.type != 'MESH':
        continue
    zc = ob.matrix_world.translation.z
    if zc <= 1.85:
        continue
    u = max(0.0, min(1.0, (zc - 1.85) / 1.9))
    forward_sag = 0.86 * (u ** 1.35)
    downward_sag = 0.38 * (u ** 1.6)
    ob.matrix_world = mathutils.Matrix.Translation((0, forward_sag, -downward_sag)) @ ob.matrix_world
    # Pull the head and felt neck down into the torso silhouette. A hunched predator's
    # head is carried low in front of the ribcage, not balanced upright like a balloon.
    if ob.name.startswith('head_'):
        ob.matrix_world = mathutils.Matrix.Translation((0, 0.34, -0.56)) @ ob.matrix_world
    elif ob.name.startswith('neck_'):
        ob.matrix_world = mathutils.Matrix.Translation((0, 0.14, -0.24)) @ ob.matrix_world
bpy.context.view_layer.update()

export(HERE)
