# Headless Blender build for THRESHOLD Z2 Pit Swimmer. Deterministic; no external assets.
import bpy, math, os
from mathutils import Vector, Matrix
HERE=os.path.dirname(os.path.abspath(__file__))

def reset(): bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
def material(name,color,rough=.78,coat=0,spec=.5,use_vcolor=False):
 m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
 nt=m.node_tree; bs=nt.nodes.get('Principled BSDF')
 if use_vcolor:
  # glTF exporter recognizes factor * color-attribute in the node graph and binds
  # the mesh attribute as COLOR_0 instead of emitting a dummy white COLOR_0.
  vc=nt.nodes.new('ShaderNodeVertexColor'); vc.layer_name='Color'
  mix=nt.nodes.new('ShaderNodeMix'); mix.data_type='RGBA'; mix.blend_type='MULTIPLY'; mix.inputs[0].default_value=1
  mix.inputs[6].default_value=(*color,1)
  nt.links.new(vc.outputs['Color'],mix.inputs[7]); nt.links.new(mix.outputs[2],bs.inputs['Base Color'])
 else:
  bs.inputs['Base Color'].default_value=(*color,1)
 bs.inputs['Roughness'].default_value=rough
 if bs.inputs.get('Coat Weight'): bs.inputs['Coat Weight'].default_value=coat
 if bs.inputs.get('Coat Roughness'): bs.inputs['Coat Roughness'].default_value=.18
 if bs.inputs.get('Specular IOR Level'): bs.inputs['Specular IOR Level'].default_value=spec
 return m
def flesh_mottling(o):
 # vertex-colour mottling: cold grey-pink corpse flesh with greener/livor patches,
 # deterministic and baked rather than textured
 me=o.data
 if not hasattr(me,'color_attributes'): return
 ca=me.color_attributes.get('Color')
 if ca is None: ca=me.color_attributes.new(name='Color',type='BYTE_COLOR',domain='POINT')
 for i,v in enumerate(me.vertices):
  x,y,z=v.co
  n1=(math.sin(x*13.7+y*17.1+z*11.3)+math.sin(x*31.0-y*23.0+z*19.0))*.5
  n2=math.sin(x*47.0+z*39.0+y*29.0)
  livor=max(0,-n1)*.22+max(0,n2)*.06
  disease=0
  if o.name=='torso_continuous_skin':
   # broad diffuse bruise islands keyed to rib/sternum topology, broken up by noise
   for cx,cz,sx,sz,amp in [(-.045,.485,.055,.075,.42),(.052,.410,.045,.060,.34),(0,.535,.035,.085,.32),(.025,.250,.055,.070,.28)]:
    q=((x-cx)/sx)**2+((z-cz)/sz)**2
    disease=max(disease,math.exp(-q)*amp*(.65+.35*n2))
  ribshade=0
  if o.name=='torso_continuous_skin' and y<0:
   for rz in (.30,.355,.41,.465,.52,.575,.63):
    ribshade+=math.exp(-((z-rz)/.018)**2)
   ribshade=min(1,ribshade)*.075*(.65+.35*n1)
  livor+=disease+ribshade
  pale=.90+.08*n1
  r=min(1,max(.58,pale-livor*.16+disease*.025))
  g=min(1,max(.55,pale-livor*.31+n2*.025-disease*.035))
  b=min(1,max(.58,pale-livor*.24-n2*.018-disease*.020))
  ca.data[i].color=(r,g,b,1)
def finish(o,name,mat):
 o.name=name; o['fx_part']=name; o.data.materials.append(mat)
 if mat.name=='swimmer_corpse_pale_flesh': flesh_mottling(o)
 return o
def smooth(o):
 for p in o.data.polygons: p.use_smooth=True

def organic_mesh(o,amt=.025,seed=0):
 for v in o.data.vertices:
  x,y,z=v.co; rr=max((x*x+y*y+z*z)**.5,1e-6); nx,ny,nz=x/rr,y/rr,z/rr
  low=(math.sin(nx*3.1+seed*.7)+math.sin(ny*4.1-seed)+math.sin(nz*3.7+seed*.3))/3
  med=math.sin((nx*9+ny*6)+seed)*math.sin((nz*11-nx*4)-seed*.3)
  high=math.sin((x*43+y*31-z*37)+seed)*math.sin((z*53-x*27+y*17)-seed*.6)
  k=1+amt*(low*.52+med*.32+high*.20)
  v.co.x=x*k; v.co.y=y*(1+amt*(.26*low+.16*high)); v.co.z=z*k
 o.data.update()

