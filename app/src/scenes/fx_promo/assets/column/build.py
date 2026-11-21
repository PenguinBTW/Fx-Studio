# Signal column for s4_signal: a beveled unit pillar (1 x 1 x 1, base at y=0) with an emissive cap.
# Instanced hundreds of times by the engine; heights come from audio.json.
import bpy, os, sys, bmesh
sys.dont_write_bytecode = True; HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.dirname(HERE))
from _bl import *
reset()
BODY = mat('ColumnBody', (0.06, 0.06, 0.065), rough=0.35, metal=0.6)
CAP = mat('ColumnCap', (1.0, 1.0, 1.0), rough=0.2, emit=(1.0, 1.0, 1.0), strength=3.0)
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0.5)); body = bpy.context.active_object; body.name = 'column_body'
bev = body.modifiers.new('bev', 'BEVEL'); bev.width = 0.06; bev.segments = 2
select(body); bpy.ops.object.modifier_apply(modifier='bev'); assign(body, BODY); shade_smooth_auto(body)
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 1.0)); cap = bpy.context.active_object; cap.name = 'column_cap'
cap.scale = (0.82, 0.82, 0.04); bpy.ops.object.transform_apply(scale=True); assign(cap, CAP)
export(HERE)
