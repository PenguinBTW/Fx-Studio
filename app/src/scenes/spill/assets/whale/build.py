# SPILL Sky Whale (OIL style): a humpback-like sky whale, 1 unit = cursor height (whale ~ 60 long here, scaled in engine).
# Parts: whale (root), body, flipperL, flipperR, flukes, eye, grooves. Blender Z up, head = -X... (front = +X).
import bpy, os, sys, math, bmesh
sys.dont_write_bytecode = True; HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.dirname(HERE))
from _bl import *
reset()
SKIN = mat('Skin', (0.16, 0.2, 0.42), 0.7)
BELLY = mat('Belly', (0.92, 0.78, 0.62), 0.7)
EYE = mat('Eye', (0.02, 0.02, 0.03), 0.2)
L = 60.0
root = empty('whale'); root['fx_part'] = 'whale'
bpy.ops.mesh.primitive_uv_sphere_add(segments=64, ring_count=40, radius=1)
body = bpy.context.active_object; body.name = 'body'; body['fx_part'] = 'body'
bm = bmesh.new(); bm.from_mesh(body.data)
for v in bm.verts:
    x, y, z = v.co
    u = (x + 1) / 2  # 0 tail .. 1 head
    r = math.sqrt(max(0.0, 1 - ((u - 0.62) / 0.41) ** 2)) if u > 0.62 else 0.1 + 0.9 * (u / 0.62) ** 0.8
    r = max(0.06, r)
    hy = 1.0 + 0.12 * (1 - u)
    z2 = z * r * (0.85 if z > 0 else 1.0) * 0.5 - 0.08 * (u - 0.6) ** 2
    if z < 0: z2 *= 1.0 + 0.15 * math.sin(math.pi * u)
    v.co = (x * L / 2, y * r * 0.5 * hy * L / 4.0, z2 * L / 4.0)
bm.to_mesh(body.data); bm.free(); smooth(body, 80)
m = body.modifiers.new('sub', 'SUBSURF'); m.levels = 1; select(body); bpy.ops.object.modifier_apply(modifier='sub')
body.data.materials.append(SKIN); body.data.materials.append(BELLY)
for poly in body.data.polygons:
    c = sum((body.data.vertices[i].co for i in poly.vertices), start=body.data.vertices[poly.vertices[0]].co * 0) / len(poly.vertices)
    if c.z < -1.2 and c.x > -14: poly.material_index = 1
parent(body, root)
def fin(name, loc, scale, rot, matl):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, radius=1, location=loc)
    f = bpy.context.active_object; f.name = name; f.scale = scale; f.rotation_euler = rot
    select(f); bpy.ops.object.transform_apply(scale=True, rotation=True); assign(f, matl); smooth(f, 80); f['fx_part'] = name; parent(f, root); return f
fin('flipperL', (8, 6.8, -3.2), (5.5, 7.5, 0.45), (math.radians(15), 0, math.radians(-30)), SKIN)
fin('flipperR', (8, -6.8, -3.2), (5.5, 7.5, 0.45), (math.radians(-15), 0, math.radians(30)), SKIN)
fin('flukes', (-30.5, 0, 0.2), (3.2, 9.5, 0.35), (0, math.radians(-6), 0), SKIN)
fin('dorsal', (-12, 0, 5.4), (2.2, 0.35, 1.0), (0, math.radians(-20), 0), SKIN)
for s, nm in ((1, 'eyeL'), (-1, 'eyeR')):
    e = fin(nm, (19.5, s * 5.6, -1.0), (0.55, 0.3, 0.45), (0, 0, 0), EYE)
# throat grooves: thin pale ribbons along the belly
for i in range(7):
    y = (i - 3) * 0.9
    g = box(f'groove{i}', (15, 0.12, 0.08), (17, y, -4.7 + 0.05 * abs(i - 3) ** 2), BELLY); parent(g, root)
export(HERE)