def make_mesh(name,verts,faces,mat,deform=0):
 me=bpy.data.meshes.new(name+'_mesh'); me.from_pydata(verts,[],faces); me.update()
 o=bpy.data.objects.new(name,me); bpy.context.collection.objects.link(o); finish(o,name,mat); smooth(o)
 if deform: organic_mesh(o,deform,len(name)*.37)
 return o

def tube(name,pts,radii,mat,rxz=(1,1),sides=10,cap=True,deform=.018):
 # one continuous curved skin tube; object origin is the first joint/pivot for later runtime rotation
 pts=[Vector(p) for p in pts]; origin=pts[0].copy(); verts=[]; faces=[]
 for i,p in enumerate(pts):
  if i==0: tangent=(pts[1]-p).normalized()
  elif i==len(pts)-1: tangent=(p-pts[i-1]).normalized()
  else: tangent=(pts[i+1]-pts[i-1]).normalized()
  u=tangent.cross(Vector((0,0,1)))
  if u.length<.1: u=tangent.cross(Vector((0,1,0)))
  u.normalize(); v=tangent.cross(u).normalized()
  if isinstance(radii,(list,tuple)):
   uu=i/max(1,len(pts)-1)*(len(radii)-1); ri=min(len(radii)-2,int(uu)); rf=uu-ri
   r=radii[ri]*(1-rf)+radii[ri+1]*rf
  else: r=radii
  for j in range(sides):
   a=math.tau*j/sides
   skinwav=(math.sin(i*1.73+j*.91)+.55*math.sin(i*3.07-j*1.37)+.30*math.sin(i*5.11+j*2.23))/1.85
   rr2=r*(1+.055*skinwav)
   q=p+u*math.cos(a)*rr2*rxz[0]+v*math.sin(a)*rr2*rxz[1]
   verts.append(tuple(q-origin))
 rings=len(pts)
 for i in range(rings-1):
  for j in range(sides):
   a=i*sides+j; b=i*sides+(j+1)%sides; c=(i+1)*sides+(j+1)%sides; d=(i+1)*sides+j
   faces.append((a,b,c,d))
 if cap:
  faces.append(tuple(range(sides-1,-1,-1))); faces.append(tuple((rings-1)*sides+j for j in range(sides)))
 o=make_mesh(name,verts,faces,mat,deform); o.location=origin
 return o

def uv(name,loc,scale,mat,seg=20,rings=12,rot=(0,0,0),deform=.025):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=seg,ring_count=rings,location=loc,rotation=rot)
 o=bpy.context.object; o.scale=scale; bpy.ops.object.transform_apply(location=False,rotation=False,scale=True); smooth(o)
 finish(o,name,mat); organic_mesh(o,deform,len(name)*.7); return o

def cyl(name,a,b,r,mat,vertices=8):
 return tube(name,[a,b],[r,r],mat,sides=vertices,deform=.006)
def cone(name,loc,r1,r2,depth,mat,rot=(0,0,0),vertices=7):
 bpy.ops.mesh.primitive_cone_add(vertices=vertices,radius1=r1,radius2=r2,depth=depth,location=loc,rotation=rot)
 o=bpy.context.object; smooth(o); return finish(o,name,mat)
def empty(name,loc=(0,0,0)):
 o=bpy.data.objects.new(name,None); bpy.context.collection.objects.link(o); o.location=loc; o['fx_part']=name; return o
def bindparent(o,p,parent_world_loc):
 # bind-time hierarchy for runtime rotations: preserve current world placement while
 # letting the control pivot carry descendants during swim strokes
 o.parent=p; o.matrix_parent_inverse=Matrix.Translation(Vector(parent_world_loc)).inverted()
def bez(a,c,b,n=7):
 a,c,b=Vector(a),Vector(c),Vector(b); out=[]
 for i in range(n):
  u=i/(n-1); out.append(tuple((1-u)*(1-u)*a+2*(1-u)*u*c+u*u*b))
 return out

