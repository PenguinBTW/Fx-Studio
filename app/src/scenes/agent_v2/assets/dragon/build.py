# Serpentine dragon v3, straight along +X (tail tip x=0 .. nose x~10.9), Blender Z up. The engine bends it along a
# path in the vertex shader. Body+neck+skull are ONE parametric superellipse loft (no remesh, so ridges stay crisp);
# the jaw is a second loft hinged at JAW_HINGE. Objects: body, jaw*, mouth, teeth, eyes, spikes, fin, mane.
import bpy, os, sys, math
sys.dont_write_bytecode = True; HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.dirname(HERE))
from _bl import *
reset()
SC = mat('Scale', (0.03, 0.03, 0.035), rough=0.3, metal=0.6)
HO = mat('Horn', (0.75, 0.68, 0.55), rough=0.45)
TO = mat('Tooth', (0.9, 0.86, 0.78), rough=0.3)
EY = mat('Eye', (1.0, 0.6, 0.1), emit=(1.0, 0.5, 0.1), strength=5)
MA = mat('Mane', (0.6, 0.15, 0.05), rough=0.6)
FI = mat('Fin', (0.5, 0.08, 0.04), rough=0.5)
MO = mat('Mouth', (0.25, 0.02, 0.02), rough=0.5)
JAW_HINGE = (9.32, 0.0, -0.04)
TAU = math.tau

def ss(a, b, x):
    t = min(1, max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t)

def table(keys, x):
    if x <= keys[0][0]: return keys[0][1:]
    for a, b in zip(keys, keys[1:]):
        if x <= b[0]:
            t = ss(a[0], b[0], x); return tuple(p + (q - p) * t for p, q in zip(a[1:], b[1:]))
    return keys[-1][1:]

#        x     half-w  top   bottom  cz    exponent
BODY = [(0.0,  0.015, 0.015, 0.015, 0.0,  2.0), (0.5, 0.09, 0.09, 0.08, 0.0, 2.0), (2.2, 0.25, 0.26, 0.21, 0.0, 2.2),
        (3.4,  0.31,  0.31,  0.27,  0.0,  2.3), (5.4, 0.38, 0.39, 0.33, 0.0, 2.3), (7.3, 0.47, 0.47, 0.41, 0.0, 2.3), (8.3, 0.33, 0.35, 0.29, 0.0, 2.2),
        (8.85, 0.35,  0.37,  0.30,  0.02, 2.2), (9.25, 0.40, 0.40, 0.17, 0.07, 2.4), (9.65, 0.33, 0.34, 0.11, 0.09, 2.6),
        (10.0, 0.245, 0.25,  0.09,  0.07, 2.9), (10.4, 0.19, 0.175, 0.08, 0.035, 3.1), (10.66, 0.155, 0.145, 0.07, 0.025, 3.0),
        (10.84, 0.085, 0.075, 0.05, 0.015, 2.5), (10.9, 0.01, 0.01, 0.01, 0.015, 2.0)]
JAW = [(9.15, 0.29, 0.02, 0.24, -0.04, 2.2), (9.6, 0.27, 0.02, 0.16, -0.045, 2.4), (10.1, 0.205, 0.02, 0.11, -0.05, 2.8),
       (10.5, 0.155, 0.02, 0.08, -0.05, 3.0), (10.76, 0.08, 0.02, 0.05, -0.05, 2.6), (10.82, 0.01, 0.01, 0.01, -0.05, 2.0)]

def g(x, c, s): return math.exp(-((x - c) / s) ** 2)

def body_detail(x, th, y, z, w, ht):
    sn, cs = math.sin(th), math.cos(th); dy = dz = 0.0
    a = abs(th if th <= math.pi else th - TAU)          # 0 = top, pi = belly
    body = 1 - ss(8.6, 9.1, x)
    # dorsal keel and ventral plates (belly ribs)
    dz += 0.035 * ht * g(a, 0, 0.22) * body
    if a > 2.2: dz -= 0.022 * ht * (0.5 + 0.5 * math.cos(x * TAU * 6.5)) ** 3 * body * ss(2.2, 2.6, a)
    # skull: nasal ridges, brow overhang, eye socket, nostrils, cheek bone
    hd = ss(9.1, 9.3, x)
    if hd > 0:
        ridge = g(a, 0.75, 0.12) * ss(9.45, 9.7, x) * (1 - ss(10.45, 10.7, x))
        brow = g(a, 1.05, 0.2) * g(x, 9.78, 0.16)
        sock = g(a, 1.45, 0.16) * g(x, 9.86, 0.09)
        nos = g(a, 0.55, 0.16) * g(x, 10.62, 0.06)
        cheek = g(a, 1.75, 0.2) * g(x, 9.4, 0.14)
        k = 0.028 * ridge + 0.09 * brow - 0.05 * sock + 0.045 * nos + 0.05 * cheek
        dy += k * (1 if sn >= 0 else -1) * abs(sn) ** 0.5; dz += k * cs * 0.8 * (1 if a < 1.6 else 0.3)
    return y + dy, z + dz

