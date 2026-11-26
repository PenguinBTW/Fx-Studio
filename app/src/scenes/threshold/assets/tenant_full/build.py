# THRESHOLD Tenant full creature. Silhouette-first fused quadruped predator.
import bpy, os, sys, math, random
import mathutils
sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
from _bl import *

reset()
R = random.Random(91731)

# Source-true but dust-muted materials. The continuous body carries the silhouette;
# ball-pit plastic, glazed pool tile, paper, felt, chrome and glass are surface evidence.
BODY = mat('TenantFusedBody', (0.032, 0.012, 0.009), 0.9, metal=0.01)
BODY_ALT = mat('TenantFusedBodyWarm', (0.074, 0.025, 0.015), 0.88, metal=0.01)
TILE = mat('TenantPoolTile', (0.045, 0.14, 0.14), 0.42, metal=0.02)
GROUT = mat('TenantTileGrout', (0.018, 0.028, 0.028), 0.82)
PAPER = mat('TenantPaper', (0.34, 0.255, 0.13), 0.88)
PAPER_DARK = mat('TenantPaperEdge', (0.055, 0.028, 0.012), 0.96)
FELT = mat('TenantFelt', (0.035, 0.004, 0.003), 0.99)
CHROME = mat('TenantChrome', (0.34, 0.39, 0.43), 0.2, metal=0.88)
DARK_METAL = mat('TenantVendingMetal', (0.018, 0.028, 0.034), 0.42, metal=0.72)
GLASS = mat('TenantRibcageGlass', (0.025, 0.085, 0.105), 0.14, metal=0.08)
try:
    GLASS.diffuse_color = (0.025, 0.085, 0.105, 0.46)
    GLASS.node_tree.nodes['Principled BSDF'].inputs['Alpha'].default_value = 0.46
    GLASS.surface_render_method = 'DITHERED'
except Exception:
    pass
BLACK = mat('TenantFaceSlot', (0.0015, 0.002, 0.002), 0.94)
RUBBER = mat('TenantDarkRubber', (0.012, 0.009, 0.008), 0.86)
BALLS = [
    mat('TenantBallRed', (0.095, 0.008, 0.006), 0.74),
    mat('TenantBallBlue', (0.006, 0.022, 0.048), 0.72),
    mat('TenantBallYellow', (0.105, 0.055, 0.006), 0.78),
    mat('TenantBallGreen', (0.008, 0.048, 0.025), 0.78),
    mat('TenantBallDark', (0.045, 0.025, 0.022), 0.62),
]

seen_parts = set()
root = empty('tenant_full_root')
root['fx_part'] = 'root'
upper = empty('upper_body')
upper['fx_part'] = 'upper_body'
parent(upper, root)
lower = empty('lower_body')
lower['fx_part'] = 'lower_body'
parent(lower, root)

def mark(ob, part):
    if part and part not in seen_parts:
        ob['fx_part'] = part
        seen_parts.add(part)
    return ob

def group(name, par, part=None, loc=(0, 0, 0)):
    ob = empty(name, loc)
    parent(ob, par)
    if part:
        mark(ob, part)
    return ob

def add(ob, par, part=None):
    parent(ob, par)
    if part:
        mark(ob, part)
    return ob

def catmull(points, radii, per_seg=9):
    pts = [mathutils.Vector(p) for p in points]
    if len(pts) == 2:
        pts = [pts[0], pts[0], pts[1], pts[1]]
        radii = [radii[0], radii[0], radii[-1], radii[-1]]
    else:
        pts = [pts[0]] + pts + [pts[-1]]
        radii = [radii[0]] + list(radii) + [radii[-1]]
    out = []
    # pts/radii now have two padding entries; interpolate each original segment.
    for seg in range(1, len(pts) - 2):
        p0, p1, p2, p3 = pts[seg - 1], pts[seg], pts[seg + 1], pts[seg + 2]
        r0, r1, r2, r3 = radii[seg - 1], radii[seg], radii[seg + 1], radii[seg + 2]
        for j in range(per_seg):
            u = j / per_seg
            u2, u3 = u * u, u * u * u
            p = 0.5 * ((2 * p1) + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u2 + (-p0 + 3 * p1 - 3 * p2 + p3) * u3)
            r = 0.5 * ((2 * r1) + (-r0 + r2) * u + (2 * r0 - 5 * r1 + 4 * r2 - r3) * u2 + (-r0 + 3 * r1 - 3 * r2 + r3) * u3)
            out.append((p, r))
    out.append((mathutils.Vector(points[-1]), radii[-1 if len(radii) == len(points) else -2]))
    return out

