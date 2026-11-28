# SPILL Ink Marsh kit (SUMI-E INK): giant heron (gulp rig: beakTop/beakBot/neck/head), reeds, lotus pad + flower, koi.
# Engine renders these as ink: dark wash fill, boiling brush outline. 1 unit = cursor height; heron ~ 14 tall.
import bpy, os, sys, math, mathutils
sys.dont_write_bytecode = True; HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.dirname(HERE))
from _bl import *
reset()
INK = mat('Ink', (0.06, 0.06, 0.08), 0.9)
WASH = mat('InkWash', (0.45, 0.45, 0.5), 0.9)
PAPER = mat('InkPaper', (0.93, 0.9, 0.82), 0.9)
SEAL = mat('InkSeal', (0.8, 0.12, 0.1), 0.9)
PINK = mat('InkLotus', (0.95, 0.6, 0.65), 0.9)

def blob(name, loc, scale, m, par, rot=(0, 0, 0), seg=24):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=seg // 2, radius=1, location=loc)
    o = bpy.context.active_object; o.name = name; o.scale = scale; o.rotation_euler = rot
    select(o); bpy.ops.object.transform_apply(scale=True, rotation=True); assign(o, m); smooth(o, 80); parent(o, par); return o

def seg(name, a, b, r1, r2, m, par, n=10):
    a, b = mathutils.Vector(a), mathutils.Vector(b); d = b - a
    bpy.ops.mesh.primitive_cone_add(vertices=n, radius1=r1, radius2=r2, depth=d.length, location=(a + b) / 2)
    o = bpy.context.active_object; o.name = name; o.rotation_euler = d.to_track_quat('Z', 'Y').to_euler(); assign(o, m); smooth(o, 80); parent(o, par); return o

heron = empty('heron'); heron['fx_part'] = 'heron'
blob('hBody', (0, 0, 8.0), (2.4, 1.2, 1.4), WASH, heron, rot=(0, -0.35, 0))
blob('hWing', (-0.6, 0, 8.3), (2.6, 1.3, 1.1), INK, heron, rot=(0, -0.45, 0))
seg('hTail', (-2.2, 0, 8.6), (-3.6, 0, 7.6), 0.8, 0.1, INK, heron)
for s in (1, -1):
    seg(f'hLegU{s}', (0.2, s * 0.4, 7.0), (0.4, s * 0.45, 3.6), 0.12, 0.08, INK, heron)
    seg(f'hLegD{s}', (0.4, s * 0.45, 3.6), (0.3, s * 0.5, 0.0), 0.08, 0.06, INK, heron)
    for k in (-0.4, 0, 0.5):
        seg(f'hToe{s}{k}', (0.3, s * 0.5, 0.02), (0.3 + 0.9 * math.cos(k), s * 0.5 + 0.9 * math.sin(k), 0.02), 0.05, 0.02, INK, heron, 6)
ON = (1.8, 0, 9.0); OH = (3.0, 0, 13.4)
A = lambda o, p: (o[0] + p[0], o[1] + p[1], o[2] + p[2])
neck = empty('neck'); neck['fx_part'] = 'neck'; neck.location = ON; parent(neck, heron)
pts = [A(ON, q) for q in [(0, 0, 0), (0.9, 0, 1.0), (0.6, 0, 2.2), (-0.2, 0, 3.0), (0.4, 0, 4.0), (1.2, 0, 4.4)]]
for i in range(len(pts) - 1):
    seg(f'nk{i}', pts[i], pts[i + 1], 0.6 - i * 0.07, 0.55 - i * 0.07, PAPER if i % 2 else WASH, neck)
    blob(f'nkJ{i}', pts[i + 1], (0.5 - i * 0.06,) * 3, PAPER, neck)
head = empty('head'); head['fx_part'] = 'head'; head.location = OH; parent(head, neck)
blob('hHead', A(OH, (0.3, 0, 0.1)), (0.75, 0.5, 0.55), PAPER, head)
blob('hCrest', A(OH, (-0.5, 0, 0.35)), (0.9, 0.12, 0.18), INK, head, rot=(0, 0.3, 0))
blob('hEye', A(OH, (0.6, 0.42, 0.25)), (0.12, 0.06, 0.12), INK, head)
blob('hEye2', A(OH, (0.6, -0.42, 0.25)), (0.12, 0.06, 0.12), INK, head)
blob('hCap', A(OH, (0.2, 0, 0.55)), (0.6, 0.45, 0.15), SEAL, head)
top = empty('beakTop'); top['fx_part'] = 'beakTop'; top.location = A(OH, (0.9, 0, 0.1)); parent(top, head)
seg('bTop', A(OH, (0.9, 0, 0.22)), A(OH, (4.5, 0, 0.05)), 0.3, 0.02, INK, top, 8)
bot = empty('beakBot'); bot['fx_part'] = 'beakBot'; bot.location = A(OH, (0.9, 0, 0.0)); parent(bot, head)
seg('bBot', A(OH, (0.9, 0, -0.1)), A(OH, (4.3, 0, -0.08)), 0.26, 0.02, WASH, bot, 8)
throat = blob('hThroat', A(OH, (0.4, 0, -0.35)), (0.6, 0.38, 0.4), PAPER, head); throat['fx_part'] = 'throat'
# reed, lotus pad, lotus flower, koi
reed = empty('reed'); reed['fx_part'] = 'reed'
seg('rStem', (0, 0, 0), (0.2, 0, 6.0), 0.07, 0.015, INK, reed, 6)
blob('rHead', (0.18, 0, 5.2), (0.12, 0.12, 0.6), INK, reed)
seg('rLeaf', (0, 0, 0.5), (1.2, 0.2, 3.5), 0.12, 0.01, WASH, reed, 4)
pad = empty('pad'); pad['fx_part'] = 'pad'
bpy.ops.mesh.primitive_cylinder_add(vertices=40, radius=1.4, depth=0.06, location=(0, 0, 0.03)); o = bpy.context.active_object; o.name = 'pDisc'; assign(o, WASH); parent(o, pad)
lotus = empty('lotus'); lotus['fx_part'] = 'lotus'
for i in range(8):
    a = i / 8 * math.tau
    blob(f'lPet{i}', (math.cos(a) * 0.35, math.sin(a) * 0.35, 0.5), (0.45, 0.18, 0.22), PINK, lotus, rot=(0, -0.9, a))
blob('lCore', (0, 0, 0.55), (0.22, 0.22, 0.12), SEAL, lotus)
koi = empty('koi'); koi['fx_part'] = 'koi'
blob('kBody', (0, 0, 0), (1.0, 0.3, 0.32), PAPER, koi)
blob('kSpot', (0.2, 0, 0.18), (0.4, 0.22, 0.14), SEAL, koi)
tail = empty('kTail'); tail['fx_part'] = 'kTail'; tail.location = (-0.9, 0, 0); parent(tail, koi)
blob('kFin', (-1.3, 0, 0), (0.45, 0.05, 0.35), INK, tail)
export(HERE)
