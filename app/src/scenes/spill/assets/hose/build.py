# SPILL Rubber-hose Town kit (1930s CARTOON): pie-eyed cat (body/head/hat; limbs are engine hoses), singing flower,
# bouncing house with window-eyes and door-mouth, white gloves. Flat B/W + one tint. Parts: cat, catHead, hat, flower, fFace, house, glove.
import bpy, os, sys, math
sys.dont_write_bytecode = True; HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.dirname(HERE))
from _bl import *
reset()
BLK = mat('HoseBlack', (0.03, 0.03, 0.03), 0.6); WHT = mat('HoseWhite', (0.97, 0.95, 0.9), 0.6)
GRY = mat('HoseGrey', (0.55, 0.53, 0.5), 0.6); TNT = mat('HoseTint', (0.85, 0.25, 0.2), 0.6)

def blob(name, loc, scale, m, par, rot=(0, 0, 0), seg=24):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=seg // 2, radius=1, location=loc)
    o = bpy.context.active_object; o.name = name; o.scale = scale; o.rotation_euler = rot
    select(o); bpy.ops.object.transform_apply(scale=True, rotation=True); assign(o, m); smooth(o, 80); parent(o, par); return o
def cone(name, loc, r, d, m, par, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cone_add(vertices=24, radius1=r, depth=d, location=loc, rotation=rot); o = bpy.context.active_object; o.name = name; assign(o, m); smooth(o, 60); parent(o, par); return o

cat = empty('cat'); cat['fx_part'] = 'cat'
blob('cBody', (0, 0, 1.3), (0.62, 0.55, 0.8), BLK, cat); blob('cBelly', (0.38, 0, 1.2), (0.3, 0.38, 0.5), WHT, cat)
for s in (1, -1): blob(f'cShorts{s}', (0, s * 0.2, 0.72), (0.5, 0.35, 0.3), TNT, cat)
for s in (1, -1): blob(f'cBtn{s}', (0.5, s * 0.18, 0.78), (0.07, 0.07, 0.07), WHT, cat)
head = empty('catHead'); head['fx_part'] = 'catHead'; head.location = (0, 0, 2.6); parent(head, cat)
blob('hSkull', (0, 0, 2.6), (0.7, 0.75, 0.65), BLK, head)
blob('hMask', (0.42, 0, 2.45), (0.38, 0.55, 0.38), WHT, head)
for s in (1, -1):
    blob(f'hEye{s}', (0.55, s * 0.2, 2.75), (0.14, 0.12, 0.26), WHT, head)
    blob(f'hPie{s}', (0.66, s * 0.2, 2.72), (0.06, 0.08, 0.18), BLK, head)
    cone(f'hEar{s}', (-0.05, s * 0.45, 3.25), 0.28, 0.6, BLK, head, rot=(s * 0.45, 0, 0))
blob('hNose', (0.82, 0, 2.5), (0.12, 0.14, 0.1), BLK, head)
blob('hGrin', (0.72, 0, 2.28), (0.12, 0.35, 0.08), BLK, head)
hat = empty('hat'); hat['fx_part'] = 'hat'; hat.location = (0, 0, 3.2); parent(hat, head)
cyl('hatBrim', 0.75, 0.06, loc=(0, 0, 3.2), m=BLK); bpy.context.active_object.name = 'hatBrim'; parent(bpy.context.active_object, hat)
cyl('hatTop', 0.45, 0.7, loc=(0, 0, 3.55), m=BLK); parent(bpy.context.active_object, hat)
cyl('hatBand', 0.46, 0.12, loc=(0, 0, 3.28), m=TNT); parent(bpy.context.active_object, hat)

glove = empty('glove'); glove['fx_part'] = 'glove'
blob('gPalm', (0, 0, 0), (0.28, 0.12, 0.25), WHT, glove)
for i in range(3): blob(f'gF{i}', (0.25, 0, -0.12 + 0.12 * i), (0.14, 0.08, 0.06), WHT, glove)
blob('gThumb', (0.05, 0, 0.27), (0.07, 0.07, 0.14), WHT, glove)
for i in range(3): blob(f'gCuff{i}', (-0.28, 0, 0), (0.08, 0.22, 0.28), WHT, glove)

flower = empty('flower'); flower['fx_part'] = 'flower'
cyl('fStem', 0.06, 2.2, loc=(0, 0, 1.1), m=BLK); parent(bpy.context.active_object, flower)
for s in (1, -1): blob(f'fLeaf{s}', (0, s * 0.35, 0.9), (0.08, 0.35, 0.15), GRY, flower, rot=(s * 0.4, 0, 0))
face = empty('fFace'); face['fx_part'] = 'fFace'; face.location = (0, 0, 2.4); parent(face, flower)
for i in range(8):
    a = i * math.tau / 8; blob(f'fPetal{i}', (0, 0.62 * math.cos(a), 2.4 + 0.62 * math.sin(a)), (0.08, 0.32, 0.32), WHT, face)
blob('fDisc', (0.05, 0, 2.4), (0.12, 0.42, 0.42), TNT, face)
for s in (1, -1): blob(f'fEye{s}', (0.18, s * 0.14, 2.52), (0.04, 0.06, 0.11), BLK, face)
blob('fMouth', (0.18, 0, 2.25), (0.04, 0.14, 0.09), BLK, face)

house = empty('house'); house['fx_part'] = 'house'
box('hWall', (3, 2.6, 3.4), loc=(0, 0, 1.7), m=WHT, bev=0.25); parent(bpy.context.active_object, house)
cone('hRoof', (0, 0, 4.2), 2.4, 1.8, BLK, house)
for s in (1, -1):
    box(f'hWin{s}', (0.1, 0.6, 0.9), loc=(1.52, s * 0.62, 2.4), m=BLK, bev=0.08); parent(bpy.context.active_object, house)
    blob(f'hShine{s}', (1.58, s * 0.5, 2.6), (0.03, 0.1, 0.14), WHT, house)
box('hDoor', (0.1, 0.9, 1.3), loc=(1.52, 0, 0.75), m=TNT, bev=0.3); parent(bpy.context.active_object, house)
cyl('hChim', 0.25, 1.4, loc=(-0.8, 0.7, 4.4), m=GRY); parent(bpy.context.active_object, house)
export(HERE)