def tapered_tube(name, points, radii, material, sides=20, per_seg=9, patch_material=None):
    samples = catmull(points, list(radii), per_seg)
    verts = []
    faces = []
    rings = []
    for i, (p, radius) in enumerate(samples):
        if i == 0:
            tangent = (samples[1][0] - p).normalized()
        elif i == len(samples) - 1:
            tangent = (p - samples[i - 1][0]).normalized()
        else:
            tangent = (samples[i + 1][0] - samples[i - 1][0]).normalized()
        ref = mathutils.Vector((0, 1, 0)) if abs(tangent.dot(mathutils.Vector((0, 1, 0)))) < 0.86 else mathutils.Vector((1, 0, 0))
        side = tangent.cross(ref).normalized()
        normal = side.cross(tangent).normalized()
        ring = []
        for k in range(sides):
            a = math.tau * k / sides
            # Fused matter is not an inflated tube: low-frequency asymmetrical lumps
            # break the silhouette while the underlying volume remains continuous.
            lump = 1.0 + 0.125 * math.sin(i * 0.83 + k * 1.91) + 0.065 * math.sin(i * 0.31 - k * 3.07)
            rr = radius * lump * (1.0 + 0.035 * math.sin(i * 0.47))
            v = p + (side * math.cos(a) + normal * math.sin(a)) * rr
            ring.append(len(verts))
            verts.append(tuple(v))
        rings.append(ring)
    for i in range(len(rings) - 1):
        for k in range(sides):
            faces.append((rings[i][k], rings[i][(k + 1) % sides], rings[i + 1][(k + 1) % sides], rings[i + 1][k]))
    faces.append(tuple(reversed(rings[0])))
    faces.append(tuple(rings[-1]))
    mesh = bpy.data.meshes.new(name + '_mesh')
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    ob = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(ob)
    assign(ob, material)
    if patch_material is not None:
        ob.data.materials.append(patch_material)
        # Deterministic patchwork within the same continuous mesh: irregular bands of
        # warmer fused plastic interrupt the base material without splitting the volume.
        for pi, poly in enumerate(mesh.polygons[:-2]):
            ring_i = pi // sides
            k = pi % sides
            patch_wave = math.sin(ring_i * 0.71 + k * 1.19) + 0.55 * math.sin(ring_i * 0.29 - k * 2.13)
            if patch_wave > 0.42:
                poly.material_index = 1
    for poly in mesh.polygons:
        poly.use_smooth = True
    return ob

def path_point(points, u):
    pts = [mathutils.Vector(p) for p in points]
    lengths = [0.0]
    for a, b in zip(pts, pts[1:]):
        lengths.append(lengths[-1] + (b - a).length)
    target = lengths[-1] * u
    for i in range(len(pts) - 1):
        if lengths[i + 1] >= target:
            q = 0 if lengths[i + 1] == lengths[i] else (target - lengths[i]) / (lengths[i + 1] - lengths[i])
            return pts[i].lerp(pts[i + 1], q)
    return pts[-1]

def path_radius(radii, u):
    if len(radii) == 1:
        return radii[0]
    q = max(0.0, min(0.999999, u)) * (len(radii) - 1)
    i = int(q)
    f = q - i
    return radii[i] * (1 - f) + radii[min(i + 1, len(radii) - 1)] * f

