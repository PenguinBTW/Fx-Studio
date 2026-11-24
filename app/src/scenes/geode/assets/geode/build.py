# GEODE — a cracked-open amethyst geode: displaced rock half-shell (opening
# toward authored +Z, the camera side), a jagged basalt rim ring around the
# mouth, and ~170 hexagonal crystal spikes seated on the displaced inner wall,
# all pointing inward. Vertex colors bake the violet-base → clear-tip gradient.
# Deterministic analytic noise only — same output every run.
# Run: blender -b --factory-startup --python build.py
import bpy, math, os, bmesh
HERE = os.path.dirname(os.path.abspath(__file__))
bpy.ops.wm.read_factory_settings(use_empty=True)

R = 1.55            # shell radius, metres
WALL = 0.10         # inner-surface seat offset for crystals
RIM_Z = 0.28        # mouth plane (authored Z, faces the camera)

def sock(node, *names):
    for n in names:
        if n in node.inputs:
            return node.inputs[n]
    return None

def mat_basalt():
    m = bpy.data.materials.new('Basalt')
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    sock(b, 'Base Color').default_value = (0.016, 0.014, 0.02, 1)
    sock(b, 'Roughness').default_value = 0.88
    return m

def mat_amethyst():
    m = bpy.data.materials.new('Amethyst')
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    sock(b, 'Base Color').default_value = (0.28, 0.09, 0.45, 1)
    sock(b, 'Roughness').default_value = 0.08
    sock(b, 'Metallic').default_value = 0.0
    s = sock(b, 'Transmission Weight', 'Transmission')
    if s: s.default_value = 0.75
    s = sock(b, 'IOR')
    if s: s.default_value = 1.54
    s = sock(b, 'Emission Color', 'Emission')
    if s: s.default_value = (0.05, 0.012, 0.09, 1)
    return m

BASALT = mat_basalt()
AMETHYST = mat_amethyst()

# Analytic fbm — deterministic, used for BOTH the shell displacement and the
# crystal seat computation so spikes anchor exactly on the displaced wall.
def noise3(x, y, z):
    return (0.55 * math.sin(2.9 * x + 1.3) * math.sin(2.2 * y + 0.7) * math.sin(3.4 * z + 2.1)
          + 0.30 * math.sin(5.7 * x + 4.1) * math.sin(4.9 * y + 1.9) * math.sin(6.2 * z + 0.3)
          + 0.15 * math.sin(11.3 * x + 2.7) * math.sin(10.1 * y + 3.3) * math.sin(9.4 * z + 1.1))

def disp(v):
    """Displaced position of a sphere vertex v (a unit direction * R)."""
    l = math.sqrt(v[0]**2 + v[1]**2 + v[2]**2) or 1
    ux, uy, uz = v[0]/l, v[1]/l, v[2]/l
    d = 1.0 + 0.16 * noise3(ux, uy, uz) + 0.045 * noise3(ux*2.7, uy*2.7, uz*2.7)
    return (ux * R * d, uy * R * d, uz * R * d)

def rim_cut(dx, dy):
    """Jagged mouth edge: faces whose displaced centre z exceeds this die."""
    return RIM_Z + 0.16 * noise3(dx * 1.9 + 4.4, dy * 1.9 - 2.2, 0.6)

# ---- shell -------------------------------------------------------------------
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3, radius=1.0)
shell = bpy.context.object
shell.name = 'shell'
me = shell.data
for v in me.vertices:
    v.co = disp((v.co.x, v.co.y, v.co.z))

bm = bmesh.new()
bm.from_mesh(me)
kill = [f for f in bm.faces
        if f.calc_center_median().z > rim_cut(f.calc_center_median().x, f.calc_center_median().y)]
bmesh.ops.delete(bm, geom=kill, context='FACES')
bm.to_mesh(me)
bm.free()

sol = shell.modifiers.new('wall', 'SOLIDIFY')
sol.thickness = 0.07
sol.offset = -1.0
bpy.context.view_layer.objects.active = shell
bpy.ops.object.modifier_apply(modifier='wall')
shell.data.materials.append(BASALT)
for p in shell.data.polygons:
    p.use_smooth = True
shell['fx_part'] = 'shell'

# ---- rim ring ----------------------------------------------------------------
NSEG = 96
verts, faces = [], []
for i in range(NSEG):
    a = 2 * math.pi * i / NSEG
    nx = math.sin(a * 3.1 + 0.8) * 0.5 + math.sin(a * 7.3 + 1.7) * 0.5
    r_out = R * (1.02 + 0.085 * nx)
    r_in = R * (0.90 + 0.06 * math.sin(a * 5.1 + 2.9))
    z = RIM_Z + 0.16 * noise3(math.cos(a) * 1.9 + 4.4, math.sin(a) * 1.9 - 2.2, 0.6)
    verts.append((math.cos(a) * r_out, math.sin(a) * r_out, z + 0.02 * nx))
    verts.append((math.cos(a) * r_in, math.sin(a) * r_in, z - 0.03))
    verts.append((math.cos(a) * r_out, math.sin(a) * r_out, z - 0.12))
for i in range(NSEG):
    j = (i + 1) % NSEG
    faces.append((i * 3, j * 3, j * 3 + 1, i * 3 + 1))       # top surface
    faces.append((i * 3 + 2, j * 3 + 2, j * 3, i * 3))       # outer wall
    faces.append((i * 3 + 1, j * 3 + 1, j * 3 + 2, i * 3 + 2))  # under lip
