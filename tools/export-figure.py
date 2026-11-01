# BAND AB! – Figur aus art/BaseBody.blend nach src/avatar/figure.glb.
# Vom Modell kommen Kopf (mit Ohren), Arme und Beine, Shirt, Hose, Schuhe und die Frisuren; Nasen, Brillen und Hüte
# baut avatar3d.js selbst, das Gesicht (Augen, Brauen, Mund, Wangen, Bart) malt es auf. Das Skript
#   - teilt Body in Head (über dem Kragen) und RigBody (Arme, Beine, Halsansatz) und lässt Nose weg,
#   - setzt jede Frisur (Objekte hair01, hair02 … neben der Figur, auch der Tippfehler haie01) auf den Kopf und
#     exportiert sie der Nummer nach als Hair01, Hair02 …: seitlich eingepasst auf den Schädel, Höhe und Tiefe an der
#     inneren Schale gemessen und mit dem Haar „Hair“ geeicht, das schon richtig sitzt; zuletzt so wenig wie möglich
#     angehoben und vergrößert, bis der Scheitel bedeckt ist (sonst schaut der Kopf durch),
#   - legt eine dünne Face-Schicht über die Vorderseite des Kopfs, mit UVs von vorn projiziert:
#     die 512er-Gesichtstextur deckt x -0.717..0.717 und y 0.588..-0.809 ab (Kopfmaße, wie die alte Kugel),
#   - lässt Körper (RigBody), Shirt (RigShirt), Hose und Schuhe in der T-Pose: Knochen und Gewichte bekommen sie in
#     rig3d.js, das auch die Arme in die Ruhelage nach unten nimmt,
#   - gibt dem Shirt UVs wie einem Zylinder (Vorderseite in der Mitte), damit die Shirt-Muster aus avatar3d.js passen,
#   - rechnet alles in Figuren-Maße um (Kopfmitte bei 0, 5-fach: Kopf etwa so groß wie die alte Kugel mit Radius 1,
#     Füße bei y = -3.775) und exportiert ohne Materialien (die Farben setzt avatar3d.js).
# usage: blender -b art/BaseBody.blend --python tools/export-figure.py
import math
import os
import re
import bmesh
import bpy
from mathutils import Matrix, Vector, kdtree
from mathutils.bvhtree import BVHTree

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'src', 'avatar', 'figure.glb')

KEEP = ['Body', 'Shirt', 'Trouser', 'Shoe']
NECK_CUT = 0.535                 # Kopf darüber (Kragenoberkante 0.527, Kinn ab 0.544)
HEAD_Z, SCALE = 0.755, 5.0       # Kopfmitte im Modell; Modell 1 Einheit = 5 Figuren-Einheiten
FACE_BOX = (-0.717, 0.717, 0.588, -0.809)   # Gesichtstextur: x links, rechts, y oben, unten (Figuren-Maße)
FACE_LIFT = 0.006                # Face-Schicht so weit über der Haut
HAIR_NAME = re.compile(r'ha(ir|ie)(\d+)$')   # die Frisuren (haie01 ist ein Tippfehler im .blend)
HEAD_TOP = 0.971                 # Scheitel des Kopfs (Modell)


def keep_verts(obj, keep):
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not keep(v)], context='VERTS')
    bm.to_mesh(obj.data)
    bm.free()


def shirt_uvs(me):
    """Zylinder-UVs: u = Winkel um die Hochachse (Vorderseite -y in der Mitte), v = Höhe (Kragen oben)."""
    zs = [v.co.z for v in me.vertices]
    z0, z1 = min(zs), max(zs)
    uv = me.uv_layers.new(name='UVMap')
    for poly in me.polygons:
        us = []
        for li in poly.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            us.append(0.5 + math.atan2(co.x, -co.y) / (2 * math.pi))
        # Polygone über der Naht hinten nicht quer über die ganze Textur ziehen
        if max(us) - min(us) > 0.5:
            us = [u + 1 if u < 0.5 else u for u in us]
        for li, u in zip(poly.loop_indices, us):
            co = me.vertices[me.loops[li].vertex_index].co
            uv.data[li].uv = (u, (co.z - z0) / (z1 - z0))


