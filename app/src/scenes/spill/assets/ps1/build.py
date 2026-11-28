# SPILL PS1 Arcade Ruins kit (LATE-90s CONSOLE 3D): deliberately low-poly T-rex style dino with a hinged jaw,
# 4-vertex-leaf palm, broken arcade cabinet, ruined pillar. Engine adds vertex snapping, affine texture warp, fog.
# Parts: dino, dHead, dJaw, dTail, palm, cab, pillar.
import bpy, os, sys, math
sys.dont_write_bytecode = True; HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.dirname(HERE))
from _bl import *
reset()
SKIN = mat('PsSkin', (0.35, 0.55, 0.25), 0.9); BELLY = mat('PsBelly', (0.8, 0.75, 0.45), 0.9); TEETH = mat('PsTeeth', (0.95, 0.95, 0.85), 0.9)
EYE = mat('PsEye', (1.0, 0.85, 0.1), 0.9); MOUTH = mat('PsMouth', (0.6, 0.1, 0.12), 0.9)
BARK = mat('PsBark', (0.5, 0.35, 0.2), 0.9); LEAF = mat('PsLeaf', (0.2, 0.6, 0.2), 0.9)
CAB = mat('PsCab', (0.25, 0.15, 0.45), 0.6); SCR = mat('PsScreen', (0.1, 0.9, 0.8), 0.3, emit=(0.1, 0.9, 0.8), strength=3.0); STONE = mat('PsStone', (0.6, 0.58, 0.52), 0.9)

def lp(name, kind, loc, scale, m, par, rot=(0, 0, 0)):
    if kind == 'ico': bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=1, location=loc)
    elif kind == 'cone': bpy.ops.mesh.primitive_cone_add(vertices=5, radius1=1, depth=2, location=loc)
    else: bpy.ops.mesh.primitive_cube_add(size=2, location=loc)
    o = bpy.context.active_object; o.name = name; o.scale = scale; o.rotation_euler = rot
    select(o); bpy.ops.object.transform_apply(scale=True, rotation=True); assign(o, m); parent(o, par); return o

dino = empty('dino'); dino['fx_part'] = 'dino'
lp('dBody', 'ico', (0, 0, 5.0), (3.2, 1.8, 2.2), SKIN, dino, rot=(0, -0.35, 0))
lp('dBelly', 'ico', (0.9, 0, 4.4), (2.0, 1.4, 1.6), BELLY, dino, rot=(0, -0.35, 0))
lp('dNeck', 'ico', (2.8, 0, 6.6), (1.3, 1.1, 1.4), SKIN, dino, rot=(0, 0.6, 0))
for s in (1, -1):
    lp(f'dThigh{s}', 'ico', (-0.4, s * 1.4, 3.6), (1.3, 0.7, 1.7), SKIN, dino)
    lp(f'dShin{s}', 'cone', (-0.2, s * 1.5, 1.4), (0.55, 0.55, 1.1), SKIN, dino, rot=(math.pi, 0, 0))
    lp(f'dFoot{s}', 'cube', (0.5, s * 1.5, 0.25), (1.0, 0.45, 0.25), SKIN, dino)
    lp(f'dArm{s}', 'cone', (2.4, s * 1.1, 4.6), (0.22, 0.22, 0.6), SKIN, dino, rot=(0, 2.4, 0))
tail = empty('dTail'); tail['fx_part'] = 'dTail'; tail.location = (-2.8, 0, 5.3); parent(tail, dino)
lp('dTail1', 'cone', (-5.2, 0, 5.8), (1.3, 1.1, 2.8), SKIN, tail, rot=(0, -1.75, 0))
head = empty('dHead'); head['fx_part'] = 'dHead'; head.location = (3.6, 0, 7.6); parent(head, dino)
lp('dSkull', 'cube', (4.8, 0, 8.1), (1.6, 0.85, 0.75), SKIN, head, rot=(0, 0.1, 0))
lp('dBrow', 'cube', (4.3, 0, 8.85), (0.9, 0.9, 0.2), SKIN, head)
for s in (1, -1): lp(f'dEye{s}', 'cube', (4.6, s * 0.86, 8.45), (0.22, 0.05, 0.15), EYE, head)
lp('dMouthIn', 'cube', (5.0, 0, 7.45), (1.4, 0.7, 0.2), MOUTH, head)
for i in range(5):
    for s in (1, -1): lp(f'dToothU{i}{s}', 'cone', (4.0 + 0.5 * i, s * 0.62, 7.3), (0.12, 0.12, 0.22), TEETH, head, rot=(math.pi, 0, 0))
jaw = empty('dJaw'); jaw['fx_part'] = 'dJaw'; jaw.location = (3.7, 0, 7.4); parent(jaw, head)
lp('dJawM', 'cube', (5.0, 0, 7.05), (1.5, 0.75, 0.3), SKIN, jaw, rot=(0, 0.05, 0))
for i in range(4):
    for s in (1, -1): lp(f'dToothL{i}{s}', 'cone', (4.3 + 0.5 * i, s * 0.55, 7.45), (0.1, 0.1, 0.18), TEETH, jaw)

palm = empty('palm'); palm['fx_part'] = 'palm'
for i in range(5): lp(f'pTrunk{i}', 'cone', (0.25 * i * i * 0.1, 0, 1 + 1.6 * i), (0.45 - 0.05 * i, 0.45 - 0.05 * i, 0.85), BARK, palm)
for i in range(6):
    a = i * math.tau / 6
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0.4 + 1.6 * math.cos(a), 1.6 * math.sin(a), 8.0)); o = bpy.context.active_object; o.name = f'pLeaf{i}'
    o.scale = (3.2, 0.9, 1); o.rotation_euler = (0, 0.45, a); select(o); bpy.ops.object.transform_apply(scale=True, rotation=True); assign(o, LEAF); parent(o, palm)

cab = empty('cab'); cab['fx_part'] = 'cab'
lp('cBody', 'cube', (0, 0, 1.8), (0.8, 0.7, 1.8), CAB, cab, rot=(0, 0.05, 0))
lp('cScreen', 'cube', (0.75, 0, 2.6), (0.08, 0.55, 0.45), SCR, cab, rot=(0, -0.2, 0))
lp('cPanel', 'cube', (0.95, 0, 1.75), (0.35, 0.65, 0.12), CAB, cab, rot=(0, 0.3, 0))
lp('cMarq', 'cube', (0.65, 0, 3.4), (0.2, 0.72, 0.25), SCR, cab)
pil = empty('pillar'); pil['fx_part'] = 'pillar'
lp('plBase', 'cube', (0, 0, 0.3), (1.0, 1.0, 0.3), STONE, pil)
bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=0.7, depth=5, location=(0, 0, 3.0)); o = bpy.context.active_object; o.name = 'plShaft'; assign(o, STONE); parent(o, pil)
lp('plTop', 'cube', (0.2, 0, 5.6), (0.9, 0.9, 0.25), STONE, pil, rot=(0.15, 0.1, 0.2))
export(HERE)
