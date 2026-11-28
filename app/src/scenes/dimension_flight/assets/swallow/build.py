# Swallow hero asset. Run: blender -b --factory-startup --python build.py
# Blender axes: forward -Y, up +Z, wings along X (exports to three: forward +Z, up +Y).
import bpy, bmesh, math, os
from mathutils import Vector
HERE = os.path.dirname(os.path.abspath(__file__))
FPS = 60
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.fps = FPS

def mat(name, col, rough, metal=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*col, 1); b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
    return m
M_PLUME = mat('Plumage', (0.03, 0.07, 0.22), 0.32, 0.35)
M_BREAST = mat('Breast', (0.85, 0.78, 0.66), 0.7)
M_THROAT = mat('Throat', (0.55, 0.12, 0.05), 0.6)
M_BEAK = mat('Beak', (0.05, 0.04, 0.035), 0.35)
M_EYE = mat('Eye', (0.01, 0.01, 0.01), 0.08)

def mesh_obj(name, verts, faces, mats, fmat):
    me = bpy.data.meshes.new(name); me.from_pydata(verts, [], faces); me.update()
    for m in mats: me.materials.append(m)
    for i, p in enumerate(me.polygons): p.material_index = fmat(i, p); p.use_smooth = True
    o = bpy.data.objects.new(name, me); sc.collection.objects.link(o); return o

# ---- body: loft of elliptical rings along Y (tail +Y .. beak -Y)
ST = [  # y, half-width, half-height, z-centre
    (0.50, 0.010, 0.010, 0.020), (0.40, 0.045, 0.040, 0.012), (0.25, 0.085, 0.080, 0.000),
    (0.08, 0.105, 0.105, -0.005), (-0.08, 0.100, 0.100, 0.005), (-0.20, 0.080, 0.080, 0.020),
    (-0.27, 0.070, 0.072, 0.035), (-0.33, 0.072, 0.074, 0.045), (-0.40, 0.062, 0.062, 0.045),
    (-0.46, 0.038, 0.036, 0.035), (-0.50, 0.012, 0.012, 0.028)]
N = 20
verts, faces = [], []
for (y, rx, rz, zc) in ST:
    for k in range(N):
        a = 2 * math.pi * k / N
        verts.append((rx * math.cos(a), y, zc + rz * math.sin(a)))
for s in range(len(ST) - 1):
    for k in range(N):
        a, b = s * N + k, s * N + (k + 1) % N
        faces.append((a, b, b + N, a + N))
verts.append((0, 0.52, 0.02)); verts.append((0, -0.515, 0.028)); tl, hd = len(verts) - 2, len(verts) - 1
for k in range(N):
    faces.append((tl, (k + 1) % N, k)); L = (len(ST) - 1) * N; faces.append((hd, L + k, L + (k + 1) % N))
def body_mat(i, p):
    c = p.center
    if c.z < -0.02 and c.y > -0.30: return 1          # cream belly
    if c.y < -0.33 and c.z < 0.03 and c.y > -0.47: return 2  # rust throat / face
    return 0
body = mesh_obj('Body', verts, faces, [M_PLUME, M_BREAST, M_THROAT], body_mat)

# ---- wing: span grid (s 0..1 outward along +X), chord lead/trail along Y, swept-back pointed swallow wing
def wing_outline(s):
    span = 1.05
    x = 0.07 + s * span
    sweep = 0.34 * s ** 1.6                             # tip swept back (+Y)
    # broad inner wing/wrist (reads as a wing from behind and head-on), tapering to a pointed hand
    chord = 0.46 * (1 - s) ** 0.62 * (1 - 0.15 * s) + 0.03 + 0.06 * math.exp(-((s - 0.38) / 0.16) ** 2)
    lead = -0.10 + sweep - 0.05 * math.sin(math.pi * s)
    # separated primaries: 6 fingers on the outer hand only
    f = max(0.0, (s - 0.68) / 0.32)
    scallop = 0.07 * f * (1 - abs(math.sin(math.pi * f * 6))) ** 3 * (1 - f ** 4)
    return x, lead, lead + chord + scallop
SN, CN = 90, 7
wv, wf, ws = [], [], []
for i in range(SN + 1):
    s = i / SN; x, l, t = wing_outline(s)
    for j in range(CN + 1):
        c = j / CN; y = l + (t - l) * c
        z = 0.035 * math.sin(math.pi * c) * (1 - s) + 0.03 * (1 - s) ** 2  # camber + root blend
        wv.append((x, y, z)); ws.append(s)
for i in range(SN):
    for j in range(CN):
        a = i * (CN + 1) + j; wf.append((a, a + 1, a + CN + 2, a + CN + 1))
