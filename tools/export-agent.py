# Weave avatar – the agents' robot body from art/agent.fbx to src/avatar/agent.glb.
# The model (Tripo smart mesh, cleaned by hand) stands in the T-pose, 1 unit tall (z up, feet at -0.5), facing +x; it has
# two objects: Body (one mesh, untextured) and FacePlate (the screen in the head's recess). The script
#   - splits Body at the neck into AgentHead (head, headphones, antennas) and AgentBody (neck stub, torso, arms, legs):
#     the head hangs on the rig's head bone as a plain mesh (head-only pictures need no body), the body gets bones and
#     weights in rig3d.js (skinAgent, joints AGENT_JOINT),
#   - names FacePlate AgentScreen and gives it UVs straight from the front (u left to right, v top to bottom in glTF),
#   - converts all to figure units like figure.glb: head centre at 0, feet at y = -3.775, front +z,
#     and exports without materials (avatar3d.js sets the colours).
# usage: blender -b --python tools/export-agent.py
import os
import bmesh
import bpy
from mathutils import Matrix

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'art', 'agent.fbx')
OUT = os.path.join(ROOT, 'src', 'avatar', 'agent.glb')

HEAD_Z, FEET_Z = 0.29, -0.5      # head centre and soles in the model
FEET = -3.775                     # soles in figure units
SCALE = -FEET / (HEAD_Z - FEET_Z)
NECK_CUT = 0.1                    # the head above (the neck is z 0.09..0.11, the shoulders end at 0.08)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=SRC)
body, plate = bpy.data.objects['Body'], bpy.data.objects['FacePlate']

# Into figure units. glTF turns Blender's (x, y, z) into (x, z, -y): so figure (X, Y, Z) = model (y, z - HEAD_Z, x) · SCALE
# is Blender (y, -x, z - HEAD_Z) · SCALE here.
to_figure = Matrix.Scale(SCALE, 4) @ Matrix.Translation((0, 0, -HEAD_Z)) @ Matrix.Rotation(-1.5707963267948966, 4, 'Z')
for o in (body, plate):
    o.data.transform(to_figure @ o.matrix_world)
    o.matrix_world = Matrix.Identity(4)
    o.data.materials.clear()
cut = (NECK_CUT - HEAD_Z) * SCALE


def keep_faces(obj, keep):
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if not keep(f)], context='FACES')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    bm.to_mesh(obj.data)
    bm.free()


head = body.copy()
head.data = body.data.copy()
bpy.context.scene.collection.objects.link(head)
keep_faces(head, lambda f: f.calc_center_median().z >= cut)
keep_faces(body, lambda f: f.calc_center_median().z < cut)
head.name = head.data.name = 'AgentHead'
body.name = body.data.name = 'AgentBody'
plate.name = plate.data.name = 'AgentScreen'

# The screen's UVs from the front: u = x across it, v = up (glTF flips v: there v = 0 is the top)
me = plate.data
xs, zs = [v.co.x for v in me.vertices], [v.co.z for v in me.vertices]
x0, x1, z0, z1 = min(xs), max(xs), min(zs), max(zs)
uv = me.uv_layers.new(name='UVMap')
for loop in me.loops:
    co = me.vertices[loop.vertex_index].co
    uv.data[loop.index].uv = ((co.x - x0) / (x1 - x0), (co.z - z0) / (z1 - z0))
print('screen', round(x1 - x0, 4), 'x', round(z1 - z0, 4), 'centre', round((x0 + x1) / 2, 4), round((z0 + z1) / 2, 4))

for o in (head, body, plate):
    for p in o.data.polygons: p.use_smooth = True
bpy.ops.object.select_all(action='DESELECT')
for o in (head, body, plate): o.select_set(True)
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True, export_materials='NONE',
                          export_normals=True, export_texcoords=True, export_yup=True, export_apply=True)
print('wrote', OUT, 'verts', len(head.data.vertices), len(body.data.vertices), len(plate.data.vertices))