def surface_frame(path, u):
    eps = 0.012
    c = path_point(path, u)
    a = path_point(path, max(0.0, u - eps))
    b = path_point(path, min(1.0, u + eps))
    tangent = (b - a).normalized()
    ref = mathutils.Vector((0, 1, 0)) if abs(tangent.dot(mathutils.Vector((0, 1, 0)))) < 0.86 else mathutils.Vector((1, 0, 0))
    side = tangent.cross(ref).normalized()
    normal = side.cross(tangent).normalized()
    return c, side, normal, tangent

def surface_seam(name, path, radii, u0, u1, wraps, phase, material, bevel=0.007, samples=54):
    pts = []
    for j in range(samples):
        q = j / (samples - 1)
        u = u0 + (u1 - u0) * q
        c, side, normal, tangent = surface_frame(path, u)
        r = path_radius(radii, u) * 1.035
        a = math.tau * (wraps * u + phase)
        pts.append(c + (side * math.cos(a) + normal * math.sin(a)) * r)
    return curve(name, pts, bevel, material)

def roughen_blob(ob, amount=0.06, seed=0.0):
    # Deterministic fused-mass deformation: enough to remove balloon/primitive outlines,
    # small enough that the large silhouette remains a single continuous volume.
    for v in ob.data.vertices:
        co = v.co
        wave = (math.sin(co.x * 11.7 + seed) + math.sin(co.y * 9.3 - seed * 1.7) + math.sin((co.x + co.z) * 7.1 + seed * 0.31)) / 3.0
        scale = 1.0 + amount * wave
        v.co = co * scale
    ob.data.update()
    return ob

# Control hierarchy keeps the established scene animation API.
head_g = group('head_control', upper, 'head', (0, 1.10, 2.62))
neck_g = group('neck_control', upper, 'neck', (0, 0.78, 2.78))
rib_g = group('ribcage_control', upper, 'ribcage', (0, 0.1, 2.55))
spine_g = group('spine_control', upper, 'spine', (0, -0.18, 2.55))
pelvis_g = group('pelvis_control', lower, 'pelvis', (0, -0.12, 1.95))
arm_l_g = group('arm_l_control', upper, 'arm_l', (-0.43, 0.2, 3.02))
arm_r_g = group('arm_r_control', upper, 'arm_r', (0.43, 0.16, 3.02))
arm_l_upper_g = group('arm_l_upper_control', arm_l_g, 'arm_l_upper', (-0.43, 0.2, 3.02))
arm_l_lower_g = group('arm_l_lower_control', arm_l_g, 'arm_l_lower', (-0.75, 0.72, 2.0))
arm_r_upper_g = group('arm_r_upper_control', arm_r_g, 'arm_r_upper', (0.43, 0.16, 3.02))
arm_r_lower_g = group('arm_r_lower_control', arm_r_g, 'arm_r_lower', (0.78, 0.38, 2.08))
hand_l_g = group('hand_l_control', arm_l_lower_g, 'hand_l', (-0.46, 1.45, 0.24))
hand_r_g = group('hand_r_control', arm_r_lower_g, 'hand_r', (0.55, 1.17, 0.32))
leg_l_g = group('leg_l_control', lower, 'leg_l', (-0.27, -0.18, 2.0))
leg_r_g = group('leg_r_control', lower, 'leg_r', (0.27, -0.18, 2.0))
leg_l_upper_g = group('leg_l_upper_control', leg_l_g, 'leg_l_upper', (-0.27, -0.18, 2.0))
leg_l_lower_g = group('leg_l_lower_control', leg_l_g, 'leg_l_lower', (-0.56, -0.28, 1.05))
leg_r_upper_g = group('leg_r_upper_control', leg_r_g, 'leg_r_upper', (0.27, -0.18, 2.0))
leg_r_lower_g = group('leg_r_lower_control', leg_r_g, 'leg_r_lower', (0.44, -0.02, 1.05))