wingL = mesh_obj('Wing_L', wv, wf, [M_PLUME], lambda i, p: 0)
# ---- tail: deeply forked streamers
tv, tf = [], []
TS = 14
for i in range(TS + 1):
    s = i / TS
    for side in (-1, 1):
        pass
def tail_pts(s):  # half-tail (x>=0): inner edge, outer edge
    y = 0.36 + 0.82 * s
    outer = 0.05 + 0.22 * s ** 0.8
    inner = 0.0 if s < 0.35 else 0.16 * ((s - 0.35) / 0.65) ** 0.9 + 0.0
    width = max(0.012, 0.11 * (1 - s) ** 1.2)
    inner = max(inner, outer - width)
    return y, inner, outer
CW = 4
for i in range(TS + 1):
    s = i / TS; y, xi, xo = tail_pts(s)
    for side in (1, -1):
        for j in range(CW + 1):
            x = (xi + (xo - xi) * j / CW) * side
            tv.append((x, y, 0.015 - 0.04 * s * s))
row = 2 * (CW + 1)
for i in range(TS):
    for h in range(2):
        for j in range(CW):
            a = i * row + h * (CW + 1) + j
            q = (a, a + 1, a + 1 + row, a + row)
            tf.append(q if h == 0 else q[::-1])
tail = mesh_obj('Tail', tv, tf, [M_PLUME], lambda i, p: 0)
for o, th in ((wingL, 0.012), (tail, 0.006)):
    m = o.modifiers.new('solid', 'SOLIDIFY'); m.thickness = th; m.offset = 0
    bpy.context.view_layer.objects.active = o; bpy.ops.object.modifier_apply(modifier='solid')
# mirror the wing to the right side (separate object so each side skins to its own bones)
wingR = wingL.copy(); wingR.data = wingL.data.copy(); wingR.name = 'Wing_R'; sc.collection.objects.link(wingR)
for v in wingR.data.vertices: v.co.x = -v.co.x
wingR.data.flip_normals()
# beak + eyes
bpy.ops.mesh.primitive_cone_add(vertices=12, radius1=0.022, depth=0.075, location=(0, -0.53, 0.026), rotation=(math.pi / 2, 0, 0))
beak = bpy.context.object; beak.name = 'Beak'; beak.data.materials.append(M_BEAK)
eyes = []
for sx in (1, -1):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=8, radius=0.014, location=(0.052 * sx, -0.43, 0.06))
    e = bpy.context.object; e.data.materials.append(M_EYE); eyes.append(e)
for o in [body, beak, *eyes]:
    for p in o.data.polygons: p.use_smooth = True
sub = body.modifiers.new('sub', 'SUBSURF'); sub.levels = 1
bpy.context.view_layer.objects.active = body; bpy.ops.object.modifier_apply(modifier='sub')

# ---- armature (bones along X for wings; local X ~ -Y world for left, +Y world for right)
arm = bpy.data.armatures.new('Rig'); rig = bpy.data.objects.new('Swallow', arm); sc.collection.objects.link(rig)
bpy.context.view_layer.objects.active = rig; bpy.ops.object.mode_set(mode='EDIT')
eb = arm.edit_bones
def bone(name, h, t, parent=None):
    b = eb.new(name); b.head = h; b.tail = t; b.roll = 0
    if parent: b.parent = eb[parent]; b.use_connect = False
    return b
bone('root', (0, 0.1, 0), (0, -0.1, 0))
bone('tail', (0, 0.36, 0.015), (0, 0.6, 0.0), 'root')
WX = [0.07, 0.45, 0.78, 1.12]
for side, sx in (('L', 1), ('R', -1)):
    bone(f'arm_{side}', (WX[0] * sx, -0.05, 0.03), (WX[1] * sx, -0.02, 0.03), 'root')
    bone(f'fore_{side}', (WX[1] * sx, -0.02, 0.03), (WX[2] * sx, 0.05, 0.02), f'arm_{side}')
    bone(f'hand_{side}', (WX[2] * sx, 0.05, 0.02), (WX[3] * sx, 0.25, 0.01), f'fore_{side}')
bpy.ops.object.mode_set(mode='OBJECT')

def skin(o, fn):
    for v in o.data.vertices:
        for g, w in fn(v.co).items():
            if w <= 0: continue
            vg = o.vertex_groups.get(g) or o.vertex_groups.new(name=g); vg.add([v.index], w, 'REPLACE')
    o.parent = rig; md = o.modifiers.new('rig', 'ARMATURE'); md.object = rig
def smooth(x, a, b):
    t = min(1, max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t)
