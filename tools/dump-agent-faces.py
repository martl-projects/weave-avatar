# Weave avatar – Rob13's faces as JSON for tools/paint-agent.py: UV polygon, its corners, strongest vertex group, centre and normal
# (model space, rest pose: z up, front -y).
# usage: blender -b -P tools/dump-agent-faces.py -- <Rob13.fbx> <faces.json>
import bpy, sys, json
SRC, OUT = sys.argv[sys.argv.index('--') + 1:][:2]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=SRC)
arm = next(o for o in bpy.context.scene.objects if o.type == 'ARMATURE')
arm.data.pose_position = 'REST'
bpy.context.view_layer.update()
dg = bpy.context.evaluated_depsgraph_get()
o = bpy.data.objects['Rob13_Body']
me = bpy.data.meshes.new_from_object(o.evaluated_get(dg), preserve_all_data_layers=True, depsgraph=dg)
me.transform(o.matrix_world)
names = {g.index: g.name for g in o.vertex_groups}
def strongest(vi):
    gs = [(names[g.group], g.weight) for g in o.data.vertices[vi].groups if g.weight > 0]
    return max(gs, key=lambda t: t[1])[0] if gs else '?'
uv = me.uv_layers.active.data
faces = []
for p in me.polygons:
    gs = [strongest(v) for v in p.vertices]
    faces.append({'uv': [[round(uv[li].uv[0], 5), round(uv[li].uv[1], 5)] for li in p.loop_indices],
                  'p': [[round(x, 4) for x in me.vertices[me.loops[li].vertex_index].co] for li in p.loop_indices],
                  'g': max(set(gs), key=gs.count), 'c': [round(x, 4) for x in p.center], 'n': [round(x, 3) for x in p.normal]})
json.dump(faces, open(OUT, 'w'))
print('faces', len(faces))
