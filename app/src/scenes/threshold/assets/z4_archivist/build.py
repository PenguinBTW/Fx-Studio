# Headless Blender build for THRESHOLD Z4 Archivist. Deterministic; no external assets.
import bpy, math, random, os
from mathutils import Vector
random.seed(4404)
HERE=os.path.dirname(os.path.abspath(__file__))

def reset(): bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
def material(name,color,rough=.75,metal=0,emission=None,estr=0):
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
def cube(name,loc,dims,mat,rot=(0,0,0),bevel=.008):
    bpy.ops.mesh.primitive_cube_add(location=loc,rotation=rot); o=bpy.context.object; o.scale=(dims[0]/2,dims[1]/2,dims[2]/2); bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel: mod=o.modifiers.new('soft_worn_paper_edge','BEVEL'); mod.width=bevel; mod.segments=4
    return finish(o,name,mat)
def cyl(name,loc,radius,depth,mat,rot=(0,0,0),vertices=28):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=radius,depth=depth,location=loc,rotation=rot); o=bpy.context.object; smooth(o); return finish(o,name,mat)
def sphere(name,loc,scale,mat,seg=24,rings=12):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg,ring_count=rings,location=loc); o=bpy.context.object; o.scale=scale; bpy.ops.object.transform_apply(location=False,rotation=False,scale=True); smooth(o); return finish(o,name,mat)
def empty(name,loc=(0,0,0)):
    o=bpy.data.objects.new(name,None); bpy.context.collection.objects.link(o); o.location=loc; o['fx_part']=name; return o
reset()
paper=material('aged_ivory_paper',(0.78,0.72,0.57),.88)
paper2=material('greyed_paper_edge',(0.57,0.51,0.4),.92)
paperhi=material('fresh_torn_paper',(0.92,0.87,0.7),.8)
ink=material('mouth_crease_ink',(0.025,0.018,0.012),.9)
spine_mat=material('book_spine_leather',(0.18,0.085,0.035),.62)
root=empty('archivist_root')
spine=empty('spine_control',(0,0,1.65)); spine.parent=root
# vertical book spine and layered hinge ribs
cyl('book_spine',(0,0,1.55),.11,2.25,spine_mat,vertices=32).parent=spine
for i in range(9):
    z=.55+i*.24
    cube(f'spine_hinge_band_{i+1}',(-.005,-.005,z),(.26,.18,.035),paper2,rot=(0,0,(i%2-.5)*.04),bevel=.006).parent=spine
# waist roll and folded lower body/legs
cyl('waist_roll',(0,0,.72),.17,.72,paper2,rot=(0,math.pi/2,0),vertices=32).parent=root
for side,sgn in [('l',-1),('r',1)]:
    hip=(sgn*.12,0,.66)
    for j in range(5):
        length=.72+random.uniform(-.08,.1)
        x=sgn*(.1+j*.045); y=(j-2)*.025
        strip=cube(f'leg_{side}_folded_strip_{j+1}',(x,y,.32),(0.055,0.025,length),paper if j%2 else paper2,rot=(random.uniform(-.06,.06),random.uniform(-.08,.08),sgn*(.04+j*.025)),bevel=.006)
        strip.parent=root
        # dark folded edge line
        cube(f'leg_{side}_strip_crease_{j+1}',(x+sgn*.018,y-.015,.32),(.006,.006,length*.88),ink,bevel=.001).parent=root
# twelve fanned torso pages around the spine, individually named exactly for animation hooks
for i in range(12):
    k=i-5.5; ang=k*.105
    x=math.sin(ang)*.17; y=-math.cos(ang)*.035
    pg=cube(f'torso_pages_{i+1:02d}',(x,y,1.45+i*.008),(.58-abs(k)*.018,0.024,1.38),paperhi if i in (0,11) else paper,rot=(0,ang*.45,ang*.18),bevel=.012)
    pg.parent=spine
    # horizontal paper layer lines and one torn notch per page
    for c in range(4):
        z=1.0+c*.25+random.uniform(-.025,.025)
        cube(f'torso_page_{i+1:02d}_layerline_{c+1}',(x,y-.018,z),(.45-abs(k)*.012,.006,.006),paper2,rot=(0,ang*.45,0),bevel=.001).parent=spine
    if i%3==0:
        cube(f'torso_page_{i+1:02d}_tear',(x+.22*(1 if i%2 else -1),y-.022,1.82),(.055,.006,.11),ink,rot=(0,ang,0),bevel=.002).parent=spine
