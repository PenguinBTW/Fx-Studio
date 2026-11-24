# REEDBED hero: reed clumps + cattail reeds, a worn jetty, a flat-bottomed
# punt, a grey heron (wings separate for the flare beat), lily pads, a snag.
# Parts: reeds, reedTall, jetty, punt, heron, lily, snag.
import bpy, math, random, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
from _bl import reset, mat, select, assign, smooth, bevel, box, cyl, empty, parent, tris, export

reset()
RNG = random.Random(77)

# ---------- materials (factors only; scene adds texture breakup) ----------
STEM   = mat('ReedStem',  (0.42, 0.44, 0.28), rough=0.9)
STEM2  = mat('ReedDry',   (0.55, 0.46, 0.26), rough=0.95)
LEAF   = mat('ReedLeaf',  (0.30, 0.40, 0.22), rough=0.9)
CAT    = mat('Cattail',   (0.24, 0.16, 0.10), rough=0.98)
SEED   = mat('SeedHead',  (0.62, 0.52, 0.34), rough=0.9)
WOOD   = mat('JettyWood', (0.30, 0.24, 0.17), rough=0.95)
WOOD2  = mat('JettyPale', (0.42, 0.36, 0.26), rough=0.95)
PUNT   = mat('PuntWood',  (0.26, 0.20, 0.14), rough=0.9)
PUNT2  = mat('PuntGun',   (0.36, 0.30, 0.22), rough=0.9)
HERON  = mat('HeronBody', (0.42, 0.46, 0.50), rough=0.85)
HERON2 = mat('HeronWing', (0.32, 0.36, 0.42), rough=0.85)
HERON3 = mat('HeronNeck', (0.62, 0.64, 0.66), rough=0.85)
BEAK   = mat('Beak',      (0.72, 0.55, 0.20), rough=0.6)
LEG    = mat('Legs',      (0.18, 0.16, 0.14), rough=0.9)
LILY   = mat('LilyPad',   (0.16, 0.30, 0.18), rough=0.8)
LILYF  = mat('LilyFlow',  (0.85, 0.72, 0.80), rough=0.6)
SNAG   = mat('Snag',      (0.22, 0.18, 0.14), rough=0.95)

root = empty('reedbed'); root['fx_part'] = 'reedbed'

# ---------- reed clump archetype: ~13 leaning stems + blades ----------
reeds = empty('reeds'); reeds['fx_part'] = 'reeds'; parent(reeds, root)
for i in range(13):
    a = RNG.uniform(0, 6.283); r = RNG.uniform(0.05, 0.85)
    x, y = math.cos(a) * r, math.sin(a) * r
    h = RNG.uniform(1.6, 2.6)
    lean = RNG.uniform(0.0, 0.14)
    s = cyl(f'rstem{i}', 0.016, h, (x, y, h / 2), STEM if i % 3 else STEM2,
            rot=(lean * math.cos(a), lean * math.sin(a), 0), verts=7)
    parent(s, reeds)
    # blade leaf halfway up — narrow vertical blade leaning out
    if i % 2 == 0:
        bl = box(f'rleaf{i}', (0.035, 0.008, RNG.uniform(0.7, 1.1)),
                 (x + 0.05, y, h * 0.38), LEAF, bev=0.004, seg=1,
                 rot=(RNG.uniform(-0.55, -0.15), 0, RNG.uniform(0, 6.28)))
        parent(bl, reeds)
# a few short broken stems
for i in range(3):
    a = RNG.uniform(0, 6.283); r = RNG.uniform(0.2, 0.7)
    s = cyl(f'rstub{i}', 0.018, RNG.uniform(0.3, 0.6),
            (math.cos(a) * r, math.sin(a) * r, 0.25), STEM2, verts=7)
    parent(s, reeds)

