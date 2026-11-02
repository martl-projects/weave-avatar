# Weave avatar – the agents' robot from art/agent.fbx to src/avatar/agent.glb.
# The model (martl's, a Tripo smart mesh cleaned by hand) stands in the T-pose, 1 unit tall (z up, feet at -0.5), facing
# +x: Body (one mesh, untextured) and FacePlate (the screen in the head's recess). The script
#   - makes it small and squat: the head 0.8 of its size at the people's scale, its centre where the robot's head
#     always was (AGENT_JOINT.headY); the body as wide, but squashed between neck and soles (the arms keep their round),
#   - splits Body at the neck into AgentHead (head, headphones, antennas; head-local, head centre at 0) and AgentBody
#     (neck, torso, arms, legs; weights on Weave's bones, as skinAgent gave them),
#   - paints it by hand, flat like the people: a colour per part in COLOR_0, and in its alpha where the robot's own
#     colour tints it (head shell, torso, upper arms, legs),
#   - names FacePlate AgentScreen with UVs from the front (the face is drawn on it),
#   - prints the joints for rig3d.js (AGENT_JOINT).
# usage: blender -b -P tools/export-agent.py
import os
import bmesh
import bpy
from mathutils import Vector, geometry

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'art', 'agent.fbx')
OUT = os.path.join(ROOT, 'src', 'avatar', 'agent.glb')

HEAD_Z, FEET_Z, NECK_Z = 0.29, -0.5, 0.1   # head centre, soles and the neck's cut in the model
FEET = -3.775                              # soles in figure units
S = -FEET / (HEAD_Z - FEET_Z) * 0.8        # model → figure, 0.8 of the people's scale
HEAD_Y = -1.166                            # head centre in figure units (AGENT_JOINT.headY)
NECK_Y = HEAD_Y + (NECK_Z - HEAD_Z) * S
ARM_Z = 0.035                              # the arms' axis (model)


