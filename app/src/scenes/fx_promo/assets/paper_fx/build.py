# Papercraft f(x): low-resolution text curves give faceted, folded-card glyphs with real card thickness,
# plus a small orange paper tab on the f's crossbar. Flat-shaded in the engine; fold creases come from edge geometry.
import bpy, os, sys
sys.dont_write_bytecode = True; HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.dirname(HERE))
from _bl import *
reset()
KRAFT = mat('Kraft', (0.62, 0.45, 0.28), rough=0.95)
CREAM = mat('Cream', (0.90, 0.86, 0.78), rough=0.95)
TAB = mat('Tab', (1.0, 0.30, 0.07), rough=0.9)
parts = [('f', 'f', KRAFT, -1.55), ('lp', '(', CREAM, -0.55), ('x', 'x', KRAFT, 0.35), ('rp', ')', CREAM, 1.25)]
for name, ch, m, x in parts:
    o = text_mesh(ch, 'Archivo-w1000-900.ttf', size=2.2, extrude=0.16, bevel=0.0, name='paper_' + name, res=1)
    o.location.x = x
    assign(o, m)
    o['fx_part'] = name
bpy.ops.mesh.primitive_cube_add(size=1, location=(-1.35, 0.0, 0.62))
t = bpy.context.active_object; t.scale = (0.34, 0.36, 0.14); bpy.ops.object.transform_apply(scale=True)
assign(t, TAB); t.name = 'paper_tab'; t['fx_part'] = 'tab'
export(HERE)
