# SPILL Paper Canopy kit (PAPERCRAFT style): faceted origami deer, folded-paper trees, pop-up flower, paper crane.
# All flat-shaded with hard creases. Parts: deer, tree, crane, flower (each a root at origin, scaled in engine). 1 unit = cursor height.
import bpy, os, sys, math, bmesh
sys.dont_write_bytecode = True; HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.dirname(HERE))
from _bl import *
reset()
CREAM = mat('PaperCream', (0.95, 0.88, 0.74), 0.9)
CORAL = mat('PaperCoral', (0.95, 0.38, 0.3), 0.9)
TEAL = mat('PaperTeal', (0.1, 0.55, 0.55), 0.9)
MUST = mat('PaperMustard', (0.95, 0.7, 0.18), 0.9)
INKM = mat('PaperInk', (0.08, 0.07, 0.1), 0.9)

def poly(name, verts, faces, m, par):
    me = bpy.data.meshes.new(name); me.from_pydata(verts, [], faces); me.update()
    o = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(o); o.data.materials.append(m); parent(o, par); return o

def facet(name, loc, scale, m, par, segs=5, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=1, location=loc)
    o = bpy.context.active_object; o.name = name; o.scale = scale; o.rotation_euler = rot
    select(o); bpy.ops.object.transform_apply(scale=True, rotation=True); assign(o, m); parent(o, par); return o

def leg(name, a, b, w, m, par):
    import mathutils
    a, b = mathutils.Vector(a), mathutils.Vector(b); d = b - a
    bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=w, radius2=w * 0.55, depth=d.length, location=(a + b) / 2)
    o = bpy.context.active_object; o.name = name; o.rotation_euler = d.to_track_quat('Z', 'Y').to_euler(); assign(o, m); parent(o, par); return o

# --- origami deer (~3 units tall at the shoulder... scaled in engine)
deer = empty('deer'); deer['fx_part'] = 'deer'
facet('dBody', (0, 0, 1.6), (1.1, 0.42, 0.5), CORAL, deer, rot=(0, 0.08, 0))
facet('dChest', (0.85, 0, 1.75), (0.45, 0.38, 0.5), CREAM, deer)
facet('dNeck', (1.15, 0, 2.3), (0.22, 0.2, 0.55), CORAL, deer, rot=(0, 0.5, 0))
head = facet('dHead', (1.45, 0, 2.85), (0.42, 0.2, 0.22), CORAL, deer, rot=(0, 0.35, 0)); head['fx_part'] = 'dHead'
for s in (1, -1):
    facet(f'dEar{s}', (1.25, s * 0.22, 3.05), (0.18, 0.05, 0.08), CREAM, deer, rot=(0.6 * s, 0, 0))
    for k in range(3):
        leg(f'dAnt{s}{k}', (1.35, s * 0.1, 3.0 + k * 0.25), (1.2 - k * 0.15, s * (0.3 + 0.18 * k), 3.35 + k * 0.28), 0.04, MUST, head)
    for fx in (0.7, -0.75):
        leg(f'dLeg{s}{fx}', (fx, s * 0.22, 1.4), (fx + 0.05, s * 0.24, 0.0), 0.09, CORAL, deer)
facet('dTail', (-1.15, 0, 1.85), (0.2, 0.08, 0.14), CREAM, deer, rot=(0, -0.6, 0))
facet('dEye', (1.68, 0.14, 2.92), (0.05, 0.03, 0.05), INKM, deer)
facet('dEye2', (1.68, -0.14, 2.92), (0.05, 0.03, 0.05), INKM, deer)

# --- folded paper tree: trunk prism + stacked 6-sided folded fans
tree = empty('tree'); tree['fx_part'] = 'tree'
leg('tTrunk', (0, 0, 0), (0, 0, 3.2), 0.28, CREAM, tree)
for k in range(5):
    z = 2.0 + k * 1.15; r = 2.4 - k * 0.42; n = 6; vs = [(0, 0, z + 1.3)]
    for i in range(n * 2):
        a = i / (n * 2) * math.tau; rr = r * (1.0 if i % 2 == 0 else 0.72)
        vs.append((math.cos(a) * rr, math.sin(a) * rr, z - (0.0 if i % 2 == 0 else 0.25)))
    fs = [(0, 1 + i, 1 + (i + 1) % (n * 2)) for i in range(n * 2)]
    poly(f'tFan{k}', vs, fs, TEAL if k % 2 == 0 else MUST, tree)

# --- pop-up flower: stem + 5 folded petals (each a creased kite) + centre
flower = empty('flower'); flower['fx_part'] = 'flower'
leg('fStem', (0, 0, 0), (0, 0, 1.6), 0.05, TEAL, flower)
for i in range(5):
    a = i / 5 * math.tau; c, s_ = math.cos(a), math.sin(a)
    vs = [(0, 0, 1.6), (c * 0.35 - s_ * 0.22, s_ * 0.35 + c * 0.22, 1.75), (c * 0.75, s_ * 0.75, 2.0), (c * 0.35 + s_ * 0.22, s_ * 0.35 - c * 0.22, 1.75), (c * 0.38, s_ * 0.38, 1.9)]
    poly(f'fPetal{i}', vs, [(0, 1, 4), (1, 2, 4), (2, 3, 4), (3, 0, 4)], CORAL if i % 2 else MUST, flower)
facet('fCore', (0, 0, 1.72), (0.16, 0.16, 0.12), CREAM, flower)

# --- paper crane: classic silhouette from flat triangles, wings as separate parts for flapping
crane = empty('crane'); crane['fx_part'] = 'crane'
poly('cBody', [(-0.9, 0, 0.1), (0.9, 0, 0.1), (0, 0.18, -0.25), (0, -0.18, -0.25), (1.25, 0, 0.75), (-1.2, 0, 0.6), (1.4, 0, 0.6)],
     [(0, 1, 2), (0, 3, 1), (0, 2, 5), (1, 4, 2), (4, 6, 2)], CREAM, crane)
for s in (1, -1):
    w = poly(f'cWing{s}', [(0.35, 0, 0.1), (-0.35, 0, 0.1), (0.0, s * 1.4, 0.35)], [(0, 1, 2)], CREAM if s > 0 else CORAL, crane)
    w['fx_part'] = 'cWingL' if s > 0 else 'cWingR'
export(HERE)
