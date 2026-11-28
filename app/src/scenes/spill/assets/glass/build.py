# Cover glass pre-fractured in a real impact pattern: radial cracks from the impact point crossed by
# concentric rings, with a crush zone at the centre and rays that end/merge further out.
# 1 unit = cursor height, pane in the Blender XZ plane, front (camera side) = -Y, impact at IMPACT.
# Objects: shard_<ring>_<ray> (origin = centroid; extras ring, ray, dist) and 'cracks', a ribbon mesh
# along every crack whose UV.x is the crack's arrival distance from the impact (reveal when progress > uv.x)
# and UV.y is -1..1 across the ribbon.
import bpy, os, sys, math, random, bmesh
sys.dont_write_bytecode = True; HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.dirname(HERE))
from _bl import *
reset()
TAU = math.tau
PW, PH, T, EDGE = 12.0, 12.0, 0.08, 0.4
IMPACT = (0.0, 0.5)
NRAY, R0, RG = 26, 0.14, 1.42
rng = random.Random(7)

def m_glass():
    m = mat('CoverGlass', (0.93, 0.95, 0.96), rough=0.03)
    b = m.node_tree.nodes['Principled BSDF']; b.inputs['Transmission Weight'].default_value = 1.0; b.inputs['IOR'].default_value = 1.5
    return m
GL = m_glass(); CR = mat('Crack', (1, 1, 1), rough=0.2)

def h(*k):
    return random.Random(hash(k) & 0xffffffff).random()

ang = [TAU * (i + 0.7 * (h('a', i) - 0.5)) / NRAY for i in range(NRAY)]
far = max(math.hypot(sx * PW / 2 - IMPACT[0], sz * PH / 2 - IMPACT[1]) for sx in (-1, 1) for sz in (-1, 1))
radii = [R0]
while radii[-1] < far * 1.05: radii.append(radii[-1] * (RG if len(radii) < 6 else 1.8) * (0.9 + 0.2 * h('r', len(radii))))
NR = len(radii)

def P(i, j):
    i %= NRAY
    a = ang[i] + (h('pa', i, j) - 0.5) * 0.12
    r = radii[j] * (0.9 + 0.2 * h('pr', i, j))
    return (IMPACT[0] + r * math.cos(a), IMPACT[1] + r * math.sin(a))

# a ray i is absent (merged) from ring j outward with some probability, rays never vanish near the centre
alive = [[True] * NR for _ in range(NRAY)]
for i in range(NRAY):
    for j in range(5, NR):
        if not alive[i][j - 1] or h('alive', i, j) < 0.16: alive[i][j] = False
    alive[i][NR - 1] = alive[i][NR - 2]

def jag(a, b, n, amp, key):
    out = []
    dx, dz = b[0] - a[0], b[1] - a[1]; L = math.hypot(dx, dz) or 1
    nx, nz = -dz / L, dx / L
    for k in range(1, n + 1):
        t = k / (n + 1); o = (h(key, k) - 0.5) * amp * L
        out.append((a[0] + dx * t + nx * o, a[1] + dz * t + nz * o))
    return out

def ray_edge(i, j):  # P(i,j) -> P(i,j+1)
    return jag(P(i, j), P(i, j + 1), 2, 0.22, ('ray', i % NRAY, j))

def ring_edge(i, j):  # P(i,j) -> P(i+1,j) along the arc
    a0 = ang[i % NRAY]; a1 = ang[(i + 1) % NRAY]
    if a1 < a0: a1 += TAU
    pa, pb = P(i, j), P(i + 1, j); pts = []
    for k in range(1, 4):
        t = k / 4; a = a0 + (a1 - a0) * t
        r = radii[j] * (0.9 + 0.2 * ((1 - t) * h('pr', i % NRAY, j) + t * h('pr', (i + 1) % NRAY, j))) * (1 + (h('ring', i % NRAY, j, k) - 0.5) * 0.12)
        pts.append((IMPACT[0] + r * math.cos(a), IMPACT[1] + r * math.sin(a)))
    return pts

def clip(poly):
    for ax, s, lim in ((0, 1, PW / 2), (0, -1, PW / 2), (1, 1, PH / 2), (1, -1, PH / 2)):
        out = []
        for k in range(len(poly)):
            a, b = poly[k - 1], poly[k]
            ia, ib = s * a[ax] <= lim, s * b[ax] <= lim
            if ia != ib:
                t = (lim - s * a[ax]) / (s * (b[ax] - a[ax]))
                out.append((a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t))
            if ib: out.append(b)
        poly = out
        if not poly: break
    return poly

def curve_y(x, z):  # curved edge: the pane bends back into the phone near its border
    y = 0.0
    for v, lim in ((abs(x), PW / 2), (abs(z), PH / 2)):
        s = (v - (lim - EDGE)) / EDGE
        if s > 0: y += 0.55 * s * s
    return y

