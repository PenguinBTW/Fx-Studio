# Pre-fractured floor slab for the city collapse: one floor module (1 x 1 footprint, 0.3 tall, origin at its base)
# cut into Voronoi cells with bmesh bisects. Each chunk keeps its centroid as its node translation so the engine can
# swap a falling floor for its chunks at the exact pose of impact and throw them out from there.
import bpy, bmesh, os, sys, random
from mathutils import Vector
sys.dont_write_bytecode = True; HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.dirname(HERE))
from _bl import *
reset()
BODY = mat('DebrisBody', (0.42, 0.42, 0.44), rough=0.8, metal=0.0)
H, N = 0.3, 16
random.seed(7)
pts = [Vector((random.uniform(-0.5, 0.5), random.uniform(-0.5, 0.5), random.uniform(0.02, H - 0.02))) for _ in range(N)]
for i, p in enumerate(pts):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts: v.co = Vector((v.co.x, v.co.y, (v.co.z + 0.5) * H))
    for j, q in enumerate(pts):
        if i == j: continue
        n = (q - p).normalized(); mid = (p + q) / 2
        # Jitter each cut a little so the shards are not perfectly planar facets of one lattice.
        n = (n + Vector((random.uniform(-0.15, 0.15), random.uniform(-0.15, 0.15), random.uniform(-0.15, 0.15)))).normalized()
        geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
        res = bmesh.ops.bisect_plane(bm, geom=geom, plane_co=mid, plane_no=n, clear_outer=True, use_snap_center=False)
        edges = [e for e in res['geom_cut'] if isinstance(e, bmesh.types.BMEdge)]
        if edges: bmesh.ops.edgenet_fill(bm, edges=edges)
    if len(bm.verts) < 4: bm.free(); continue
    me = bpy.data.meshes.new(f'chunk_{i:02d}'); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(f'chunk_{i:02d}', me); bpy.context.collection.objects.link(ob)
    assign(ob, BODY); ob['fx_part'] = ob.name
    select(ob); bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY', center='BOUNDS')
export(HERE)
