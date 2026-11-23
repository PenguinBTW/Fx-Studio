# SPILL Stained-glass Garden kit (asset id: garden) (GLASS): butterfly (wing panes with lead came), lead-line peacock with a rose-window
# tail, tulip, gothic arch. Every pane is inset so the rim is black lead and the inner face coloured glass.
# Parts: bfly, bWingL, bWingR, peacock, pTail, tulip, arch.
import bpy, os, sys, math, bmesh
sys.dont_write_bytecode = True; HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.dirname(HERE))
from _bl import *
reset()
LEAD = mat('GlassLead', (0.03, 0.03, 0.035), 0.5, 0.6)
PANES = [mat(n, c, 0.15) for n, c in [('GlassRed', (0.9, 0.1, 0.15)), ('GlassBlue', (0.1, 0.3, 0.95)), ('GlassAmber', (1.0, 0.65, 0.1)),
         ('GlassGreen', (0.15, 0.75, 0.3)), ('GlassViolet', (0.55, 0.2, 0.85)), ('GlassCyan', (0.2, 0.8, 0.9))]]

def panes(name, cells, par, seed=0, lead=0.05):
    # cells: list of polygons (lists of xyz). Each becomes an inset pane: black rim, coloured centre.
    me = bpy.data.meshes.new(name + 'M'); ob = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(ob)
    me.materials.append(LEAD); [me.materials.append(p) for p in PANES]
    bm = bmesh.new(); faces = []
    for i, poly in enumerate(cells):
        vs = [bm.verts.new(p) for p in poly]; f = bm.faces.new(vs); f.material_index = 1 + (i * 7 + seed) % len(PANES); faces.append(f)
    res = bmesh.ops.inset_individual(bm, faces=faces, thickness=lead, depth=0.0)
    for f in res['faces']: f.material_index = 0
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(me); bm.free()
    mod = ob.modifiers.new('s', 'SOLIDIFY'); mod.thickness = 0.04; select(ob); bpy.ops.object.modifier_apply(modifier='s')
    parent(ob, par); return ob

def fan(cx, cz, r0, r1, a0, a1, n, rings, y=0.0, lobe=None):
    cells = []
    for k in range(rings):
        ra, rb = r0 + (r1 - r0) * k / rings, r0 + (r1 - r0) * (k + 1) / rings
        for i in range(n):
            A, B = a0 + (a1 - a0) * i / n, a0 + (a1 - a0) * (i + 1) / n
            sa = lobe(A) if lobe else 1; sb = lobe(B) if lobe else 1
            cells.append([(cx + ra * sa * math.cos(A), y, cz + ra * sa * math.sin(A)), (cx + rb * sa * math.cos(A), y, cz + rb * sa * math.sin(A)),
                          (cx + rb * sb * math.cos(B), y, cz + rb * sb * math.sin(B)), (cx + ra * sb * math.cos(B), y, cz + ra * sb * math.sin(B))])
    return cells

def blob(name, loc, scale, m, par, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=10, radius=1, location=loc); o = bpy.context.active_object; o.name = name; o.scale = scale; o.rotation_euler = rot
    select(o); bpy.ops.object.transform_apply(scale=True, rotation=True); assign(o, m); smooth(o, 80); parent(o, par); return o

# butterfly: wings in the XY plane (flat, y = up in three after export -> blender z), hinge on x axis
bf = empty('bfly'); bf['fx_part'] = 'bfly'
blob('bBody', (0, 0, 0), (0.1, 0.1, 0.7), LEAD, bf)
lob = lambda a: 1.0 + 0.35 * math.sin(2 * a) ** 2
for s, nm in ((1, 'bWingL'), (-1, 'bWingR')):
    w = empty(nm); w['fx_part'] = nm; parent(w, bf)
    cells = fan(0, 0, 0.12, 1.6, -1.2, 1.3, 6, 3, lobe=lob)
    cells = [[(s * abs(p[0]) if s < 0 else p[0], p[2] * 0 + p[1] * 0 + (-p[2] if False else 0), p[2]) for p in c] for c in cells]
    cells = [[(s * p[0], 0.0, p[2]) for p in c] for c in cells]
    if s < 0: cells = [c[::-1] for c in cells]
    # rotate wing plane to horizontal: wing lies in XY (blender) so it flaps about the body (Y) axis
    cells = [[(p[0], p[2], 0.0) for p in c] for c in cells]
    panes(nm + 'P', cells, w, seed=2 if s > 0 else 2)
# peacock: blue body, neck, crest, rose-window tail
pk = empty('peacock'); pk['fx_part'] = 'peacock'
blob('pBody', (0, 0, 1.6), (0.9, 0.6, 0.75), PANES[1], pk)
blob('pNeck', (0.6, 0, 2.6), (0.25, 0.25, 0.8), PANES[1], pk, rot=(0, 0.3, 0))
blob('pHead', (0.85, 0, 3.4), (0.28, 0.24, 0.26), PANES[5], pk)
blob('pBeak', (1.15, 0, 3.35), (0.18, 0.06, 0.06), PANES[2], pk)
for i in range(3): blob(f'pCrest{i}', (0.8 + 0.08 * (i - 1), 0.08 * (i - 1), 3.9), (0.04, 0.04, 0.22), PANES[2], pk)
for s in (1, -1): blob(f'pLeg{s}', (0, s * 0.25, 0.5), (0.06, 0.06, 0.6), LEAD, pk)
tail = empty('pTail'); tail['fx_part'] = 'pTail'; tail.location = (-0.6, 0, 1.8); parent(tail, pk)
panes('pTailP', [[(-0.6 + q[2] * 0.0 + 0 * q[0], q[0], 1.8 + q[2]) for q in c] for c in fan(0, 0, 0.3, 4.2, 0.05, math.pi - 0.05, 14, 4)], tail, seed=1, lead=0.07)
# tulip: 3 petal panes on a stem
tu = empty('tulip'); tu['fx_part'] = 'tulip'
cyl('tStem', 0.05, 1.6, loc=(0, 0, 0.8), m=PANES[3]); parent(bpy.context.active_object, tu)
for k in range(3):
    a = k * math.tau / 3; ca, sa = math.cos(a), math.sin(a)
    pts = [(0.15, 1.6), (0.45, 1.9), (0.5, 2.3), (0.25, 2.6), (0.0, 2.45)]
    cells = [[(ca * r - sa * 0.0, sa * r, z) for r, z in pts]]
    cells = [[(ca * r, sa * r, z) for r, z in pts], [(-ca * 0.0 + ca * r * 0.0 - sa * r, ca * r, z) for r, z in pts]]
    panes(f'tPetal{k}', cells, tu, seed=k * 3 % 6, lead=0.03)
# gothic arch window frame
ar = empty('arch'); ar['fx_part'] = 'arch'
cells = fan(0, 4.0, 0.0001, 2.0, 0.0, math.pi, 6, 2) + [[(-2 + 1.0 * i, 0, 4.0 - 1.33 * (j + 1)), (-1 + 1.0 * i, 0, 4.0 - 1.33 * (j + 1)), (-1 + 1.0 * i, 0, 4.0 - 1.33 * j), (-2 + 1.0 * i, 0, 4.0 - 1.33 * j)] for i in range(4) for j in range(3)]
panes('archP', cells, ar, seed=4, lead=0.08)
export(HERE)
