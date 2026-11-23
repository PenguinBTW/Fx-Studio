# SPILL Pixel Falls kit (VOXEL / 8-BIT): salmon sprite extruded to voxels (2 tail frames), blocky fern, voxel cliff block, coin.
# Each voxel = 0.25 units. Parts: salmonA, salmonB, fern, cliff, coin.
import bpy, os, sys, bmesh
sys.dont_write_bytecode = True; HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.dirname(HERE))
from _bl import *
reset()
PAL = {'k': mat('PxBlack', (0.05, 0.04, 0.08), 0.8), 'p': mat('PxSalmon', (1.0, 0.42, 0.42), 0.8), 'd': mat('PxSalmonDk', (0.72, 0.18, 0.3), 0.8),
       'w': mat('PxWhite', (1.0, 0.95, 0.85), 0.8), 'g': mat('PxGreen', (0.2, 0.8, 0.3), 0.8), 'G': mat('PxGreenDk', (0.08, 0.45, 0.2), 0.8),
       'b': mat('PxBrown', (0.55, 0.32, 0.18), 0.8), 'B': mat('PxBrownDk', (0.35, 0.2, 0.12), 0.8), 'y': mat('PxGold', (1.0, 0.8, 0.1), 0.6), 'Y': mat('PxGoldDk', (0.8, 0.5, 0.05), 0.6)}
V = 0.25
def sprite(name, rows, depth, par, z0=0.0):
    root = empty(name); root['fx_part'] = name; parent(root, par) if par else None
    bm = bmesh.new(); mats = list(PAL.keys())
    me = bpy.data.meshes.new(name + 'M'); ob = bpy.data.objects.new(name + 'M', me); bpy.context.collection.objects.link(ob)
    for k in mats: me.materials.append(PAL[k])
    H = len(rows)
    for r, row in enumerate(rows):
        for c, ch in enumerate(row):
            if ch not in PAL: continue
            d = depth(r, c) if callable(depth) else depth
            for z in range(-d, d + 1):
                res = bmesh.ops.create_cube(bm, size=V); 
                for v in res['verts']: v.co.x += c * V; v.co.z += (H - r) * V; v.co.y += z * V
                for f in {f for v in res['verts'] for f in v.link_faces}: f.material_index = mats.index(ch)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bm.to_mesh(me); bm.free(); parent(ob, root); return root
SAL = ["....dddd.......",
       "..ddppppdd.....",
       ".dpppppppppd..d",
       "dpkwpppppppppdd",
       "dppppppppppppdd",
       ".wwwwwwwwwwwd.d",
       "..wwwwwwwwd....",
       "....d...d......"]
SAL_B = [r[:12] + ('..d' if i in (2, 3) else 'dd.' if i == 4 else '...' if i != 5 else '..d') for i, r in enumerate(SAL)]
top = empty('pixel'); top['fx_part'] = 'pixel'
sprite('salmonA', [r[::-1] for r in SAL], lambda r, c: 1 if 2 <= r <= 5 and 2 <= c <= 11 else 0, top)
sprite('salmonB', [r[::-1] for r in SAL_B], lambda r, c: 1 if 2 <= r <= 5 and 2 <= c <= 11 else 0, top)
sprite('fern', ["..g...g..", ".gGg.gGg.", "gG.gGg.Gg", "...gGg...", "..g.G.g..", "....G....", "....G...."], 0, top)
sprite('cliff', ["gggggggg", "GgGggGgG", "bbBbbbBb", "bBbbBbbb", "bbbBbbBb", "Bbbbbbbb", "bbBbbBbb", "bbbbBbbB"], 3, top)
sprite('coin', [".yyy.", "yyYyy", "yyYyy", "yyYyy", ".yyy."], 0, top)
export(HERE)