def loft(keys, name, xs, na, detail=None, cap=True):
    V, F = [], []
    for x in xs:
        w, ht, hb, cz, n = table(keys, x); e = 2 / n
        for j in range(na):
            th = TAU * j / na; sn, cs = math.sin(th), math.cos(th)
            y = w * math.copysign(abs(sn) ** e, sn); z = cz + (ht if cs >= 0 else hb) * math.copysign(abs(cs) ** e, cs)
            if detail: y, z = detail(x, th, y, z, w, ht)
            V.append((x, y, z))
    R = len(xs)
    for i in range(R - 1):
        for j in range(na):
            a, b = i * na + j, i * na + (j + 1) % na
            F.append((a, b, b + na, a + na))
    if cap:
        V += [(xs[0], 0, table(keys, xs[0])[3]), (xs[-1], 0, table(keys, xs[-1])[3])]; c0, c1 = len(V) - 2, len(V) - 1
        for j in range(na):
            F.append((c0, (j + 1) % na, j)); F.append((c1, (R - 1) * na + j, (R - 1) * na + (j + 1) % na))
    me = bpy.data.meshes.new(name); me.from_pydata(V, [], F); me.validate()
    o = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(o); select(o); bpy.ops.object.shade_smooth(); return o

def span(a, b, step): n = max(2, int((b - a) / step)); return [a + (b - a) * i / n for i in range(n + 1)]
xs = span(0, 8.8, 0.022) + span(8.8, 10.9, 0.008)[1:]
body = loft(BODY, 'body', xs, 72, body_detail); assign(body, SC)
def R(x): return table(BODY, x)[1]
def skin_chain(pts, name, sub=2):
    V = [p for p, _ in pts]; E = [(i, i + 1) for i in range(len(V) - 1)]
    me = bpy.data.meshes.new(name); me.from_pydata(V, E, []); o = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(o)
    select(o); o.modifiers.new('skin', 'SKIN')
    for i, (_, r) in enumerate(pts): me.skin_vertices[0].data[i].radius = (r, r * 0.92)
    me.skin_vertices[0].data[0].use_root = True
    s = o.modifiers.new('sub', 'SUBSURF'); s.levels = sub
    bpy.ops.object.modifier_apply(modifier='skin'); bpy.ops.object.modifier_apply(modifier='sub'); bpy.ops.object.shade_smooth(); return o

def join(obs, name):
    bpy.ops.object.select_all(action='DESELECT')
    for o in obs: o.select_set(True)
    bpy.context.view_layer.objects.active = obs[0]; bpy.ops.object.join(); obs[0].name = name; return obs[0]

def cone(loc, r1, depth, rot, verts=10):
    bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r1, radius2=0, depth=depth, location=loc, rotation=rot)
    o = bpy.context.active_object; bpy.ops.object.shade_smooth(); return o

def fang(base, length, r, dirv, bend):
    # curved tapered tooth/claw as a skin chain from base along dirv, bending by `bend`
    pts = []; p = list(base); d = list(dirv)
    for i in range(6):
        t = i / 5; pts.append((tuple(p), max(0.003, r * (1 - t) ** 0.8)))
        p = [p[k] + d[k] * length / 5 for k in range(3)]; d = [d[k] + bend[k] / 5 for k in range(3)]
    return skin_chain(pts, 'f', 1)

