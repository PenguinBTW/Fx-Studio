# Orrery — Blender headless build (Blender 3.0+).
# Lathe-turned brass pedestal + column, ember sun in a cup, three toothed gears,
# three engraved concentric rings, three turned-brass arms carrying stone planets.
# Every drivable part is a separate root object tagged fx_part so the scene can
# address it by name: base, column, cup, sun, gear_0..2, ring_0..2, arm_0..2,
# planet_0..2.
import bpy
import math
import os

HERE = os.path.dirname(os.path.abspath(__file__))
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.unit_settings.system = 'METRIC'
sc.unit_settings.scale_length = 1.0

# ---------------------------------------------------------------- materials
def mat(name, col, rough=0.4, metal=0.0, emit=None, es=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*col, 1.0)
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
    if emit is not None:
        # Blender 4 renamed 'Emission' to 'Emission Color'
        sock = bsdf.inputs.get('Emission') or bsdf.inputs.get('Emission Color')
        if sock is not None: sock.default_value = (*emit, 1.0)
        strength = bsdf.inputs.get('Emission Strength')
        if strength is not None: strength.default_value = es
    return m

BRASS      = mat('Brass',      (0.46, 0.24, 0.075), 0.30, 0.94)
BRASS_DARK = mat('BrassDark',  (0.30, 0.15, 0.045), 0.42, 0.90)
STEEL      = mat('Steel',      (0.30, 0.31, 0.34),  0.36, 0.96)
EMBER      = mat('Ember',      (1.00, 0.34, 0.05),  0.55, 0.0, emit=(1.0, 0.22, 0.03), es=9.0)
MARBLE_A   = mat('Moonstone',  (0.78, 0.76, 0.72),  0.34, 0.02)
MARBLE_B   = mat('RustVein',   (0.52, 0.16, 0.08),  0.30, 0.05)
MARBLE_C   = mat('SeaMarble',  (0.10, 0.30, 0.30),  0.28, 0.08)
RUBY       = mat('Ruby',       (0.55, 0.015, 0.04),  0.16, 0.55, emit=(0.35, 0.01, 0.02), es=0.8)
EBONY      = mat('Ebony',      (0.05, 0.035, 0.030), 0.55, 0.05)

def fxpart(ob, name):
    ob.name = name
    ob['fx_part'] = name
    return ob

def finish(ob, m=None, smooth=True, bevel=0.0, bevel_seg=3):
    if m: ob.data.materials.append(m)
    if smooth:
        for p in ob.data.polygons: p.use_smooth = True
        if hasattr(ob.data, 'set_sharp_from_angle'):
            pass
        try: ob.data.use_auto_smooth = True; ob.data.auto_smooth_angle = math.radians(60)
        except Exception: pass
    if bevel > 0:
        mod = ob.modifiers.new('bev', 'BEVEL')
        mod.width = bevel; mod.segments = bevel_seg
        mod.limit_method = 'ANGLE'
        bpy.context.view_layer.objects.active = ob
        try: bpy.ops.object.modifier_apply(modifier='bev')
        except Exception: pass
    return ob

# ---------------------------------------------------------------- lathe
def lathe(name, profile, m, seg=64):
    """Revolve a (r,z) profile around the Z axis."""
    verts, faces = [], []
    n = len(profile)
    for i in range(seg):
        a = 2 * math.pi * i / seg
        ca, sa = math.cos(a), math.sin(a)
        for (r, z) in profile:
            verts.append((r * ca, r * sa, z))
    for i in range(seg):
        j = (i + 1) % seg
        for k in range(n - 1):
            faces.append((i*n+k, j*n+k, j*n+k+1, i*n+k+1))
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    uv = me.uv_layers.new(name='UVMap')
    for poly in me.polygons:
        for li in poly.loop_indices:
            vi = me.loops[li].vertex_index
            uv.data[li].uv = ((vi // n) / seg, (vi % n) / max(1, n - 1))
    me.update()
    ob = bpy.data.objects.new(name, me)
    sc.collection.objects.link(ob)
    finish(ob, m)
    return fxpart(ob, name)

def sphere(name, loc, radius, m, seg=48, rings=32):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=rings,
        radius=radius, location=loc)
    ob = bpy.context.object
    finish(ob, m)
    return fxpart(ob, name)

def cyl(name, loc, radius, depth, m, verts=48, bevel=0.0):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=radius,
        depth=depth, location=loc)
    ob = bpy.context.object
    finish(ob, m, bevel=bevel)
    return fxpart(ob, name)

