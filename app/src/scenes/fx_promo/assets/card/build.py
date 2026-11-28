# Wall card for s8_wall: a 16:9 rounded dark bezel and a separate 'Screen' face (1.6 x 0.9, 0..1 UVs)
# that the engine replaces with a live CanvasTexture. Faces three.js +z.
import bpy, os, sys
sys.dont_write_bytecode = True; HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.dirname(HERE))
from _bl import *
reset()
BEZEL = mat('Bezel', (0.05, 0.05, 0.055), rough=0.3, metal=0.7)
SCREEN = mat('Screen', (1, 1, 1), rough=0.5)
bpy.ops.mesh.primitive_cube_add(size=1)
b = bpy.context.active_object
b.name = 'card_bezel'
b.scale = (1.72, 0.06, 1.02)
bpy.ops.object.transform_apply(scale=True)
m = b.modifiers.new('bev', 'BEVEL')
m.width = 0.05
m.segments = 3
bpy.ops.object.modifier_apply(modifier='bev')
assign(b, BEZEL)
shade_smooth_auto(b)
bpy.ops.mesh.primitive_plane_add(size=1, location=(0, -0.031, 0), rotation=(1.5707963, 0, 0))
s = bpy.context.active_object
s.name = 'card_screen'
s.scale = (1.6, 0.9, 1)
bpy.ops.object.transform_apply(rotation=True, scale=True)
assign(s, SCREEN)
s['fx_part'] = 'screen'
export(HERE)
