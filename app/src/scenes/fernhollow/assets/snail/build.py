"""fernhollow snail — rigged body + shell, 'glide' pedal-wave clip."""
import bpy, math, sys, os
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
from _bl import reset, export

reset()

def uv_sphere(name, loc, scale, mat, seg=24, rings=16):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=rings, location=loc)
    o = bpy.context.object
    o.name = name
    o.scale = scale
    bpy.ops.object.transform_apply(scale=True)
    bpy.ops.object.shade_smooth()
    o.data.materials.append(mat)
    return o

# materials
body_mat = bpy.data.materials.new("snail_body")
body_mat.use_nodes = True
b = body_mat.node_tree.nodes["Principled BSDF"]
b.inputs["Base Color"].default_value = (0.30, 0.23, 0.15, 1.0)
b.inputs["Roughness"].default_value = 0.25
shell_mat = bpy.data.materials.new("snail_shell")
shell_mat.use_nodes = True
s = shell_mat.node_tree.nodes["Principled BSDF"]
s.inputs["Base Color"].default_value = (0.38, 0.22, 0.09, 1.0)
s.inputs["Roughness"].default_value = 0.3

# body: elongated soft foot + head, along +Y, foot flat on z=0
body = uv_sphere("body", (0, 0.0, 0.055), (0.055, 0.16, 0.055), body_mat)
body["fx_part"] = "body"
# head bulb forward
head = uv_sphere("head", (0, 0.15, 0.09), (0.04, 0.055, 0.045), body_mat)
head["fx_part"] = "head"
# eyestalks: thin cones angled up-forward
stalks = []
for side in (-1, 1):
    bpy.ops.mesh.primitive_cone_add(vertices=10, radius1=0.008, radius2=0.004, depth=0.09,
        location=(side * 0.02, 0.185, 0.15), rotation=(math.radians(35), 0, side * math.radians(12)))
    st = bpy.context.object
    st.name = f"stalk{'L' if side < 0 else 'R'}"
    st.data.materials.append(body_mat)
    st["fx_part"] = st.name
    stalks.append(st)

# shell: flattened spiral-ish sphere, banded look via noiseless simple scaled sphere
shell = uv_sphere("shell", (0, -0.045, 0.115), (0.075, 0.095, 0.075), shell_mat)
shell.rotation_euler[0] = math.radians(-18)
shell["fx_part"] = "shell"

# rig: single bone chain for glide pedal wave — simple armature, body skinned
bpy.ops.object.armature_add(location=(0, 0, 0))
arm = bpy.context.object
arm.name = "snail_rig"
bpy.ops.object.mode_set(mode='EDIT')
eb = arm.data.edit_bones[0]
eb.head = (0, -0.14, 0.02); eb.tail = (0, 0.0, 0.02)
b2 = arm.data.edit_bones.new("wave2")
b2.head = (0, 0.0, 0.02); b2.tail = (0, 0.14, 0.02); b2.parent = eb
bpy.ops.object.mode_set(mode='OBJECT')

# parent body+head+stalks+shell to armature with automatic weights
for o in [body, head, shell] + stalks:
    o.select_set(True)
arm.select_set(True)
bpy.context.view_layer.objects.active = arm
bpy.ops.object.parent_set(type='ARMATURE_AUTO')
for o in [body, head, shell] + stalks:
    o.select_set(False)
arm.select_set(False)

# glide clip: slow pedal wave — bones undulate in Z, 4s loop, deterministic
arm.animation_data_create()
act = bpy.data.actions.new("glide")
arm.animation_data.action = act
fps = 24
frames = list(range(0, 97, 8))  # 4s loop at 24fps
import math as m
for f in frames:
    t = f / 24.0
    ph = t * m.pi  # half-cycle per loop → seamless-ish undulation
    for bname, amp, off in (("Bone", 0.010, 0.0), ("wave2", 0.012, 1.2)):
        pb = arm.pose.bones.get(bname)
        if pb is None: continue
        z = amp * m.sin(ph + off)
        pb.location = (0, 0, z)
        pb.keyframe_insert("location", frame=f, group=bname)
# ensure cyclic interpolation linear-ish
for fc in act.fcurves:
    for kp in fc.keyframe_points:
        kp.interpolation = 'SINE' if 'SINE' in {'BEZIER','SINE'} else 'BEZIER'
    fc.modifiers.new('CYCLES')

scn = bpy.context.scene
scn.frame_start = 0; scn.frame_end = 96
scn.render.fps = 24

export(HERE)
print("snail exported")