def strand(pts, r0):
    cu = bpy.data.curves.new('m', 'CURVE'); cu.dimensions = '3D'; cu.bevel_depth = r0; cu.bevel_resolution = 1
    sp_ = cu.splines.new('POLY'); sp_.points.add(len(pts) - 1)
    for i, p in enumerate(pts): sp_.points[i].co = (*p, 1); sp_.points[i].radius = 1 - i / len(pts)
    o = bpy.data.objects.new('m', cu); bpy.context.collection.objects.link(o); select(o); bpy.ops.object.convert(target='MESH'); return bpy.context.active_object

def under(x): w, ht, hb, cz, n = table(BODY, x); return w, cz - hb, cz + ht
# jaw + mouth interior
jx = span(9.15, 10.82, 0.008)
jaw = loft(JAW, 'jaw', jx, 48); assign(jaw, SC)
PAL = [(x, under(x)[0] * 0.82, 0.004, 0.004, under(x)[1] + 0.006, 2.0) for x in span(9.3, 10.78, 0.05)]
mouth = loft(PAL, 'mouth', span(9.3, 10.78, 0.01), 24); assign(mouth, MO)
TONG = [(x, table(JAW, x)[0] * 0.8, 0.004, 0.004, -0.03, 2.0) for x in span(9.3, 10.74, 0.05)]
jm = loft(TONG, 'jawmouth', span(9.3, 10.74, 0.01), 24); assign(jm, MO)
# teeth: upper row follows the lip outline, big canines near the front
up, lo = [], []
xs, xq = [], 9.58
for i in range(40):
    if xq > 10.68: break
    xs.append(xq); xq += 0.07 + 0.09 * ((i * 0.7548776) % 1) ** 2
for i, x in enumerate(xs):
    w, zb, _ = under(x); can = math.exp(-((x - 10.55) / 0.04) ** 2)
    for s in (-1, 1):
        hj = ((i * 7 + (s + 1) * 13) * 0.6180339) % 1; L_ = 0.03 + 0.08 * can + 0.07 * hj * hj + 0.025 * (i % 4 == 1)
        up.append(fang((x + 0.02 * (hj - 0.5), (w - 0.03) * s, zb + 0.02), L_, 0.012 + 0.012 * can + 0.006 * hj, (-0.15 - 0.2 * (hj - 0.5), (0.05 + 0.08 * (hj - 0.5)) * s, -1), (0.35 + 0.35 * hj, 0, 0)))
        wj = table(JAW, x + 0.03)[0]; cl = math.exp(-((x - 10.42) / 0.04) ** 2)
        hk = ((i * 11 + (s + 1) * 5) * 0.381966) % 1; lo.append(fang((x + 0.03, (wj - 0.035) * s, -0.04), 0.03 + 0.06 * cl + 0.035 * hk * hk, 0.01 + 0.008 * cl + 0.005 * hk, (-0.1 + 0.2 * (hk - 0.5), 0.03 * s, 1), (0.2 + 0.15 * hk, 0, 0)))
teeth = join(up, 'teeth'); assign(teeth, TO)
lowt = join(lo, 'lowteeth'); assign(lowt, TO)
# eyes: small almond lenses recessed under the brow
ey = []
for s in (-1, 1):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, radius=1, location=(9.86, 0.25 * s, 0.14), rotation=(0, 0, math.radians(18 * s)))
    o = bpy.context.active_object; o.scale = (0.075, 0.034, 0.042); select(o); bpy.ops.object.transform_apply(scale=True, rotation=True); bpy.ops.object.shade_smooth(); ey.append(o)
eyes = join(ey, 'eyes'); assign(eyes, EY)
# horns (annulated), brow horns, cheek frills, claws -> Horn material
hn = []
for s in (-1, 1):
    pts = []
    for i in range(25):
        t = i / 24; x = 9.35 - 1.55 * t; y = (0.2 + 0.38 * t ** 0.8) * s; z = 0.42 + 1.05 * math.sin(t * 1.9) * 0.82 - 0.25 * t * t
        pts.append(((x, y, z), (0.105 * (1 - t) ** 0.9 + 0.006) * (1 + 0.1 * (i % 2) * (1 - t))))
    hn.append(skin_chain(pts, 'horn'))
    hn.append(fang((9.62, 0.24 * s, 0.33), 0.32, 0.04, (-0.7, 0.35 * s, 0.6), (-0.3, 0.1 * s, -0.2)))
    for k in range(3):
        hn.append(fang((9.3, 0.33 * s, -0.06 + 0.09 * k), 0.3 - 0.06 * k, 0.035, (-0.8, 0.5 * s, 0.1 - 0.15 * k), (-0.2, 0.2 * s, 0)))
