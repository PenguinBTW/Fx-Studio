# Headless Blender build for THRESHOLD Z3 Mirrorling. Deterministic; no external assets.
import bpy, math, random, os
from mathutils import Vector
random.seed(3303)
HERE=os.path.dirname(os.path.abspath(__file__))

def reset(): bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
def material(name,color,rough=.2,metal=0,emission=None,estr=0):
    m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF'); bs.inputs['Base Color'].default_value=(*color,1); bs.inputs['Roughness'].default_value=rough; bs.inputs['Metallic'].default_value=metal
    if emission:
        key='Emission Color' if 'Emission Color' in bs.inputs else 'Emission'; bs.inputs[key].default_value=(*emission,1); bs.inputs['Emission Strength'].default_value=estr
    return m
def finish(o,name,mat=None):
    o.name=name; o['fx_part']=name
    if mat: o.data.materials.append(mat)
    return o
def smooth(o):
    if hasattr(o.data,'polygons'):
        for p in o.data.polygons: p.use_smooth=True
def sphere(name,loc,scale,mat,seg=32,rings=16):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg,ring_count=rings,location=loc); o=bpy.context.object; o.scale=scale; bpy.ops.object.transform_apply(location=False,rotation=False,scale=True); smooth(o); return finish(o,name,mat)
def cyl_between(name,a,b,r1,r2,mat,vertices=40):
    a,b=Vector(a),Vector(b); d=b-a
    bpy.ops.mesh.primitive_cone_add(vertices=vertices,radius1=r1,radius2=r2,depth=d.length,location=(a+b)*.5)
    o=bpy.context.object; o.rotation_mode='QUATERNION'; o.rotation_quaternion=d.to_track_quat('Z','Y'); smooth(o); return finish(o,name,mat)
