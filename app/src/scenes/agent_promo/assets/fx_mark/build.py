# A10: the f(x) STUDIO mark in extruded Archivo; mark_cursor is the orange block after it.
import bpy, os, sys, math
sys.dont_write_bytecode = True; HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.dirname(HERE))
from _bl import *
reset()
FACE = mat('Face', (0.92, 0.9, 0.85), rough=0.25)
SIG = mat('Signal', ORANGE, rough=0.3, emit=ORANGE, strength=6.0)
fx = text_mesh('f(x)', 'Archivo-w1000-900.ttf', size=2.0, extrude=0.18, bevel_d=0.025, name='mark_fx'); assign(fx, FACE)
st = text_mesh('STUDIO', 'Archivo-w1250-700.ttf', size=0.62, extrude=0.08, bevel_d=0.01, name='mark_studio'); assign(st, FACE)
st.location = (0, 0, -1.35); select(st); bpy.ops.object.transform_apply(location=True)
box('mark_cursor', (0.42, 0.25, 0.9), (2.35, 0, -0.1), SIG, bev=0.03)
export(HERE)
