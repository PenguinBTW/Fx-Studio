# SPILL Felt Meadow kit (STOP-MOTION FELT): felt sheep (wool lumps, button eyes), knitted fox, pom-pom shrub, button stone.
# Engine adds fibre shells + fuzz rim + 12 fps creep. Parts: sheep, sHead, fox, fTail, pom, button. 1 unit = cursor height.
import bpy, os, sys, math
sys.dont_write_bytecode = True; HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.dirname(HERE))
from _bl import *
reset()
WOOL = mat('FeltWool', (0.95, 0.92, 0.85), 1.0); FACE = mat('FeltFace', (0.12, 0.1, 0.12), 1.0)
BTN = mat('FeltButton', (0.95, 0.75, 0.2), 0.35); FOX = mat('FeltFox', (0.95, 0.42, 0.12), 1.0)
CREAM = mat('FeltCream', (0.98, 0.94, 0.86), 1.0); POM = mat('FeltPom', (0.85, 0.3, 0.55), 1.0)
LEAF = mat('FeltLeaf', (0.35, 0.65, 0.3), 1.0); STONE = mat('FeltStone', (0.4, 0.55, 0.85), 0.4)

def blob(name, loc, scale, m, par, rot=(0, 0, 0), seg=20):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=seg // 2, radius=1, location=loc)
    o = bpy.context.active_object; o.name = name; o.scale = scale; o.rotation_euler = rot
    select(o); bpy.ops.object.transform_apply(scale=True, rotation=True); assign(o, m); smooth(o, 80); parent(o, par); return o

sheep = empty('sheep'); sheep['fx_part'] = 'sheep'
for i in range(14):
    a = i * 2.4; u = (i % 7) / 6.0
    blob(f'wool{i}', (-1.1 + 2.2 * u, 0.55 * math.sin(a), 1.35 + 0.35 * math.cos(a)), (0.6, 0.6, 0.55), WOOL, sheep)
blob('woolCore', (0, 0, 1.3), (1.4, 0.85, 0.7), WOOL, sheep)
for x in (-0.8, 0.8):
    for y in (-0.4, 0.4): blob(f'leg{x}{y}', (x, y, 0.4), (0.14, 0.14, 0.45), FACE, sheep)
head = empty('sHead'); head['fx_part'] = 'sHead'; head.location = (1.5, 0, 1.6); parent(head, sheep)
blob('face', (1.85, 0, 1.55), (0.45, 0.36, 0.42), FACE, head)
blob('tuft', (1.75, 0, 1.95), (0.3, 0.3, 0.2), WOOL, head)
for s in (1, -1):
    blob(f'ear{s}', (1.6, s * 0.45, 1.75), (0.22, 0.08, 0.1), FACE, head, rot=(0, 0, s * 0.4))
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.1, depth=0.05, location=(2.18, s * 0.16, 1.62), rotation=(0, math.pi / 2, 0))
    o = bpy.context.active_object; o.name = f'btnEye{s}'; assign(o, BTN); parent(o, head)

fox = empty('fox'); fox['fx_part'] = 'fox'
blob('fBody', (0, 0, 1.0), (1.1, 0.42, 0.45), FOX, fox, rot=(0, -0.1, 0))
blob('fChest', (0.8, 0, 1.0), (0.4, 0.34, 0.38), CREAM, fox)
blob('fHead', (1.35, 0, 1.55), (0.42, 0.38, 0.36), FOX, fox)
blob('fSnout', (1.8, 0, 1.45), (0.32, 0.17, 0.14), CREAM, fox)
blob('fNose', (2.1, 0, 1.48), (0.07, 0.07, 0.07), FACE, fox)
for s in (1, -1):
    blob(f'fEar{s}', (1.25, s * 0.22, 1.98), (0.12, 0.08, 0.26), FOX, fox, rot=(s * 0.25, 0, 0))
    blob(f'fEye{s}', (1.62, s * 0.2, 1.65), (0.06, 0.06, 0.06), FACE, fox)
for x in (-0.6, 0.6):
    for y in (-0.22, 0.22): blob(f'fLeg{x}{y}', (x, y, 0.35), (0.1, 0.1, 0.38), FACE, fox)
tail = empty('fTail'); tail['fx_part'] = 'fTail'; tail.location = (-1.0, 0, 1.1); parent(tail, fox)
for i in range(6):
    k = i / 5; blob(f'tail{i}', (-1.1 - 0.35 * i, 0, 1.15 + 0.25 * math.sin(k * 2.5)), (0.3 - 0.02 * i, 0.25, 0.25), CREAM if i == 5 else FOX, tail)

pom = empty('pom'); pom['fx_part'] = 'pom'
for i in range(9):
    a = i * 2.3; r = 0.5 if i else 0
    blob(f'pom{i}', (r * math.cos(a), r * math.sin(a), 0.9 + 0.35 * (i % 3)), (0.55, 0.55, 0.55), POM if i % 3 else LEAF, pom)
button = empty('button'); button['fx_part'] = 'button'
bpy.ops.mesh.primitive_cylinder_add(vertices=40, radius=1.1, depth=0.3, location=(0, 0, 0.15)); o = bpy.context.active_object; o.name = 'btn'; assign(o, STONE); bevel(o, 0.08, 3); parent(o, button)
for i in range(4):
    a = i * math.pi / 2 + 0.78
    bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.13, depth=0.32, location=(0.35 * math.cos(a), 0.35 * math.sin(a), 0.17)); h = bpy.context.active_object; h.name = f'hole{i}'; assign(h, FACE); parent(h, button)
export(HERE)
