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
white=material('clouded_eye_sclera',(0.43,0.39,0.25),.74)
black=material('clouded_pupil_black',(0.010,0.006,0.003),.52)
mouthdark=material('mouth_deep_red_black',(0.055,0.002,0.004),.65)
toothmat=material('slide_stopper_teeth',(0.76,0.64,0.40),.48)
toothold=material('aged_stopper_teeth',(0.48,0.37,0.22),.62)
toothdark=material('worn_tooth_edges',(0.28,0.19,0.10),.68)
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
    # The skull is not a symmetrical inflatable egg: one side bulges outward and downward,
    # the crown slumps, and the jaw-side mass pinches inward. This preserves the fused-ball
    # construction while killing the bevelled-box/perfect-ellipsoid read at delivery distance.
    if x > 0:
        x *= 1.16 + .05*math.sin(i*1.7)
        y -= .035*w
    else:
        x *= .91 + .04*math.cos(i*2.1)
        z += .018*math.sin(i*.9)
    if z > .08:
        z += .045*math.sin(i*.73) - .025*max(0., x)
    if y < -.16:
        x *= .92
        z -= .025
    skull_centers.append((x,y,z))
    r=.12+((i*37)%11)*.006
    b=sphere(f'fused_skull_ball_{i+1:02d}',(x,y,z),(r,r,r),palette[i%len(palette)],seg=32,rings=16); b.parent=root
    # visible vinyl highlight cap/seam on selected balls
    if i%5==0:
        torus(f'fused_skull_ball_{i+1:02d}_seam',(x,y,z),r*.78,r*.018,seammat,rot=(math.pi/2,0,theta)).parent=root

# Deep mouth cavity facing negative Y.
sphere('mouth_cavity',(0,-.48,-.02),(.42,.20,.28),mouthdark,seg=32,rings=16).parent=root
# thick folded vinyl gum/lip rim; the mouth is a soft-toy anatomical opening, not a flat black oval
gum=torus('mouth_gum_lip',(0,-.505,-.02),.33,.035,mouthdark,rot=(math.pi/2,0,0)); gum.scale=(1.22,.72,.72); gum.parent=root
for side,x in [('l',-.31),('r',.31)]:
    sphere(f'mouth_corner_fold_{side}',(x,-.50,-.02),(.075,.045,.09),yellow,seg=20,rings=10).parent=root
# Hinged yellow slide jaws, assembled from overlapping curved chute sections.
upper=empty('slide_mouth_upper_root',(0,-.38,.13)); upper.parent=root
lower=empty('slide_mouth_lower_root',(0,-.38,-.16)); lower.parent=root
for side,rootobj,zsign in [('upper',upper,1),('lower',lower,-1)]:
    for j in range(6):
        yy=-.34-j*.074; zz=zsign*(.12+j*.035+(j/5)**2*.12)
        panel=cube(f'slide_mouth_{side}_panel_{j+1}',(((-1)**j)*(.008+j*.004)+(0.018 if side=='lower' else -0.010),yy,zz),(.50-j*.045,.15,.112),yellow,bevel=.035,rot=(zsign*(.12+j*.08),(-1 if side=='upper' else 1)*(.018+j*.009),(-1)**j*(.012+j*.006)))
        panel.parent=rootobj; panel.matrix_parent_inverse=rootobj.matrix_world.inverted()
    # side rails make the slide silhouette unmistakable
    for x in (-.205,.235):
        rail=cyl_between(f'slide_mouth_{side}_rail_{x}',(x,-.31,zsign*.08),(x,-.88,zsign*.34),.034,yellow,vertices=16)
        rail.parent=rootobj; rail.matrix_parent_inverse=rootobj.matrix_world.inverted()

# Abrasion, faded paint and chipped slide-plastic edges across the cranium/jaw. Small dark
# strips interrupt the clean yellow silhouette and read as wear rather than decoration.
for k in range(16):
    j=k%6
    side='upper' if k<10 else 'lower'
    rootobj=upper if side=='upper' else lower
    zsign=1 if side=='upper' else -1
    yy=-.36-j*.068+random.uniform(-.012,.012)
    zz=zsign*(.135+j*.035+(j/5)**2*.12)+zsign*.060
    xx=(-.24+(k*.061)%.48)+random.uniform(-.015,.015)
    patch=cube(f'jaw_abrasion_patch_{k+1:02d}',(xx,yy,zz),(.035+random.uniform(0,.075),.012,.006+random.uniform(0,.008)),seammat if k%3 else toothold,bevel=.001,rot=(zsign*(.12+j*.08),0,random.uniform(-.65,.65)))
    patch.parent=rootobj; patch.matrix_parent_inverse=rootobj.matrix_world.inverted()