# ---------- tall cattail clump: stems + brown heads + fluff ----------
reedsT = empty('reedTall'); reedsT['fx_part'] = 'reedTall'; parent(reedsT, root)
for i in range(8):
    a = RNG.uniform(0, 6.283); r = RNG.uniform(0.05, 0.6)
    x, y = math.cos(a) * r, math.sin(a) * r
    h = RNG.uniform(2.2, 3.0)
    lean = RNG.uniform(0.0, 0.10)
    s = cyl(f'tstem{i}', 0.014, h, (x, y, h / 2), STEM2,
            rot=(lean * math.cos(a), lean * math.sin(a), 0), verts=7)
    parent(s, reedsT)
    if i % 2 == 0:
        # cattail: slim dark brown cigar + thin pale spike above
        c = cyl(f'thead{i}', 0.034, 0.5, (x, y, h + 0.1), CAT, verts=8, bev=0.015)
        parent(c, reedsT)
        sp = cyl(f'tspike{i}', 0.007, 0.34, (x, y, h + 0.46), SEED, verts=6)
        parent(sp, reedsT)
    else:
        # drooping seed plume — thin, angled well off the stem
        p = cyl(f'tplume{i}', 0.028, 0.5, (x + 0.08, y, h + 0.02), SEED,
                rot=(0.65, 0, RNG.uniform(0, 6.28)), verts=6, bev=0.02)
        parent(p, reedsT)

# ---------- jetty: worn posts + uneven planks + rails ----------
jetty = empty('jetty', (-6, -14, 0)); jetty['fx_part'] = 'jetty'; parent(jetty, root)
JX, JY = -6.0, -14.0   # absolute placement (parent() preserves world)
# posts
for i, (px, py) in enumerate([(JX - 0.7, JY), (JX + 0.7, JY), (JX - 0.7, JY - 3.2),
                              (JX + 0.7, JY - 3.2), (JX - 0.7, JY - 6.4), (JX + 0.7, JY - 6.4)]):
    p = cyl(f'jpost{i}', 0.09, 1.7, (px, py, -0.15), WOOD, verts=8, bev=0.02,
            rot=(RNG.uniform(-0.04, 0.04), RNG.uniform(-0.04, 0.04), 0))
    parent(p, jetty)
# planks: 9 boards running -y, slight height+angle jitter
for i in range(9):
    m = WOOD if i % 3 else WOOD2
    pl = box(f'jplank{i}', (1.7, 0.62, 0.07),
             (JX + RNG.uniform(-0.02, 0.02), JY - 0.35 - i * 0.7, 0.72 + RNG.uniform(-0.02, 0.03)),
             m, bev=0.015, seg=1, rot=(RNG.uniform(-0.02, 0.02), 0, RNG.uniform(-0.015, 0.015)))
    parent(pl, jetty)
# side rail on one post pair + a mooring post at the end
rail = box('jrail', (0.07, 6.6, 0.07), (JX - 0.72, JY - 3.2, 1.28), WOOD2, bev=0.01, seg=1)
parent(rail, jetty)
for i in range(3):
    rp = cyl(f'jrailpost{i}', 0.05, 0.6, (JX - 0.72, JY - i * 3.2, 1.0), WOOD, verts=7)
    parent(rp, jetty)
moor = cyl('jmoor', 0.11, 1.5, (JX + 0.85, JY - 6.7, 0.2), WOOD, verts=8, bev=0.03)
parent(moor, jetty)

# ---------- punt: flat-bottomed, squared bow, seat + pole ----------
punt = empty('punt', (-4.2, -9.5, 0.12)); punt['fx_part'] = 'punt'; parent(punt, root)
PX, PY = -4.2, -9.5
hull = box('puntHull', (1.3, 4.2, 0.3), (PX, PY, 0.3), PUNT, bev=0.06, seg=2)
parent(hull, punt)
for sgn in (-1, 1):
    side = box(f'puntSide{sgn}', (0.09, 4.2, 0.42), (PX + sgn * 0.66, PY, 0.55), PUNT2, bev=0.03, seg=1)
    parent(side, punt)
for sgn in (-1, 1):
    end = box(f'puntEnd{sgn}', (1.3, 0.09, 0.42), (PX, PY + sgn * 2.06, 0.55), PUNT2, bev=0.03, seg=1)
    parent(end, punt)
