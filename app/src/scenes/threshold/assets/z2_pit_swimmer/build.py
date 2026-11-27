# Headless Blender build for THRESHOLD Z2 Pit Swimmer. Deterministic; no external assets.
import bpy, math, random, os
from mathutils import Vector
random.seed(2202)
HERE=os.path.dirname(os.path.abspath(__file__))

def reset():
    bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)

def material(name,color,rough=.62,metal=0.0):
    m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF'); bs.inputs['Base Color'].default_value=(*color,1); bs.inputs['Roughness'].default_value=rough; bs.inputs['Metallic'].default_value=metal
    return m

def finish(o,name,part,mat=None):
    o.name=name; o['fx_part']=name
    if mat: o.data.materials.append(mat)
    return o

def smooth(o):
    if hasattr(o.data,'polygons'):
        for p in o.data.polygons: p.use_smooth=True

def organic(o,amt=.12,seed=0):
    if not hasattr(o.data,'vertices'): return
    # Multi-octave deterministic radial displacement baked into the mesh itself. The first
    # octave breaks silhouette arcs; the second makes the surface leathery and collapsed;
    # the third adds small diseased lumpiness. Noise is directional so seams do not tear.
    for v in o.data.vertices:
        x,y,z=v.co
        rr=max((x*x+y*y+z*z)**.5,1e-6); nx,ny,nz=x/rr,y/rr,z/rr
        low=(math.sin(nx*3.1+seed*.71)+math.sin(ny*4.3-seed*1.13)+math.sin(nz*3.7+seed*.37))/3.0
        med=math.sin((nx*9.7+ny*6.1)+seed*.53)*math.sin((nz*11.9-nx*4.7)-seed*.29)
        fine=math.sin(nx*29.0+seed)*math.sin(ny*31.0-seed*.7)*math.sin(nz*27.0+seed*.3)
        k=1.0+amt*(low*.72+med*.48+fine*.16)
        # radially collapse/expand the primitive, then skew it so no axis-aligned ellipsoid remains
        v.co.x=x*k+ny*amt*.10*med
        v.co.y=y*(1.0+amt*(low*.42+med*.20))
        v.co.z=z*k+nx*amt*.09*low-amt*.16*max(0.0,z)*(.5+.5*math.sin(seed+nx*4.0))
    o.data.update()

def sphere(name,loc,scale,mat,part=None,seg=20,rings=10,rot=(0,0,0),deform=.12):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg,ring_count=rings,location=loc,rotation=rot)
    o=bpy.context.object; o.scale=scale; bpy.ops.object.transform_apply(location=False,rotation=False,scale=True); smooth(o); organic(o,deform*1.35,len(name)*.731)
    return finish(o,name,part or name,mat)

def cyl_between(name,a,b,r,mat,part=None,vertices=10):
    a,b=Vector(a),Vector(b); d=b-a; mid=(a+b)*.5
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=r,depth=d.length,location=mid)
    o=bpy.context.object; o.rotation_mode='QUATERNION'; o.rotation_quaternion=d.to_track_quat('Z','Y'); smooth(o)
    return finish(o,name,part or name,mat)

def cone(name,loc,r1,r2,depth,mat,part=None,rot=(0,0,0),vertices=9):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices,radius1=r1,radius2=r2,depth=depth,location=loc,rotation=rot)
    o=bpy.context.object; smooth(o); organic(o,.08,len(name)*.41); return finish(o,name,part or name,mat)