# legs (Scale) with curved claws (Horn)
legs = []
for s in (-1, 1):
    for lx in (6.4, 3.4):
        w, zb, _ = under(lx)
        legs.append(skin_chain([((lx, 0.22 * s, zb + 0.15), 0.17), ((lx + 0.2, 0.52 * s, zb - 0.06), 0.12), ((lx + 0.36, 0.62 * s, zb - 0.32), 0.075), ((lx + 0.5, 0.66 * s, zb - 0.4), 0.06)], 'leg'))
        for t in (-1, 0, 1, 2):
            p0 = (lx + 0.5, 0.66 * s, zb - 0.4); p1 = (lx + 0.7 - 0.25 * (t == 2), (0.66 + 0.09 * t) * s, zb - 0.44)
            legs.append(skin_chain([(p0, 0.045), (p1, 0.03)], 'toe', 1))
            hn.append(fang(p1, 0.12, 0.022, (0.8 - 1.6 * (t == 2), 0.1 * t * s, -0.3), (0.2, 0, -0.9)))
body = join([body] + legs, 'body')
# dorsal spikes + membrane
sp, V, F = [], [], []
for k in range(42):
    x = 0.6 + k * 0.2; w, ht, hb, cz, n = table(BODY, x); h = 0.05 + 0.62 * ht; top = cz + ht * 1.02
    hn.append(fang((x, 0, top - 0.03), h, 0.22 * ht + 0.01, (-0.55, 0, 0.83), (-0.35, 0, -0.1)))
    V += [(x, 0, top - 0.02), (x - h * 0.5, 0, top + h * 0.78), (x + 0.1, 0, top - 0.02), (x + 0.1 - h * 0.3, 0, top + h * 0.38)]
spikes = join(hn, 'spikes'); assign(spikes, HO)
for k in range(41):
    a = k * 4; b = (k + 1) * 4; F += [(a, a + 2, a + 3, a + 1), (a + 2, b, b + 1, a + 3)]
me = bpy.data.meshes.new('fin'); me.from_pydata(V, [], F); fin = bpy.data.objects.new('fin', me); bpy.context.collection.objects.link(fin)
select(fin); so = fin.modifiers.new('so', 'SOLIDIFY'); so.thickness = 0.006; bpy.ops.object.modifier_apply(modifier='so'); assign(fin, FI)
# mane, beard (hinged with jaw), whiskers
ms, bd = [], []
for k in range(170):
    a = (k * 0.618034) % 1; x0 = 9.25 - a * 1.6; ang = math.radians(-85 + 170 * ((k * 0.381966) % 1))
    w, ht, hb, cz, n = table(BODY, x0); y0, z0 = math.sin(ang) * w * 0.95, cz + math.cos(ang) * ht * 0.95
    ln = 0.5 + 0.5 * ((k * 0.7548) % 1)
    ms.append(strand([(x0 - ln * t * 1.15, y0 * (1 + 0.8 * t), z0 + ln * (0.4 * t - 0.3 * t * t) * (1 if z0 > cz else -0.4)) for t in [i / 7 for i in range(8)]], 0.011))
for k in range(34):
    x0 = 9.5 + 0.5 * ((k * 0.618) % 1); y0 = (((k * 0.381) % 1) - 0.5) * 0.25; ln = 0.35 + 0.25 * ((k * 0.7548) % 1)
    bd.append(strand([(x0 - ln * t * 0.9, y0 * (1 + t), -0.15 - ln * t * 0.9) for t in [i / 6 for i in range(7)]], 0.008))
for s in (-1, 1):
    ms.append(strand([(10.64 - 1.9 * t, (0.16 + 0.7 * math.sin(min(1, t * 1.4) * 1.5708)) * s, 0.02 - 0.38 * math.sin(t * 2.8) + 0.3 * t ** 3) for t in [i / 23 for i in range(24)]], 0.007))
mane = join(ms, 'mane'); assign(mane, MA)
beard = join(bd, 'jawbeard'); assign(beard, MA)
jaw = join([jaw, lowt], 'jaw')
for o in bpy.context.scene.objects: o.select_set(False)
export(HERE)