def torso_mesh(mat):
    verts=[]; faces=[]; sides=20
    # Finely sampled continuous shell so rib modulation is actual surface topology,
    # not sparse sticks or invisible low-resolution faceting.
    n=42
    zs=[-.02+i*(.74/(n-1)) for i in range(n)]
    cw=[.085,.115,.135,.175,.225,.195,.145,.095]
    cd=[.065,.085,.095,.115,.135,.115,.085,.060]
    cy=[.28,.22,.16,.10,.03,-.01,-.02,-.02]
    def interp(arr,z):
        u=max(0,min(1,(z-zs[0])/(zs[-1]-zs[0])))*(len(arr)-1)
        i=min(len(arr)-2,int(u)); f=u-i
        return arr[i]*(1-f)+arr[i+1]*f
    for iz,z in enumerate(zs):
        width0=interp(cw,z)*.68; depth0=interp(cd,z)*.76; y0=interp(cy,z)
        for j in range(sides):
            a=math.tau*j/sides
            ribgroove=0
            for rz in (.30,.355,.41,.465,.52,.575,.63):
                ribgroove+=math.exp(-((z-rz)/.015)**2)
            # front/side rib arcs: alternating groove/ridge within one continuous skin shell
            frontside=max(0,-math.sin(a))*.62+max(0,math.cos(a))*.38
            ridge=max(0,ribgroove-.35)
            w=width0*(1-.18*ribgroove*frontside+.030*ridge*frontside)
            d=depth0*(1-.15*ribgroove*frontside)
            # slight sternal hollow and asymmetric collapse, still continuous topology
            sternum=max(0,-math.sin(a))*math.exp(-((z-.47)/.16)**2)
            x=math.cos(a)*w*(1+.03*math.sin(z*8+a))
            y=y0+math.sin(a)*d - sternum*.022
            verts.append((x,y,z))
    for iz in range(n-1):
        for j in range(sides):
            aa=iz*sides+j; bb=iz*sides+(j+1)%sides; cc=(iz+1)*sides+(j+1)%sides; dd=(iz+1)*sides+j
            faces.append((aa,bb,cc,dd))
    faces.append(tuple(range(sides-1,-1,-1))); faces.append(tuple((n-1)*sides+j for j in range(sides)))
    return make_mesh('torso_continuous_skin',verts,faces,mat,.018)

reset()
clay=material('swimmer_corpse_pale_flesh',(0.385,0.325,0.345),.55,coat=.14,spec=.40,use_vcolor=True)
dark=material('swimmer_wet_deep_cavity',(0.018,0.010,0.012),.24,coat=.35,spec=.55)
bruise=material('swimmer_bruise_necrosis',(0.26,0.105,0.115),.70,coat=.12,spec=.35)
veinmat=material('swimmer_vein_bluegrey',(0.055,0.075,0.095),.43,coat=.18,spec=.42)
toothmat=material('swimmer_receded_tooth',(0.15,0.115,0.060),.48,coat=.16,spec=.38)
eyecloud=material('swimmer_clouded_necrotic_eye',(0.27,0.32,0.29),.16,coat=.55,spec=.65)
throatwet=material('swimmer_wet_throat',(0.12,0.025,0.032),.15,coat=.65,spec=.62)
root=empty('pit_swimmer_root')
# continuous torso/pelvis skin shell and spine suggestion under it
torso=torso_mesh(clay); torso.parent=root
uv('pelvis_continuous',(0,.30,.02),(.12,.17,.10),clay,deform=.035).parent=root
uv('neck_torso_flesh_fusion',(0,.005,.655),(.108,.070,.092),clay,seg=16,rings=8,deform=.045).parent=root
# spine appears as shallow bumps under continuous skin, not glued rods
for i in range(6): uv(f'spine_under_skin_{i+1}',(0,.105,.16+i*.085),(.035,.018,.030),clay,seg=10,rings=6,deform=.015).parent=root
# narrow long skull, face toward -Y
head=empty('head_root',(0,-.055,.91)); head.parent=root
skull=uv('skull_emaciated',(0,-.06,.91),(.112,.105,.245),clay,seg=24,rings=14,rot=(.03,0,0),deform=.038); skull.parent=head; skull.matrix_parent_inverse=head.matrix_world.inverted()
# temporal bone masses and gaunt cheeks are continuous overlapping tissue, not ball joints
for side in (-1,1):
 uv(f'temporal_bone_{side}',(side*.105,-.095,.955),(.018,.025,.060),clay,seg=14,rings=8,rot=(0,side*.18,side*.08),deform=.03).parent=root
 uv(f'cheek_hollow_plane_{side}',(side*.073,-.180,.855),(.012,.010,.035),clay,seg=14,rings=8,rot=(.15,0,side*.18),deform=.025).parent=root