# blank face page and folded brow/cheek planes
face=cube('blank_face_page',(0,-.09,2.55),(.58,.035,.74),paperhi,bevel=.018); face.parent=root
cube('face_left_fold',(-.28,-.082,2.55),(.045,.04,.68),paper2,rot=(0,0,-.08),bevel=.006).parent=root
cube('face_right_fold',(.28,-.082,2.55),(.045,.04,.68),paper2,rot=(0,0,.08),bevel=.006).parent=root
cube('face_brow_fold',(0,-.105,2.9),(.55,.035,.045),paper2,rot=(.08,0,0),bevel=.006).parent=root
# mouth is a crease system, not a drawn smile: central fold plus branching cracks
cube('mouth_crease_main',(0,-.116,2.39),(.38,.012,.018),ink,rot=(0,0,-.035),bevel=.002).parent=root
for i,x in enumerate((-.16,-.07,.06,.15)):
    cube(f'mouth_crease_branch_{i+1}',(x,-.118,2.42+i%2*.025),(.11,.01,.009),ink,rot=(0,0,(i-1.5)*.28),bevel=.001).parent=root
# accordion arms: alternating folded panels and hinge beads, extending sideways in canonical asset space
for side,sgn in [('l',-1),('r',1)]:
    armroot=empty(f'arm_{side}_root',(sgn*.28,0,2.03)); armroot.parent=root
    for j in range(12):
        # zig-zag in both depth and vertical angle; panels overlap like a party blower
        x=sgn*(.43+j*.255); z=2.03+math.sin(j*.9)*.055-j*.012; y=(j%2-.5)*.075
        panel=cube(f'arm_{side}_accordion_panel_{j+1:02d}',(x,y,z),(.29,.028,.105),paper if j%2 else paper2,rot=(0,sgn*(j%2-.5)*.34,sgn*(j%2-.5)*.22),bevel=.008)
        panel.parent=armroot; panel.matrix_parent_inverse=armroot.matrix_world.inverted()
        sphere(f'arm_{side}_hinge_{j+1:02d}',(x,y,z),(.055,.035,.06),paperhi,18,9).parent=armroot
        if j%2==0: cube(f'arm_{side}_panel_crease_{j+1:02d}',(x,y-.019,z),(.22,.005,.008),ink,rot=(0,0,sgn*.08),bevel=.001).parent=armroot
    # paper-strip hand fan and five long fingers
    handx=sgn*(.43+12*.255)
    cube(f'hand_{side}_paper_fan',(handx,0,1.86),(.28,.035,.22),paperhi,rot=(0,0,sgn*.08),bevel=.01).parent=armroot
    for fi in range(5):
        length=.42+fi*.035+random.uniform(-.02,.02)
        finger=cube(f'finger_{side}_{fi+1}',(handx+sgn*.12,(fi-2)*.035,1.77-fi*.008),(.035,.018,length),paperhi if fi%2 else paper,rot=(.12*fi,sgn*.1,sgn*(fi-2)*.12),bevel=.004)
        finger.parent=armroot
# dense edge fibres, page holes and crease ticks: small deterministic paper damage catches flashlight grazing light
for i in range(72):
    page=i%12; k=page-5.5; ang=k*.105
    side=-1 if i%2 else 1
    x=math.sin(ang)*.17+side*(.24-abs(k)*.006)
    y=-math.cos(ang)*.035-.024
    z=.92+(i//12)*.18+random.uniform(-.025,.025)
    cube(f'torso_edge_fibre_{i+1:02d}',(x,y,z),(.006,.004,.065+random.uniform(0,.045)),paperhi if i%3 else paper2,rot=(0,ang*.45,side*(.18+random.uniform(0,.12))),bevel=.001).parent=spine
for i in range(24):
    x=(i%6-2.5)*.075; z=2.28+(i//6)*.16
    cube(f'face_pressure_crease_{i+1:02d}',(x,-.119,z),(.045,.006,.004),ink if i%4==0 else paper2,rot=(0,0,(i%5-2)*.16),bevel=.001).parent=root
# loose hair-like paper strips around shoulders
for i in range(18):
    sgn=-1 if i<9 else 1; j=i%9
    x=sgn*(.18+j*.018); z=1.92-j*.035; y=-.02+random.uniform(-.025,.025)
    cube(f'shoulder_loose_strip_{i+1:02d}',(x,y,z),(.025,.014,.34+random.uniform(-.04,.08)),paper2,rot=(random.uniform(-.12,.12),random.uniform(-.1,.1),sgn*(.12+j*.025)),bevel=.003).parent=root
# export
bpy.ops.object.select_all(action='SELECT')
out=os.path.join(HERE,'model.glb')
bpy.ops.export_scene.gltf(filepath=out,export_format='GLB',export_extras=True,export_apply=True,export_animations=False)
print('exported',out)