def smooth(a, b, x):
    t = min(1, max(0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def body_y(z):
    """A height in the body (model) in figure units: squashed between soles and neck."""
    return FEET + (z - FEET_Z) / (NECK_Z - FEET_Z) * (NECK_Y - FEET)


def to_figure(co, head):
    """Model → Blender in figure units (glTF turns Blender (x, y, z) into (x, z, -y): front +z there)."""
    x, y, z = co
    if head:
        fy = HEAD_Y + (z - HEAD_Z) * S
    else:
        a = smooth(0.10, 0.16, abs(y)) if z > -0.09 else 0   # the arms: squashed along their axis only
        fy = (1 - a) * body_y(z) + a * (body_y(ARM_Z) + (z - ARM_Z) * S)
    return Vector((y * S, -x * S, fy - (HEAD_Y if head else 0)))


# ── Colours (sRGB) and where the robot's colour tints (alpha 1: white base × tint)
TINT, LIGHT, DARK, METAL, ACCENT = '#ffffff', '#eef1f5', '#2b303c', '#9aa3b2', '#ffc83d'
lin = lambda c: c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
rgba = lambda h, t=0.0: (*(lin(int(h[i:i + 2], 16) / 255) for i in (1, 3, 5)), t)
PAINT = {'tint': rgba(TINT, 1), 'light': rgba(LIGHT), 'dark': rgba(DARK), 'metal': rgba(METAL), 'accent': rgba(ACCENT)}
CUP, CUP_R = Vector(), 0.0                 # the headphones' centre (side view: x, z) and radius, measured below
SCREEN = []                                # the face plate's outline from the front (y, z), measured below


def near_screen(y, z, margin=0.012):
    """Inside the face plate's outline from the front, or within margin of it (the recess around it)."""
    inside, j = False, len(SCREEN) - 1
    for i in range(len(SCREEN)):
        (ya, za), (yb, zb) = SCREEN[i], SCREEN[j]
        if (za > z) != (zb > z) and y < (yb - ya) * (z - za) / (zb - za) + ya: inside = not inside
        j = i
    if inside: return True
    p = Vector((y, z))
    return any(geometry.intersect_point_line(p, Vector(SCREEN[i - 1]), Vector(SCREEN[i]))[1] >= 0 and
               (geometry.intersect_point_line(p, Vector(SCREEN[i - 1]), Vector(SCREEN[i]))[0] - p).length < margin and
               geometry.intersect_point_line(p, Vector(SCREEN[i - 1]), Vector(SCREEN[i]))[1] <= 1 for i in range(len(SCREEN)))


def part(c, n):
    """Which paint a face gets, by its centre c and normal n (model)."""
    x, y, z = c
    ay = abs(y)
    if z > NECK_Z:                                            # head
        if ay > 0.17 and z > 0.455: return 'accent'          # antenna balls
        r = (Vector((x, z)) - CUP).length
        if ay > 0.205 and r < CUP_R:                         # headphones: a dark ring around a light disc
            return 'light' if r < CUP_R * 0.45 else 'dark'
        if 0.17 < ay < 0.235 and z > 0.40: return 'metal'    # antenna stalks
        if x > 0.1 and near_screen(y, z): return 'dark'      # the screen's bezel
        return 'tint'
    if z > 0.085 and ay < 0.1: return 'dark'                 # neck
    if z > -0.09 and ay > 0.118:                             # arm
        if ay > 0.337: return 'light'                        # hand
        if ay > 0.287: return 'dark'                         # cuff
        if ay > 0.156: return 'tint'                         # upper arm
        return 'light'                                       # shoulder ball
    if x > 0.09 and ay < 0.045 and -0.045 < z < 0.045: return 'accent'   # chest badge
    if z > -0.105: return 'tint'                             # torso
    if z > -0.16: return 'dark'                              # belt
    if z > -0.2: return 'light'                              # pelvis
    if z < -0.48: return 'dark'                              # soles
    if z < -0.395: return 'light'                            # boots
    return 'tint'                                            # legs


# ── Weights (model): stiff parts that bend at the narrow places – shoulder ball, mid arm, waist, hip, knee
def weights(co):
    x, y, z = co
    ay, R = abs(y), y > 0   # model +y is figure +x (R)
    arm = smooth(0.1046, 0.1214, ay) if z > -0.0867 else 0
    if arm > 0:
        e = smooth(0.2281, 0.2533, ay)
        return {'chest': 1 - arm, ('shoulderR' if R else 'shoulderL'): arm * (1 - e), ('elbowR' if R else 'elbowL'): arm * e}
    if z < -0.1453:
        leg, k = smooth(-0.1536, -0.1892, z), smooth(-0.2959, -0.3168, z)
        return {'hips': 1 - leg, ('thighR' if R else 'thighL'): leg * (1 - k), ('shinR' if R else 'shinL'): leg * k}
    c = smooth(-0.116, -0.0909, z)
    h = smooth(0.0833, 0.0958, z) if ay < 0.0628 else 0
    return {'hips': 1 - c, 'chest': c * (1 - h), 'head': c * h}


bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=SRC)
sc = bpy.context.scene
src, plate = bpy.data.objects['Body'], bpy.data.objects['FacePlate']
for o in (src, plate):
    o.data.transform(o.matrix_world)
    o.matrix_world.identity()
cup = [v.co for v in src.data.vertices if v.co.y > 0.222 and NECK_Z < v.co.z < 0.44]
CUP = sum((Vector((c.x, c.z)) for c in cup), Vector((0, 0))) / len(cup)
CUP_R = max((Vector((c.x, c.z)) - CUP).length for c in cup) + 0.004
SCREEN = [tuple(p) for p in (lambda pts: [pts[i] for i in geometry.convex_hull_2d(pts)])([(v.co.y, v.co.z) for v in plate.data.vertices])]
print('cup', [round(c, 3) for c in CUP], round(CUP_R, 3))


def piece(name, keep, head):
    me = src.data.copy()
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if not keep(f)], context='FACES')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    col = bm.loops.layers.float_color.new('Col')
    for f in bm.faces:
        p = PAINT[part(f.calc_center_median(), f.normal)]
        for loop in f.loops: loop[col] = p
    model = [v.co.copy() for v in bm.verts]
    for v in bm.verts: v.co = to_figure(v.co, head)
    bm.to_mesh(me)
    bm.free()
    me.name = name
    me.materials.clear()
    for p in me.polygons: p.use_smooth = True
    me.color_attributes.active_color = me.color_attributes['Col']
    o = bpy.data.objects.new(name, me)
    sc.collection.objects.link(o)
    return o, model


