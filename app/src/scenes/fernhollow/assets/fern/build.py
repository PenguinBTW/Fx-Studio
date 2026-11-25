"""fernhollow fern frond — procedural arch with pinnae, deterministic."""
import bpy, math, random, sys, os
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
from _bl import reset, export

reset()
random.seed(11)

# frond: central rachis arcing in +Y up then drooping, pinnae as flattened
# tapered quads alternating along it, all in one mesh.
verts, faces = [], []
N = 28  # spine samples
length = 2.2
def spine(i):
    t = i / (N - 1)
    # arch: rises then droops — closed form
    y = length * t
    z = 1.35 * math.sin(t * math.pi * 0.62) * (1 - 0.25 * t)
    return (0.0, y, z)

spine_pts = [spine(i) for i in range(N)]
# rachis as thin ribbon
w = 0.012
for i in range(N):
    x, y, z = spine_pts[i]
    verts += [(x - w, y, z), (x + w, y, z)]
for i in range(N - 1):
    a = i * 2
    faces.append((a, a + 1, a + 3, a + 2))

# pinnae: leaflet pairs along outer two-thirds of spine
for i in range(4, N - 2):
    t = i / (N - 1)
    x, y, z = spine_pts[i]
    # direction along spine
    x2, y2, z2 = spine_pts[min(i + 1, N - 1)]
    dy, dz = y2 - y, z2 - z
    L = 0.16 * math.sin(math.pi * min(1.0, t * 1.25)) * (1 - t * 0.55) + 0.02
    for side in (-1, 1):
        # leaflet as a 3-segment tapered blade angled outward/forward
        base = len(verts)
        tilt = 0.5  # forward tilt
        for s in range(4):
            st = s / 3
            px = x + side * L * st
            py = y + dy * 2.0 * st * tilt + 0.02 * st
            pz = z + dz * 2.0 * st * tilt - 0.12 * st * st
            hw = 0.018 * (1 - st) * (0.5 + 0.5 * math.sin(math.pi * min(1, st * 3)))
            verts += [(px, py - hw, pz), (px, py + hw, pz)]
        for s in range(3):
            a = base + s * 2
            faces.append((a, a + 1, a + 3, a + 2))

mesh = bpy.data.meshes.new("frond")
mesh.from_pydata(verts, [], faces)
mesh.update()
obj = bpy.data.objects.new("frond", mesh)
bpy.context.collection.objects.link(obj)
obj["fx_part"] = "frond"

# solidify for thickness
mod = obj.modifiers.new("solid", "SOLIDIFY")
mod.thickness = 0.004
bpy.context.view_layer.objects.active = obj
bpy.ops.object.modifier_apply(modifier="solid")

mat = bpy.data.materials.new("fern_green")
mat.use_nodes = True
bsdf = mat.node_tree.nodes["Principled BSDF"]
bsdf.inputs["Base Color"].default_value = (0.18, 0.32, 0.10, 1.0)
bsdf.inputs["Roughness"].default_value = 0.75
obj.data.materials.append(mat)

export(HERE)
print("fern exported")