seat = box('puntSeat', (1.1, 0.5, 0.08), (PX, PY - 1.3, 0.62), WOOD2, bev=0.02, seg=1)
parent(seat, punt)
# punting pole resting across the gunwales
pole = cyl('puntPole', 0.035, 4.6, (PX + 0.2, PY + 0.4, 0.78), WOOD2,
           rot=(math.radians(88), 0, math.radians(9)), verts=7)
parent(pole, punt)

# ---------- heron: motionless stance, wings as separate parts ----------
heron = empty('heron', (7.5, -18, 0.0)); heron['fx_part'] = 'heron'; parent(heron, root)
HX, HY = 7.5, -18.0
# legs
for sgn in (-0.12, 0.12):
    lg = cyl(f'hleg{sgn}', 0.02, 0.85, (HX + sgn, HY, 0.42), LEG, verts=6)
    parent(lg, heron)
# body: scaled icosphere
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=0.55, location=(HX, HY, 1.15))
hb = bpy.context.active_object; hb.name = 'hbody'
hb.scale = (0.75, 1.15, 0.72); bpy.ops.object.transform_apply(scale=True)
assign(hb, HERON); smooth(hb); parent(hb, heron)
# S-neck: 3 stacked segments rising to the head
neck1 = cyl('hneck1', 0.07, 0.55, (HX, HY - 0.28, 1.55), HERON3,
            rot=(math.radians(30), 0, 0), verts=8); parent(neck1, heron)
neck2 = cyl('hneck2', 0.06, 0.5, (HX, HY - 0.42, 1.95), HERON3,
            rot=(math.radians(-18), 0, 0), verts=8); parent(neck2, heron)
# head + dagger beak
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=0.16, location=(HX, HY - 0.5, 2.2))
hh = bpy.context.active_object; hh.name = 'hhead'
hh.scale = (0.8, 1.3, 0.9); bpy.ops.object.transform_apply(scale=True)
assign(hh, HERON3); smooth(hh); parent(hh, heron)
bk = cyl('hbeak', 0.025, 0.55, (HX, HY - 0.78, 2.22), BEAK,
         rot=(math.radians(83), 0, 0), verts=6); parent(bk, heron)
# folded wings: slightly scaled spheres on the flanks (named for the flare)
for sgn in (-1, 1):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=0.5,
        location=(HX + sgn * 0.4, HY + 0.05, 1.25))
    wg = bpy.context.active_object; wg.name = f'wing{"L" if sgn < 0 else "R"}'
    wg.scale = (0.35, 1.25, 0.6); bpy.ops.object.transform_apply(scale=True)
    assign(wg, HERON2); smooth(wg); parent(wg, heron)

# ---------- lily pad: notched disc + a flower ----------
lily = empty('lily'); lily['fx_part'] = 'lily'; parent(lily, root)
bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.42, depth=0.025, location=(0, 0, 0.01))
lp = bpy.context.active_object; lp.name = 'lilypad'
lp.scale = (1.0, 1.0, 1.0); assign(lp, LILY); smooth(lp); parent(lp, lily)
# notch wedge
notch = box('lilynotch', (0.3, 0.3, 0.1), (0.38, 0, 0.02), None, bev=0.0, seg=1)
# flower: small cone cluster
fl = cyl('lilyflow', 0.09, 0.14, (0.12, 0.12, 0.08), LILYF, verts=8, bev=0.03)
parent(fl, lily)

# ---------- snag: leaning dead branch poking from the water ----------
snag = empty('snag', (3, -26, 0)); snag['fx_part'] = 'snag'; parent(snag, root)
SX, SY = 3.0, -26.0
tr = cyl('snagtrunk', 0.07, 2.2, (SX, SY, 0.8), SNAG,
         rot=(0, math.radians(14), 0), verts=7); parent(tr, snag)
br1 = cyl('snagbr1', 0.04, 1.1, (SX + 0.25, SY, 1.6), SNAG,
          rot=(0, math.radians(48), 0), verts=6); parent(br1, snag)
br2 = cyl('snagbr2', 0.03, 0.8, (SX - 0.1, SY, 1.35), SNAG,
          rot=(math.radians(30), math.radians(-35), 0), verts=6); parent(br2, snag)

export(HERE)