# deep almond eye pits under a continuous brow; no googly balls
uv('continuous_brow',(0,-.166,.995),(.098,.022,.025),clay,seg=18,rings=9,rot=(.03,0,0),deform=.025).parent=root
for side in (-1,1):
 sl='l' if side<0 else 'r'
 uv(f'eye_socket_{sl}',(side*.058,-.176,.948),(.044,.009,.015),dark,seg=12,rings=6,rot=(.02,0,side*.06),deform=.005).parent=root
 uv(f'eye_ball_{sl}',(side*.058,-.181,.948),(.010,.003,.007),eyecloud,seg=8,rings=4,deform=.003).parent=root
 uv(f'eye_pupil_{sl}',(side*.058,-.184,.948),(.004,.0015,.004),dark,seg=8,rings=4,deform=0).parent=root
# nose structure/cavity
uv('nose_bridge',(0,-.205,.895),(.017,.013,.060),clay,seg=14,rings=8,rot=(.12,0,0),deform=.018).parent=root
for side in (-1,1): uv(f'nostril_cavity_{side}',(side*.016,-.229,.856),(.006,.003,.008),dark,seg=8,rings=4,deform=0).parent=root
# slack hanging jaw and dark mouth slit, teeth barely suggested in shadow
upper=empty('slide_mouth_upper_root',(0,-.17,.815)); upper.parent=root
lower=empty('slide_mouth_lower_root',(0,-.16,.765)); lower.parent=root
uv('mouth_cavity',(.004,-.204,.752),(.030,.007,.042),dark,seg=14,rings=7,rot=(.05,0,0),deform=.18).parent=root
uv('mouth_throat_wet',(.004,-.211,.738),(.017,.0035,.022),throatwet,seg=12,rings=6,rot=(.08,0,0),deform=.06).parent=root
uv('mouth_corner_flesh_flap',(.025,-.209,.765),(.010,.003,.020),clay,seg=10,rings=5,rot=(.18,0,-.25),deform=.11).parent=root
jaw=tube('jaw_slack_continuous',[(-.070,-.140,.825),(-.074,-.160,.780),(-.046,-.172,.724),(0,-.178,.700),(.046,-.172,.724),(.074,-.160,.780),(.070,-.140,.825)],[.017,.022,.025,.027,.025,.022,.017],clay,rxz=(1,.68),sides=12,deform=.014); jaw.parent=lower; jaw.matrix_parent_inverse=lower.matrix_world.inverted()
for i in range(7):
 x=-.048+i*.016+math.sin(i)*.002
 tooth=cone(f'human_tooth_shadow_{i+1}',(x,-.215,.795),.004,.001,.015+(i%2)*.004,toothmat,rot=(math.pi+math.sin(i)*.12,0,math.cos(i)*.1),vertices=5); tooth.parent=upper; tooth.matrix_parent_inverse=upper.matrix_world.inverted()
# neck is a continuous tendon mass
neck=tube('neck_continuous',[(0,-.005,.56),(0,-.025,.74),(0,-.045,.88)],[.086,.064,.052],clay,rxz=(.85,1.1),sides=14,deform=.025); neck.parent=root
# arms: continuous curved tapered tubes, no joint balls. Controls exist for later swim animation.
def arm(side):
 shx=side*.245
 shoulder=(shx,-.015,.625)
 if side<0:
  elbow=(-.43,-.30,.53); wrist=(-.31,-.68,.40)
 else:
  elbow=(.55,-.12,.55); wrist=(.73,.13,.40)
 sh=empty(f'arm_{side}_shoulder',shoulder); sh.parent=root
 el=empty(f'arm_{side}_elbow',elbow); bindparent(el,sh,shoulder)
 wr=empty(f'arm_{side}_wrist',wrist); bindparent(wr,el,elbow)
 # upper arm begins buried in torso/shoulder and narrows toward elbow
 pts=bez((side*.045,-.005,.61),(side*.23,-.025,.675),elbow,13)
 ua=tube(f'upper_arm_{side}',pts,[.048,.046,.040,.034,.028,.023,.019],clay,rxz=(1,1),sides=12,deform=.032); bindparent(ua,sh,shoulder)
 pts2=bez(elbow,((elbow[0]+wrist[0])*.5,(elbow[1]+wrist[1])*.5-.03,(elbow[2]+wrist[2])*.5+.02),wrist,13)
 fa=tube(f'forearm_{side}',pts2,[.022,.020,.018,.016,.013,.010,.008],clay,sides=11,deform=.034); bindparent(fa,el,elbow)
 # hand is a continuous tapered palm mass flowing from wrist
 handpts=bez(wrist,(wrist[0]+side*.01,wrist[1]-.07,wrist[2]-.02),(wrist[0]+side*.015,wrist[1]-.13,wrist[2]-.035),4)
 hand=tube(f'hand_{side}',handpts,[.040,.047,.038,.022],clay,rxz=(1.48,.55),sides=10,deform=.032); bindparent(hand,wr,wrist)
 # fingers: continuous tapered multi-joint tubes with knuckle swelling in radius profile
 for f in range(5):
  spread=(f-2)*.027
  lf=(.78,.94,1.12,.98,.72)[f]
  fan=(f-2)*.018
  base=(wrist[0]+spread*.82,wrist[1]-.086,wrist[2]-.020+(abs(f-2)-1)*.005)
  mid1=(base[0]+spread*.42+fan,base[1]-.105*lf,base[2]-.018-(2-abs(f-2))*.008)
  mid2=(mid1[0]+spread*.30+fan*.65,mid1[1]-.092*lf,mid1[2]-.028-(f%2)*.010)
  tip=(mid2[0]+spread*.20+fan*.35,mid2[1]-.070*lf,mid2[2]-.023-(2-abs(f-2))*.007)
  ptsf=[base,((base[0]+mid1[0])*.5,(base[1]+mid1[1])*.5,(base[2]+mid1[2])*.5),mid1,((mid1[0]+mid2[0])*.5,(mid1[1]+mid2[1])*.5,(mid1[2]+mid2[2])*.5),mid2,tip]
  rr=[.011,.017,.012,.014,.009,.006,.002]
  bindparent(tube(f'finger_{side}_{f+1}_continuous',ptsf,rr,clay,sides=7,deform=.020),wr,wrist)
