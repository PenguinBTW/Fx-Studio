# Headless Blender build for THRESHOLD Z1 Ceiling Breather. Deterministic; no external assets.
import bpy, math, random, os
from mathutils import Vector
random.seed(1101)
HERE = os.path.dirname(os.path.abspath(__file__))

def reset():
    bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
    for datablocks in (bpy.data.meshes, bpy.data.curves, bpy.data.materials, bpy.data.cameras, bpy.data.lights):
        pass

def material(name, color, rough=.6, metal=0.0, emission=None, estr=0.0):
    m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF'); bs.inputs['Base Color'].default_value=(*color,1)
    bs.inputs['Roughness'].default_value=rough; bs.inputs['Metallic'].default_value=metal
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

def cube(name,loc,dims,mat,part,bevel=.015):
    bpy.ops.mesh.primitive_cube_add(location=loc)
    o=bpy.context.object; o.scale=(dims[0]/2,dims[1]/2,dims[2]/2)
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:
        mod=o.modifiers.new('worn_soft_edges','BEVEL'); mod.width=bevel; mod.segments=2
    return finish(o,name,part,mat)

def sphere(name,loc,scale,mat,part,seg=24,rings=12):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=rings, location=loc)
    o=bpy.context.object; o.scale=scale; bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    smooth(o); return finish(o,name,part,mat)

def cyl_between(name,a,b,r,mat,part,vertices=16):
    a,b=Vector(a),Vector(b); d=b-a; mid=(a+b)*.5
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=r, depth=d.length, location=mid)
    o=bpy.context.object; o.rotation_mode='QUATERNION'; o.rotation_quaternion=d.to_track_quat('Z','Y')
    smooth(o); return finish(o,name,part,mat)