for k in range(14):
    cx,cy,cz=skull_centers[(k*11+3)%len(skull_centers)]
    scar=cube(f'cranium_scuffed_paint_{k+1:02d}',(cx,cy-.12,cz+random.uniform(-.03,.03)),(.045+random.uniform(0,.07),.007,.008+random.uniform(0,.016)),seammat,bevel=.001,rot=(random.uniform(-.3,.3),random.uniform(-.2,.2),random.uniform(-1.1,1.1)))
    scar.parent=root

# Twenty stopper teeth, ten upper and ten lower. They are small rubber slide-stoppers:
# irregular lengths, clustered spacing, leaned angles, worn yellowing, chips and base flanges
# rather than a uniform white picket fence.
tooth_x=[-.285,-.225,-.176,-.116,-.065,-.012,.046,.105,.168,.252]
for i in range(10):
    x=tooth_x[i]
    um=toothold if i in (1,4,8) else toothmat
    ul=.072+((i*37)%9)*.008+random.uniform(-.006,.012)
    ur=.015+((i*19)%5)*.0025+random.uniform(0,.004)
    uy=-.665-(i%3)*.018+random.uniform(-.008,.008)
    up=cone(f'tooth_upper_{i+1:02d}',(x,uy,.005+(i%2)*.008),ur,.0035,ul,um,rot=(math.pi+random.uniform(-.30,.30),random.uniform(-.25,.25),random.uniform(-.26,.26)),vertices=14); up.parent=upper; up.matrix_parent_inverse=upper.matrix_world.inverted()
    cyl_between(f'tooth_upper_{i+1:02d}_rubber_flange',(x,uy,.055),(x,uy,.038),ur*1.35,toothdark if i in (2,7) else um,vertices=14).parent=upper
    ll=.060+((i*29)%8)*.009+random.uniform(-.004,.011)
    lr=.014+((i*13)%5)*.0025+random.uniform(0,.004)
    lx=x+.018+(-1)**i*.008
    ly=-.655-(i%2)*.025+random.uniform(-.008,.008)
    lm=toothold if i in (0,5,8) else toothmat
    lo=cone(f'tooth_lower_{i+1:02d}',(lx,ly,-.105-(i%3)*.007),lr,.0035,ll,lm,rot=(random.uniform(-.30,.30),random.uniform(-.24,.24),random.uniform(-.26,.26)),vertices=14); lo.parent=lower; lo.matrix_parent_inverse=lower.matrix_world.inverted()
    cyl_between(f'tooth_lower_{i+1:02d}_rubber_flange',(lx,ly,-.094),(lx,ly,-.075),lr*1.35,toothdark if i in (3,6) else lm,vertices=14).parent=lower
    if i in (2,7):
        # chipped dark notch biting into the upper tooth silhouette
        cube(f'tooth_chip_{i+1}',(x,-.705,.012),(0.018,.012,.020),toothdark,bevel=.002,rot=(random.uniform(-.2,.2),0,random.uniform(-.4,.4))).parent=upper

