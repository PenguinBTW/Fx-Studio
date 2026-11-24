# CHLADNI rig: machined vibration bench — plinth, shaker column + cantilever clamp arm,
# control console (display bezel, freq knob, toggle), articulated lamp, cable, salt jar.
# Origin = plate centre at plate top (y=0 in exported Y-up space). Units: metres.
# Run: blender -b --factory-startup --python build.py
import bpy, math, os
from mathutils import Vector
HERE = os.path.dirname(os.path.abspath(__file__))
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
TAU = math.tau

def mat(name, col, rough, metal=0.0, emit=None, es=0.0, alpha=1.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*col, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if emit:
        b.inputs['Emission Color'].default_value = (*emit, 1)
        b.inputs['Emission Strength'].default_value = es
    if alpha < 1.0:
        b.inputs['Alpha'].default_value = alpha
        m.surface_render_method = 'DITHERED'
    return m

STEEL_D  = mat('SteelDark',   (0.055,0.056,0.062), 0.42, 0.92)
STEEL_B  = mat('SteelBrush',  (0.42,0.43,0.46),    0.30, 1.0)
ALU      = mat('AluBody',     (0.14,0.145,0.16),   0.48, 0.85)
BRASS    = mat('Brass',       (0.50,0.34,0.11),    0.28, 1.0)
RUBBER   = mat('Rubber',      (0.018,0.018,0.020), 0.95, 0.0)
COPPER   = mat('CopperWire',  (0.30,0.16,0.07),    0.55, 0.9)
SHADE    = mat('ShadeInk',    (0.045,0.052,0.048), 0.38, 0.85)
SHADE_IN = mat('ShadeBone',   (0.82,0.80,0.72),    0.55, 0.2)
BULB     = mat('BulbWarm',    (1.0,0.72,0.40),     0.4,  0.0, (1.0,0.62,0.28), 4.0)
BEZEL    = mat('BezelGlass',  (0.006,0.010,0.016), 0.06, 0.5)
GLASS    = mat('JarGlass',    (0.62,0.72,0.78),    0.08, 0.0, alpha=0.22)
SALTFILL = mat('SaltFill',    (0.93,0.90,0.84),    1.0,  0.0)
CABLE    = mat('CableBraid',  (0.030,0.030,0.036), 0.82, 0.1)
REDLENS  = mat('LensRed',     (0.35,0.02,0.02),    0.15, 0.0, (0.8,0.05,0.02), 0.6)

parts = {}
def begin(name):
    parts[name] = {'objs': []}
def add(name, o):
    parts[name]['objs'].append(o); return o

# Coordinates are authored (x, y=UP, z=depth); Blender is Z-up, so map to (x,-z,y).
# Cylinder/lathe axes then stay vertical and export_yup lands correctly.
def P(x, y, z): return (x, -z, y)
def prim(name, kind, loc, scale=(1,1,1), rot=(0,0,0), matl=None, verts=32, bevel=0.0):
    bl = P(*loc)
    if kind == 'box':
        bpy.ops.mesh.primitive_cube_add(location=bl)
        o = bpy.context.object
        o.scale = (scale[0]/2, scale[2]/2, scale[1]/2)
        bpy.ops.object.transform_apply(scale=True)
        if bevel > 0:
            mod = o.modifiers.new('bev', 'BEVEL'); mod.width = bevel; mod.segments = 3
            bpy.context.view_layer.objects.active = o
            bpy.ops.object.modifier_apply(modifier='bev')
            for p in o.data.polygons: p.use_smooth = False
    elif kind == 'cyl':
        bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=scale[0], depth=scale[1], location=bl)
        o = bpy.context.object
        if bevel > 0:
            mod = o.modifiers.new('bev', 'BEVEL'); mod.width = bevel; mod.segments = 2
            bpy.context.view_layer.objects.active = o
            bpy.ops.object.modifier_apply(modifier='bev')
        for p in o.data.polygons: p.use_smooth = True
    elif kind == 'sphere':
        bpy.ops.mesh.primitive_uv_sphere_add(segments=verts, ring_count=max(8, verts//2), radius=scale[0], location=bl)
        o = bpy.context.object
        for p in o.data.polygons: p.use_smooth = True
    elif kind == 'torus':
        bpy.ops.mesh.primitive_torus_add(major_radius=scale[0], minor_radius=scale[1], major_segments=verts, minor_segments=8, location=bl)
        o = bpy.context.object
    if rot != (0,0,0):
        # rot authored about my axes (x, y_up, z_depth) -> Blender (x, -z, y)
        o.rotation_euler = (rot[0], -rot[2], rot[1])
    if matl: o.data.materials.append(matl)
    add(name, o); return o

def knurl(name, loc, r, h, axis='Z', matl=None, n=28, depth=0.0035):
    """Faceted cylinder: ring of thin boxes around a core reads as knurling.
    axis 'Z' = vertical knob (my y-up), axis 'X' = horizontal knob on an x shaft."""
    prim(name, 'cyl', loc, (r, h), matl=matl, verts=48)
    for i in range(n):
        a = i / n * TAU
        if axis == 'Z':
            p = (loc[0] + math.cos(a)*(r+depth*0.4), loc[1], loc[2] + math.sin(a)*(r+depth*0.4))
            prim(name, 'box', p, (depth, h*0.98, depth*1.6), rot=(0, -a, 0), matl=matl, bevel=0.0005)
        else:  # axis X: shaft along x — sliver ring spins in the yz plane
            p = (loc[0], loc[1] + math.cos(a)*(r+depth*0.4), loc[2] + math.sin(a)*(r+depth*0.4))
            prim(name, 'cyl', p, (depth*0.6, h*0.98), rot=(0, 0, math.pi/2), matl=matl, verts=8)

def tube(name, pts, r0, r1, matl, ring=8):
    pts = [P(*p) for p in pts]
    V, F = [], []
    n = len(pts)
    for i, p in enumerate(pts):
        t = (Vector(pts[min(i+1, n-1)]) - Vector(pts[max(i-1, 0)])).normalized()
        up = Vector((0,0,1)) if abs(t.z) < 0.9 else Vector((1,0,0))
        a = t.cross(up).normalized(); b = t.cross(a).normalized()
        r = r0 + (r1 - r0) * i / (n - 1)
        for k in range(ring):
            th = TAU * k / ring
            V.append(tuple(Vector(p) + a*math.cos(th)*r + b*math.sin(th)*r))
    for i in range(n-1):
        for k in range(ring):
            a0 = i*ring+k; a1 = i*ring+(k+1)%ring
            F.append((a0, a1, a1+ring, a0+ring))
    me = bpy.data.meshes.new(name); me.from_pydata(V, [], F); me.update()
    o = bpy.data.objects.new(name, me); sc.collection.objects.link(o)
    me.materials.append(matl)
    for p in me.polygons: p.use_smooth = True
    add(name, o); return o

def lathe(name, profile, loc, rot=(0,0,0), matl=None, segs=48):
    """profile: list of (radius, z) — spun around Z."""
    V, F = [], []
    n = len(profile)
    for i, (r, z) in enumerate(profile):
        for k in range(segs):
            th = TAU * k / segs
            V.append((r*math.cos(th), r*math.sin(th), z))
    for i in range(n-1):
        for k in range(segs):
            a0 = i*segs+k; a1 = i*segs+(k+1)%segs
            F.append((a0, a0+segs, a1+segs, a1))
    me = bpy.data.meshes.new(name); me.from_pydata(V, [], F); me.update()
    me.materials.append(matl)
    for p in me.polygons: p.use_smooth = True
    o = bpy.data.objects.new(name, me); sc.collection.objects.link(o)
    o.location = P(*loc); o.rotation_euler = rot
    add(name, o); return o

BY = -0.018  # base plinth top; plate top is y=0

# ---------- base plinth ----------
begin('base')
prim('base', 'box', (0, BY-0.016, 0), (0.50, 0.032, 0.38), matl=STEEL_D, bevel=0.004)
for sx in (-1, 1):
    for sz in (-1, 1):
        prim('base', 'cyl', (sx*0.225, BY-0.033, sz*0.165), (0.016, 0.014), matl=RUBBER, verts=24, bevel=0.002)
        prim('base', 'cyl', (sx*0.21, BY+0.001, sz*0.16), (0.0055, 0.006), matl=STEEL_B, verts=16, bevel=0.001)
        prim('base', 'cyl', (sx*0.21, BY+0.0015, sz*0.16), (0.0022, 0.007), matl=STEEL_D, verts=6)  # hex socket
# recessed ring under the plate post
prim('base', 'cyl', (0, BY+0.0005, 0), (0.030, 0.003), matl=STEEL_B, verts=48, bevel=0.001)

# ---------- shaker under the plinth (visible at grazing angles) ----------
begin('shaker')
prim('shaker', 'cyl', (0, BY-0.075, 0), (0.041, 0.075), matl=ALU, verts=40, bevel=0.002)
for i in range(6):
    prim('shaker', 'cyl', (0, BY-0.048-i*0.010, 0), (0.045, 0.0035), matl=ALU, verts=40)  # cooling fins
prim('shaker', 'cyl', (0, BY-0.041, 0), (0.013, 0.010), matl=STEEL_B, verts=24)          # driver rod

# ---------- Chladni plate ----------
begin('plate')
prim('plate', 'box', (0, -0.002, 0), (0.30, 0.004, 0.30), matl=STEEL_B, bevel=0.0015)
prim('plate', 'cyl', (0, -0.008, 0), (0.012, 0.012), matl=STEEL_B, verts=24)  # seat on the driver rod

# ---------- rear column + cantilever clamp arm ----------
begin('column')
CX, CZ = 0.0, -0.163
prim('column', 'cyl', (CX, (BY+0.150)/2, CZ), (0.026, 0.150-BY), matl=STEEL_D, verts=40, bevel=0.003)
prim('column', 'cyl', (CX, BY+0.004, CZ), (0.046, 0.010), matl=STEEL_D, verts=40, bevel=0.002)  # foot flange
for a in range(4):
    th = a/4*TAU + math.pi/4
    prim('column', 'cyl', (CX+math.cos(th)*0.035, BY+0.010, CZ+math.sin(th)*0.035), (0.004, 0.006), matl=STEEL_B, verts=12)
prim('column', 'cyl', (CX, 0.150, CZ), (0.031, 0.024), matl=ALU, verts=40, bevel=0.002)          # head block
# arm: forward over the plate centre at y=0.142, then a brass thumbscrew down to the clamp
tube('column', [(CX,0.150,CZ+0.01), (CX,0.162,CZ+0.05), (CX,0.165,CZ+0.10), (CX,0.165,0.0)], 0.011, 0.008, STEEL_D, ring=10)
prim('column', 'cyl', (0, 0.165, 0), (0.016, 0.014), matl=ALU, verts=32)                          # boss above plate centre
knurl('column', (0, 0.172, 0), 0.009, 0.012, axis='Z', matl=BRASS)                                 # thumbscrew head
prim('column', 'cyl', (0, 0.155, 0), (0.0035, 0.020), matl=STEEL_B, verts=16)                      # screw shaft

# ---------- clamp pin on the plate (brass press foot) ----------
begin('clamp')
lathe('clamp', [(0.003,0.0),(0.008,0.004),(0.010,0.008),(0.010,0.014),(0.007,0.016),(0.007,0.021),(0.002,0.023)], (0,0,0), matl=BRASS)
knurl('clamp', (0, 0.026, 0), 0.0085, 0.007, axis='Z', matl=BRASS, n=24)

# ---------- control console (front-left wedge) ----------
begin('console')
KX, KZ = -0.175, 0.125
# wedge: slanted face tilted up toward the viewer (pitch 55° up from horizontal => normal (0,.82,.57))
prim('console', 'box', (KX, BY+0.024, KZ), (0.150, 0.048, 0.105), matl=ALU, bevel=0.004)
prim('console', 'box', (KX, BY+0.052, KZ+0.012), (0.118, 0.006, 0.062), rot=(0.96,0,0), matl=STEEL_D, bevel=0.002)   # slanted face plate
prim('console', 'box', (KX, BY+0.056, KZ+0.013), (0.104, 0.004, 0.038), rot=(0.96,0,0), matl=BEZEL, bevel=0.001)     # display bezel glass
prim('console', 'box', (KX, BY+0.046, KZ+0.033), (0.020, 0.004, 0.012), rot=(0.96,0,0), matl=BEZEL, bevel=0.001)     # LED bezel
prim('console', 'sphere', (KX, BY+0.0475, KZ+0.034), (0.0048,), rot=(0.96,0,0), matl=REDLENS, verts=24)             # LED lens
knurl('console', (KX+0.085, BY+0.035, KZ), 0.014, 0.014, axis='X', matl=BRASS)                                      # freq knob
prim('console', 'cyl', (KX+0.085, BY+0.035, KZ), (0.004, 0.016), rot=(0,0,math.pi/2), matl=STEEL_B, verts=16)       # knob shaft
prim('console', 'cyl', (KX-0.045, BY+0.030, KZ-0.050), (0.006, 0.016), rot=(0.5,0,0), matl=STEEL_B, verts=16)       # toggle lever
prim('console', 'sphere', (KX-0.045, BY+0.036, KZ-0.054), (0.0065,), matl=BRASS, verts=20)                          # toggle tip
prim('console', 'cyl', (KX+0.030, BY+0.030, KZ-0.052), (0.0065, 0.004), rot=(math.pi/2,0,0), matl=BEZEL, verts=24)  # small push button

# ---------- articulated lamp (back-right, head over front-left) ----------
begin('lamp')
LX, LZ = 0.185, -0.150
prim('lamp', 'cyl', (LX, BY+0.008, LZ), (0.028, 0.016), matl=STEEL_D, verts=36, bevel=0.003)   # base puck
prim('lamp', 'sphere', (LX, BY+0.018, LZ), (0.009,), matl=STEEL_B, verts=20)                   # joint ball
tube('lamp', [(LX,BY+0.02,LZ), (LX-0.01,0.19,LZ-0.01), (LX-0.03,0.30,LZ+0.02)], 0.0065, 0.0055, STEEL_D, ring=10)  # lower arm
prim('lamp', 'sphere', (LX-0.03, 0.30, LZ+0.02), (0.0085,), matl=STEEL_B, verts=20)            # elbow joint
tube('lamp', [(LX-0.03,0.30,LZ+0.02), (0.09,0.335,0.02), (0.03,0.315,0.11)], 0.0055, 0.005, STEEL_D, ring=10)       # upper arm
# head at (0.03,0.315,0.11), aimed at plate centre: axis dir ~ (-0.03,-0.31,-0.11)
# lamp head above the plate front-right; shade profile is built around -Z so it
# already hangs downward — tilt it slightly toward the plate centre.
hd = (0.03, 0.315, 0.11)
lathe('lamp', [(0.012,0.0),(0.016,-0.012),(0.030,-0.030),(0.045,-0.055),(0.047,-0.062)], hd, rot=(0.28,-0.24,0), matl=SHADE)
lathe('lamp', [(0.044,-0.060),(0.030,-0.048),(0.012,-0.020)], hd, rot=(0.28,-0.24,0), matl=SHADE_IN)
prim('lamp', 'sphere', (hd[0]+0.012, hd[1]-0.040, hd[2]+0.008), (0.012,), matl=BULB, verts=24)  # warm bulb

# ---------- cable: console → column, sagging ----------
begin('cable')
tube('cable', [(KX+0.02,BY+0.01,KZ-0.05), (KX+0.06,BY-0.01,KZ-0.09), (KX+0.14,BY-0.014,-0.02),
               (0.10,BY-0.012,-0.12), (0.02,BY-0.006,CZ+0.02)], 0.0048, 0.0048, CABLE, ring=8)
prim('cable', 'cyl', (KX+0.02, BY+0.012, KZ-0.052), (0.007, 0.012), rot=(0.9,0,0), matl=RUBBER, verts=16)   # strain relief

# ---------- salt jar (diegetic source of the grains) ----------
begin('saltpot')
JX, JZ = 0.195, 0.135
lathe('saltpot', [(0.0,0.0),(0.020,0.0),(0.022,0.002),(0.022,0.040),(0.018,0.046),(0.0,0.046)], (JX,BY+0.001,JZ), matl=GLASS, segs=32)
lathe('saltpot', [(0.0,0.0),(0.019,0.0),(0.019,0.030),(0.016,0.034)], (JX,BY+0.002,JZ), matl=SALTFILL, segs=32)
prim('saltpot', 'cyl', (JX, BY+0.049, JZ), (0.018, 0.009), matl=STEEL_D, verts=32, bevel=0.001)   # cap
for i in range(7):
    a = i/7*TAU
    prim('saltpot', 'cyl', (JX+math.cos(a)*0.012, BY+0.054, JZ+math.sin(a)*0.012), (0.0012, 0.003), matl=STEEL_B, verts=8)  # shaker holes

# ---------- export ----------
for name, p in parts.items():
    if len(p['objs']) > 1:
        bpy.ops.object.select_all(action='DESELECT')
        for o in p['objs']:
            if o.name in bpy.context.view_layer.objects: o.select_set(True)
        bpy.context.view_layer.objects.active = p['objs'][0]
        try:
            bpy.ops.object.join()
            parts[name]['root'] = bpy.context.view_layer.objects.active
        except RuntimeError:
            parts[name]['root'] = p['objs'][0]
    else:
        parts[name]['root'] = p['objs'][0]
    root = parts[name]['root']
    root.name = name
    root['fx_part'] = name

bpy.ops.object.select_all(action='DESELECT')
for p in parts.values():
    try: p['root'].select_set(True)
    except Exception: pass
print('[export] parts:', ', '.join(parts.keys()))
bpy.ops.export_scene.gltf(filepath=os.path.join(HERE,'model.glb'), export_format='GLB',
                          export_extras=True, export_yup=True, use_selection=True)