# Hunched torso: one continuous sloping mass. Chest high, pelvis back, neck/head forward.
torso_path = [(0, -0.22, 1.92), (0.02, 0.02, 2.35), (-0.02, 0.35, 2.78), (0, 0.67, 3.08)]
add(tapered_tube('torso_continuous_hunched_mass', torso_path, [0.43, 0.5, 0.54, 0.34], BODY, sides=24, per_seg=10, patch_material=BODY_ALT), rib_g)
pelvis_mass = sphere('pelvis_fused_mass', 0.42, (0, -0.2, 1.96), BODY_ALT, scale=(1.28, 0.9, 0.66), segments=36, rings=18)
roughen_blob(pelvis_mass, 0.075, 1.3)
add(pelvis_mass, pelvis_g)
chest_mass = sphere('chest_fused_mass', 0.5, (0, 0.3, 2.68), BODY, scale=(1.34, 0.86, 0.86), segments=40, rings=20)
roughen_blob(chest_mass, 0.085, 4.1)
add(chest_mass, rib_g)
for side in (-1, 1):
    shoulder = sphere(f'shoulder_hump_{side}', 0.27, (side * 0.38, 0.18, 2.95), BODY_ALT, scale=(1.08, 0.82, 0.78), segments=28, rings=14)
    roughen_blob(shoulder, 0.08, 7.0 + side)
    add(shoulder, upper, 'shoulder_mass')

# Ribcage remains a broken vending-machine front, now embedded in the front of the torso mass.
add(box('ribcage_inner_occluding_darkness', (0.55, 0.035, 0.76), (0, 0.58, 2.68), BLACK, bev=0.012, rot=(math.radians(-18), 0, 0)), rib_g, 'inner_darkness')
for i, (z, w, h) in enumerate(((2.43, 0.47, 0.28), (2.7, 0.53, 0.3), (2.98, 0.48, 0.27))):
    add(box(f'ribcage_glass_front{"_mid" if i == 1 else "_lower" if i == 2 else ""}', (w, 0.025, h), (0, 0.69 + i * 0.035, z), GLASS,
            bev=0.012, rot=(math.radians(-18 + i * 5), math.radians((i - 1) * 3), math.radians((i - 1) * 3))), rib_g, 'glass_front')
for x in (-0.31, 0.31):
    add(box(f'ribcage_side_frame_{x}', (0.045, 0.06, 0.82), (x, 0.62, 2.7), CHROME, bev=0.009, rot=(math.radians(-16), 0, math.radians(3 if x < 0 else -3))), rib_g, 'door_frame')
for shelf in range(4):
    z = 2.46 + shelf * 0.18
    add(box(f'ribcage_shelf_{shelf}', (0.48, 0.12, 0.02), (0, 0.61, z), CHROME, bev=0.004, rot=(math.radians(-15), 0, 0)), rib_g, 'shelves')
for col, x in enumerate((-0.15, 0.0, 0.15)):
    pts = []
    for j in range(70):
        u = j / 69
        pts.append((x + math.sin(u * math.tau * 5.5) * 0.026, 0.65 + math.cos(u * math.tau * 5.5) * 0.026, 2.42 + u * 0.62))
    add(curve(f'ribcage_spiral_coil_{col}', pts, 0.0075, CHROME), rib_g, 'spiral_coils')
for i in range(12):
    add(cyl(f'coin_rattle_{i}', 0.016, 0.0035, (R.uniform(-0.2, 0.2), R.uniform(0.5, 0.62), R.uniform(2.36, 2.55)), CHROME,
            rot=(R.random() * math.pi, R.random() * math.pi, R.random() * math.pi), verts=16), rib_g, 'coins')

# Exposed vending-coil spine along the back.
for seg in range(7):
    z0 = 2.08 + seg * 0.15
    pts = []
    for j in range(32):
        u = j / 31
        pts.append((math.sin(u * math.tau * 2.0) * 0.038, -0.35 + math.cos(u * math.tau * 2.0) * 0.025, z0 + u * 0.16))
    add(curve(f'spine_{seg+1}', pts, 0.01, CHROME), spine_g, 'spine_coils')

