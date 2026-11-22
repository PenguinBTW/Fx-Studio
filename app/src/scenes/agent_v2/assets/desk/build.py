# S4 desk props, 1 unit = 10 cm, Blender Z up (glTF: engine +Z = Blender -Y, the front faces the camera).
# Every prop is one root node; animated parts are child nodes whose origin is their pivot.
# Roots: pen, scissors(sc_a, sc_b), stamp, inkpad, floppy, drive(drive_led), deck(deck_key0..3, deck_spool0/1,
# deck_knob, deck_led), lock(lock_shackle), bell(bell_btn, bell_dome), mag(mag_lens), matchbox, match, plug, mug.
import bpy, os, sys, math, bmesh
sys.dont_write_bytecode = True; HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.dirname(HERE))
from _bl import *
reset()
TAU = math.tau
RES = mat('Resin', (0.008, 0.008, 0.01), rough=0.12); GOLD = mat('Gold', (1.0, 0.7, 0.34), rough=0.22, metal=1)
STEEL = mat('Steel', (0.82, 0.82, 0.85), rough=0.16, metal=1); GRIP = mat('Grip', (0.03, 0.03, 0.035), rough=0.45)
WOOD = mat('WoodDark', (0.16, 0.07, 0.03), rough=0.35); RUB = mat('Rubber', (0.3, 0.03, 0.02), rough=0.9)
FELT = mat('Felt', (0.5, 0.015, 0.02), rough=1.0); TIN = mat('Tin', (0.55, 0.55, 0.58), rough=0.32, metal=1)
DISK = mat('Disk', (0.02, 0.05, 0.14), rough=0.32); SHUT = mat('Shutter', (0.78, 0.79, 0.82), rough=0.22, metal=1)
LAB = mat('Label', (0.93, 0.91, 0.86), rough=0.8); BEIGE = mat('Beige', (0.72, 0.66, 0.55), rough=0.5)
DARK = mat('Dark', (0.012, 0.012, 0.012), rough=0.7); GLASS = mat('Glass', (0.05, 0.05, 0.06), rough=0.03)
LEDG = mat('LedG', (0.05, 0.2, 0.05), emit=(0.2, 1.0, 0.3), strength=0.0); LEDR = mat('LedR', (0.2, 0.03, 0.02), emit=(1.0, 0.15, 0.08), strength=0.0)
ALU = mat('Alu', (0.6, 0.61, 0.63), rough=0.38, metal=1); KRED = mat('KeyRed', (0.75, 0.04, 0.02), rough=0.3)
KSIL = mat('KeySilver', (0.75, 0.75, 0.77), rough=0.28, metal=1); BRASS = mat('Brass', (0.88, 0.62, 0.26), rough=0.28, metal=1)
CHROME = mat('Chrome', (0.92, 0.92, 0.94), rough=0.05, metal=1); PLA = mat('Plastic', (0.025, 0.025, 0.03), rough=0.4)
LENS = mat('Lens', (0.9, 0.95, 1.0), rough=0.0); STICK = mat('Stick', (0.85, 0.66, 0.4), rough=0.8)
HEAD = mat('MatchHead', (0.5, 0.03, 0.02), rough=0.6); STRK = mat('Striker', (0.18, 0.1, 0.07), rough=0.95)
CARD = mat('Card', (0.85, 0.14, 0.06), rough=0.6); CASS = mat('Cassette', (0.9, 0.87, 0.8), rough=0.45)
TAPE = mat('Tape', (0.1, 0.055, 0.03), rough=0.4); MUG = mat('Ceramic', (0.06, 0.2, 0.22), rough=0.18)

def obj(name, verts, faces, m):
    me = bpy.data.meshes.new(name); me.from_pydata(verts, [], faces); me.update()
    ob = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(ob); assign(ob, m); return ob

def clean(ob, recalc=True):
    bm = bmesh.new(); bm.from_mesh(ob.data); bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    if recalc: bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(ob.data); bm.free(); ob.data.update()

def lathe(name, prof, m, seg=64, loc=(0, 0, 0), rot=(0, 0, 0), sx=1.0, sy=1.0, ang=40):
    v, f, n = [], [], len(prof)
    for i in range(seg):
        a = TAU * i / seg
        for r, h in prof: v.append((r * math.cos(a) * sx, r * math.sin(a) * sy, h))
    for i in range(seg):
        j = (i + 1) % seg
        for k in range(n - 1): f.append((i * n + k, j * n + k, j * n + k + 1, i * n + k + 1))
    ob = obj(name, v, f, m); clean(ob); ob.rotation_euler = rot; ob.location = loc; smooth(ob, ang); return ob