arm(-1); arm(1)
# necrosis/bruise concentrated at creases and thin-skin tension zones; flattened irregular shells
for nm,loc,sc in [
 ('necrosis_neck',(-.028,-.074,.735),(.012,.003,.026)),
 ('necrosis_shoulder_l',(-.18,-.035,.625),(.022,.004,.020)),
 ('necrosis_shoulder_r',(.20,-.030,.610),(.018,.004,.018)),
 ('necrosis_under_eye_l',(-.055,-.180,.918),(.014,.002,.010)),
]:
 uv(nm,loc,sc,bruise,seg=10,rings=5,rot=(.08,0,0),deform=.12).parent=root
# small baked lesion nodules interrupt the broad wet specular without becoming surface sprinkles
for i in range(24):
 z=.22+(i%8)*.055
 side=-1 if i%2 else 1
 x=side*(.018+(i%5)*.012)+math.sin(i*2.17)*.008
 y=-.078+math.cos(i*1.31)*.012
 sc=.004+(i%4)*.0018
 uv(f'lesion_nodule_{i+1}',(x,y,z),(sc*1.4,sc*.45,sc),bruise if i%3==0 else clay,seg=8,rings=4,deform=.16).parent=root
# raised vein relief following surface curves at neck, ribs, forearms and knuckles
for nm,pts,rad in [
 ('vein_neck_l',[(-.018,-.072,.64),(-.040,-.082,.73),(-.030,-.095,.86)],.0080),
 ('vein_neck_r',[(.022,-.070,.65),(.038,-.080,.75),(.020,-.092,.85)],.0068),
 ('vein_rib_l',[(-.035,-.082,.39),(-.080,-.070,.46),(-.065,-.052,.55)],.0072),
 ('vein_rib_r',[(.030,-.080,.37),(.078,-.064,.44),(.060,-.045,.53)],.0064),
]:
 tube(nm,pts,[rad,rad*.85,rad*.55],veinmat,sides=6,deform=.010).parent=root
# hips/lower body trail as one continuous submerged form rather than segmented tail beads
lower=tube('submerged_lower_body',[(0,.24,.02),(0,.55,-.01),(.04,.95,-.04),(-.03,1.35,-.07),(0,1.80,-.10)],[.16,.15,.12,.085,.035],clay,rxz=(1,.75),sides=14,deform=.035); lower.parent=root
tailcap=uv('tail_cap',(0,1.82,-.10),(.04,.08,.025),clay,seg=10,rings=5,deform=.015); bindparent(tailcap,lower,(0,.24,.02))
# tiny compatibility eye center
uv('face_eye_necrotic_center',(.060,-.204,.948),(.004,.001,.003),dark,seg=8,rings=4,deform=0).parent=root

bpy.ops.object.select_all(action='SELECT')
out=os.path.join(HERE,'model.glb')
bpy.ops.export_scene.gltf(filepath=out,export_format='GLB',export_extras=True,export_apply=True,export_animations=False)
print('exported',out)