def gear(name, teeth, R, thick, z, m, tooth_w=0.10, tooth_h=0.09, center=(0, 0)):
    """Spur gear: bevelled hub + rim disc + teeth + jeweled pivot cap.
    center: (x, y) so gears can mesh off-axis on the plinth."""
    cx, cy = center
    parts = []
    # rim sits on the root circle, below the pitch radius R — opposing teeth
    # bottom out in the gap instead of clipping solid rim (dedendum clearance)
    bpy.ops.mesh.primitive_cylinder_add(vertices=64, radius=R - tooth_h * 0.75,
        depth=thick, location=(cx, cy, z))
    core = bpy.context.object
    core.data.materials.append(m)
    parts.append(core)
    # bore hub
    bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=R*0.20, depth=thick*1.5,
        location=(cx, cy, z))
    hub = bpy.context.object
    hub.data.materials.append(m)
    parts.append(hub)
    for i in range(teeth):
        a = 2 * math.pi * i / teeth
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=(cx + math.cos(a)*R, cy + math.sin(a)*R, z))
        t = bpy.context.object
        t.scale = (tooth_h, tooth_w * R * 2 * math.pi / teeth, thick * 1.05)
        t.rotation_euler[2] = a
        t.data.materials.append(m)
        parts.append(t)
    # jeweled pivot — tiny ruby dome on the arbor
    bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=12, radius=0.026,
        location=(cx, cy, z + thick * 0.78))
    jw = bpy.context.object
    jw.scale = (1.0, 1.0, 0.55)
    jw.data.materials.append(RUBY)
    parts.append(jw)
    bpy.ops.object.select_all(action='DESELECT')
    for p in parts: p.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    ob = bpy.context.object
    finish(ob, m, bevel=min(thick * 0.18, 0.010), bevel_seg=2)
    return fxpart(ob, name)

def ring(name, R, minor, z, m, tilt_deg, ticks=24):
    """Orbit ring: torus + engraved degree ticks sunk into the upper surface."""
    bpy.ops.mesh.primitive_torus_add(major_segments=96, minor_segments=20,
        location=(0, 0, z), major_radius=R, minor_radius=minor)
    ob = bpy.context.object
    ob.data.materials.append(m)
    parts = [ob]
    # engraved markings — dark notches every 15°, longer every 90°
    for i in range(ticks):
        a = 2 * math.pi * i / ticks
        long = (i % 6) == 0
        bpy.ops.mesh.primitive_cube_add(size=1.0,
            location=(math.cos(a) * R, math.sin(a) * R, z + minor * 0.72))
        k = bpy.context.object
        k.scale = (0.008 if long else 0.004, 0.032 if long else 0.020, 0.006)
        k.rotation_euler[2] = a
        k.data.materials.append(BRASS_DARK)
        parts.append(k)
    bpy.ops.object.select_all(action='DESELECT')
    for p in parts: p.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    ob = bpy.context.object
    finish(ob, m)
    if tilt_deg:
        M = mathutils_rot(math.radians(tilt_deg), (1, 0, 0))
        ob.data.transform(M)
    return fxpart(ob, name)

def mathutils_rot(rad, axis):
    import mathutils
    return mathutils.Matrix.Rotation(rad, 4, axis)

def collar(name, R0, R1, z0, z1, m):
    return lathe(name, [(R0, z0), (R1, z0+0.004), (R1*0.96, (z0+z1)/2), (R1*0.92, z1-0.004), (R0*0.9, z1)], m, seg=64)

# ---------------------------------------------------------------- build
# Base — a turned plinth, wide foot, waist, top plate.
lathe('base', [
    (0.02, 0.000), (1.62, 0.000), (1.66, 0.030), (1.52, 0.075),
    (1.34, 0.100), (1.38, 0.150), (1.18, 0.200), (0.95, 0.235),
    (0.90, 0.300), (0.70, 0.360), (0.62, 0.440), (0.66, 0.520),
    (0.80, 0.560), (1.05, 0.575), (1.30, 0.585), (1.44, 0.600),
    (1.44, 0.640), (1.28, 0.660), (0.60, 0.670), (0.50, 0.700),
], BRASS)

