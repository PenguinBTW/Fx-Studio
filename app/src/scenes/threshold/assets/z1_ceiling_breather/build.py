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

def taper_between(name,a,b,r0,r1,mat,part,vertices=20):
    a,b=Vector(a),Vector(b); d=b-a; mid=(a+b)*.5
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=r0, radius2=r1, depth=d.length, location=mid)
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
padmat=material('suction_pad_pale',(0.46,0.36,0.29),.52)
crackmat=material('nail_crack_dark',(0.08,0.045,0.015),.9)
veinmat=material('purple_vein_low_flash',(0.16,0.035,0.19),.48)
wetdrop=material('wet_skin_specular_droplets',(0.82,0.68,0.62),.06)
catchmat=material('wet_eye_catchlight',(0.95,0.98,0.72),.015,0,(0.45,0.52,0.18),.18)
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
    p=cube(f'pupil_{side}',(x,-.058,-.128),(.052,.008,.010),pupil,f'pupil_{side}',.005); p.parent=root
    for px in (-.026,.026): sphere(f'pupil_round_end_{side}_{px}',(x+px,-.058,-.128),(.010,.004,.006),pupil,f'pupil_{side}',12,6).parent=root
    # bottom-heavy upper/lower lid shells with independent blink hooks
    lid1=sphere(f'lid_{side}_upper',(x,-.018,-.088),(.067,.045,.018),skin,f'lid_{side}_upper',28,12); lid1.scale.z=.55; lid1.parent=root
    lid2=sphere(f'lid_{side}_lower',(x,-.018,-.12),(.067,.045,.014),skin_hi,f'lid_{side}_lower',28,12); lid2.scale.z=.45; lid2.parent=root
    # wet rim
    torus(f'eye_rim_{side}',(x,-.022,-.108),.064,.008,skin_hi,f'eye_{side}',(math.pi/2,0,0)).parent=root
    sphere(f'eye_catchlight_{side}',(x-.018,-.063,-.104),(.012,.004,.008),catchmat,f'eye_{side}',14,7).parent=root