# Small forward head, clearly below the shoulder line. The neck reaches horizontally
# out of the chest, so the head reads as a predator skull rather than a top knob.
add(tapered_tube('neck_forward_fused_mass', [(0, 0.56, 2.92), (0, 0.82, 2.79), (0, 1.12, 2.60)], [0.17, 0.145, 0.112], FELT, sides=18, per_seg=8), neck_g, 'neck_segments')
for i in range(3):
    u = i / 2
    add(sphere(f'neck_{i+1}', 0.105 - i * 0.012, (0, 0.62 + u * 0.32, 2.87 - u * 0.19), FELT,
               scale=(1.05, 0.72, 0.8), segments=24, rings=12), neck_g, 'neck_segments')
head_mass = sphere('head_tile_ovoid', 0.142, (0, 1.31, 2.48), TILE, scale=(0.78, 0.68, 1.05), segments=40, rings=20)
roughen_blob(head_mass, 0.025, 9.2)
add(head_mass, head_g)
# A separate compressed chin/forehead mass keeps the skull from reading as one smooth egg.
add(sphere('head_tile_chin_mass', 0.088, (0, 1.37, 2.405), TILE, scale=(0.82, 0.62, 0.68), segments=28, rings=14), head_g, 'head_damage')
add(box('head_black_face_slot', (0.045, 0.012, 0.115), (0, 1.398, 2.485), BLACK, bev=0.002, rot=(math.radians(5), 0, 0)), head_g, 'face_slot')
for i, z in enumerate((2.40, 2.46, 2.53)):
    pts = []
    for j in range(22):
        a = j / 21 * math.tau
        pts.append((math.cos(a) * 0.099, 1.31 + math.sin(a) * 0.086, z))
    add(curve(f'head_grout_ring_{i}', pts, 0.006, GROUT, cyclic=True), head_g, 'head_grout')
for i, (loc, sc) in enumerate((((-0.045, 1.35, 2.51), (0.045, 0.012, 0.06)), ((0.052, 1.34, 2.43), (0.055, 0.014, 0.045)), ((0.0, 1.37, 2.55), (0.07, 0.012, 0.032)))):
    add(box(f'head_broken_tile_chip_{i}', sc, loc, GROUT if i == 1 else TILE, bev=0.003,
            rot=(R.uniform(-0.18, 0.18), R.uniform(-0.18, 0.18), R.uniform(-0.4, 0.4))), head_g, 'head_damage')

