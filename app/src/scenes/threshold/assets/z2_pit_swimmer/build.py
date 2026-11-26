# Headless Blender build for THRESHOLD Z2 Pit Swimmer. Deterministic; no external assets.
import bpy, math, random, os
from mathutils import Vector
random.seed(2202)
HERE=os.path.dirname(os.path.abspath(__file__))

def reset():
    bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)

def material(name,color,rough=.45,metal=0.0,emission=None,estr=0.0):
    m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF'); bs.inputs['Base Color'].default_value=(*color,1); bs.inputs['Roughness'].default_value=rough; bs.inputs['Metallic'].default_value=metal
    if emission:
        key='Emission Color' if 'Emission Color' in bs.inputs else 'Emission'
        bs.inputs[key].default_value=(*emission,1); bs.inputs['Emission Strength'].default_value=estr
    return m

def finish(o,name,part,mat=None):
    o.name=name; o['fx_part']=name
    if mat: o.data.materials.append(mat)
    return o

def smooth(o):
    if hasattr(o.data,'polygons'):
        for p in o.data.polygons: p.use_smooth=True

def sphere(name,loc,scale,mat,part=None,seg=28,rings=14):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg,ring_count=rings,location=loc)
    o=bpy.context.object; o.scale=scale; bpy.ops.object.transform_apply(location=False,rotation=False,scale=True); smooth(o)
    return finish(o,name,part or name,mat)

def cube(name,loc,dims,mat,part=None,bevel=.02,rot=(0,0,0)):
    bpy.ops.mesh.primitive_cube_add(location=loc,rotation=rot)
    o=bpy.context.object; o.scale=(dims[0]/2,dims[1]/2,dims[2]/2); bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:
        mod=o.modifiers.new('moulded_rounding','BEVEL'); mod.width=bevel; mod.segments=3
    return finish(o,name,part or name,mat)

def cyl_between(name,a,b,r,mat,part=None,vertices=20):
    a,b=Vector(a),Vector(b); d=b-a; mid=(a+b)*.5
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=r,depth=d.length,location=mid)
    o=bpy.context.object; o.rotation_mode='QUATERNION'; o.rotation_quaternion=d.to_track_quat('Z','Y'); smooth(o)
    return finish(o,name,part or name,mat)

def cone(name,loc,r1,r2,depth,mat,part=None,rot=(0,0,0),vertices=20):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices,radius1=r1,radius2=r2,depth=depth,location=loc,rotation=rot)
    o=bpy.context.object; smooth(o); return finish(o,name,part or name,mat)