# Eight curling four-segment fingers. Each phalanx is tapered and overlapped at the knuckle,
# with asymmetrical curl rather than straight pipe runs.
for fi in range(8):
    x=-.76+fi*.205+[-.035,.025,-.012,.044,-.028,.018,-.044,.032][fi]; side=-1 if fi<4 else 1
    rootE=empty(f'finger_{fi+1}_root',(x,.04,-.03),part=f'finger_{fi+1}_root'); rootE.parent=root
    pts=[]
    curl_dir=[1,-1,1,1,-1,1,-1,-1][fi]
    # articulated phalanx chain in the vertical plane: each joint changes angle enough
    # that the silhouette reads as a curling finger rather than a straight rod.
    length_scale=[1.18,.86,1.06,.74,1.28,.94,1.12,.78][fi]
    thick_scale=[1.12,.82,1.0,.72,1.18,.88,1.04,.76][fi]
    seg_lens=[(.20+random.uniform(-.025,.025))*length_scale,(.17+random.uniform(-.02,.02))*length_scale,(.135+random.uniform(-.018,.018))*length_scale,(.105+random.uniform(-.015,.015))*length_scale]
    xx=x; yy=.04; zz=-.03
    pts.append((xx,yy,zz))
    base_ang=side*(.08+.045*(fi%3))+random.uniform(-.035,.035)
    for j,sl in enumerate(seg_lens):
        ang=base_ang+side*(j*(.34+.055*(fi%4))+.16*math.sin(fi*1.3+j*1.7))
        xx+=math.sin(ang)*sl
        zz-=math.cos(ang)*sl
        yy+=curl_dir*(.042+.018*j)*math.sin((j+1)*math.pi/4)+math.cos(fi*1.1+j*.7)*(.026+.006*(fi%3))
        pts.append((xx,yy,zz))
    for j in range(4):
        r0=(.070-j*.016)*thick_scale
        r1=(.052-j*.015)*thick_scale
        seg=taper_between(f'finger_{fi+1}_segment_{j+1}',pts[j],pts[j+1],r0,r1,skin,f'finger_{fi+1}',24)
        seg.parent=rootE; seg.matrix_parent_inverse=rootE.matrix_world.inverted()
        jr=max(.014,(.034-j*.0065)*thick_scale)
        joint=sphere(f'finger_{fi+1}_joint_{j+1}',pts[j+1],(jr*(1+.16*((fi+j)%3)),jr*.66,jr*.58),skin,f'finger_{fi+1}',22,11)
        joint.parent=rootE; joint.matrix_parent_inverse=rootE.matrix_world.inverted()
        # irregular skin-fold bulges replace detached-looking mechanical rings
        for wr in range(2):
            uu=.28+wr*.34
            pp=Vector(pts[j]).lerp(Vector(pts[j+1]),uu)
            off=Vector(((-side)*(0.012+wr*.003),-.026+wr*.004,0))
            fold=sphere(f'finger_{fi+1}_skin_fold_{j+1}_{wr}',pp+off,(.023-j*.0015,.0065,.013),skin_hi,f'finger_{fi+1}',14,7)
            fold.rotation_euler[2]=curl_dir*(.35+wr*.22); fold.parent=rootE; fold.matrix_parent_inverse=rootE.matrix_world.inverted()
        # fine veins sit close to the skin surface instead of reading as separate wires
        for vi,off in enumerate(((-.006,-.023),(0.008,-.021))):
            va=Vector(pts[j])+Vector((off[0],off[1],0)); vb=Vector(pts[j+1])+Vector((off[0]*.65,off[1],0))
            vein=cyl_between(f'finger_{fi+1}_vein_{j+1}_{vi+1}',va,vb,.0026,veinmat,f'finger_{fi+1}',vertices=8)
            vein.parent=rootE; vein.matrix_parent_inverse=rootE.matrix_world.inverted()
        for wd in range(1 + (1 if (fi+j)%3==0 else 0)):
            uu=.48+random.uniform(-.18,.18)
            pp=Vector(pts[j]).lerp(Vector(pts[j+1]),min(.92,max(.08,uu)))
            rr=max(.012,.052-j*.008)
            drop=sphere(f'finger_{fi+1}_wet_bead_{j+1}_{wd+1}',pp+Vector((random.uniform(-.006,.006),-rr*.82,random.uniform(-.006,.006))),(.0048*thick_scale,.0026,.0038),wetdrop,f'finger_{fi+1}',10,5)
            drop.parent=rootE; drop.matrix_parent_inverse=rootE.matrix_world.inverted()
    tip=Vector(pts[-1])
    # fleshy rounded fingertip under the cracked yellow nail
    tipbulb=sphere(f'finger_{fi+1}_tip_pad',tip,(.027,.023,.032),skin_hi,f'finger_{fi+1}',18,9)
    tipbulb.parent=rootE; tipbulb.matrix_parent_inverse=rootE.matrix_world.inverted()
    bpy.ops.mesh.primitive_cone_add(vertices=20,radius1=.012,radius2=.029,depth=.105,location=tip+Vector((0,-.004,-.045)))
    n=finish(bpy.context.object,f'finger_{fi+1}_nail',f'finger_{fi+1}',nail); smooth(n); n.parent=rootE; n.matrix_parent_inverse=rootE.matrix_world.inverted()
    n.rotation_euler[0]=curl_dir*.12
    for c in range(3):
        crack=cube(f'finger_{fi+1}_nail_crack_{c}',tip+Vector((random.uniform(-.01,.01),-.022,-.052-c*.014)),(.003,.004,.022),crackmat,f'finger_{fi+1}',.001)
        crack.rotation_euler[2]=random.uniform(-.5,.5); crack.parent=rootE; crack.matrix_parent_inverse=rootE.matrix_world.inverted()
    # suction pads are shallow flattened cups embedded along the inner finger face
    inward=Vector((-side*.012,-.025,0))
    for pd in range(5):
        pp=Vector(pts[1]).lerp(Vector(pts[4]),pd/4)+inward
        s=sphere(f'finger_{fi+1}_suction_pad_{pd+1}',pp,(.014,.005,.011),padmat,f'finger_{fi+1}',14,7)
        s.parent=rootE; s.matrix_parent_inverse=rootE.matrix_world.inverted()
        center=sphere(f'finger_{fi+1}_suction_cup_{pd+1}',pp+Vector((0,-.004,0)),(.006,.002,.005),skin,f'finger_{fi+1}',10,5)
        center.parent=rootE; center.matrix_parent_inverse=rootE.matrix_world.inverted()

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