# Arms: continuous tapered bent tubes, 30-45 cm diameter before surface compression.
def build_arm(side):
    sx = -1 if side == 'l' else 1
    if side == 'l':
        # Planted long forelimb: reaches forward and down like a running quadruped.
        path = [(sx * 0.42, 0.22, 3.03), (sx * 0.74, 0.58, 2.48), (sx * 0.82, 0.92, 1.86), (sx * 0.58, 1.34, 0.9), (sx * 0.39, 1.58, 0.25)]
        radii = [0.175, 0.17, 0.15, 0.12, 0.082]
    else:
        # Opposite forelimb is lifted and folded back mid-stride, breaking symmetry.
        path = [(sx * 0.42, 0.18, 3.03), (sx * 0.78, 0.16, 2.55), (sx * 0.96, 0.22, 1.98), (sx * 0.88, 0.48, 1.25), (sx * 0.68, 0.76, 0.72)]
        radii = [0.175, 0.168, 0.148, 0.118, 0.082]
    parent_control = arm_l_g if side == 'l' else arm_r_g
    add(tapered_tube(f'arm_{side}_continuous_fused_limb', path, radii, BODY_ALT if side == 'l' else BODY, sides=22, per_seg=8, patch_material=BODY if side == 'l' else BODY_ALT), parent_control, 'fused_limb_volume')
    elbow = path[2]
    elbow_mass = sphere(f'arm_{side}_elbow_fused_joint', 0.16, elbow, BODY_ALT, scale=(1.05, 0.9, 1.1), segments=28, rings=14)
    roughen_blob(elbow_mass, 0.07, 11.0 if side == 'l' else 13.0)
    add(elbow_mass, parent_control, 'joints')
    for mass_i, u in enumerate((0.27, 0.58)):
        c = path_point(path, u)
        bulk = sphere(f'arm_{side}_fused_bulk_{mass_i}', 0.13 if mass_i == 0 else 0.105, c, BODY_ALT if mass_i == 0 else BODY,
                      scale=(1.25, 0.78, 1.05), segments=24, rings=12)
        roughen_blob(bulk, 0.085, 15.0 + mass_i * 2 + (0 if side == 'l' else 5))
        add(bulk, parent_control, 'fused_limb_volume')
    # Compressed ball-pit plastic is embedded in the continuous skin. Dense overlapping
    # flattened balls create a crust; the thick tube underneath still owns the silhouette.
    # Ugly joint lines are geometry, not shader noise: cracked grout and melted
    # plastic seams wrap the continuous limb and remain legible at delivery scale.
    seam_specs = ((0.05, 0.93, 1.55, 0.05, GROUT, 0.0065), (0.12, 0.82, -1.15, 0.48, PAPER_DARK, 0.008), (0.22, 0.68, 0.0, 0.2, RUBBER, 0.009))
    for seam_i, (u0, u1, wraps, phase, smat, bw) in enumerate(seam_specs):
        add(surface_seam(f'arm_{side}_ugly_joint_seam_{seam_i}', path, radii, u0, u1, wraps, phase, smat, bw), parent_control, 'melted_seams')
    for i in range(64):
        # Deterministic but deliberately nonuniform: clustered/gapped compressed crust,
        # never a single-file bead chain.
        u = 0.04 + 0.88 * R.random()
        c = path_point(path, u)
        angle = R.random() * math.tau
        radial = 0.062 + 0.038 * R.random()
        offset = mathutils.Vector((math.cos(angle) * radial, math.sin(angle) * radial * 0.9, (R.random() - 0.5) * 0.035))
        radius = (0.052 + 0.04 * (1 - u)) * R.uniform(0.68, 1.28)
        ball_mat = BALLS[4] if i % 5 in (0, 3) else BALLS[int(R.random() * 4)]
        ob = sphere(f'arm_{side}_embedded_ball_{i}', radius, c + offset, ball_mat,
                    scale=(1.36, 0.38 + 0.1 * (i % 3), 0.86), segments=20, rings=10)
        add(ob, parent_control, 'ball_pit_shell')
        if i % 6 == 2:
            add(torus(f'arm_{side}_melted_seam_{i}', radius * 0.86, 0.004, c + offset * 0.65, RUBBER,
                      rot=(math.radians(90), 0, 0), major_segments=18, minor_segments=5), parent_control, 'melted_seams')
    # Torn paper and cracked tile plates sit partly inside the limb skin. Their irregular
    # exposed edges break the otherwise clay-smooth albedo without becoming separate armor.
    plate_mats = (PAPER_DARK, TILE, FELT, PAPER)
    for i in range(22):
        u = 0.07 + 0.82 * ((i * 0.381 + (0.11 if side == 'r' else 0.0)) % 1.0)
        c, sidev, normalv, tangentv = surface_frame(path, u)
        angle = (i * 2.399 + (0.7 if side == 'r' else 0.0)) % math.tau
        loc = c + (sidev * math.cos(angle) + normalv * math.sin(angle)) * (path_radius(radii, u) * 0.9)
        add(box(f'arm_{side}_embedded_source_plate_{i}', (0.045 + 0.012 * (i % 3), 0.012, 0.065 + 0.014 * ((i + 1) % 3)),
                loc, plate_mats[i % len(plate_mats)], bev=0.004,
                rot=(R.uniform(-0.45, 0.45), R.uniform(-0.45, 0.45), R.uniform(-0.9, 0.9))), parent_control, 'patchwork')
    return path