def make_face(head):
    """Die nach vorn zeigenden Flächen des Kopfs (in Figuren-Maßen), etwas angehoben, mit Gesichts-UVs von vorn."""
    face = head.copy()
    face.data = head.data.copy()
    face.name = face.data.name = 'Face'
    bpy.context.scene.collection.objects.link(face)
    x0, x1, y0, y1 = FACE_BOX
    bm = bmesh.new()
    bm.from_mesh(face.data)
    bm.normal_update()
    margin = 0.15
    drop = [f for f in bm.faces if f.normal.y > -0.2 or not all(
        x0 - margin <= v.co.x <= x1 + margin and y1 - margin <= v.co.z <= y0 + margin for v in f.verts)]
    bmesh.ops.delete(bm, geom=drop, context='FACES')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    bm.normal_update()
    for v in bm.verts:
        v.co += v.normal * FACE_LIFT
    uv = bm.loops.layers.uv.new('UVMap')
    for f in bm.faces:
        for loop in f.loops:
            co = loop.vert.co
            # glTF dreht v beim Export um: so ist dort v = 0 oben, wie Zeile 0 der Textur (flipY = false)
            loop[uv].uv = ((co.x - x0) / (x1 - x0), 1 - (y0 - co.z) / (y0 - y1))
    bm.to_mesh(face.data)
    bm.free()
    return face


# ── Frisuren auf den Kopf setzen
def world_verts(o):
    return [o.matrix_world @ v.co for v in o.data.vertices]


def hair_bmesh(o):
    bm = bmesh.new()
    bm.from_mesh(o.data)
    bm.transform(o.matrix_world)
    return bm


class HairFit:
    def __init__(self, body):
        head = [v for v in world_verts(body) if v.z > NECK_CUT and abs(v.x) < 0.175]
        self.scalp = [v for v in head if v.z > 0.80 or (v.y > 0.0 and v.z > 0.62)]    # ohne Gesicht und Ohren
        self.crown = [v for v in head if v.z > 0.84 and abs(v.x) < 0.16] +                      [v for v in head if v.z > 0.62 and v.y > 0.09 and abs(v.x) < 0.15]   # muss bedeckt sein
        self.center = Vector((0, 0, HEAD_Z))
        self.cal = Vector((0, 0, 0))
        self.cal = -self.raw(bpy.data.objects['Hair'])    # „Hair“ sitzt richtig: seine Messung muss 0 ergeben
        self.cal.x = 0

    def icp_x(self, hv, t):
        """Seitlich: Frisur so verschieben, dass ihre Punkte dem Schädel am nächsten liegen (nur x wird genutzt)."""
        for _ in range(40):
            kd = kdtree.KDTree(len(hv))
            for i, v in enumerate(hv):
                kd.insert(v + t, i)
            kd.balance()
            delta = sum((p - kd.find(p)[0] for p in self.scalp), Vector()) / len(self.scalp)
            t += delta
            if delta.length < 1e-5:
                break
        return t.x

    def raw(self, o):
        bm = hair_bmesh(o)
        hv = [v.co.copy() for v in bm.verts]
        bvh = BVHTree.FromBMesh(bm)
        bm.free()
        xs, ys, zs = ([v[i] for v in hv] for i in range(3))
        cy0 = (min(ys) + max(ys)) / 2
        x = self.icp_x(hv, Vector((-(min(xs) + max(xs)) / 2, -cy0, HEAD_TOP - max(zs) + 0.03)))
        top = bvh.ray_cast(Vector((-x, cy0, max(zs) + 1)), Vector((0, 0, -1)))[0]          # äußere Schale von oben
        inner = bvh.ray_cast(Vector((-x, cy0, top.z - 0.25)), Vector((0, 0, 1)))[0]        # innere von unten
        band = [v.y for v in hv if v.z > inner.z - 0.12 and abs(v.x + x) < 0.12]           # oberer Teil der Schale
        return Vector((x, -(min(band) + max(band)) / 2, -inner.z)) + self.cal

    def coverage(self, bvh, t, s, lift):
        hits = 0
        for p in self.crown:
            q = (p - self.center - Vector((0, 0, lift))) / s + self.center - t   # zurück ins Netz der Frisur
            hits += bvh.ray_cast(q, (p - self.center).normalized(), 0.12 / s)[0] is not None
        return hits / len(self.crown)

    def place(self, o):
        """Verschiebung t, Vergrößerung s um die Kopfmitte, Anhebung lift; dazu der bedeckte Anteil des Scheitels."""
        t = self.raw(o)
        bm = hair_bmesh(o)
        bvh = BVHTree.FromBMesh(bm)
        bm.free()
        best = None
        for s in (1.0, 1.03, 1.06, 1.09, 1.12, 1.15, 1.2):
            for lift in (i * 0.01 for i in range(-3, 9)):
                c = self.coverage(bvh, t, s, lift)
                score = c - 0.4 * (s - 1) - 0.4 * abs(lift)
                if best is None or score > best[0]:
                    best = (score, c, s, lift)
        return t, best[2], best[3], best[1]


