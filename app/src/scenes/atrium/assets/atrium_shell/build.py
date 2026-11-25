"""atrium shell — spiral staircase + cylindrical wall + columns + oculus, one GLB.
Hard-surface architectural asset, no rigging; all motion lives in scene code."""
import bpy, math, sys, os
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
from _bl import reset, export

reset()

concrete = bpy.data.materials.new("concrete_warm")
concrete.use_nodes = True
b = concrete.node_tree.nodes["Principled BSDF"]
b.inputs["Base Color"].default_value = (0.72, 0.64, 0.52, 1.0)
b.inputs["Roughness"].default_value = 0.88

dark = bpy.data.materials.new("concrete_shadow")
dark.use_nodes = True
d = dark.node_tree.nodes["Principled BSDF"]
d.inputs["Base Color"].default_value = (0.38, 0.35, 0.30, 1.0)
d.inputs["Roughness"].default_value = 0.92

R = 4.0          # atrium radius
HT = 9.0         # wall height
TURNS = 1.6      # staircase turns
RISE = 6.5       # staircase total rise

parts = []

# --- cylindrical wall (open-ended tube, inward-facing) ---
verts, faces = [], []
N = 64
for i in range(N + 1):
    a = i / N * math.tau if hasattr(math, 'tau') else i / N * 2 * math.pi
    x, y = R * math.cos(a), R * math.sin(a)
    verts += [(x, y, 0), (x, y, HT)]
for i in range(N):
    a = i * 2
    faces.append((a, a + 2, a + 3, a + 1))
mesh = bpy.data.meshes.new("wall")
mesh.from_pydata(verts, [], faces)
mesh.update()
wall = bpy.data.objects.new("wall", mesh)
bpy.context.collection.objects.link(wall)
wall.data.materials.append(concrete)
wall["fx_part"] = "wall"
parts.append(wall)
# flip normals inward
bpy.context.view_layer.objects.active = wall
bpy.ops.object.select_all(action='DESELECT')
wall.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.mesh.flip_normals()
bpy.ops.object.mode_set(mode='OBJECT')

# --- spiral staircase: helical sweep of treads, radius 2.2..3.6 ---
st_verts, st_faces = [], []
STEPS = 88
r_in, r_out = 1.9, 3.55
tread_h = 0.09
for i in range(STEPS):
    t = i / STEPS
    a0 = t * TURNS * 2 * math.pi
    z = 0.4 + t * RISE
    sweep = (2 * math.pi * TURNS / STEPS) * 1.15  # overlap slightly
    a1 = a0 + sweep
    base = len(st_verts)
    # tread slab: inner/outer arc, top + bottom + sides (8 corners, quads)
    corners = []
    for aa, rr in ((a0, r_in), (a1, r_in), (a1, r_out), (a0, r_out)):
        corners.append((rr * math.cos(aa), rr * math.sin(aa), z))
    bot = [(x, y, zz - tread_h) for x, y, zz in corners]
    st_verts += corners + bot
    idx = base
    st_faces.append((idx, idx + 1, idx + 2, idx + 3))          # top
    st_faces.append((idx + 7, idx + 6, idx + 5, idx + 4))      # bottom
    for k in range(4):
        k2 = (k + 1) % 4
        st_faces.append((idx + k, idx + 4 + k, idx + 4 + k2, idx + k2))
st_mesh = bpy.data.meshes.new("staircase")
st_mesh.from_pydata(st_verts, [], st_faces)
st_mesh.update()
stair = bpy.data.objects.new("staircase", st_mesh)
bpy.context.collection.objects.link(stair)
stair.data.materials.append(concrete)
stair["fx_part"] = "staircase"
parts.append(stair)

# --- helical stringer band under the treads (visual spine) ---
sb_verts, sb_faces = [], []
SEGS = 96
rmid = (r_in + r_out) / 2
bw = 0.1
for i in range(SEGS + 1):
    t = i / SEGS
    a = t * TURNS * 2 * math.pi
    z = 0.32 + t * RISE
    x, y = rmid * math.cos(a), rmid * math.sin(a)
    sb_verts += [(x, y, z), (x, y, z - 0.28)]
for i in range(SEGS):
    a = i * 2
    sb_faces.append((a, a + 2, a + 3, a + 1))
sbm = bpy.data.meshes.new("stringer")
sbm.from_pydata(sb_verts, [], sb_faces)
sbm.update()
sb = bpy.data.objects.new("stringer", sbm)
bpy.context.collection.objects.link(sb)
sb.data.materials.append(dark)
sb["fx_part"] = "stringer"
parts.append(sb)

# --- columns: 6 around perimeter ---
for k in range(6):
    a = k / 6 * 2 * math.pi + 0.3
    bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=0.22, depth=HT,
        location=((R - 0.4) * math.cos(a), (R - 0.4) * math.sin(a), HT / 2))
    c = bpy.context.object
    c.name = f"column{k}"
    c.data.materials.append(dark)
    c["fx_part"] = c.name
    parts.append(c)

# --- floor disc ---
bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=R, depth=0.2, location=(0, 0, -0.1))
fl = bpy.context.object
fl.name = "floor"
fl.data.materials.append(dark)
fl["fx_part"] = "floor"
parts.append(fl)

# --- oculus ring at the top: torus + ceiling annulus ---
bpy.ops.mesh.primitive_torus_add(major_radius=1.35, minor_radius=0.14, major_segments=48, minor_segments=10, location=(0, 0, HT))
oc = bpy.context.object
oc.name = "oculus_ring"
oc.data.materials.append(concrete)
oc["fx_part"] = "oculus_ring"
parts.append(oc)

# ceiling: annular disc from oculus edge to wall
cv, cf = [], []
N2 = 64
for i in range(N2 + 1):
    a = i / N2 * 2 * math.pi
    cv += [(1.35 * math.cos(a), 1.35 * math.sin(a), HT), (R * math.cos(a), R * math.sin(a), HT)]
for i in range(N2):
    aa = i * 2
    cf.append((aa, aa + 2, aa + 3, aa + 1))
cm = bpy.data.meshes.new("ceiling")
cm.from_pydata(cv, [], cf)
cm.update()
ce = bpy.data.objects.new("ceiling", cm)
bpy.context.collection.objects.link(ce)
ce.data.materials.append(dark)
ce["fx_part"] = "ceiling"
parts.append(ce)
# flip ceiling normals down
bpy.context.view_layer.objects.active = ce
bpy.ops.object.select_all(action='DESELECT')
ce.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.mesh.flip_normals()
bpy.ops.object.mode_set(mode='OBJECT')

export(HERE)
print("atrium shell exported")