arm_l_path = build_arm('l')
arm_r_path = build_arm('r')

# Left hand is a chrome vending spiral splitting into hooked fingers; right hand is torn paper strips.
wrist_l = arm_l_path[-1]
add(sphere('hand_l_palm_cuff', 0.11, wrist_l, CHROME, scale=(1.1, 0.78, 0.9), segments=28, rings=14), hand_l_g, 'palm')
for finger in range(5):
    spread = (finger - 2) / 2
    pts = []
    for j in range(42):
        u = j / 41
        pts.append((wrist_l[0] + spread * 0.1 * u + math.sin(u * math.tau * 4.8) * 0.015,
                    wrist_l[1] + 0.14 * u + math.cos(u * math.tau * 4.8) * 0.015,
                    wrist_l[2] - (0.42 - abs(spread) * 0.04) * u))
    add(curve(f'hand_l_coil_finger_{finger}', pts, 0.009, CHROME), hand_l_g, 'coil_fingers')
wrist_r = arm_r_path[-1]
add(box('hand_r_paper_palm', (0.17, 0.1, 0.13), wrist_r, PAPER, bev=0.012, rot=(0.12, 0.05, -0.08)), hand_r_g, 'paper_palm')
for finger in range(5):
    spread = (finger - 2) / 2
    for seg in range(3):
        add(box(f'hand_r_paper_finger_{finger}_{seg}', (0.025, 0.035, 0.13),
                (wrist_r[0] + spread * (0.04 + seg * 0.02), wrist_r[1] + 0.08 + seg * 0.04, wrist_r[2] - 0.08 * (seg + 0.5)),
                PAPER if seg < 2 else PAPER_DARK, bev=0.002, rot=(0.16 * seg, 0.04 * spread, -0.1 * spread)), hand_r_g, 'paper_fingers')

# Legs: shorter than arms, but still continuous tapered bent limb volumes.
def build_leg(side):
    sx = -1 if side == 'l' else 1
    if side == 'l':
        path = [(sx * 0.27, -0.16, 1.98), (sx * 0.52, -0.28, 1.45), (sx * 0.58, -0.32, 1.02), (sx * 0.34, -0.05, 0.48), (sx * 0.28, 0.04, 0.16)]
    else:
        path = [(sx * 0.27, -0.16, 1.98), (sx * 0.43, -0.05, 1.48), (sx * 0.46, 0.0, 1.04), (sx * 0.52, 0.16, 0.5), (sx * 0.43, 0.28, 0.16)]
    radii = [0.155, 0.148, 0.13, 0.105, 0.078]
    parent_control = leg_l_g if side == 'l' else leg_r_g
    add(tapered_tube(f'leg_{side}_continuous_fused_limb', path, radii, BODY, sides=20, per_seg=8, patch_material=BODY_ALT), parent_control, 'fused_limb_volume')
    add(surface_seam(f'leg_{side}_cracked_grout_seam', path, radii, 0.08, 0.9, 1.25 if side == 'l' else -1.05, 0.18, GROUT, 0.006), parent_control, 'melted_seams')
    knee = path[2]
    ankle = path[-1]
    add(sphere(f'leg_{side}_knee_joint', 0.17, knee, RUBBER, scale=(1.12, 0.84, 0.95), segments=24, rings=12), parent_control, 'joints')
    add(sphere(f'leg_{side}_ankle_joint', 0.12, ankle, RUBBER, scale=(1.15, 0.72, 0.75), segments=20, rings=10), parent_control, 'joints')
    # Pool-tile/card evidence is strapped into the fused skin as broken surface plating.
    for i in range(16):
        u = 0.06 + 0.86 * (i % 8) / 7
        c = path_point(path, u)
        mat_choice = TILE if i % 3 else PAPER
        jitter = mathutils.Vector((sx * (0.038 + 0.018 * math.sin(i * 1.9)), 0.022 * math.cos(i * 2.3), 0.015 * math.sin(i * 1.3)))
        ob = box(f'leg_{side}_surface_tile_{i}', (0.12 + 0.018 * (i % 3), 0.016, 0.075 + 0.018 * ((i + 1) % 2)),
                 c + jitter, mat_choice, bev=0.007,
                 rot=(R.uniform(-0.45, 0.45), math.radians(sx * (18 + R.uniform(-18, 18))), math.radians(sx * (8 + R.uniform(-24, 24)))))
        add(ob, parent_control, 'overlapping_tiles')
    foot_pos = (ankle[0] + sx * 0.02, ankle[1] + 0.15, 0.08)
    foot = box(f'foot_{side}', (0.22, 0.36, 0.09), foot_pos, RUBBER, bev=0.022,
               rot=(math.radians(4), math.radians(sx * 8), math.radians(sx * 5)))
    add(foot, parent_control, f'foot_{side}')
    # Card/tile evidence is broken plating over a dark fused foot, not a clean beige block.
    for toe in range(3):
        add(box(f'foot_{side}_toe_plate_{toe}', (0.045, 0.105, 0.018),
                (foot_pos[0] + sx * (toe - 1) * 0.045, foot_pos[1] + 0.17, foot_pos[2] + 0.045),
                TILE if toe == 1 else PAPER_DARK, bev=0.005,
                rot=(math.radians(8), math.radians(sx * (5 + toe * 3)), math.radians(sx * (toe - 1) * 7))), parent_control, 'foot_plating')
    add(box(f'foot_{side}_instep_card', (0.12, 0.15, 0.014),
            (foot_pos[0], foot_pos[1] - 0.03, foot_pos[2] + 0.052), PAPER, bev=0.005,
            rot=(math.radians(5), math.radians(sx * 11), math.radians(sx * 5))), parent_control, 'foot_plating')
    return path

