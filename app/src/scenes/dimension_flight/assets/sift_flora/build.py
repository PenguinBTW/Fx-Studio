# Sift flora: tall flame-silhouette sculk coral clump + pale drooping giant tree. Run: blender -b --python build.py
import bpy, math, random, os
from mathutils import Vector
HERE = os.path.dirname(os.path.abspath(__file__))
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
random.seed(11)

def mat(name, col, rough, emit=None, es=0.0, two=False):
    m = bpy.data.materials.new(name); m.use_nodes = True; b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*col, 1); b.inputs['Roughness'].default_value = rough
    if emit: b.inputs['Emission Color'].default_value = (*emit, 1); b.inputs['Emission Strength'].default_value = es
    m.use_backface_culling = not two
    return m

def tube(V, F, spine, radii, ring=6, flat=1.0):
    base, n = len(V), len(spine)
    for i, p in enumerate(spine):
        t = (spine[min(i + 1, n - 1)] - spine[max(i - 1, 0)]).normalized()
        up = Vector((0, 0, 1)) if abs(t.z) < 0.9 else Vector((1, 0, 0))
        a = t.cross(up).normalized(); b = t.cross(a).normalized()
        for k in range(ring):
            th = 2 * math.pi * k / ring
            V.append(tuple(p + a * (math.cos(th) * radii[i] * flat) + b * (math.sin(th) * radii[i])))
    for i in range(n - 1):
        for k in range(ring):
            a0 = base + i * ring + k; a1 = base + i * ring + (k + 1) % ring
            F.append((a0, a1, a1 + ring, a0 + ring))
    V.append(tuple(spine[-1])); tip = len(V) - 1; L = base + (n - 1) * ring
    for k in range(ring): F.append((L + k, L + (k + 1) % ring, tip))

def obj(name, parts):
    V, F, M = [], [], []
    mats = []
    for (pv, pf, m) in parts:
        if m not in mats: mats.append(m)
        off = len(V); V += pv; F += [tuple(i + off for i in f) for f in pf]; M += [mats.index(m)] * len(pf)
    me = bpy.data.meshes.new(name); me.from_pydata(V, [], F); me.update()
    for m in mats: me.materials.append(m)
    for i, p in enumerate(me.polygons): p.use_smooth = True; p.material_index = M[i]
    o = bpy.data.objects.new(name, me); sc.collection.objects.link(o); o['fx_part'] = name.lower(); return o

CORAL = mat('SiftCoral', (0.95, 0.42, 0.38), 0.55, (1.0, 0.32, 0.3), 0.25)
BARK = mat('PaleBark', (0.86, 0.83, 0.78), 0.8)
LEAF = mat('PaleLeaf', (0.82, 0.95, 0.9), 0.6, (0.45, 0.85, 0.78), 0.15, two=True)
VEIL = mat('Veil', (0.7, 0.95, 0.88), 0.5, (0.4, 0.95, 0.85), 0.6)

# ---- coral: 9 curling flattened blades, most fork once (flame silhouette), height ~1
cv, cf = [], []
for bl in range(9):
    ang = bl / 9 * 2 * math.pi + random.random() * 0.5
    lean, h, ph = 0.12 + random.random() * 0.4, 0.55 + random.random() * 0.45, random.random() * 6
    out = Vector((math.cos(ang), math.sin(ang), 0))
    base = out * 0.05
    sp, rr = [], []
    S = 10
    for i in range(S + 1):
        u = i / S
        p = base + out * (lean * h * u ** 1.3) + Vector((0, 0, h * u)) + out.cross(Vector((0, 0, 1))) * 0.06 * math.sin(u * 4.5 + ph) * u
        sp.append(p); rr.append(0.05 * (1 - u) ** 0.75 + 0.004)
    tube(cv, cf, sp, rr, ring=6, flat=0.45)
    if random.random() < 0.75:
        j = 5; d = (sp[j] - sp[j - 1]).normalized()
        side = out.cross(Vector((0, 0, 1))) * (1 if random.random() < 0.5 else -1)
        br, brr = [], []
        for i in range(7):
            u = i / 6
            br.append(sp[j] + (d * 0.6 + side * 0.5 + Vector((0, 0, 0.4))).normalized() * (0.38 * h * u) + Vector((0, 0, 0.08 * u * u)))
            brr.append(rr[j] * 0.85 * (1 - u) ** 0.8 + 0.003)
        tube(cv, cf, br, brr, ring=5, flat=0.5)
obj('Coral', [(cv, cf, CORAL)])

# ---- pale giant: flared rooted trunk, three wavy drooping umbrella canopies, hanging glowing veils (height ~1)
tv, tf = [], []
S = 24
sp = [Vector((0.035 * math.sin(i / S * 3.0), 0.02 * math.sin(i / S * 2.1), i / S * 0.92)) for i in range(S + 1)]
tube(tv, tf, sp, [0.03 + 0.085 * (1 - i / S) ** 6 for i in range(S + 1)], ring=12)
for k in range(6):
    a = k / 6 * 2 * math.pi + 0.3
    d = Vector((math.cos(a), math.sin(a), 0))
    rs = [Vector((0, 0, 0.14)) + d * 0.04, Vector((0, 0, 0.06)) + d * 0.11, d * 0.19 + Vector((0, 0, 0.0)), d * 0.25 + Vector((0, 0, -0.03))]
    tube(tv, tf, rs, [0.035, 0.026, 0.014, 0.004], ring=7)
lv, lf, vv, vf = [], [], [], []
for (z, R, droop, nv) in ((0.8, 0.46, 0.16, 40), (0.92, 0.34, 0.12, 28), (1.02, 0.2, 0.08, 16)):
    RN, AN = 9, 48
    base = len(lv)
    for i in range(RN + 1):
        u = i / RN
        for k in range(AN):
            th = 2 * math.pi * k / AN
            r = R * math.sin(u * math.pi / 2) * (1 + 0.06 * math.sin(th * 7) * u)
            lv.append((math.cos(th) * r + sp[-1].x, math.sin(th) * r + sp[-1].y, z + 0.05 * (1 - u * u) - droop * u ** 2.2 + 0.015 * math.sin(th * 7) * u))
    for i in range(RN):
        for k in range(AN):
            a0 = base + i * AN + k; a1 = base + i * AN + (k + 1) % AN
            lf.append((a0, a0 + AN, a1 + AN, a1))
    for k in range(nv):
        th = 2 * math.pi * (k + random.random() * 0.5) / nv
        rim = Vector((math.cos(th) * R * 0.97 + sp[-1].x, math.sin(th) * R * 0.97 + sp[-1].y, z + 0.05 - droop - 0.005))
        L = 0.1 + random.random() * 0.22
        st = [rim + Vector((math.cos(th) * 0.02 * u, math.sin(th) * 0.02 * u, -L * u)) for u in (0, 0.25, 0.5, 0.75, 1.0)]
        tube(vv, vf, st, [0.007, 0.006, 0.0045, 0.003, 0.0015], ring=4)
obj('PaleTree', [(tv, tf, BARK), (lv, lf, LEAF), (vv, vf, VEIL)])

for o in sc.objects: o.select_set(True)
print('[export] ok', sum(len(o.data.polygons) for o in sc.objects))
bpy.ops.export_scene.gltf(filepath=os.path.join(HERE, 'model.glb'), export_format='GLB', export_extras=True, export_yup=True)