def torus(name,loc,major,minor,mat,part=None,rot=(0,0,0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=major,minor_radius=minor,major_segments=32,minor_segments=10,location=loc,rotation=rot)
    o=bpy.context.object; smooth(o); return finish(o,name,part or name,mat)

def empty(name,loc=(0,0,0)):
    o=bpy.data.objects.new(name,None); bpy.context.collection.objects.link(o); o.location=loc; o['fx_part']=name; return o

reset()
red=material('ball_red_vinyl',(0.82,0.035,0.025),.2)
yellow=material('slide_yellow_plastic',(1.0,0.65,0.025),.18)
blue=material('ball_blue_vinyl',(0.025,0.19,0.85),.2)
green=material('ball_green_vinyl',(0.03,0.62,0.16),.22)
orange=material('ball_orange_vinyl',(1.0,0.25,0.025),.2)
white=material('painted_eye_white',(0.95,0.92,0.82),.26)
black=material('painted_pupil_black',(0.006,0.004,0.003),.18)
mouthdark=material('mouth_deep_red_black',(0.055,0.002,0.004),.65)
toothmat=material('slide_stopper_teeth',(0.95,0.86,0.62),.32)
seammat=material('vinyl_seam_shadow',(0.08,0.025,0.02),.72)
root=empty('pit_swimmer_root')

# Broad fused-ball skull, one metre-plus across. Balls overlap rather than merely touching.
palette=[red,blue,green,orange,yellow]
skull_centers=[]
for i in range(54):
    # deterministic low-discrepancy shell clustered into an ellipsoid
    u=(i*0.61803398875)%1; v=((i*0.754877666)+.17)%1; w=((i*0.56984029)+.31)%1
    theta=2*math.pi*u; phi=math.acos(2*v-1); rr=.48*(.42+.58*w)
    x=math.sin(phi)*math.cos(theta)*rr*1.2
    y=math.sin(phi)*math.sin(theta)*rr*.72-.02
    z=math.cos(phi)*rr*.72+.08
    skull_centers.append((x,y,z))
    r=.12+((i*37)%11)*.006
    b=sphere(f'fused_skull_ball_{i+1:02d}',(x,y,z),(r,r,r),palette[i%len(palette)],seg=32,rings=16); b.parent=root
    # visible vinyl highlight cap/seam on selected balls
    if i%5==0:
        torus(f'fused_skull_ball_{i+1:02d}_seam',(x,y,z),r*.78,r*.018,seammat,rot=(math.pi/2,0,theta)).parent=root

# Deep mouth cavity facing negative Y.
sphere('mouth_cavity',(0,-.48,-.02),(.42,.20,.28),mouthdark,seg=32,rings=16).parent=root
# Hinged yellow slide jaws, assembled from overlapping curved chute sections.
upper=empty('slide_mouth_upper_root',(0,-.38,.13)); upper.parent=root
lower=empty('slide_mouth_lower_root',(0,-.38,-.16)); lower.parent=root
for side,rootobj,zsign in [('upper',upper,1),('lower',lower,-1)]:
    for j in range(6):
        yy=-.34-j*.095; zz=zsign*(.12+j*.035+(j/5)**2*.12)
        panel=cube(f'slide_mouth_{side}_panel_{j+1}',(0,yy,zz),(.62-j*.025,.13,.075),yellow,bevel=.035,rot=(zsign*(.12+j*.08),0,0))
        panel.parent=rootobj; panel.matrix_parent_inverse=rootobj.matrix_world.inverted()
    # side rails make the slide silhouette unmistakable
    for x in (-.31,.31):
        rail=cyl_between(f'slide_mouth_{side}_rail_{x}',(x,-.31,zsign*.08),(x,-.88,zsign*.34),.025,yellow,vertices=16)
        rail.parent=rootobj; rail.matrix_parent_inverse=rootobj.matrix_world.inverted()

# Twenty stopper teeth, ten upper and ten lower, irregularly worn.
for i in range(10):
    x=-.25+i*.055
    up=cone(f'tooth_upper_{i+1:02d}',(x,-.70,-.015+(i%2)*.012),.018,.006,.11,toothmat,rot=(math.pi,0,0),vertices=16); up.parent=upper
    lo=cone(f'tooth_lower_{i+1:02d}',(x+.018,-.69,-.12-(i%2)*.009),.018,.006,.10,toothmat,vertices=16); lo.parent=lower
    if i in (2,7):
        # chipped dark notch
        cube(f'tooth_chip_{i+1}',(x,-.715,.035),(0.018,.012,.018),seammat,bevel=.002).parent=upper

# Cartoon painted eyes: vinyl balls, white iris discs, off-centre pupils and pressure seams.
for side,x in [('l',-.27),('r',.27)]:
    sphere(f'eye_ball_{side}',(x,-.42,.34),(.14,.10,.14),red if side=='l' else blue,seg=32,rings=16).parent=root
    # iris disc points roughly forward/down (-Y)
    bpy.ops.mesh.primitive_cylinder_add(vertices=32,radius=.072,depth=.012,location=(x,-.515,.35),rotation=(math.pi/2,0,0))
    iris=finish(bpy.context.object,f'eye_iris_{side}',f'eye_iris_{side}',white); smooth(iris); iris.parent=root
    bpy.ops.mesh.primitive_cylinder_add(vertices=24,radius=.029,depth=.014,location=(x+(.012 if side=='l' else -.012),-.525,.35),rotation=(math.pi/2,0,0))
    pup=finish(bpy.context.object,f'eye_pupil_{side}',f'eye_pupil_{side}',black); smooth(pup); pup.parent=root
    torus(f'eye_pressure_seam_{side}',(x,-.42,.34),.115,.012,seammat,rot=(math.pi/2,0,0)).parent=root

# Inflated vinyl cheeks, crease dimples, and asymmetric scuffed patches.
for side,x in [('l',-.43),('r',.43)]:
    sphere(f'cheek_{side}',(x,-.31,.02),(.20,.14,.18),red if side=='l' else orange,seg=32,rings=16).parent=root
    for k in range(3):
        sphere(f'cheek_{side}_dimple_{k+1}',(x+(-.08 if side=='l' else .08),-.42,.02+k*.045),(.018,.009,.018),seammat,seg=16,rings=8).parent=root

# Six-metre eel body: fused diminishing balls and ten dorsal ridge balls.
for i in range(24):
    yy=.28+i*.22; taper=1-i/28; rr=.24*taper+.08
    x=math.sin(i*.55)*.10*taper; z=-.03+math.sin(i*.42)*.04
    body=sphere(f'body_fused_ball_{i+1:02d}',(x,yy,z),(rr*1.05,rr*1.28,rr*.88),palette[(i+2)%len(palette)],seg=28,rings=14); body.parent=root
    if i%3==0: torus(f'body_seam_{i+1:02d}',(x,yy,z),rr*.75,rr*.045,seammat,rot=(math.pi/2,0,i*.2)).parent=root
for i in range(10):
    yy=.28+i*.52; rr=.16-(i*.008)
    ridge=sphere(f'ridge_{i+1:02d}',(math.sin(i*.7)*.06,yy,.24+math.sin(i*.45)*.035),(rr,rr*1.1,rr),palette[(i+1)%len(palette)],seg=28,rings=14); ridge.parent=root
    # small moulded plug/inflation valve on alternating ridge balls
    if i%2==0: cyl_between(f'ridge_valve_{i+1:02d}',(0,yy,.31),(0,yy,.39),.018,seammat,vertices=12).parent=root
# tapered tail cap and two small vinyl fin paddles
sphere('tail_cap',(0,5.42,.02),(.09,.18,.08),blue,seg=24,rings=12).parent=root
for side,x in [('l',-.13),('r',.13)]:
    fin=cube(f'tail_fin_{side}',(x,4.85,-.02),(.28,.48,.035),green if side=='l' else orange,bevel=.04,rot=(0,(-.25 if side=='l' else .25),(.35 if side=='l' else -.35))); fin.parent=root

bpy.ops.object.select_all(action='SELECT')
out=os.path.join(HERE,'model.glb')
bpy.ops.export_scene.gltf(filepath=out,export_format='GLB',export_extras=True,export_apply=True,export_animations=False)
print('exported',out)