rim_me = bpy.data.meshes.new('rim')
rim_me.from_pydata(verts, [], faces)
rim_me.update()
rim = bpy.data.objects.new('rim', rim_me)
bpy.context.collection.objects.link(rim)
rim.data.materials.append(BASALT)
for p in rim.data.polygons:
    p.use_smooth = True
rim['fx_part'] = 'rim'

# ---- crystals ----------------------------------------------------------------
# Fibonacci-sphere directions inside the shell (z below the mouth plane),
# jittered by hash; base seated on the displaced wall, spike aimed at centre.
def h(i, s):
    x = math.sin(i * 127.1 + s * 311.7) * 43758.5453
    return x - math.floor(x)

cv, cf, vcol = [], [], []
NSPIKE = 175
GOLD = math.pi * (3 - math.sqrt(5))
made = 0
i = 0
while made < NSPIKE and i < NSPIKE * 4:
    i += 1
    y = -1 + 2 * (i + 0.5) / (NSPIKE * 2.2)  # bias deep into -z? keep all dirs, filter z
    rad = math.sqrt(max(0, 1 - y * y))
    th = GOLD * i
    dx, dy, dz = math.cos(th) * rad, y, math.sin(th) * rad
    if dz > RIM_Z / R + 0.15 * h(i, 7) - 0.1:
        continue  # outside the mouth region
    if h(i, 9) < 0.12:
        continue  # sparse gaps — organic clustering
    d = (dx, dy, dz)
    px, py, pz = disp(d)
    # Only seat where the shell actually exists: the jagged mouth cut removes
    # faces above rim_cut — a spike placed there hangs in air.
    if pz > rim_cut(dx, dy) - 0.08:
        continue
    # seat buried below the inner wall (solidify pulls it inward ~0.07 —
    # 0.13 puts the base hexagon fully inside the rock on every spike)
    dl = math.sqrt(px**2 + py**2 + pz**2)
    bx, by, bz = px - px/dl * (WALL + 0.03), py - py/dl * (WALL + 0.03), pz - pz/dl * (WALL + 0.03)
    ln = math.sqrt(bx**2 + by**2 + bz**2)
    ax, ay, az = -bx/ln, -by/ln, -bz/ln          # spike axis → centre
    # tilt jitter so spikes fan naturally
    jx = (h(i, 1) - 0.5) * 0.22
    jy = (h(i, 2) - 0.5) * 0.22
    ax, ay, az = ax + jx, ay + jy, az - 0.06
    al = math.sqrt(ax**2 + ay**2 + az**2)
    ax, ay, az = ax/al, ay/al, az/al
    length = 0.16 + 0.34 * (h(i, 3) ** 1.4)
    r0 = 0.028 + 0.05 * h(i, 4)
    # orthonormal basis around axis
    upx, upy, upz = (0, 0, 1) if abs(az) < 0.9 else (0, 1, 0)
    ux, uy, uz = ay*upz - az*upy, az*upx - ax*upz, ax*upy - ay*upx
    ul = math.sqrt(ux**2 + uy**2 + uz**2)
    ux, uy, uz = ux/ul, uy/ul, uz/ul
    wx, wy, wz = ay*uz - az*uy, az*ux - ax*uz, ax*uy - ay*ux
    roll = h(i, 5) * math.pi / 3
    base = len(cv)
    for k in range(6):  # base hexagon ring
        a = math.pi * k / 3 + roll
        ca, sa = math.cos(a), math.sin(a)
        cv.append((bx + (ux*ca + wx*sa) * r0,
                   by + (uy*ca + wy*sa) * r0,
                   bz + (uz*ca + wz*sa) * r0))
        vcol.append((0.16, 0.03, 0.30, 1.0))   # deep violet root
    for k in range(6):  # shoulder ring
        a = math.pi * k / 3 + roll
        ca, sa = math.cos(a), math.sin(a)
        t = 0.62
        cv.append((bx + ax*length*t + (ux*ca + wx*sa) * r0 * 0.62,
                   by + ay*length*t + (uy*ca + wy*sa) * r0 * 0.62,
                   bz + az*length*t + (uz*ca + wz*sa) * r0 * 0.62))
        vcol.append((0.38, 0.16, 0.55, 1.0))
    cv.append((bx + ax*length, by + ay*length, bz + az*length))  # apex
    vcol.append((0.92, 0.86, 0.98, 1.0))                          # near-clear tip
    apex = base + 12
    for k in range(6):
        n = base + (k + 1) % 6
        cf.append((base + k, n, base + 6 + (k + 1) % 6, base + 6 + k))  # shaft quad
        cf.append((base + 6 + k, base + 6 + (k + 1) % 6, apex))          # tip tri
    made += 1

cme = bpy.data.meshes.new('crystals')
cme.from_pydata(cv, [], cf)
cme.update()
crystals = bpy.data.objects.new('crystals', cme)
bpy.context.collection.objects.link(crystals)
crystals.data.materials.append(AMETHYST)
# vertex colours — one colour per loop vertex, looked up by its vertex index
vcl = cme.vertex_colors.new(name='Col')
for poly in cme.polygons:
    for li in poly.loop_indices:
        vcl.data[li].color = vcol[cme.loops[li].vertex_index]
crystals['fx_part'] = 'crystals'

for o in (shell, rim, crystals):
    o.select_set(True)
bpy.ops.export_scene.gltf(filepath=os.path.join(HERE, 'model.glb'),
                          export_format='GLB', export_extras=True,
                          export_yup=True, use_selection=True)
print('[export] geode written — shell %d shell-verts, %d spikes' % (len(me.vertices), made))