# Column — thin turned spindle rising from the base top.
lathe('column', [
    (0.50, 0.700), (0.44, 0.720), (0.28, 0.760), (0.20, 0.830),
    (0.165, 0.950), (0.155, 1.120), (0.175, 1.220), (0.24, 1.290),
    (0.26, 1.350), (0.20, 1.410), (0.135, 1.450), (0.12, 1.520),
], BRASS_DARK)

# Cup — flared bowl cradling the sun.
lathe('cup', [
    (0.12, 1.510), (0.30, 1.520), (0.37, 1.560), (0.40, 1.615),
    (0.385, 1.635), (0.30, 1.645), (0.20, 1.620), (0.15, 1.560),
], BRASS)

# Sun — ember sphere floating just above the cup.
sphere('sun', (0, 0, 1.86), 0.335, EMBER)

# Gear train — a main drive wheel + coaxial sister wheel, each driving a pinion
# on a brass post, so teeth visibly mesh (pitch circles touch: R0+R3=0.67, R1+R2=0.45).
gear('gear_0', 30, 0.50, 0.050, 0.88,  BRASS, tooth_h=0.085)
gear('gear_1', 20, 0.30, 0.044, 0.985, STEEL, tooth_h=0.075)
gear('gear_2',  9, 0.15, 0.044, 0.985, BRASS, tooth_h=0.075, center=(0.45, 0))
gear('gear_3', 12, 0.17, 0.050, 0.88,  STEEL, tooth_h=0.085, center=(0.67, 0))

# Pinion posts rising from the plinth flange (folded into `base`).
def post_into_base(x, z1):
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.024,
        depth=z1 - 0.62, location=(x, 0, (0.62 + z1) / 2))
    p = bpy.context.object
    p.data.materials.append(BRASS_DARK)
    bpy.ops.object.select_all(action='DESELECT')
    p.select_set(True); bpy.data.objects['base'].select_set(True)
    bpy.context.view_layer.objects.active = bpy.data.objects['base']
    bpy.ops.object.join()

post_into_base(0.45, 0.97)
post_into_base(0.67, 0.90)

# Rings — concentric engraved brass circles riding around the column.
ring('ring_0', 0.88, 0.034, 1.26, BRASS,  3.0)
ring('ring_1', 1.46, 0.042, 1.40, BRASS, -2.2)
ring('ring_2', 2.06, 0.048, 1.54, BRASS,  1.4)

# Rings get a fine steel inlay edge (decorative, part of the same object name).
def inlay(name, R, z, tilt_deg):
    ob = ring(name, R, 0.012, z, STEEL, tilt_deg)
    return ob
# keep single-part names; fold inlays into ring objects via join
def add_inlay_into(ringname, R, z, tilt_deg):
    inn = inlay('tmp_inlay', R, z + 0.001, tilt_deg)
    bpy.ops.object.select_all(action='DESELECT')
    inn.select_set(True); bpy.data.objects[ringname].select_set(True)
    bpy.context.view_layer.objects.active = bpy.data.objects[ringname]
    bpy.ops.object.join()

add_inlay_into('ring_0', 0.88, 1.292,  3.0)
add_inlay_into('ring_1', 1.46, 1.452, -2.2)
add_inlay_into('ring_2', 2.06, 1.592,  1.4)

