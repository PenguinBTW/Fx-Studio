# SPILL Clay Hollow kit (STOP-MOTION CLAY): snail bus, chunky frog, fat mushroom, coil-pot cactus, market stall.
# Soft lumpy forms (engine adds thumbprints + 12 fps). Parts: snail, shell, frog, mush, cactus, stall. 1 unit = cursor height.
import bpy, os, sys, math
sys.dont_write_bytecode = True; HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.dirname(HERE))
from _bl import *
reset()
SLUG = mat('ClaySlug', (0.55, 0.75, 0.3), 0.85)
SHELL = mat('ClayShell', (0.9, 0.45, 0.25), 0.85)
SHELL2 = mat('ClayShell2', (0.98, 0.78, 0.4), 0.85)
GLASS = mat('ClayWindow', (0.75, 0.9, 1.0), 0.4)
FROG = mat('ClayFrog', (0.3, 0.7, 0.35), 0.85)
WHITE = mat('ClayWhite', (0.95, 0.93, 0.86), 0.85)
BLACK = mat('ClayBlack', (0.05, 0.05, 0.06), 0.6)
RED = mat('ClayRed', (0.85, 0.2, 0.18), 0.85)
STEM = mat('ClayStem', (0.95, 0.88, 0.7), 0.85)
CACT = mat('ClayCactus', (0.35, 0.6, 0.45), 0.85)
POT = mat('ClayPot', (0.78, 0.42, 0.28), 0.85)
WOOD = mat('ClayWood', (0.6, 0.4, 0.25), 0.85)

def blob(name, loc, scale, m, par, rot=(0, 0, 0), seg=24):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=seg // 2, radius=1, location=loc)
    o = bpy.context.active_object; o.name = name; o.scale = scale; o.rotation_euler = rot
    select(o); bpy.ops.object.transform_apply(scale=True, rotation=True); assign(o, m); smooth(o, 80); parent(o, par); return o

def ring(name, loc, R, r, m, par, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r, major_segments=32, minor_segments=12, location=loc, rotation=rot)
    o = bpy.context.active_object; o.name = name; assign(o, m); smooth(o, 80); parent(o, par); return o

# snail bus: slug body (6 long) with windows, big spiral shell
snail = empty('snail'); snail['fx_part'] = 'snail'
blob('sBody', (0, 0, 0.55), (3.2, 0.9, 0.55), SLUG, snail)
blob('sHead', (3.1, 0, 1.2), (0.7, 0.65, 0.8), SLUG, snail)
for s in (1, -1):
    import mathutils
    blob(f'sStalk{s}', (3.4, s * 0.3, 2.2), (0.09, 0.09, 0.55), SLUG, snail, rot=(s * 0.25, 0.3, 0))
    blob(f'sEye{s}', (3.55, s * 0.36, 2.75), (0.17, 0.17, 0.17), WHITE, snail)
    blob(f'sPupil{s}', (3.68, s * 0.38, 2.78), (0.08, 0.08, 0.08), BLACK, snail)
shell = empty('shell'); shell['fx_part'] = 'shell'; parent(shell, snail)
for i in range(7):
    k = i / 6; R = 1.9 * (1 - k * 0.8); a = i * 1.15
    ring(f'shRing{i}', (-0.4 + 0.25 * k + math.cos(a) * 0.15 * k, 0, 2.1 + math.sin(a) * 0.15 * k), R, 0.42 * (1 - k * 0.6) + 0.1, SHELL if i % 2 == 0 else SHELL2, shell, rot=(math.pi / 2, 0, 0))
for j in range(4):
    blob(f'sWin{j}', (-1.0 + j * 1.05, 0.84, 0.75), (0.32, 0.06, 0.24), GLASS, snail)
    blob(f'sWinR{j}', (-1.0 + j * 1.05, -0.84, 0.75), (0.32, 0.06, 0.24), GLASS, snail)
# frog: squat body, big eyes, belly
frog = empty('frog'); frog['fx_part'] = 'frog'
blob('fBody', (0, 0, 0.6), (0.85, 0.75, 0.6), FROG, frog)
blob('fBelly', (0.35, 0, 0.5), (0.55, 0.55, 0.45), WHITE, frog)
for s in (1, -1):
    blob(f'fEye{s}', (0.35, s * 0.38, 1.12), (0.25, 0.25, 0.25), WHITE, frog)
    blob(f'fPup{s}', (0.55, s * 0.4, 1.15), (0.1, 0.11, 0.12), BLACK, frog)
    blob(f'fLeg{s}', (-0.3, s * 0.7, 0.25), (0.55, 0.28, 0.25), FROG, frog)
    blob(f'fHand{s}', (0.7, s * 0.4, 0.1), (0.22, 0.14, 0.08), FROG, frog)
blob('fMouth', (0.78, 0, 0.62), (0.05, 0.45, 0.04), BLACK, frog)
# fat mushroom
mush = empty('mush'); mush['fx_part'] = 'mush'
blob('mStem', (0, 0, 0.9), (0.5, 0.5, 0.95), STEM, mush)
blob('mCap', (0, 0, 1.85), (1.4, 1.4, 0.7), RED, mush)
for i in range(9):
    a = i * 2.4; r = 0.45 + 0.6 * ((i * 0.37) % 1)
    blob(f'mDot{i}', (math.cos(a) * r, math.sin(a) * r, 1.85 + 0.7 * math.sqrt(max(0, 1 - (r / 1.4) ** 2)) - 0.02), (0.18, 0.18, 0.06), WHITE, mush)
# coil-pot cactus: stacked tori in a clay pot
cactus = empty('cactus'); cactus['fx_part'] = 'cactus'
for i in range(6):
    ring(f'cPot{i}', (0, 0, 0.12 + i * 0.16), 0.55 + 0.05 * math.sin(i), 0.1, POT, cactus)
for i in range(9):
    ring(f'cCoil{i}', (0, 0, 1.0 + i * 0.2), 0.3 * (1 - i / 14), 0.13, CACT, cactus)
blob('cArm', (0.45, 0, 1.6), (0.12, 0.12, 0.35), CACT, cactus)
blob('cFlower', (0, 0, 2.85), (0.16, 0.16, 0.1), RED, cactus)
# market stall: counter, posts, striped awning
stall = empty('stall'); stall['fx_part'] = 'stall'
blob('stCounter', (0, 0, 0.6), (1.8, 0.7, 0.6), WOOD, stall, seg=16)
for x in (-1.6, 1.6):
    blob(f'stPost{x}', (x, -0.5, 1.6), (0.1, 0.1, 1.6), WOOD, stall, seg=12)
for i in range(6):
    blob(f'stAwn{i}', (-1.5 + i * 0.6, -0.1, 3.1 - 0.06 * abs(i - 2.5)), (0.32, 1.0, 0.12), RED if i % 2 == 0 else WHITE, stall, rot=(0.35, 0, 0), seg=16)
for i in range(5):
    blob(f'stFruit{i}', (-1.2 + i * 0.6, 0.2, 1.3), (0.22, 0.22, 0.22), [RED, SHELL2, FROG, SHELL, CACT][i], stall, seg=12)
export(HERE)