def torus(name,loc,major,minor,mat,part=None,rot=(0,0,0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=major,minor_radius=minor,major_segments=24,minor_segments=7,location=loc,rotation=rot)
    o=bpy.context.object; smooth(o); organic(o,.16,len(name)*.61); return finish(o,name,part or name,mat)

def empty(name,loc=(0,0,0)):
    o=bpy.data.objects.new(name,None); bpy.context.collection.objects.link(o); o.location=loc; o['fx_part']=name; return o

reset()
# Cold corpse-pallor flesh family: deliberately close in hue, with localized bruise/liver concentration.
flesh=material('corpse_grey_pink_flesh',(0.055,0.043,0.040),.78)
flesh2=material('cold_pallid_flesh',(0.070,0.064,0.052),.82)
flesh3=material('grey_green_necrosis',(0.038,0.070,0.047),.86)
bruise=material('liver_bruise_mass',(0.085,0.012,0.010),.88)
deep=material('wet_mouth_black_red',(0.018,0.002,0.003),.28)
gum=material('dark_gum_mass',(0.055,0.010,0.012),.42)
bone=material('yellowed_translucent_bone',(0.12,0.085,0.038),.78)
boneold=material('rotten_bone_edges',(0.045,0.022,0.010),.88)
eyewhite=material('necrotic_eye_slit',(0.20,0.19,0.14),.90)
eyedark=material('dead_eye_dark',(0.008,0.012,0.010),.84)
root=empty('pit_swimmer_root')

# Asymmetric grub-cranium: overlapping sagging ellipsoid tissue masses, not balls.
centers=[]
for i in range(18):
    u=(i*.61803398875)%1; v=((i*.754877666)+.17)%1; w=((i*.56984029)+.31)%1
    th=math.tau*u; ph=math.acos(2*v-1); rr=.34*(.30+.70*w)
    x=math.sin(ph)*math.cos(th)*rr*1.20; y=math.sin(ph)*math.sin(th)*rr*.69-.025; z=math.cos(ph)*rr*.72+.07
    if x>0: x*=1.23+.04*math.sin(i); y-=.045*w
    else: x*=.88; z+=.025*math.sin(i*.8)
    if z>.08: z+=.055*math.sin(i*.73)-.035*max(0,x)
    centers.append((x,y,z))
    r=.175+((i*37)%9)*.012
    mat=[flesh,flesh2,flesh3,flesh,bruise][i%5 if i%11==0 else i%3]
    o=sphere(f'fused_skull_mass_{i+1:02d}',(x,y,z),(r*(.70+((i*13)%7)*.08),r*(.48+((i*17)%5)*.11),r*(1.00+((i*11)%6)*.10)),mat,seg=20,rings=10,rot=(math.sin(i*1.7)*.7,math.sin(i*.9)*.8,math.cos(i*1.3)*.7),deform=.16)
    o.parent=root


# Dense crust relief inherited from the Tenant lesson: no large convex cranial surface is
# allowed to remain clean. Low-frequency lobes are interrupted by sub-lobe scabs, ulcers,
# raised vein knots, and brittle necrotic islands, concentrated at seams and underside.
for k in range(126):
    cx,cy,cz=centers[k%len(centers)]
    band=(k*17)%5
    ox=math.sin(k*1.91)*(.045+band*.012)
    oz=math.cos(k*1.37)*(.045+(k%4)*.010)
    # bias relief toward visible front/top and crease boundaries, with extra darkening low down
    px=cx+ox
    py=cy-.335-((k*13)%7)*.008
    pz=cz+oz
    underside=max(0.0,.10-pz)
    cm=bruise if (k%4==0 or underside>0.03) else (flesh3 if k%3==0 else boneold)
    sc=sphere(f'cranial_crust_relief_{k+1:03d}',(px,py,pz),(.034+(k%5)*.007,.012+(k%3)*.003,.020+(k%4)*.005),cm,seg=8,rings=4,rot=(k*.19,k*.11,k*.23),deform=.32)
    sc.parent=root
    if k%9==0:
        # brittle raised spike breaking the lobe silhouette at close range
        cone(f'cranial_crust_spike_{k+1:03d}',(px,py-.008,pz+.012),.009+(k%3)*.002,.001,.035+(k%4)*.008,boneold if k%2 else bruise,rot=(random.uniform(-.5,.5),random.uniform(-.5,.5),random.uniform(-.5,.5)),vertices=5).parent=root


# Explicit front-carapace crust field placed on the camera-facing skin. Unlike the statistical
# cluster pass, this guarantees no broad smooth convex region survives at the actual hero angle.
for k in range(96):
    col=k%12; row=k//12
    x=-.36+col*.065+math.sin(k*1.7)*.012
    z=.035+row*.065+math.cos(k*1.3)*.012
    # approximate the convex front shell, leaving the large eye/nose focal area mostly clear
    if -.03<x<.29 and .16<z<.43 and k%5!=0: continue
    y=-.405-.035*math.cos(x*5.0)-.025*math.sin(z*8.0)-((k*7)%5)*.006
    cm=bruise if (row+col)%4==0 else (flesh3 if (row+col)%3==0 else flesh2)
    cr=sphere(f'front_carapace_crust_{k+1:03d}',(x,y,z),(.020+(k%5)*.004,.008+(k%3)*.002,.012+(k%4)*.003),cm,seg=8,rings=4,rot=(k*.13,k*.21,k*.31),deform=.34)
    cr.parent=root
    if k%13==0:
        cone(f'front_carapace_brittle_spire_{k+1:03d}',(x,y-.006,z+.012),.007+(k%3)*.002,.001,.028+(k%4)*.007,boneold,rot=(random.uniform(-.45,.45),random.uniform(-.45,.45),random.uniform(-.45,.45)),vertices=5).parent=root

# Deep irregular mouth wound facing negative Y.
mc=sphere('mouth_cavity',(0,-.485,-.035),(.43,.19,.28),deep,seg=24,rings=12,deform=.28); mc.parent=root
# Gum is multiple overlapping lumps rather than a clean oval lip.
for i in range(16):
    a=math.tau*i/16
    x=math.cos(a)*.34*(1+.12*math.sin(i*2.2)); z=-.02+math.sin(a)*.22*(1+.14*math.cos(i*1.7)); y=-.505-.018*math.sin(i)
    g=sphere(f'mouth_gum_mass_{i+1:02d}',(x,y,z),(.075,.045,.055),gum if i%4 else bruise,seg=14,rings=7,rot=(a*.2,a*.3,a),deform=.20); g.parent=root

# Jaw control empties preserve the existing runtime rig exactly.
upper=empty('slide_mouth_upper_root',(0,-.38,.13)); upper.parent=root
lower=empty('slide_mouth_lower_root',(0,-.38,-.16)); lower.parent=root

def parent_keep(o,p):
    o.parent=p; o.matrix_parent_inverse=p.matrix_world.inverted()

# Torn upper/lower flesh flaps: elongated ragged tissue lobes, no planar plates.
for side,rootobj,zsign in [('upper',upper,1),('lower',lower,-1)]:
    for j in range(7):
        x=-.31+j*.103+math.sin(j*2.1)*.018
        y=-.43-j*.026
        z=zsign*(.115+j*.018+(j%3)*.012)
        flap=sphere(f'{side}_torn_flesh_flap_{j+1}',(x,y,z),(.105+((j*7)%4)*.015,.085,.045+((j*5)%3)*.012),flesh if j%3 else flesh3,seg=16,rings=8,rot=(zsign*(.25+j*.07),math.sin(j)*.35,math.cos(j*1.3)*.4),deform=.24)
        parent_keep(flap,rootobj)
        # exposed bone splinter ridge along the flap, irregular and embedded
        if j not in (1,5):
            shard=cone(f'{side}_exposed_bone_plate_{j+1}',(x+.015,y-.045,z+zsign*.035),.018+((j*3)%4)*.004,.002,.11+((j*5)%5)*.018,bone if j%3 else boneold,rot=(math.pi/2+zsign*(.25+j*.08),math.sin(j*2)*.35,math.cos(j)*.25),vertices=7)
            parent_keep(shard,rootobj)

# Needle/shard teeth embedded directly into dark gum. No capsules, no flanges, no even fence.
tooth_x=[-.30,-.255,-.205,-.158,-.102,-.052,-.006,.045,.098,.151,.214,.275]
for row,rootobj,zsign in [('upper',upper,-1),('lower',lower,1)]:
    for i,x in enumerate(tooth_x):
        if (i+(0 if row=='upper' else 3))%7==2: continue  # missing teeth
        length=(.055+((i*37)%13)*.010)*(1.0 if row=='upper' else .82)
        radius=.0065+((i*11)%5)*.0018
        xx=x+math.sin(i*1.7)*.015
        yy=-.585-(i%3)*.014
        zz=(.035 if row=='upper' else -.100)+zsign*.015*math.sin(i)
        mat=bone if i%4 else boneold
        rot=(math.pi if row=='upper' else 0,0,0)
        # lean in three axes; broken teeth are short and dark-tipped
        t=cone(f'tooth_{row}_{i+1:02d}',(xx,yy,zz),radius,.0012,length,mat,rot=(rot[0]+random.uniform(-.48,.48),random.uniform(-.45,.45),random.uniform(-.50,.50)),vertices=7)
        parent_keep(t,rootobj)
        if i in (3,8):
            darktip=cone(f'tooth_{row}_{i+1:02d}_broken_dark_tip',(xx,yy-.008,zz+zsign*.012),radius*.72,.001,length*.28,boneold,rot=(rot[0]+random.uniform(-.4,.4),random.uniform(-.3,.3),random.uniform(-.4,.4)),vertices=6)
            parent_keep(darktip,rootobj)

# Uncanny half-formed face: one stretched clouded slit-eye, one mostly swallowed vestigial eye.
sphere('eye_socket_stretched',(.205,-.365,.405),(.205,.055,.095),flesh2,seg=20,rings=10,rot=(.12,-.25,-.18),deform=.20).parent=root
sphere('eye_lid_upper',(.19,-.414,.435),(.175,.035,.046),flesh,seg=16,rings=8,rot=(.1,-.2,-.15),deform=.18).parent=root
sphere('eye_lid_lower',(.20,-.412,.365),(.150,.030,.035),flesh3,seg=16,rings=8,rot=(.1,-.2,-.12),deform=.18).parent=root
# runtime-required pupil parts, tiny and mostly occluded
for side,x,z in [('l',-.19,.34),('r',.205,.395)]:
    bpy.ops.mesh.primitive_cylinder_add(vertices=16,radius=.008 if side=='r' else .0045,depth=.008,location=(x,-.442,z),rotation=(math.pi/2,0,0))
    pup=finish(bpy.context.object,f'eye_pupil_{side}',f'eye_pupil_{side}',eyedark); pup.parent=root
    sphere(f'eye_ball_{side}',(x,-.435,z),(.025 if side=='r' else .012,.004,.010),eyewhite,seg=12,rings=6,deform=.06).parent=root
# vestigial nose/mouth-like human feature in the wrong place
sphere('vestigial_nose_bridge',(-.16,-.405,.29),(.055,.028,.105),flesh2,seg=16,rings=8,rot=(.25,0,-.28),deform=.18).parent=root
for side in (-1,1): sphere(f'vestigial_nostril_{side}',(-.16+side*.027,-.438,.245),(.012,.005,.008),deep,seg=10,rings=5,deform=.04).parent=root


# Dominant half-formed face region: deliberately oversized so it reads at delivery distance.
# One heavy brow, one clouded eye, a nasal cavity and malformed cheek plane form a single
# uncanny focal feature rather than distributed decoration.
sphere('face_brow_massive',(.02,-.455,.385),(.31,.075,.085),flesh2,seg=22,rings=11,rot=(.10,0,-.08),deform=.15).parent=root
sphere('face_left_sunken_plane',(-.15,-.448,.245),(.19,.045,.19),flesh,seg=20,rings=10,rot=(.05,.12,.22),deform=.17).parent=root
sphere('face_nasal_bridge',(-.015,-.495,.265),(.060,.035,.16),flesh2,seg=16,rings=8,rot=(.20,0,-.10),deform=.13).parent=root
for side in (-1,1):
    sphere(f'face_nasal_cavity_{side}',(-.015+side*.030,-.532,.195),(.024,.009,.038),deep,seg=12,rings=6,rot=(0,0,side*.18),deform=.04).parent=root
# one large clouded eye, half-sunken under the brow; runtime pupil remains tiny inside it
sphere('face_eye_socket_large',(.175,-.492,.335),(.145,.036,.088),bruise,seg=18,rings=9,rot=(.03,-.10,-.10),deform=.10).parent=root
sphere('face_eye_cloud_large',(.172,-.523,.333),(.096,.012,.057),eyewhite,seg=18,rings=9,rot=(.02,0,-.08),deform=.05).parent=root
sphere('face_eye_necrotic_center',(.171,-.532,.331),(.030,.004,.018),eyedark,seg=12,rings=6,deform=.03).parent=root
# heavy lower lid cuts across the eye asymmetrically
sphere('face_eye_lower_lid_heavy',(.18,-.525,.305),(.105,.022,.028),flesh,seg=16,rings=8,rot=(0,0,-.13),deform=.15).parent=root

# Wet throat depth: nested receding red-black rings and a glossier rear mass, visible inside
# the mouth instead of a flat wooden-brown bowl.
for k in range(4):
    yy=-.43+k*.065
    rr=.30-k*.045
    ring=torus(f'throat_depth_ring_{k+1}',(0,yy,-.045-k*.012),rr,.018-(k*.002),deep if k<2 else gum,rot=(math.pi/2,0,0))
    ring.scale.y=.72; ring.parent=root
sphere('throat_rear_wet_mass',(0,-.19,-.07),(.20,.10,.17),deep,seg=18,rings=9,deform=.16).parent=root

# Malformed finger-like appendages erupting from cheek/jaw tissue.
for fi,(base,sgn) in enumerate([((-.42,-.25,.03),-1),((.43,-.22,.00),1),((.25,-.33,.22),1)]):
    x0,y0,z0=base
    p0=(x0,y0,z0); p1=(x0+sgn*.08,y0-.06,z0-.055); p2=(x0+sgn*.13,y0-.12,z0-.13)
    cyl_between(f'finger_{fi+1}_proximal',p0,p1,.025,flesh2,vertices=10).parent=root
    cyl_between(f'finger_{fi+1}_distal',p1,p2,.018,flesh,vertices=9).parent=root
    sphere(f'finger_{fi+1}_knuckle',p1,(.032,.026,.030),bruise if fi==1 else flesh,seg=12,rings=6,deform=.12).parent=root
    cone(f'finger_{fi+1}_vestigial_nail',p2,.010,.001,.035,boneold,rot=(math.pi/2,sgn*.3,.2),vertices=6).parent=root

# Hanging tissue strands and fluid-heavy droplets break the compact outline below the jaw.
for i in range(9):
    x=-.28+i*.07+math.sin(i*1.8)*.018
    top=(x,-.50,-.15+math.sin(i)*.03); bot=(x+math.sin(i*2.1)*.035,-.56-random.uniform(0,.07),-.34-random.uniform(0,.18))
    strand=cyl_between(f'hanging_tissue_strand_{i+1}',top,bot,.006+(i%3)*.002,flesh3 if i%3 else gum,vertices=7)
    parent_keep(strand,lower if i%2==0 else root)
    drop=sphere(f'hanging_tissue_drop_{i+1}',bot,(.018+((i*5)%3)*.004,.012,.025+((i*7)%4)*.005),bruise if i%4==0 else flesh3,seg=10,rings=5,deform=.18)
    parent_keep(drop,lower if i%2==0 else root)


# Long root-level tendrils hang outside the compact head silhouette; they are independent
# of jaw motion and remain visible even when the mouth is nearly closed.
for i in range(12):
    side=-1 if i<6 else 1
    j=i%6
    x0=side*(.43+j*.065); z0=.12-j*.045
    top=(x0,-.34-j*.012,z0)
    mid=(x0+side*(.05+random.uniform(0,.05)),-.48-random.uniform(0,.06),z0-.14-random.uniform(0,.08))
    bot=(x0+side*(.02+random.uniform(0,.08)),-.58-random.uniform(0,.08),z0-.28-random.uniform(0,.14))
    cyl_between(f'outer_face_tendril_{i+1}_a',top,mid,.003+(j%3)*.0008,flesh3 if i%3 else bruise,vertices=7).parent=root
    cyl_between(f'outer_face_tendril_{i+1}_b',mid,bot,.002+(j%2)*.0006,flesh3 if i%4 else gum,vertices=6).parent=root
    if i%3==0: sphere(f'outer_tendril_necrotic_drop_{i+1}',bot,(.018,.012,.028),bruise,seg=9,rings=5,deform=.15).parent=root

# Grub body trailing backward: overlapping uneven sacs and compression folds, no toy beads.
for i in range(24):
    yy=.27+i*.22; taper=1-i/30; rr=.23*taper+.075
    x=math.sin(i*.55)*.11*taper+(.025 if i>8 and i<13 else 0); z=-.035+math.sin(i*.42)*.045
    mat=[flesh,flesh2,flesh3,bruise][i%4 if i%9==0 else i%3]
    o=sphere(f'body_tissue_sac_{i+1:02d}',(x,yy,z),(rr*(.85+((i*5)%4)*.1),rr*1.32,rr*(.70+((i*7)%3)*.13)),mat,seg=16,rings=8,rot=(math.sin(i)*.35,math.cos(i*.7)*.45,math.sin(i*1.3)*.5),deform=.17)
    o.parent=root
    if i%3==0: torus(f'body_compression_fold_{i+1:02d}',(x,yy,z),rr*.72,rr*.035,gum if i%6==0 else bruise,rot=(math.pi/2,0,i*.2)).parent=root
for i in range(9):
    yy=.35+i*.52; rr=.13-(i*.006)
    sphere(f'dorsal_necrotic_lump_{i+1:02d}',(math.sin(i*.7)*.08,yy,.22+math.sin(i*.45)*.04),(rr,rr*.9,rr*.75),flesh3 if i%2 else bruise,seg=16,rings=8,rot=(i*.2,i*.31,i*.17),deform=.20).parent=root
sphere('tail_cap',(0,5.42,.02),(.10,.19,.075),flesh3,seg=16,rings=8,deform=.18).parent=root

# Dense necrosis/freckle geometry concentrated on visible front tissue.
for k in range(42):
    x=-.34+((k*.083)%.68)+math.sin(k)*.012; y=-.425-((k*.017)%.055); z=-.02+((k*.097)%.49)
    mat=[bruise,flesh3,boneold][k%3]
    sphere(f'necrotic_surface_fleck_{k+1:02d}',(x,y,z),(.014+(k%5)*.003,.0028,.007+(k%4)*.002),mat,seg=8,rings=4,rot=(0,0,(k%9-4)*.12),deform=.06).parent=root
# Raised dark vessels on the face.
for k in range(14):
    x=-.30+((k*.071)%.60); z=.04+((k*.089)%.40); y=-.445-random.uniform(0,.02)
    a=(x,y,z); b=(x+math.sin(k*1.9)*(.045+(k%4)*.012),y-.008,z+math.cos(k*1.3)*.025)
    cyl_between(f'face_raised_vein_{k+1:02d}',a,b,.004+(k%2)*.001,bruise,vertices=6).parent=root

bpy.ops.object.select_all(action='SELECT')
out=os.path.join(HERE,'model.glb')
bpy.ops.export_scene.gltf(filepath=out,export_format='GLB',export_extras=True,export_apply=True,export_animations=False)
print('exported',out)