def wing_w(side):
    def f(co):
        x = abs(co.x)
        a2f = smooth(x, WX[1] - 0.12, WX[1] + 0.12); f2h = smooth(x, WX[2] - 0.12, WX[2] + 0.12)
        root = 1 - smooth(x, 0.07, 0.2)
        return {'root': root, f'arm_{side}': (1 - root) * (1 - a2f), f'fore_{side}': (1 - root) * a2f * (1 - f2h), f'hand_{side}': (1 - root) * a2f * f2h}
    return f
skin(wingL, wing_w('L')); skin(wingR, wing_w('R'))
skin(tail, lambda co: {'root': 1 - smooth(co.y, 0.36, 0.5), 'tail': smooth(co.y, 0.36, 0.5)})
for o in [body, beak, *eyes]: skin(o, lambda co: {'root': 1})
for o in [body, wingL, wingR, tail, beak, *eyes]: o['fx_part'] = o.name.lower()

# ---- actions (keys at 60 fps). Flap: 0.5 s loop; Glide: 2 s loop; Tuck: 1 s hold pose for dives.
def key_action(name, length, fn, step=3):
    rig.animation_data_create(); act = bpy.data.actions.new(name); rig.animation_data.action = act
    bpy.context.view_layer.objects.active = rig; bpy.ops.object.mode_set(mode='POSE')
    for pb in rig.pose.bones: pb.rotation_mode = 'XYZ'
    for fr in range(0, length + 1, step):
        ph = fr / length
        for pb in rig.pose.bones:
            pb.rotation_euler = fn(pb.name, ph); pb.keyframe_insert('rotation_euler', frame=fr)
    bpy.ops.object.mode_set(mode='OBJECT')
    act.use_fake_user = True
    return act
TAU = 2 * math.pi
def side_sign(n): return -1 if n.endswith('_R') else 1
def flap(n, ph):
    zs = side_sign(n); s = math.sin(TAU * ph)
    if n.startswith('arm'): return (0.85 * s + 0.12, 0, zs * 0.12 * math.cos(TAU * ph))
    if n.startswith('fore'): return (0.35 * math.sin(TAU * ph - 0.6), 0, zs * 0.08 * (1 - s))
    if n.startswith('hand'): return (0.45 * math.sin(TAU * ph - 1.1), 0, zs * 0.10 * (1 - s))
    if n == 'tail': return (0.06 * math.sin(TAU * ph - 0.4), 0, 0)
    return (0, 0, 0)
def glide(n, ph):
    zs = side_sign(n); w = math.sin(TAU * ph)
    if n.startswith('arm'): return (0.14 + 0.04 * w, 0, zs * 0.05)
    if n.startswith('fore'): return (-0.05 + 0.02 * w, 0, zs * 0.04)
    if n.startswith('hand'): return (-0.12 + 0.03 * math.sin(TAU * ph + 1), 0, zs * 0.10)
    if n == 'tail': return (0.03 * w, 0, 0)
    return (0, 0, 0)
def tuck(n, ph):
    zs = side_sign(n)
    if n.startswith('arm'): return (0.25, 0, zs * 1.05)
    if n.startswith('fore'): return (-0.10, 0, zs * 0.75)
    if n.startswith('hand'): return (-0.05, 0, zs * 0.35)
    return (0, 0, 0)
acts = {'Flap': key_action('Flap', 30, flap, 2), 'Glide': key_action('Glide', 120, glide, 6), 'Tuck': key_action('Tuck', 60, tuck, 30)}

def tips():
    dg = bpy.context.evaluated_depsgraph_get(); out = []
    for o in (wingL, wingR):
        ev = o.evaluated_get(dg); mw = ev.matrix_world
        vs = [mw @ v.co for v in ev.to_mesh().vertices]; ev.to_mesh_clear()
        out.append(max(vs, key=lambda p: abs(p.x)))
    return out
for name, fr in (('Flap', 0), ('Flap', 8), ('Flap', 23), ('Glide', 0), ('Tuck', 0)):
    rig.animation_data.action = acts[name]; sc.frame_set(fr)
    l, r = tips(); print(f'[check] {name}@{fr}: L=({l.x:.2f},{l.y:.2f},{l.z:.2f}) R=({r.x:.2f},{r.y:.2f},{r.z:.2f})')
rig.animation_data.action = None; sc.frame_set(0)
bpy.ops.export_scene.gltf(filepath=os.path.join(HERE, 'model.glb'), export_format='GLB', export_extras=True,
    export_yup=True, export_animation_mode='ACTIONS', export_apply=False, export_skins=True, export_morph=False)
print('[export] ok')
