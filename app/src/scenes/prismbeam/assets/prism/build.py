# PRISMBEAM crystal — a beveled triangular prism standing on its side
# (axis = authored +Y; cross-section is a horizontal equilateral triangle).
# Origin = prism centre. Units: metres.
# Run: blender -b --factory-startup --python build.py
import bpy, math, os
HERE = os.path.dirname(os.path.abspath(__file__))
bpy.ops.wm.read_factory_settings(use_empty=True)

def sock(node, *names):
    for n in names:
        if n in node.inputs:
            return node.inputs[n]
    return None

def mat_glass():
    m = bpy.data.materials.new('CrystalGlass')
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    sock(b, 'Base Color').default_value = (0.72, 0.80, 0.90, 1)
    sock(b, 'Roughness').default_value = 0.05
    sock(b, 'Metallic').default_value = 0.0
    s = sock(b, 'Transmission Weight', 'Transmission')
    if s: s.default_value = 1.0
    s = sock(b, 'IOR')
    if s: s.default_value = 1.52
    s = sock(b, 'Emission Color', 'Emission')
    if s: s.default_value = (0.015, 0.02, 0.035, 1)
    return m

GLASS = mat_glass()

# Triangular prism: a 3-gon cylinder gives triangle cross-section in the
# authored XZ plane with three vertical rectangular facets. Axis is Blender Z,
# which export_yup maps to authored +Y.
bpy.ops.mesh.primitive_cylinder_add(vertices=3, radius=0.62, depth=1.35,
                                    location=(0, 0, 0))
o = bpy.context.object
# Orient the cross-section: rotation about Blender Z spins the triangle so a
# facet (not an edge) faces authored -X, the beam side.
o.rotation_euler = (0, 0, math.radians(30))
bpy.ops.object.transform_apply(rotation=True)
o.data.materials.append(GLASS)
# Crisp facets, tiny bevel on the edges for specular glints.
bev = o.modifiers.new('edge_bevel', 'BEVEL')
bev.width = 0.018
bev.segments = 2
bpy.context.view_layer.objects.active = o
bpy.ops.object.modifier_apply(modifier='edge_bevel')
for p in o.data.polygons:
    p.use_smooth = False

o.name = 'crystal'
o['fx_part'] = 'crystal'

bpy.ops.object.select_all(action='DESELECT')
o.select_set(True)
bpy.ops.export_scene.gltf(filepath=os.path.join(HERE, 'model.glb'),
                          export_format='GLB', export_extras=True,
                          export_yup=True, use_selection=True)
print('[export] prismbeam crystal written')