def slab(name, pts, thick, m, z0=0.0, bev=0.0):
    bm = bmesh.new(); vs = [bm.verts.new((x, y, z0)) for x, y in pts]; face = bm.faces.new(vs)
    ex = bmesh.ops.extrude_face_region(bm, geom=[face]); top = [e for e in ex['geom'] if isinstance(e, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, verts=top, vec=(0, 0, thick)); bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free(); ob = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(ob)
    assign(ob, m)
    if bev > 0: bevel(ob, bev, 2)
    smooth(ob, 30); return ob

def rb(name, w, d, h, m, x=0.0, y=0.0, z=0.0, bev=0.02, rot=(0, 0, 0)):
    """rounded box with its bottom at z"""
    return box(name, (w, d, h), loc=(x, y, z + h / 2), m=m, bev=min(bev, 0.45 * min(w, d, h)), rot=rot)

def torus(name, R, r, m, loc=(0, 0, 0), rot=(0, 0, 0), half=False, sx=1.0):
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r, major_segments=64, minor_segments=16)
    ob = bpy.context.active_object; ob.name = name
    if half:
        bm = bmesh.new(); bm.from_mesh(ob.data); bmesh.ops.delete(bm, geom=[q for q in bm.verts if q.co.y < -1e-4], context='VERTS'); bm.to_mesh(ob.data); bm.free()
    ob.scale = (sx, 1, 1); ob.rotation_euler = rot; ob.location = loc; assign(ob, m); smooth(ob, 40); return ob

def fin(parts, name, loc=(0, 0, 0)):
    """join parts (built around the pivot at the origin) into one object, origin at the pivot, then place it at loc"""
    bpy.ops.object.select_all(action='DESELECT')
    for p in parts: p.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    if len(parts) > 1: bpy.ops.object.join()
    ob = bpy.context.active_object; ob.name = name; ob.data.name = name; ob.location = loc; return ob

# ---- fountain pen: nib tip at the origin, axis +Z
pen = fin([
    lathe('nib', [(0, 0), (0.01, 0.015), (0.028, 0.08), (0.04, 0.15), (0, 0.15)], GOLD, sy=0.45),
    lathe('sect', [(0, 0.13), (0.044, 0.13), (0.05, 0.2), (0.055, 0.42), (0.06, 0.45), (0, 0.45)], RES),
    lathe('ring1', [(0, 0.45), (0.066, 0.45), (0.069, 0.47), (0.066, 0.49), (0, 0.49)], GOLD),
    lathe('barrel', [(0, 0.49), (0.066, 0.49), (0.07, 0.8), (0.068, 1.15), (0.06, 1.25), (0.035, 1.3), (0, 1.31)], RES),
    lathe('ring2', [(0, 0.97), (0.0735, 0.97), (0.0745, 1.0), (0.0735, 1.03), (0, 1.03)], GOLD),
    rb('clip', 0.018, 0.045, 0.42, GOLD, x=0.082, z=0.72, bev=0.008),
    lathe('clipball', [(0, 0.7), (0.02, 0.705), (0.025, 0.72), (0.02, 0.735), (0, 0.74)], GOLD, loc=(0.082, 0, 0)),
], 'pen')

# ---- scissors: two halves pivoting about Z at the screw
def half(s, z0, name):
    b = slab(name + '_bl', [(-0.08, 0.055 * s), (0.25, 0.065 * s), (0.8, 0.045 * s), (1.35, 0.012 * s), (1.46, 0.0), (1.3, -0.014 * s), (0.8, -0.02 * s), (0.25, -0.03 * s), (-0.08, -0.05 * s)], 0.024, STEEL, z0=z0, bev=0.005)
    ang = math.atan2(0.17 * s, -0.4)
    arm = rb(name + '_arm', 0.44, 0.085, 0.05, GRIP, x=-0.2, y=0.085 * s, z=z0 - 0.012, bev=0.02, rot=(0, 0, ang + math.pi))
    ring = torus(name + '_ring', 0.19, 0.048, GRIP, loc=(-0.6, 0.2 * s, z0 + 0.012), sx=1.35)
    return fin([b, arm, ring], name)
sa = half(1, 0.0, 'sc_a'); sb = half(-1, 0.026, 'sc_b')
screw = cyl('screw', 0.042, 0.075, loc=(0, 0, 0.025), m=STEEL, bev=0.01); sa = fin([sa, screw], 'sc_a')
sc = empty('scissors'); parent(sa, sc); parent(sb, sc)

