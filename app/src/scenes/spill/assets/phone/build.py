# SPILL phone: 'interior' (the cursor's cell, 1 unit = cursor height, floor at z=0, glass plane at y=-0.6)
# and 'exterior' (the handset seen from outside, 1 unit = 1 cm). Blender Z up, front = -Y.
import bpy, os, sys, math, random
sys.dont_write_bytecode = True; HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.dirname(HERE))
from _bl import *
reset(); R = random.Random(7)
BOARD = mat('Board', (0.018, 0.02, 0.016), 0.55)
GOLD = mat('Gold', (1.0, 0.72, 0.35), 0.28, metal=1.0)
COPPER = mat('Copper', (0.95, 0.5, 0.3), 0.35, metal=1.0)
CHIP = mat('Chip', (0.035, 0.035, 0.04), 0.42)
CERAM = mat('Ceramic', (0.62, 0.5, 0.36), 0.55)
SHIELD = mat('Shield', (0.72, 0.72, 0.7), 0.32, metal=1.0)
SCRATCH = mat('Scratch', (0.95, 0.95, 0.92), 0.2, metal=1.0)
RIBBON = mat('Ribbon', (0.85, 0.45, 0.06), 0.45)
PHOS = mat('Phosphor', (1.0, 0.85, 0.55), 0.4)
SILK = mat('Silk', (0.86, 0.84, 0.78), 0.6)
RUB = mat('Rubber', (0.03, 0.03, 0.03), 0.8)
ALU = mat('Alu', (0.55, 0.56, 0.6), 0.28, metal=1.0)
SCREEN = mat('Screen', (0.01, 0.01, 0.012), 0.08)
LENS = mat('Lens', (0.01, 0.012, 0.02), 0.1)

inter = empty('interior'); inter['fx_part'] = 'interior'
def add(o, part=None):
    parent(o, inter)
    if part: o['fx_part'] = part
    return o
add(box('board', (18, 14, 0.4), (0, 5, -0.2), BOARD))
# gold traces and pads on the board
for i in range(70):
    x0, y0 = R.uniform(-8.5, 8.5), R.uniform(-1.5, 11.5); L = R.uniform(0.6, 3.5); horiz = R.random() < 0.5
    add(box(f'tr{i}', ((L, 0.035, 0.012) if horiz else (0.035, L, 0.012)), (x0, y0, 0.006), COPPER))
for i in range(90):
    add(box(f'pad{i}', (0.12, 0.12, 0.02), (R.uniform(-8.5, 8.5), R.uniform(-1.5, 11.5), 0.01), GOLD))
# chip towers: the canyon walls either side of the cursor's spot (x=0, y=1)
chips = [(-4.2, 3.0, 2.2, 2.0, 3.2), (-6.8, 5.5, 2.6, 2.6, 4.6), (4.0, 3.6, 2.4, 2.2, 2.6), (6.6, 6.2, 2.8, 2.8, 5.2),
         (-2.6, 8.5, 3.0, 2.4, 6.0), (2.4, 9.5, 3.4, 2.8, 7.0), (-7.4, 1.0, 1.4, 1.6, 1.6), (7.2, 1.6, 1.6, 1.6, 1.4)]
for i, (x, y, w, d, h) in enumerate(chips):
    add(box(f'chip{i}', (w, d, h), (x, y, h / 2), CHIP, bev=0.04, seg=2), f'chip{i}')
    for j in range(int(h / 0.32)):  # gold legs up the sides, like windows
        for s in (-1, 1):
            add(box(f'leg{i}_{j}_{s}', (0.06, d * 0.8, 0.12), (x + s * (w / 2 + 0.03), y, 0.25 + j * 0.32), GOLD))
    t = text_mesh('NIMBUS', 'Archivo-w1000-900.ttf', size=w * 0.16, extrude=0.01, bevel_d=0.0, name=f'lbl{i}')
    t.location = (x, y - d / 2 - 0.012, h * 0.82); assign(t, SILK); add(t)
