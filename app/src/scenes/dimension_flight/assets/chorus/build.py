# End chorus plant: tall mauve columns of lumpy, fused nodules that branch at near-right angles, crowned with
# popcorn-cluster lilac blooms. Continuous noisy tubes (no pipe joints). Height ~1.3 units; instanced in the scene.
import bpy, math, os, random
from mathutils import Vector, noise
HERE = os.path.dirname(os.path.abspath(__file__))
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
def mat(name, col, rough, emit=None, strength=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True; b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*col, 1); b.inputs['Roughness'].default_value = rough
    if emit: b.inputs['Emission Color'].default_value = (*emit, 1); b.inputs['Emission Strength'].default_value = strength
    return m
STEM = mat('ChorusStem', (0.42, 0.28, 0.46), 0.6)
FLOWER = mat('ChorusFlower', (0.93, 0.86, 1.0), 0.45, (0.75, 0.55, 1.0), 1.1)
V, F, M = [], [], []
def tube(spine, r0, mi, ring=10):
    base, n = len(V), len(spine)
    for i, p in enumerate(spine):
        t = (spine[min(i + 1, n - 1)] - spine[max(i - 1, 0)]).normalized()
        up = Vector((0, 0, 1)) if abs(t.z) < 0.9 else Vector((1, 0, 0))
        a = t.cross(up).normalized(); b = t.cross(a).normalized()
        u = i / (n - 1)
        for k in range(ring):
            th = 2 * math.pi * k / ring
            d = a * math.cos(th) + b * math.sin(th)
            lump = 1 + 0.28 * max(0.0, math.sin(u * math.pi * (n - 1) / 3.0)) + 0.22 * noise.noise(p * 14 + d * 2)
            V.append(tuple(p + d * r0 * lump * (1 - 0.25 * u)))
    for i in range(n - 1):
        for k in range(ring):
            a0 = base + i * ring + k; a1 = base + i * ring + (k + 1) % ring
            F.append((a0, a1, a1 + ring, a0 + ring)); M.append(mi)
    V.append(tuple(spine[-1])); tip = len(V) - 1; L = base + (n - 1) * ring
    for k in range(ring): F.append((L + k, L + (k + 1) % ring, tip)); M.append(mi)
def blob(p, r):
    for _ in range(5):
        c = p + Vector((random.uniform(-1, 1), random.uniform(-1, 1), random.uniform(-0.3, 1))) * r * 0.55
        bm_r = r * random.uniform(0.45, 0.75); base = len(V); RN, AN = 5, 8
        for i in range(RN + 1):
            ph = math.pi * i / RN
            for k in range(AN):
                th = 2 * math.pi * k / AN
                d = Vector((math.sin(ph) * math.cos(th), math.sin(ph) * math.sin(th), math.cos(ph)))
                V.append(tuple(c + d * bm_r * (1 + 0.25 * noise.noise(d * 3 + c * 9))))
        for i in range(RN):
            for k in range(AN):
                a0 = base + i * AN + k; a1 = base + i * AN + (k + 1) % AN
                F.append((a0, a0 + AN, a1 + AN, a1)); M.append(1)
def grow(p, d, depth, s, r):
    pts = [p]
    for _ in range(3 + random.randint(0, 2)):
        q = pts[-1] + d * s * 0.5 + Vector((random.uniform(-0.04, 0.04), random.uniform(-0.04, 0.04), 0)) * s
        pts.append(q)
    sp = []
    for i in range(len(pts) - 1):
        for k in range(4): sp.append(pts[i].lerp(pts[i + 1], k / 4))
    sp.append(pts[-1]); tube(sp, r, 0)
    end = pts[-1]
    if depth == 0: blob(end + d * r, r * 2.4); return
    for _ in range(1 + random.randint(0, 2)):
        if d.z > 0.5:
            a = random.choice([0, 1.57, 3.14, 4.71]) + random.uniform(-0.3, 0.3); nd = Vector((math.cos(a), math.sin(a), random.uniform(0.05, 0.3))).normalized()
        else: nd = Vector((0, 0, 1))
        grow(end, nd, depth - 1, s * 0.82, r * 0.8)
    if d.z > 0.5 and random.random() < 0.7: grow(end, Vector((0, 0, 1)), depth - 1, s * 0.9, r * 0.85)
random.seed(21)
grow(Vector((0, 0, 0)), Vector((0, 0, 1)), 3, 0.2, 0.032)
me = bpy.data.meshes.new('Chorus'); me.from_pydata(V, [], F); me.update()
me.materials.append(STEM); me.materials.append(FLOWER)
for i, p in enumerate(me.polygons): p.use_smooth = True; p.material_index = M[i]
o = bpy.data.objects.new('Chorus', me); sc.collection.objects.link(o); o['fx_part'] = 'chorus'
bpy.ops.export_scene.gltf(filepath=os.path.join(HERE, 'model.glb'), export_format='GLB', export_extras=True, export_yup=True)
print('[export] ok', len(me.polygons), [round(x, 2) for x in o.dimensions])