# ---- rubber stamp + ink pad
stamp = fin([rb('rub', 0.74, 0.5, 0.06, RUB, bev=0.01), rb('blk', 0.8, 0.56, 0.2, WOOD, z=0.06, bev=0.03),
             lathe('fer', [(0, 0.26), (0.13, 0.26), (0.135, 0.28), (0.13, 0.3), (0, 0.3)], BRASS),
             lathe('hdl', [(0, 0.3), (0.1, 0.3), (0.07, 0.36), (0.065, 0.45), (0.09, 0.53), (0.17, 0.63), (0.2, 0.72), (0.18, 0.81), (0.1, 0.87), (0, 0.885)], WOOD)], 'stamp')
inkpad = fin([rb('tin', 1.0, 0.7, 0.06, TIN, bev=0.025), rb('felt', 0.88, 0.58, 0.012, FELT, z=0.055, bev=0.004)], 'inkpad')

# ---- 3.5" floppy (shutter toward +Y = into the drive) and drive (front at -Y)
floppy = fin([rb('shell', 0.9, 0.94, 0.034, DISK, bev=0.012), rb('shut', 0.4, 0.33, 0.006, SHUT, x=0.04, y=0.31, z=0.031, bev=0.002),
              rb('slit', 0.09, 0.2, 0.004, DARK, x=0.07, y=0.33, z=0.036, bev=0.001), rb('lab', 0.72, 0.5, 0.004, LAB, y=-0.17, z=0.031, bev=0.002),
              rb('wp', 0.06, 0.06, 0.004, DARK, x=-0.38, y=0.4, z=0.032, bev=0.001)], 'floppy')
drive = fin([rb('dbody', 1.3, 1.5, 0.34, BEIGE, bev=0.04), rb('bezel', 1.26, 0.03, 0.3, PLA, y=-0.75, z=0.02, bev=0.01),
             rb('slot', 1.0, 0.05, 0.05, DARK, y=-0.765, z=0.18, bev=0.008), rb('ej', 0.12, 0.03, 0.05, BEIGE, x=0.42, y=-0.77, z=0.08, bev=0.01)], 'drive')
dled = fin([rb('dl', 0.07, 0.02, 0.03, LEDG, bev=0.006)], 'drive_led', loc=(-0.45, -0.775, 0.09)); parent(dled, drive)

# ---- portable cassette recorder, front edge at -Y
deck = fin([rb('cbody', 3.0, 1.8, 0.55, ALU, bev=0.07), rb('top', 2.9, 1.7, 0.03, PLA, z=0.54, bev=0.012),
            rb('cass', 1.42, 0.74, 0.012, CASS, x=-0.55, y=0.25, z=0.565, bev=0.006), rb('win', 0.62, 0.26, 0.004, DARK, x=-0.55, y=0.25, z=0.576, bev=0.002),
            rb('glass', 1.52, 0.84, 0.012, GLASS, x=-0.55, y=0.25, z=0.64, bev=0.006),
            *[torus('gr%d' % k, 0.1 + 0.07 * k, 0.012, PLA, loc=(0.95, 0.05, 0.575)) for k in range(4)],
            rb('jack', 0.04, 0.12, 0.12, DARK, x=1.5, y=0.2, z=0.25, bev=0.01)], 'deck')
for i in range(4):
    k = fin([rb('k%d' % i, 0.36, 0.42, 0.12, KRED if i == 1 else KSIL, y=-0.21, bev=0.03)], 'deck_key%d' % i, loc=(-1.15 + 0.42 * i, -0.39, 0.55)); parent(k, deck)
for i, x in enumerate((-0.85, -0.25)):
    teeth = [rb('t%d_%d' % (i, j), 0.03, 0.1, 0.03, LAB, x=0.045 * math.cos(j * TAU / 6), y=0.045 * math.sin(j * TAU / 6), bev=0.005, rot=(0, 0, j * TAU / 6)) for j in range(6)]
    sp = fin([lathe('wound%d' % i, [(0, 0), (0.2 - 0.06 * i, 0), (0.2 - 0.06 * i, 0.02), (0, 0.02)], TAPE), lathe('hub%d' % i, [(0, 0.02), (0.07, 0.02), (0.07, 0.035), (0, 0.035)], LAB), *teeth], 'deck_spool%d' % i, loc=(x, 0.25, 0.577))
    parent(sp, deck)
knob = fin([lathe('kn', [(0, 0), (0.16, 0), (0.165, 0.02), (0.16, 0.16), (0.14, 0.18), (0, 0.18)], ALU, seg=48), rb('ind', 0.02, 0.12, 0.01, KRED, y=0.06, z=0.18, bev=0.004)], 'deck_knob', loc=(1.15, 0.6, 0.57))
parent(knob, deck)
cled = fin([lathe('cl', [(0, 0), (0.035, 0), (0.035, 0.02), (0.02, 0.035), (0, 0.04)], LEDR, seg=24)], 'deck_led', loc=(0.45, -0.55, 0.57)); parent(cled, deck)