# capacitor rows (ceramic SMD blocks) as low walls along the path
for i in range(22):
    x = -2.4 + (i % 11) * 0.48; y = -0.2 + (i // 11) * 4.2
    add(box(f'cap{i}', (0.32, 0.18, 0.2), (x, y, 0.1), CERAM, bev=0.02))
    for s in (-1, 1): add(box(f'capend{i}_{s}', (0.06, 0.19, 0.21), (x + s * 0.17, y, 0.105), SHIELD))
# shield wall behind: brushed steel with tally scratches (it has been reset before)
add(box('shield', (16, 0.3, 9), (0, 12.2, 4.5), SHIELD), 'shield')
for g in range(9):
    gx, gz = -6.5 + (g % 5) * 3.0, 6.2 - (g // 5) * 1.8
    for k in range(4):
        add(box(f'tally{g}_{k}', (0.05, 0.02, 0.9), (gx + k * 0.22, 12.04, gz), SCRATCH))
    add(box(f'slash{g}', (1.1, 0.02, 0.05), (gx + 0.33, 12.04, gz), SCRATCH, rot=(0, math.radians(-38), 0)))
# warm LED lamp on a stalk (the cell's only light), and the screw
add(cyl('lampstalk', 0.05, 3.2, (-2.0, 2.2, 1.6), SHIELD, verts=12))
add(box('lamp', (0.5, 0.3, 0.22), (-2.0, 2.2, 3.3), CERAM, bev=0.03), 'lamp')
add(box('lampled', (0.34, 0.31, 0.08), (-2.0, 2.2, 3.18), PHOS), 'lampled')
add(cyl('screw', 0.55, 0.3, (2.3, 0.6, 0.15), SHIELD, verts=48, bev=0.04), 'screw')
for a in (0, 90): add(box(f'cross{a}', (0.62, 0.1, 0.12), (2.3, 0.6, 0.3), CHIP, rot=(0, 0, math.radians(a))))
# ribbon-cable hammock slung between two chips + hanging cable vines
def curve(name, pts, w, m, depth=0.01):
    cu = bpy.data.curves.new(name, 'CURVE'); cu.dimensions = '3D'; sp = cu.splines.new('BEZIER'); sp.bezier_points.add(len(pts) - 1)
    for p, c in zip(sp.bezier_points, pts): p.co = c; p.handle_left_type = p.handle_right_type = 'AUTO'
    cu.extrude = w; cu.bevel_depth = depth; ob = bpy.data.objects.new(name, cu); bpy.context.collection.objects.link(ob)
    select(ob); bpy.ops.object.convert(target='MESH'); ob = bpy.context.active_object; assign(ob, m); smooth(ob); return ob
add(curve('hammock', [(-3.1, 3.0, 2.0), (-1.2, 2.6, 1.2), (0.8, 2.8, 1.5), (2.8, 3.4, 1.9)], 0.35, RIBBON, 0.0), 'hammock')
for i in range(7):
    x = R.uniform(-7, 7); y = R.uniform(4, 11); top = 9.5
    add(curve(f'vine{i}', [(x, y, top), (x + R.uniform(-0.6, 0.6), y - 0.4, top - 2.5), (x + R.uniform(-0.8, 0.8), y - 0.8, top - R.uniform(4, 6.5))], 0.0, RUB, 0.06))
add(box('ceiling', (18, 14, 0.3), (0, 5, 9.6), BOARD))

ext = empty('exterior'); ext['fx_part'] = 'exterior'
def xadd(o, part=None):
    parent(o, ext)
    if part: o['fx_part'] = part
    return o
xadd(box('frame', (7.2, 0.8, 15.2), (0, 0, 0), ALU, bev=0.9, seg=8), 'frame')
xadd(box('screen', (6.9, 0.05, 14.9), (0, -0.4, 0), SCREEN, bev=0.6, seg=6), 'screen')
xadd(box('bump', (2.8, 0.25, 2.8), (-1.9, 0.48, 5.6), ALU, bev=0.5, seg=6))
for i, (x, z) in enumerate([(-2.55, 6.25), (-1.25, 6.25), (-2.55, 4.95)]):
    xadd(cyl(f'cam{i}', 0.48, 0.2, (x, 0.62, z), LENS, rot=(math.radians(90), 0, 0), verts=48, bev=0.05))
for i, z in enumerate((3.5, 1.6)): xadd(box(f'btn{i}', (0.15, 0.4, 1.2 if i else 0.8), (3.65, 0, z), ALU, bev=0.06))
export(HERE)