def place_hairs(fit):
    hairs = sorted((o for o in bpy.data.objects if HAIR_NAME.match(o.name)), key=lambda o: int(HAIR_NAME.match(o.name)[2]))
    names = []
    for n, o in enumerate(hairs, 1):
        t, s, lift, covered = fit.place(o)
        me = o.data.copy()
        me.transform(o.matrix_world)
        me.transform(Matrix.Translation(fit.center + Vector((0, 0, lift))) @ Matrix.Scale(s, 4) @ Matrix.Translation(t - fit.center))
        name = f'Hair{n:02d}'
        obj = bpy.data.objects.new(name, me)
        me.name = name
        bpy.context.scene.collection.objects.link(obj)
        names.append(name)
        print(f'{name} aus {o.name}: Scheitel zu {covered:.0%} bedeckt (vergrößert {s:.2f}, angehoben {lift:+.2f})')
    return hairs, names


def main():
    hairs, hair_names = place_hairs(HairFit(bpy.data.objects['Body']))
    for o in list(bpy.data.objects):
        if o.name not in KEEP + hair_names:
            bpy.data.objects.remove(o, do_unlink=True)
    to_figure = Matrix.Scale(SCALE, 4) @ Matrix.Translation((0, 0, -HEAD_Z))
    for name in KEEP:
        o = bpy.data.objects[name]
        o.data = o.data.copy()                 # nicht die Daten im .blend verändern
        o.data.transform(o.matrix_world)
        o.matrix_world.identity()
    body = bpy.data.objects['Body']
    head = body.copy()
    head.data = body.data.copy()
    head.name = head.data.name = 'Head'
    bpy.context.scene.collection.objects.link(head)
    keep_verts(head, lambda v: v.co.z > NECK_CUT)
    keep_verts(body, lambda v: v.co.z <= NECK_CUT)
    shirt_uvs(bpy.data.objects['Shirt'].data)
    for name in ('Body', 'Shirt'):                       # T-Pose: das Skelett dazu baut rig3d.js
        o = bpy.data.objects[name]
        o.name = o.data.name = 'Rig' + name
    parts = ['RigBody', 'RigShirt', 'Trouser', 'Shoe', 'Head'] + hair_names
    for name in parts:
        me = bpy.data.objects[name].data
        me.materials.clear()
        for p in me.polygons:
            p.use_smooth = True
        me.transform(to_figure)
        me.update()
    make_face(head)
    parts.append('Face')
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=False, export_materials='NONE',
                              export_yup=True, export_apply=True, export_texcoords=True, export_normals=True,
                              export_cameras=False, export_lights=False)
    for name in parts:
        me = bpy.data.objects[name].data
        print(f'{name}: {len(me.vertices)} Punkte, {sum(len(p.vertices) - 2 for p in me.polygons)} Dreiecke')
    print(f'Füße bei y = {-HEAD_Z * SCALE:.3f}')
    print(f'-> {os.path.relpath(OUT, ROOT)} ({os.path.getsize(OUT) // 1024} KB)')


main()