build_leg('l')
build_leg('r')

# Pelvis folded-card seams and broad patchwork embedded into the body mass.
for i in range(8):
    add(box(f'pelvis_torn_seam_{i}', (0.022, 0.012, R.uniform(0.1, 0.22)),
            (R.uniform(-0.24, 0.24), 0.15, R.uniform(1.86, 2.1)), PAPER_DARK,
            rot=(R.uniform(-0.3, 0.3), R.uniform(-0.3, 0.3), R.uniform(-0.8, 0.8))), pelvis_g, 'torn_seams')
patch_mats = [TILE, PAPER, FELT, CHROME]
for i in range(34):
    zone = R.choice(['shoulder_l', 'shoulder_r', 'rib', 'hip'])
    if zone == 'shoulder_l':
        loc = (-0.34 + R.uniform(-0.08, 0.08), R.uniform(0.18, 0.42), 3.0 + R.uniform(-0.12, 0.1))
        par = upper
    elif zone == 'shoulder_r':
        loc = (0.34 + R.uniform(-0.08, 0.08), R.uniform(0.14, 0.4), 3.0 + R.uniform(-0.12, 0.1))
        par = upper
    elif zone == 'rib':
        loc = (R.uniform(-0.28, 0.28), R.uniform(0.43, 0.65), R.uniform(2.3, 3.0))
        par = rib_g
    else:
        loc = (R.uniform(-0.25, 0.25), R.uniform(-0.05, 0.12), R.uniform(1.85, 2.1))
        par = pelvis_g
    if i % 7 == 0:
        ob = sphere(f'patch_ball_{i}', R.uniform(0.025, 0.045), loc, BALLS[i % len(BALLS)], scale=(1, 0.65, 1), segments=16, rings=8)
    else:
        ob = box(f'patch_plate_{i}', (R.uniform(0.055, 0.11), R.uniform(0.01, 0.022), R.uniform(0.06, 0.14)), loc,
                 patch_mats[i % len(patch_mats)], bev=0.002, rot=(R.uniform(-0.4, 0.4), R.uniform(-0.4, 0.4), R.uniform(-0.8, 0.8)))
    add(ob, par, 'patchwork')

bpy.context.view_layer.update()
export(HERE)
