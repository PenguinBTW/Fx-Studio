# SPILL hero: a terminal block cursor as a physical object. 1 unit = cursor height. Blender Z up, front = -Y.
# Parts: cursor (root, pivot bottom centre for squash/stretch), shell (frosted orange), core (phosphor), scan (scanline grille).
import bpy, os, sys, math, bmesh
sys.dont_write_bytecode = True; HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.dirname(HERE))
from _bl import *
reset()

def pmat(name, col, rough, trans=0.0, emit=None, strength=0.0, ior=1.45):
    m = mat(name, col, rough=rough, emit=emit, strength=strength)
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Transmission Weight'].default_value = trans; b.inputs['IOR'].default_value = ior
    return m

SHELL = pmat('Shell', (1.0, 0.33, 0.04), 0.3, trans=0.6, ior=1.49)
CORE = pmat('Core', (1.0, 0.45, 0.08), 0.5, emit=(1.0, 0.42, 0.06), strength=4.0)
GRILLE = pmat('Grille', (0.35, 0.08, 0.01), 0.6)

W, H, D = 0.55, 1.0, 0.22
root = empty('cursor'); root['fx_part'] = 'cursor'
shell = box('shell', (W, D, H), (0, 0, H / 2), SHELL, bev=0.035, seg=5); shell['fx_part'] = 'shell'
m = shell.modifiers.new('wn', 'WEIGHTED_NORMAL'); m.keep_sharp = True; select(shell); bpy.ops.object.modifier_apply(modifier='wn')
core = box('core', (W * 0.78, D * 0.55, H * 0.88), (0, 0, H / 2), CORE, bev=0.02, seg=3); core['fx_part'] = 'core'
parent(shell, root); parent(core, root)
# thin horizontal scanline bars embedded just under the front face: CRT phosphor rows that read through the frost
bars = []
for i in range(14):
    z = 0.09 + i * (0.82 / 13)
    b = box(f'scan{i}', (W * 0.8, 0.006, 0.012), (0, -D * 0.33, z), GRILLE); bars.append(b)
select(bars[0])
for b in bars[1:]: b.select_set(True)
bpy.ops.object.join(); scan = bpy.context.active_object; scan.name = 'scan'; scan['fx_part'] = 'scan'; parent(scan, root)
export(HERE)