def torus(name,loc,major,minor,mat,rot=(0,0,0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=major,minor_radius=minor,major_segments=56,minor_segments=12,location=loc,rotation=rot); o=bpy.context.object; smooth(o); return finish(o,name,mat)
def band_on_segment(name,a,b,u,radius,mat,thickness=.024):
    a,b=Vector(a),Vector(b); d=(b-a).normalized(); c=a.lerp(b,u)
    return cyl_between(name,c-d*(thickness*.5),c+d*(thickness*.5),radius,radius,mat,vertices=32)
def cube(name,loc,dims,mat,rot=(0,0,0),bevel=.01):
    bpy.ops.mesh.primitive_cube_add(location=loc,rotation=rot); o=bpy.context.object; o.scale=(dims[0]/2,dims[1]/2,dims[2]/2); bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel: mod=o.modifiers.new('soft_tile_edges','BEVEL'); mod.width=bevel; mod.segments=2
    return finish(o,name,mat)
def empty(name,loc=(0,0,0)):
    o=bpy.data.objects.new(name,None); bpy.context.collection.objects.link(o); o.location=loc; o['fx_part']=name; return o
reset()
chrome=material('aqua_chrome_tile',(0.68,0.91,0.92),.07,0.92)
chrome2=material('pale_tile_highlight',(0.9,1.0,0.96),.12,0.62)
grout=material('black_grout_lines',(0.005,0.018,0.02),.7,0.05)
ripplemat=material('ripple_ring_aqua',(0.25,0.9,0.9),.18,0.1,(0.2,0.8,0.9),.7)
root=empty('mirrorling_root')
# narrow leg columns taper to points in the water: no feet ever read
for side,x in [('l',-.12),('r',.12)]:
    hip=(x,0,1.35); knee=(x+(.025 if side=='l' else -.02),0,.72); tip=(x+(.04 if side=='l' else -.035),0,.03)
    a=cyl_between(f'leg_{side}_upper',hip,knee,.088,.066,chrome); a.parent=root
    b=cyl_between(f'leg_{side}_lower',knee,tip,.066,.026,chrome); b.parent=root
    sphere(f'knee_{side}',knee,(.088,.07,.094),chrome2,24,12).parent=root
    sphere(f'hip_socket_{side}',hip,(.105,.075,.11),chrome2,28,14).parent=root
    for band,u in enumerate((.34,.68)):
        band_on_segment(f'leg_{side}_upper_grout_{band}',hip,knee,u,.091,grout).parent=root
        band_on_segment(f'leg_{side}_lower_grout_{band}',knee,tip,u,.067,grout).parent=root
# impossibly narrow ribbed torso, slightly asymmetric
sphere('torso_core',(0,0,1.58),(.19,.12,.48),chrome,36,18).parent=root
for i,z in enumerate((1.18,1.34,1.5,1.66,1.82,1.96)):
    torus(f'torso_tile_band_{i+1}',(0,0,z),.185-(i*.008),.007,grout).parent=root
# shoulders and a dark tile seam spine
cyl_between('shoulder_bar',(-.28,0,1.95),(.28,0,1.95),.055,.05,chrome2).parent=root
cube('spine_grout',(0,-.115,1.57),(.018,.012,.72),grout,bevel=.002).parent=root
# upside-down teardrop head: broad cranium tapering to a downward point/chin
sphere('head_teardrop_cranium',(0,0,2.28),(.19,.145,.28),chrome,40,20).parent=root
bpy.ops.mesh.primitive_cone_add(vertices=36,radius1=.035,radius2=.15,depth=.38,location=(0,0,2.05))
chin=finish(bpy.context.object,'head_pointed_chin',chrome); smooth(chin); chin.parent=root
for z in (2.18,2.32,2.45): torus(f'head_grout_{z}',(0,0,z),.15,.005,grout).parent=root
# blank mirror face inset
sphere('blank_mirror_face',(0,-.125,2.28),(.125,.018,.22),chrome2,32,16).parent=root
# very long two-segment arms, bony joints, tile banding
for side,sgn in [('l',-1),('r',1)]:
    shoulder=(sgn*.28,0,1.94); elbow=(sgn*.62,-.015,1.28); wrist=(sgn*.43,-.025,.64)
    upper=cyl_between(f'arm_{side}_upper',shoulder,elbow,.072,.054,chrome); upper.parent=root
    lower=cyl_between(f'arm_{side}_lower',elbow,wrist,.054,.032,chrome); lower.parent=root
    sphere(f'shoulder_socket_{side}',shoulder,(.082,.06,.082),chrome2,28,14).parent=root
    sphere(f'elbow_{side}',elbow,(.074,.06,.078),chrome2,24,12).parent=root
    sphere(f'wrist_{side}',wrist,(.052,.044,.056),chrome2,20,10).parent=root
    for j in range(4):
        # fingers hang and taper; asymmetric lengths
        base=Vector(wrist)+Vector((sgn*(j-1.5)*.018,-.005,-.025))
        end=base+Vector((sgn*.015*(j-1.5),-.01,-.18-random.uniform(0,.07)))
        cyl_between(f'finger_{side}_{j+1}',base,end,.009,.003,chrome2,vertices=24).parent=root
    for k,u in enumerate((.34,.68)):
        band_on_segment(f'arm_{side}_upper_grout_{k+1}',shoulder,elbow,u,.074,grout).parent=root
        band_on_segment(f'arm_{side}_lower_grout_{k+1}',elbow,wrist,u,.055,grout).parent=root
# ripple/contact rings at the waterline, exported as separate named controls
for i,r in enumerate((.28,.43,.61)):
    ring=torus(f'water_ripple_ring_{i+1}',(0,0,.012+i*.004),r,.008,ripplemat); ring.parent=root
# raised tile chips and hairline grout registration marks make the chrome read as assembled wet tile, not smooth plastic
for i in range(36):
    z=.78+(i%12)*.11; a=(i//12)*2.09+(i%12)*.17
    x=math.cos(a)*.145; y=math.sin(a)*.095
    chip=cube(f'body_tile_chip_{i+1:02d}',(x,y,z),(.035,.008,.052),chrome2 if i%3 else chrome,rot=(0,a,0),bevel=.003)
    chip.parent=root
for i in range(18):
    a=i*.349
    ring=cyl_between(f'head_hairline_grout_{i+1:02d}',(math.cos(a)*.11,-.132,2.12),(math.cos(a)*.13,-.132,2.43),.0022,.0014,grout,vertices=8)
    ring.parent=root
# small inverted reflection anchor empty for scene-side mirrored copy alignment
empty('reflection_anchor',(0,0,0)).parent=root
bpy.ops.object.select_all(action='SELECT')
out=os.path.join(HERE,'model.glb')
bpy.ops.export_scene.gltf(filepath=out,export_format='GLB',export_extras=True,export_apply=True,export_animations=False)
print('exported',out)