head, _ = piece('AgentHead', lambda f: f.calc_center_median().z > NECK_Z, True)
body, model = piece('AgentBody', lambda f: f.calc_center_median().z <= NECK_Z, False)
for b in ('hips', 'chest', 'head', 'shoulderL', 'elbowL', 'shoulderR', 'elbowR', 'thighL', 'shinL', 'thighR', 'shinR'):
    body.vertex_groups.new(name=b)
for i, co in enumerate(model):
    for b, w in weights(co).items():
        if w > 1e-4: body.vertex_groups[b].add([i], w, 'REPLACE')

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
body.modifiers.new('Armature', 'ARMATURE').object = rig

# Screen: the face plate, UVs from the front
pme = plate.data
for v in pme.vertices: v.co = to_figure(v.co, True)
while pme.uv_layers: pme.uv_layers.remove(pme.uv_layers[0])
pme.materials.clear()
xs, zs = [v.co.x for v in pme.vertices], [v.co.z for v in pme.vertices]
x0, x1, z0, z1 = min(xs), max(xs), min(zs), max(zs)
uv = pme.uv_layers.new(name='UVMap')
for loop in pme.loops:
    co = pme.vertices[loop.vertex_index].co
    uv.data[loop.index].uv = ((co.x - x0) / (x1 - x0), (co.z - z0) / (z1 - z0))
plate.name = pme.name = 'AgentScreen'
for p in pme.polygons: p.use_smooth = True
print('screen', round(x1 - x0, 3), 'x', round(z1 - z0, 3))

# The joints for rig3d.js: the old robot's (at the people's scale, head centre 0) moved like the body
def joint(fx, fy, fz, arm=False):
    mz = fy / (-FEET / (HEAD_Z - FEET_Z)) + HEAD_Z
    k = S / (-FEET / (HEAD_Z - FEET_Z))
    y = body_y(ARM_Z) + (mz - ARM_Z) * S if arm else body_y(mz)
    return f'V({fx * k:.3f}, {y:.3f}, {fz * k:.3f})'
k = S / (-FEET / (HEAD_Z - FEET_Z))
print('AGENT_JOINT hips:', joint(0, -1.96, 0.05), 'chest:', joint(0, -1.48, 0.05), 'neck:', joint(0, -0.91, 0.03),
      'shoulder:', joint(0.63, -1.22, 0.03, True), f'elbowX: {1.15 * k:.3f}, wristX: {1.43 * k:.3f}, handX: {1.79 * k:.3f},',
      'hip:', joint(0.36, -2.17, 0.05), f'knee: {body_y(-2.82 / (-FEET / (HEAD_Z - FEET_Z)) + HEAD_Z):.3f},',
      f'ankle: {body_y(-3.34 / (-FEET / (HEAD_Z - FEET_Z)) + HEAD_Z):.3f},', 'foot:', joint(0.43, -3.63, 0.19), f'headY: {HEAD_Y}')

for o in list(sc.objects):
    if o not in (head, body, plate, rig): bpy.data.objects.remove(o)
bpy.ops.object.select_all(action='DESELECT')
for o in (head, body, plate, rig): o.select_set(True)
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True, export_materials='NONE', export_normals=True, export_texcoords=True,
                          export_vertex_color='ACTIVE', export_yup=True, export_skins=True, export_animations=False, export_apply=False)
print('wrote', OUT, len(head.data.vertices), len(body.data.vertices), len(pme.vertices))