# Cartoon painted eyes are embedded into the fused-ball skull, not pasted on top of it.
# Asymmetric vinyl socket balls overlap the eye spheres; hand-painted irises sit flush on
# the exposed front cap, with lids and pressure seams locking them into the head structure.
eye_specs={
    'l':dict(x=-.275,y=-.285,z=.405,sx=.124,sy=.082,sz=.132,base=red,lid=orange,irisr=.043,pupr=.020),
    'r':dict(x=.295,y=-.265,z=.355,sx=.108,sy=.074,sz=.119,base=blue,lid=green,irisr=.027,pupr=.012),
}
for side,d in eye_specs.items():
    x,y,z=d['x'],d['y'],d['z']
    sphere(f'eye_ball_{side}',(x,y,z),(d['sx'],d['sy'],d['sz']),d['base'],seg=32,rings=16).parent=root
    # socket cluster: fused balls partially swallow the eye ball edges
    socket_cols=[d['lid'],yellow,palette[3 if side=='l' else 1],palette[0 if side=='l' else 2]]
    socket_offsets=[(-.10,.025,.055),(.095,.015,.045),(-.075,.018,-.07),(.072,.018,-.075)]
    for si,(ox,oy,oz) in enumerate(socket_offsets):
        sr=.070+(si%2)*.012
        sphere(f'eye_socket_{side}_{si+1}',(x+ox,y+oy,z+oz),(sr,sr*.72,sr),socket_cols[si],seg=24,rings=12).parent=root
    # vinyl brow/lower lid pads overlap the ball physically and break the perfect sphere silhouette
    # iris disc points roughly forward/down (-Y), scaled imperfectly like hand paint on vinyl
    front=y-d['sy']-.010
    # Heavy vinyl lids physically overlap the exposed eye cap. The right eye is nearly
    # swollen shut; the left is a narrow clouded slit rather than a bright cartoon eye.
    lid_close=1.0 if side=='l' else 1.35
    sphere(f'eye_upper_lid_{side}',(x,front+.018,z+d['sz']*(.34 if side=='l' else .25)),(d['sx']*1.02,.047,.065*lid_close),d['lid'],seg=24,rings=12).parent=root
    sphere(f'eye_lower_lid_{side}',(x,front+.014,z-d['sz']*(.36 if side=='l' else .25)),(d['sx']*.90,.040,.060*lid_close),d['lid'],seg=24,rings=12).parent=root
    bpy.ops.mesh.primitive_cylinder_add(vertices=32,radius=d['irisr'],depth=.012,location=(x,front,z+.008),rotation=(math.pi/2,0,0))
    iris=finish(bpy.context.object,f'eye_iris_{side}',f'eye_iris_{side}',white); smooth(iris); iris.scale.x=1.0+(0.10 if side=='l' else -0.06); iris.parent=root
    bpy.ops.mesh.primitive_cylinder_add(vertices=24,radius=d['pupr'],depth=.014,location=(x+(.016 if side=='l' else -.013),front-.010,z+.006),rotation=(math.pi/2,0,0))
    pup=finish(bpy.context.object,f'eye_pupil_{side}',f'eye_pupil_{side}',black); smooth(pup); pup.scale.x=.88 if side=='l' else 1.08; pup.parent=root
    
    # cloudy necrotic patches and cracked paint veins replace the clean toy catchlight
    sphere(f'eye_cloud_patch_{side}',(x+(.020 if side=='l' else -.017),front-.006,z+.020),(.020 if side=='l' else .013,.004,.013),toothold,seg=12,rings=6).parent=root
    for ci in range(4):
        ang=-.8+ci*.48+(.12 if side=='r' else 0)
        cx=x+math.sin(ang)*d['irisr']*.48
        cz=z+math.cos(ang)*d['irisr']*.42
        cube(f'eye_crack_{side}_{ci+1}',(cx,front-.012,cz),(.0024,.0022,.020+ci*.002),seammat,bevel=.0005,rot=(0,ang*.2,ang)).parent=root
    # partial dark compression seam underneath the socket; small enough to read as pressure, not outline stickers
    torus(f'eye_pressure_seam_{side}',(x,y+.004,z-.005),d['sx']*.68,.008,seammat,rot=(math.pi/2,0,0)).parent=root

# asymmetric vinyl abrasion stickers/scuffs across the fused skull
for i in range(18):
    cx,cy,cz=skull_centers[(i*7)%len(skull_centers)]
    sc=cube(f'vinyl_scuff_patch_{i+1:02d}',(cx,cy-.105,cz+random.uniform(-.035,.035)),(.055+random.uniform(0,.05),.006,.008+random.uniform(0,.012)),seammat,bevel=.001,rot=(random.uniform(-.3,.3),random.uniform(-.2,.2),random.uniform(-1.2,1.2)))
    sc.parent=root
# Inflated vinyl cheeks, crease dimples, and asymmetric scuffed patches.
for side,x in [('l',-.43),('r',.43)]:
    sphere(f'cheek_{side}',(x,-.31,.02),(.20,.14,.18),red if side=='l' else orange,seg=32,rings=16).parent=root
    for k in range(3):
        sphere(f'cheek_{side}_dimple_{k+1}',(x+(-.08 if side=='l' else .08),-.42,.02+k*.045),(.018,.009,.018),seammat,seg=16,rings=8).parent=root

# Six-metre eel body: fused diminishing balls and ten dorsal ridge balls.
for i in range(24):
    yy=.28+i*.22; taper=1-i/28; rr=.24*taper+.08
    x=math.sin(i*.55)*.10*taper; z=-.03+math.sin(i*.42)*.04
    body=sphere(f'body_fused_ball_{i+1:02d}',(x,yy,z),(rr*1.05,rr*1.28,rr*.88),palette[(i+2)%len(palette)],seg=24,rings=12); body.parent=root
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

# Preserve authored world-space placement for jaw children while allowing the jaw control
# empties to hinge them as one mechanism in the runtime.
for o in bpy.data.objects:
    if o.parent and o.parent.name in {'slide_mouth_upper_root','slide_mouth_lower_root'}:
        o.matrix_parent_inverse=o.parent.matrix_world.inverted()

bpy.ops.object.select_all(action='SELECT')
out=os.path.join(HERE,'model.glb')
bpy.ops.export_scene.gltf(filepath=out,export_format='GLB',export_extras=True,export_apply=True,export_animations=False)
print('exported',out)
