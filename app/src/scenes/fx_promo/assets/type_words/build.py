# Extruded display words for s3_type (and recap). Each word is its own node centred at the origin,
# facing +z (three.js), 1 unit cap height-ish. The engine places / flies them.
import bpy, os, sys
sys.dont_write_bytecode = True; HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.dirname(HERE))
from _bl import *
reset()
BONE = mat('TypeBone', (0.82, 0.79, 0.72), rough=0.32, metal=0.15)
SIGNAL = mat('TypeSignal', (1.0, 0.3, 0.07), rough=0.3, emit=(1.0, 0.3, 0.07), strength=2.0)
for w, font, m in [('KINETIC', 'Archivo-w620-900.ttf', BONE), ('TYPE', 'Archivo-w1250-900.ttf', BONE),
                   ('IN', 'Archivo-w1000-900.ttf', BONE), ('3D', 'Archivo-w1250-900.ttf', SIGNAL),
                   ('CODE', 'Archivo-w1000-900.ttf', BONE), ('SHIP', 'Archivo-w1000-900.ttf', BONE)]:
    o = text_mesh(w, font, size=1.0, extrude=0.18, bevel=0.018, name=f'word_{w}')
    select(o); bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY', center='BOUNDS'); o.location = (0, 0, 0)
    o['fx_part'] = w; assign(o, m); shade_smooth_auto(o)
# FONT in six faces: s3_type swaps the 3D word's typeface on every beat.
for v, font in enumerate(['Archivo-w1250-900.ttf', 'Cormorant-600.ttf', 'src/IBMPlexMono-Bold.ttf', 'ArchivoItalic-w1000-800.ttf', 'CormorantItalic-600.ttf', 'Archivo-w620-300.ttf']):
    o = text_mesh('FONT', font, size=1.0, extrude=0.18, bevel=0.012, name=f'word_FONT_{v}')
    select(o); bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY', center='BOUNDS'); o.location = (0, 0, 0)
    o['fx_part'] = f'FONT_{v}'; assign(o, SIGNAL); shade_smooth_auto(o)
export(HERE)