# Arms — turned rods pivoting at the column axis, counterweight ball at -x,
# rising foot + cradle cup at the tip where the planet rides.
def arm(name, R, z, m):
    parts = []
    # main rod along +X (built on Z then rotated in mesh space so it lies +X)
    bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=0.030, depth=R + 0.42,
        location=((R + 0.42)/2 - 0.24, 0, z))
    rod = bpy.context.object
    rod.data.transform(mathutils_rot(math.radians(90), (0, 1, 0)))
    rod.data.materials.append(m)
    parts.append(rod)
    # counterweight ball
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=16, radius=0.075,
        location=(-0.30, 0, z))
    cw = bpy.context.object
    cw.data.materials.append(m)
    parts.append(cw)
    # tip riser: small vertical foot lifting the planet above the ring plane
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.026, depth=0.10,
        location=(R, 0, z + 0.045))
    ri = bpy.context.object
    ri.data.materials.append(m)
    parts.append(ri)
    # cradle: tiny cup under the planet
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=12, radius=0.055,
        location=(R, 0, z + 0.105))
    cr = bpy.context.object
    cr.scale = (1.0, 1.0, 0.55)
    cr.data.materials.append(m)
    parts.append(cr)
    bpy.ops.object.select_all(action='DESELECT')
    for p in parts: p.select_set(True)
    # jeweled pivot where the rod crosses the column axis
    bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=12, radius=0.030,
        location=(0, 0, z + 0.045))
    jp = bpy.context.object
    jp.scale = (1.0, 1.0, 0.55)
    jp.data.materials.append(RUBY)
    parts.append(jp)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    ob = bpy.context.object
    # pivot MUST be the column axis: rotating about local Z (three Y) then orbits
    # the whole arm around the column, keeping the cradle under the planet.
    bpy.context.scene.cursor.location = (0, 0, z)
    bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    finish(ob, m, bevel=0.008, bevel_seg=2)
    return fxpart(ob, name)

ARM_Z = [1.26, 1.40, 1.54]
ARM_R = [0.88, 1.46, 2.06]
for i in range(3):
    arm(f'arm_{i}', ARM_R[i], ARM_Z[i], BRASS)

# Planets — stone spheres riding the arm tips (scene moves them by angle).
sphere('planet_0', (ARM_R[0], 0, ARM_Z[0] + 0.16), 0.10, MARBLE_A, seg=40, rings=24)
sphere('planet_1', (ARM_R[1], 0, ARM_Z[1] + 0.18), 0.135, MARBLE_B, seg=48, rings=28)
sphere('planet_2', (ARM_R[2], 0, ARM_Z[2] + 0.21), 0.175, MARBLE_C, seg=56, rings=32)

# Props — scattered brass instruments resting on the desk (r > base foot 1.66).
def prop_lens():
    """Brass loupe lying on the desk: ring + short handle."""
    parts = []
    bpy.ops.mesh.primitive_torus_add(major_segments=48, minor_segments=12,
        major_radius=0.22, minor_radius=0.030, location=(1.95, 0.55, 0.035))
    ring_ob = bpy.context.object
    ring_ob.data.materials.append(BRASS_DARK)
    parts.append(ring_ob)
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.024, depth=0.42,
        location=(1.95 + 0.30, 0.55 + 0.17, 0.030))
    h = bpy.context.object
    h.rotation_euler[1] = math.radians(90)
    h.rotation_euler[2] = math.radians(30)
    h.data.materials.append(BRASS_DARK)
    parts.append(h)
    bpy.ops.object.select_all(action='DESELECT')
    for p in parts: p.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    ob = bpy.context.object
    finish(ob, BRASS_DARK, bevel=0.008, bevel_seg=2)
    return fxpart(ob, 'prop_lens')

prop_lens()

def prop_caliper():
    """Dividers/caliper lying open on the desk: two legs + hinge jewel."""
    parts = []
    for sgn in (-1, 1):
        bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=0.018, depth=0.55,
            location=(-1.85 + sgn * 0.11, -0.55, 0.026))
        leg = bpy.context.object
        leg.rotation_euler[1] = math.radians(90)
        leg.rotation_euler[2] = math.radians(sgn * 12)
        leg.data.materials.append(STEEL)
        parts.append(leg)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=12, radius=0.045,
        location=(-1.85, -0.55, 0.05))
    knob = bpy.context.object
    knob.data.materials.append(STEEL)
    parts.append(knob)
    bpy.ops.object.select_all(action='DESELECT')
    for p in parts: p.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    ob = bpy.context.object
    finish(ob, STEEL, bevel=0.006, bevel_seg=2)
    return fxpart(ob, 'prop_caliper')

prop_caliper()

# ---------------------------------------------------------------- export
for ob in sc.objects:
    ob.select_set(True)

bpy.ops.export_scene.gltf(
    filepath=os.path.join(HERE, 'model.glb'),
    export_format='GLB',
    export_extras=True,
    export_yup=True,
    export_apply=True,
)
print('exported model.glb')