def torus(name,loc,major,minor,mat,part,rot=(0,0,0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=major,minor_radius=minor,major_segments=24,minor_segments=8,location=loc,rotation=rot)
    o=bpy.context.object; smooth(o); return finish(o,name,part,mat)

def empty(name,loc=(0,0,0),part=None):
    o=bpy.data.objects.new(name,None); bpy.context.collection.objects.link(o); o.location=loc
    if part: o['fx_part']=name
    return o

reset()
skin=material('tile_skin_warm_grey',(0.48,0.47,0.43),.82)
skin_hi=material('tile_skin_pressure_edges',(0.62,0.59,0.52),.72)
eye=material('wet_eye_yellow',(0.72,0.68,0.25),.08,0, (0.55,0.8,0.18), .55)
pupil=material('goat_pupil_black',(0.004,0.003,0.002),.12)
nail=material('cracked_nail_yellow',(0.58,0.46,0.16),.5)
padmat=material('suction_pad_pale',(0.68,0.62,0.55),.38)
crackmat=material('nail_crack_dark',(0.08,0.045,0.015),.9)
root=empty('ceiling_breather_root',part='root')

# Twelve fused acoustic-tile skin plates. They are the creature's back, not ordinary loose tiles.
tiles=[]
for row in range(2):
    for col in range(6):
        i=row*6+col; x=-1.45+col*.58; y=-.29+row*.58
        z=.015+random.uniform(-.008,.008)
        t=cube(f'tile_skin_{i+1:02d}',(x,y,z),(.54+random.uniform(-.025,.025),.54+random.uniform(-.025,.025),.055),skin,f'tile_skin_{i+1}',.025)
        t.rotation_euler[2]=random.uniform(-.025,.025); t.parent=root; t.matrix_parent_inverse=root.matrix_world.inverted(); tiles.append(t)
        # branching pressure cracks on every tile
        for k in range(2):
            cx=x+random.uniform(-.16,.16); cy=y+random.uniform(-.16,.16)
            c=cube(f'tile_skin_{i+1:02d}_crack_{k}',(cx,cy,z-.031),(random.uniform(.12,.24),.008,.006),crackmat,f'tile_skin_{i+1}',.001)
            c.rotation_euler[2]=random.uniform(-1.2,1.2); c.parent=root; c.matrix_parent_inverse=root.matrix_world.inverted()
        # raised asymmetric blister/pore clusters
        for k in range(3):
            sphere(f'tile_skin_{i+1:02d}_pore_{k}',(x+random.uniform(-.2,.2),y+random.uniform(-.2,.2),z-.032),(random.uniform(.008,.018),random.uniform(.008,.018),.006),skin_hi,f'tile_skin_{i+1}',12,6).parent=root

# Eye housings in the central missing-tile gap: exactly 70cm apart, each 12cm wide.
for side,x in [('l',-.35),('r',.35)]:
    e=sphere(f'eye_{side}',(x,-.015,-.105),(.06,.042,.035),eye,f'eye_{side}',40,20); e.parent=root
    # horizontal goat pupil: a black slit, deliberately wider than tall
    p=cube(f'pupil_{side}',(x,-.055,-.128),(.072,.012,.012),pupil,f'pupil_{side}',.006); p.parent=root
    # bottom-heavy upper/lower lid shells with independent blink hooks
    lid1=sphere(f'lid_{side}_upper',(x,-.018,-.088),(.067,.045,.018),skin,f'lid_{side}_upper',28,12); lid1.scale.z=.55; lid1.parent=root
    lid2=sphere(f'lid_{side}_lower',(x,-.018,-.12),(.067,.045,.014),skin_hi,f'lid_{side}_lower',28,12); lid2.scale.z=.45; lid2.parent=root
    # wet rim
    torus(f'eye_rim_{side}',(x,-.022,-.108),.064,.008,skin_hi,f'eye_{side}',(math.pi/2,0,0)).parent=root

# Eight long three-jointed fingers. Chains curl unevenly through the ceiling gap.
for fi in range(8):
    x=-.63+fi*.18; side=-1 if fi<4 else 1
    rootE=empty(f'finger_{fi+1}_root',(x,.04,-.03),part=f'finger_{fi+1}_root'); rootE.parent=root
    pts=[]
    length=.9+(fi%4)*.12+random.uniform(-.04,.04)
    for j in range(4):
        z=-.03-length*j/3
        xx=x+math.sin(fi*1.7+j*.9)*.035*j
        yy=.04+math.cos(fi*1.1+j*.7)*.025*j
        pts.append((xx,yy,z))
    for j in range(3):
        seg=cyl_between(f'finger_{fi+1}_segment_{j+1}',pts[j],pts[j+1],.035-j*.006,skin,f'finger_{fi+1}',20); seg.parent=rootE; seg.matrix_parent_inverse=rootE.matrix_world.inverted()
        joint=sphere(f'finger_{fi+1}_joint_{j+1}',pts[j+1],(.046-j*.005,.046-j*.005,.04),skin_hi,f'finger_{fi+1}',20,10); joint.parent=rootE; joint.matrix_parent_inverse=rootE.matrix_world.inverted()
        # tendon rings/wrinkles
        for wr in range(2):
            pp=Vector(pts[j]).lerp(Vector(pts[j+1]),.35+wr*.3)
            torus(f'finger_{fi+1}_wrinkle_{j+1}_{wr}',pp,.036-j*.005,.004,skin_hi,f'finger_{fi+1}').parent=rootE
    tip=Vector(pts[-1])
    # cracked yellow nail and dark crack lines
    bpy.ops.mesh.primitive_cone_add(vertices=20,radius1=.018,radius2=.042,depth=.13,location=tip+Vector((0,0,-.055)))
    n=finish(bpy.context.object,f'finger_{fi+1}_nail',f'finger_{fi+1}',nail); smooth(n); n.parent=rootE; n.matrix_parent_inverse=rootE.matrix_world.inverted()
    for c in range(3):
        crack=cube(f'finger_{fi+1}_nail_crack_{c}',tip+Vector((random.uniform(-.015,.015),-.025,-.08-c*.018)),(.004,.006,.035),crackmat,f'finger_{fi+1}',.001)
        crack.rotation_euler[2]=random.uniform(-.5,.5); crack.parent=rootE
    # suction pads along the inner finger face
    inward=Vector((-side*.025,-.035,0))
    for pd in range(5):
        pp=Vector(pts[1]).lerp(Vector(pts[3]),pd/4)+inward
        s=sphere(f'finger_{fi+1}_suction_pad_{pd+1}',pp,(.018,.009,.014),padmat,f'finger_{fi+1}',16,8); s.parent=rootE; s.matrix_parent_inverse=rootE.matrix_world.inverted()

# Asymmetric lip/torn membrane around the central opening.
for i in range(18):
    ang=i/18*math.pi*2; r=.42+random.uniform(-.025,.025)
    flap=cube(f'gap_membrane_flap_{i+1:02d}',(math.cos(ang)*r,math.sin(ang)*r*.42,-.045),(.12,.035,.025),skin_hi,'tile_skin_membrane',.012)
    flap.rotation_euler[2]=ang+math.pi/2+random.uniform(-.25,.25); flap.parent=root

# Export deterministic GLB with custom fx_part extras.
bpy.ops.object.select_all(action='SELECT')
out=os.path.join(HERE,'model.glb')
bpy.ops.export_scene.gltf(filepath=out,export_format='GLB',export_extras=True,export_apply=True,export_animations=False)
print('exported',out)