# ---- padlock (standing; shackle pivot at its base)
lock = fin([rb('lb', 0.6, 0.24, 0.5, BRASS, bev=0.06), rb('kh', 0.05, 0.02, 0.14, DARK, y=-0.12, z=0.12, bev=0.01),
            lathe('khr', [(0, 0), (0.05, 0), (0.05, 0.02), (0, 0.02)], DARK, loc=(0, -0.115, 0.3), rot=(math.pi / 2, 0, 0))], 'lock')
legs = [cyl('lg%d' % s, 0.045, 0.32, loc=(0.19 * s, 0, 0.16), m=CHROME) for s in (-1, 1)]
shk = fin([torus('arc', 0.19, 0.045, CHROME, loc=(0, 0, 0.32), rot=(math.pi / 2, 0, 0), half=True), *legs], 'lock_shackle', loc=(0, 0, 0.36)); parent(shk, lock)

# ---- desk bell
bell = fin([lathe('bb', [(0, 0), (0.44, 0), (0.455, 0.04), (0.43, 0.1), (0, 0.1)], PLA)], 'bell')
dome = fin([lathe('dm', [(0.36 * math.cos(a * math.pi / 32), 0.31 * math.sin(a * math.pi / 32)) for a in range(17)], CHROME)], 'bell_dome', loc=(0, 0, 0.1)); parent(dome, bell)
btn = fin([lathe('bt', [(0, 0), (0.028, 0), (0.028, 0.08), (0.06, 0.1), (0.062, 0.12), (0.05, 0.135), (0, 0.14)], CHROME, seg=32)], 'bell_btn', loc=(0, 0, 0.41)); parent(btn, bell)

# ---- magnifier lying flat; handle along +X
mag = fin([torus('rim', 0.5, 0.045, BRASS),
           lathe('mh', [(0, 0), (0.05, 0), (0.07, 0.15), (0.068, 0.8), (0.08, 0.98), (0.05, 1.04), (0, 1.05)], WOOD, loc=(0.53, 0, 0), rot=(0, math.pi / 2, 0)),
           lathe('mf', [(0, 0), (0.055, 0), (0.055, 0.12), (0, 0.12)], BRASS, loc=(0.5, 0, 0), rot=(0, math.pi / 2, 0))], 'mag')
lens = fin([lathe('ln', [(0, -0.03), (0.47, -0.006), (0.475, 0), (0.47, 0.006), (0, 0.03)], LENS)], 'mag_lens'); parent(lens, mag)

# ---- matchbox, match (origin at the head, stick toward -X), 3.5 mm jack (tip at origin, cable toward +X)
mbox = fin([rb('mb', 0.56, 0.38, 0.16, CARD, bev=0.012), rb('s1', 0.5, 0.012, 0.1, STRK, y=0.19, z=0.03, bev=0.003), rb('s2', 0.5, 0.012, 0.1, STRK, y=-0.19, z=0.03, bev=0.003)], 'matchbox')
match = fin([rb('st', 0.9, 0.04, 0.04, STICK, x=-0.47, z=-0.02, bev=0.006), lathe('hd', [(0, -0.05), (0.03, -0.04), (0.045, 0), (0.03, 0.04), (0, 0.05)], HEAD, rot=(0, math.pi / 2, 0))], 'match')
plug = fin([lathe('tip', [(0, 0), (0.02, 0.005), (0.025, 0.03), (0.02, 0.04), (0.025, 0.05), (0.025, 0.1), (0.02, 0.105), (0.025, 0.11), (0.025, 0.17), (0, 0.17)], STEEL, rot=(0, math.pi / 2, 0)),
            lathe('hs', [(0, 0.17), (0.06, 0.17), (0.065, 0.2), (0.065, 0.42), (0.04, 0.5), (0.035, 0.6), (0, 0.6)], PLA, rot=(0, math.pi / 2, 0)),
            cyl('cab', 0.024, 6.0, loc=(3.6, 0, 0), m=PLA, rot=(0, math.pi / 2, 0), verts=16)], 'plug')

# ---- mug (set dressing)
mug = fin([lathe('mg', [(0, 0.01), (0.3, 0), (0.33, 0.04), (0.34, 0.8), (0.36, 0.84), (0.33, 0.85), (0.31, 0.82), (0.31, 0.1), (0, 0.1)], MUG),
           torus('mh2', 0.2, 0.045, MUG, loc=(0.36, 0, 0.45), rot=(math.pi / 2, 0, 0), sx=0.8)], 'mug')

for o in bpy.context.scene.objects: o.select_set(False)
export(HERE)
