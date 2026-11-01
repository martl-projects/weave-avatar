# Weave avatar – the agents' robot: Rob13 (GrigoriyArx, DrollRobots; not in this repository) to src/avatar/agent.glb,
# in figure units and without materials (its texture is tools/paint-agent.py's agent.png, on Rob13's own UVs):
#   AgentHead   – the head (head and ear groups), head-local (head centre at 0)
#   AgentScreen – the glass dome, head-local, UVs from the front (the face is drawn on it)
#   AgentBody   – the rest, skinned to an armature with Weave's bone names (Rob13's groups merged onto them)
# usage: blender -b -P tools/export-agent.py -- <Rob13.fbx>
import os
import sys
import bmesh
import bpy
from mathutils import Matrix, Vector

SRC = sys.argv[sys.argv.index('--') + 1]
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'src', 'avatar', 'agent.glb')
FEET = -3.775
S = 2.35                      # head about 2.4 wide, like the old screen heads
HEAD_Z = 1.11                 # head centre (model)
HEAD_Y = HEAD_Z * S + FEET    # … in figure units
HEAD_GROUPS = {'head', 'ear_L', 'ear_R'}
# their groups → Weave's bones (side by sign of x: +x is R)
MAP = {'hip': 'chest', 'neck': 'head', 'head': 'head', 'ear_L': 'head', 'ear_R': 'head',
       'arm_L': 'shoulderR', 'arm_R': 'shoulderL', 'wheelBar_L': 'hips', 'wheel_L': 'hips', 'wheelBar_R': 'hips', 'wheel_R': 'hips'}
for side, ours in (('L', 'R'), ('R', 'L')):
    for g in ('forearm', 'hand', 'F_index1', 'F_index2', 'F_mid1', 'F_mid2', 'F_thumb1', 'F_thumb2'):
        MAP[f'{g}_{side}'] = 'elbow' + ours

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=SRC)
sc = bpy.context.scene
arm = next(o for o in sc.objects if o.type == 'ARMATURE')
arm.data.pose_position = 'REST'
bpy.context.view_layer.update()
dg = bpy.context.evaluated_depsgraph_get()
to_fig = Matrix.Translation((0, 0, FEET)) @ Matrix.Scale(S, 4)
to_head = Matrix.Translation((0, 0, -HEAD_Y)) @ to_fig


def baked(name, m):
    o = bpy.data.objects[name]
    me = bpy.data.meshes.new_from_object(o.evaluated_get(dg), preserve_all_data_layers=True, depsgraph=dg)
    me.transform(m @ o.matrix_world)
    return o, me


# Body: split off the head by each vertex's strongest group
src, me_fig = baked('Rob13_Body', to_fig)
names = {g.index: g.name for g in src.vertex_groups}
strongest, weights = [], []
for v in src.data.vertices:
    gs = [(names[g.group], g.weight) for g in v.groups if g.weight > 0]
    strongest.append(max(gs, key=lambda t: t[1])[0] if gs else 'hip')
    w = {}
    for n, x in gs:
        b = MAP.get(n)
        if b: w[b] = w.get(b, 0) + x
    weights.append(w)


def make(name, me, keep_face, m=None):
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if not keep_face(f)], context='FACES')
    bm.to_mesh(me)
    bm.free()
    if m is not None: me.transform(m)
    o = bpy.data.objects.new(name, me)
    me.name = name
    sc.collection.objects.link(o)
    return o


is_head = lambda f: all(strongest[v.index] in HEAD_GROUPS for v in f.verts)
head = make('AgentHead', me_fig.copy(), is_head, Matrix.Translation((0, 0, -HEAD_Y)))
# the body keeps each vertex's index in the original (for its weights)
body_me = me_fig.copy()
bm = bmesh.new(); bm.from_mesh(body_me)
idx = bm.verts.layers.int.new('orig')
for v in bm.verts: v[idx] = v.index
bmesh.ops.delete(bm, geom=[f for f in bm.faces if is_head(f)], context='FACES')
bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
orig = [v[idx] for v in bm.verts]
bm.to_mesh(body_me); bm.free()
body = bpy.data.objects.new('AgentBody', body_me); body_me.name = 'AgentBody'
sc.collection.objects.link(body)
for b in set(MAP.values()) | {'thighL', 'shinL', 'thighR', 'shinR'}:
    body.vertex_groups.new(name=b)
for i, o in enumerate(orig):
    w = weights[o]
    tot = sum(w.values()) or 1
    for b, x in (w.items() if w else [('chest', 1)]):
        body.vertex_groups[b].add([i], x / tot, 'REPLACE')
for o in (head, body):
    o.data.materials.clear()
    for p in o.data.polygons: p.use_smooth = True

# An armature with Weave's bones (positions don't matter: avatar3d.js binds to its own rig)
ad = bpy.data.armatures.new('Rig')
rig = bpy.data.objects.new('Rig', ad)
sc.collection.objects.link(rig)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode='EDIT')
parent = {'chest': 'hips', 'head': 'chest', 'shoulderL': 'chest', 'elbowL': 'shoulderL', 'shoulderR': 'chest', 'elbowR': 'shoulderR',
          'thighL': 'hips', 'shinL': 'thighL', 'thighR': 'hips', 'shinR': 'thighR'}
for i, n in enumerate(['hips', 'chest', 'head', 'shoulderL', 'elbowL', 'shoulderR', 'elbowR', 'thighL', 'shinL', 'thighR', 'shinR']):
    eb = ad.edit_bones.new(n); eb.head = (i * 0.01, 0, 0); eb.tail = (i * 0.01, 0, 0.1)
for n, p in parent.items(): ad.edit_bones[n].parent = ad.edit_bones[p]
bpy.ops.object.mode_set(mode='OBJECT')
body.parent = rig
mod = body.modifiers.new('Armature', 'ARMATURE'); mod.object = rig

# Screen: the glass dome, UVs from the front
_, gme = baked('Rob13_Glass', to_head)
while gme.uv_layers: gme.uv_layers.remove(gme.uv_layers[0])
gme.materials.clear()
xs, zs = [v.co.x for v in gme.vertices], [v.co.z for v in gme.vertices]
x0, x1, z0, z1 = min(xs), max(xs), min(zs), max(zs)
uv = gme.uv_layers.new(name='UVMap')
for loop in gme.loops:
    co = gme.vertices[loop.vertex_index].co
    uv.data[loop.index].uv = ((co.x - x0) / (x1 - x0), (co.z - z0) / (z1 - z0))
screen = bpy.data.objects.new('AgentScreen', gme); gme.name = 'AgentScreen'
sc.collection.objects.link(screen)
for p in gme.polygons: p.use_smooth = True
print('screen', round(x1 - x0, 3), 'x', round(z1 - z0, 3), 'head y', round(HEAD_Y, 3))

for o in list(sc.objects):
    if o not in (head, body, screen, rig): bpy.data.objects.remove(o)
bpy.ops.object.select_all(action='DESELECT')
for o in (head, body, screen, rig): o.select_set(True)
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True, export_materials='NONE', export_normals=True, export_texcoords=True, export_yup=True, export_skins=True,
                          export_animations=False, export_apply=False)
print('wrote', OUT, len(head.data.vertices), len(body.data.vertices), len(gme.vertices))