def shard(name, poly, extras):
    poly = clip(poly)
    if len(poly) < 3: return None
    area = 0.5 * sum(poly[k - 1][0] * poly[k][1] - poly[k][0] * poly[k - 1][1] for k in range(len(poly)))
    if abs(area) < 1e-4: return None
    if area < 0: poly = poly[::-1]
    me = bpy.data.meshes.new(name); bm = bmesh.new()
    vs = [bm.verts.new((x, curve_y(x, z), z)) for x, z in poly]
    bm.faces.new(vs); bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    ext = bmesh.ops.extrude_face_region(bm, geom=bm.faces[:])
    for v in [g for g in ext['geom'] if isinstance(g, bmesh.types.BMVert)]: v.co.y += T
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bmesh.ops.triangulate(bm, faces=bm.faces[:], ngon_method='EAR_CLIP')
    bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(ob); assign(ob, GL)
    for k, v in extras.items(): ob[k] = v
    select(ob); bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY', center='BOUNDS')
    c = ob.location; ob['dist'] = round(math.hypot(c.x - IMPACT[0], c.z - IMPACT[1]), 4)
    return ob

root = empty('glass'); root['fx_part'] = 'glass'
n = 0
for i in range(NRAY):  # crush zone
    poly = [IMPACT, P(i, 0)] + ring_edge(i, 0) + [P(i + 1, 0)]
    ob = shard(f'shard_0_{i}', poly, {'ring': 0, 'ray': i})
    if ob: parent(ob, root); n += 1
for j in range(NR - 1):
    i = 0
    starts = [k for k in range(NRAY) if alive[k][j]]
    for si, a in enumerate(starts):
        b = starts[(si + 1) % len(starts)] + (NRAY if si + 1 == len(starts) else 0)
        inner, outer = [], []
        for k in range(a, b):
            inner += [P(k, j)] + ring_edge(k, j)
            outer += [P(k, j + 1)] + ring_edge(k, j + 1)
        poly = inner + [P(b, j)] + ray_edge(b, j) + [P(b, j + 1)] + outer[::-1] + ray_edge(a, j)[::-1]
        ob = shard(f'shard_{j + 1}_{a % NRAY}', poly, {'ring': j + 1, 'ray': a % NRAY})
        if ob: parent(ob, root); n += 1

# crack ribbons
cv, cf, cuv = [], [], []
W = 0.012
def ribbon(pts, d0, d1):
    L = [0.0]
    for k in range(1, len(pts)): L.append(L[-1] + math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]))
    tot = L[-1] or 1
    base = len(cv)
    for k, (x, z) in enumerate(pts):
        a, b = pts[max(k - 1, 0)], pts[min(k + 1, len(pts) - 1)]
        dx, dz = b[0] - a[0], b[1] - a[1]; ll = math.hypot(dx, dz) or 1
        nx, nz = -dz / ll * W, dx / ll * W
        da, db = d0 + L[k], d1 + (tot - L[k])
        d = min(da, db)
        for s in (-1, 1):
            px, pz = x + nx * s, z + nz * s
            cv.append((px, curve_y(px, pz) - 0.004, pz)); cuv.append((d, s))
    for k in range(len(pts) - 1):
        q = base + 2 * k; cf.append((q, q + 2, q + 3, q + 1))
def dist(p): return math.hypot(p[0] - IMPACT[0], p[1] - IMPACT[1])
def inside(p): return abs(p[0]) <= PW / 2 + 0.2 and abs(p[1]) <= PH / 2 + 0.2
for i in range(NRAY):
    pts = [IMPACT]; j = 0
    while j < NR - 1 and alive[i][j]:
        pts += [P(i, j)] + ray_edge(i, j); j += 1
    pts.append(P(i, j))
    pts = [p for p in pts if inside(p)]
    if len(pts) > 1: ribbon(pts, 0.0, 1e9)
for j in range(NR):
    for i in range(NRAY):
        a, b = P(i, j), P(i + 1, j)
        pts = [a] + ring_edge(i, j) + [b]
        if not all(inside(p) for p in pts): continue
        if j >= 2 and h('show', i, j) < 0.2 + 0.08 * j: continue
        ribbon(pts, dist(a) * 1.15, dist(b) * 1.15)
me = bpy.data.meshes.new('cracks'); me.from_pydata(cv, [], cf); me.update()
uvl = me.uv_layers.new(name='UVMap')
for poly in me.polygons:
    for li in poly.loop_indices: uvl.data[li].uv = cuv[me.loops[li].vertex_index]
cr = bpy.data.objects.new('cracks', me); bpy.context.collection.objects.link(cr); assign(cr, CR); cr['fx_part'] = 'cracks'
parent(cr, root)
print(f'[glass] shards={n} rings={NR} crackverts={len(cv)}')
export(HERE)
