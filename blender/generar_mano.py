"""
Genera la mano del rescatista que da la naloxona: una mano derecha con guante y la manga del antebrazo, en el
agarre del protocolo DSPR (pulgar en el émbolo; índice y dedo del corazón a cada lado de la boquilla).

Sale de una de las personas MPFB (malla y huesos CC0): se posan los dedos, se recorta la mano con el antebrazo y
se exporta como malla estática a modelos/mano_naloxona.glb. scene.js la pone sobre el dispositivo (cuerpoNaloxona).

Uso (con una persona SIN comprimir, tal como sale de generar_personajes_mpfb.py, antes de `npm run comprimir`):
    blender --background --python blender/generar_mano.py -- --glb persona_h1.glb --out modelos/mano_naloxona.glb
    ... --prev carpeta    guarda tres vistas de revisión en PNG, con un dispositivo de referencia

Sistema de la malla exportada (el de cuerpoNaloxona en scene.js): la punta de la boquilla en el origen apuntando
a +z, el ancho del dispositivo en x y su grosor en y. El antebrazo sale hacia +y.
"""
import bpy, bmesh, sys, os, math, argparse
from mathutils import Vector, Matrix

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--glb", required=True)
ap.add_argument("--out", default="modelos/mano_naloxona.glb")
ap.add_argument("--prev", default="")
args = ap.parse_args(argv)

# Medidas del dispositivo (m), las mismas de cuerpoNaloxona en scene.js: distancias desde la punta de la boquilla.
HOMBROS = 0.034      # donde apoyan el índice y el dedo del corazón
EMBOLO = 0.075       # base del émbolo, donde empuja el pulgar
BOQUILLA = 0.0104    # diámetro de la boquilla, que pasa entre los dos dedos
GROSOR_DEDO = 0.009  # del centro del hueso a la piel

bpy.ops.wm.read_homefile(use_empty=True)
bpy.ops.import_scene.gltf(filepath=os.path.abspath(args.glb))
sc = bpy.context.scene
arm = next(o for o in sc.objects if o.type == 'ARMATURE')
pb = arm.pose.bones
MW = arm.matrix_world


def upd():
    bpy.context.view_layer.update()


def cabeza(n):
    return MW @ pb[n].head


def cola(n):
    return MW @ pb[n].tail


def girar(n, eje, ang):
    """Gira el hueso alrededor de un eje del mundo que pasa por su cabeza."""
    b = pb[n]
    h = MW @ b.head
    M = Matrix.Translation(h) @ Matrix.Rotation(ang, 4, eje) @ Matrix.Translation(-h) @ (MW @ b.matrix)
    b.matrix = MW.inverted() @ M
    upd()


upd()
piel = max((o for o in sc.objects if o.type == 'MESH' and 'index_03_r' in o.vertex_groups),
           key=lambda o: sum(1 for v in o.data.vertices for g in v.groups if o.vertex_groups[g.group].name == 'index_03_r' and g.weight > 0.3))
MP = piel.matrix_world.copy()
# Ejes de la mano derecha en reposo: K del meñique al índice, D de los nudillos hacia la punta de los dedos y
# Np = K x D hacia la palma (regla de la mano derecha para una mano derecha).
K = (cabeza('index_01_r') - cabeza('pinky_01_r')).normalized()
D = (cabeza('middle_03_r') - cabeza('middle_01_r')).normalized()
K = (K - D * K.dot(D)).normalized()
Np = K.cross(D).normalized()
print("EJES K", [round(v, 2) for v in K], "D", [round(v, 2) for v in D], "Np", [round(v, 2) for v in Np])

# Yema del pulgar, medida en la malla (la punta del último hueso no sirve: su largo es arbitrario en el GLB). Se
# guarda en el sistema del hueso para seguirla al posar.
gi = piel.vertex_groups['thumb_03_r'].index
vs = [MP @ v.co for v in piel.data.vertices if any(g.group == gi and g.weight > 0.6 for g in v.groups)]
h0 = cabeza('thumb_03_r')
c0 = sum(vs, Vector()) / len(vs)
d0 = (c0 - h0).normalized()
vs.sort(key=lambda p: (p - h0).dot(d0))
lejos = vs[int(len(vs) * 0.85):]
yema_local = (MW @ pb['thumb_03_r'].matrix).inverted() @ (sum(lejos, Vector()) / len(lejos))


def yema():
    return MW @ pb['thumb_03_r'].matrix @ yema_local


# 1. Índice y dedo del corazón: se separan lo justo para la boquilla y se doblan un poco.
L1 = (cabeza('index_02_r') - cabeza('index_01_r')).length
sep0 = (cabeza('index_02_r') - cabeza('middle_02_r')).length
falta = max(0.0, BOQUILLA + 2 * GROSOR_DEDO - sep0)
abre = math.asin(min(1.0, falta / (2 * L1)))
print("SEPARACION reposo", round(sep0, 4), "abre", round(math.degrees(abre), 1))
FLEX = {'index': (0.5, 0.55, 0.3), 'middle': (0.5, 0.55, 0.3), 'ring': (1.3, 1.5, 0.9), 'pinky': (1.35, 1.5, 0.9)}
for dedo, signo in (('index', 1), ('middle', -1)):
    # Separar: giro alrededor de la normal de la palma. El índice hacia el pulgar y el del corazón al otro lado.
    girar(f'{dedo}_01_r', Np, -signo * abre)
for dedo, angs in FLEX.items():
    for i, a in enumerate(angs):
        girar(f'{dedo}_0{i + 1}_r', K, a)

# Punto entre los dos dedos, a media falange: por ahí pasa la boquilla.
falanges = (cola('index_02_r') - cabeza('index_02_r')) + (cola('middle_02_r') - cabeza('middle_02_r'))
Pf = (cabeza('index_02_r') + cabeza('middle_02_r')) / 2 + falanges / 4
entre = (cabeza('index_02_r') - cabeza('middle_02_r')).normalized()
a_lo_largo = falanges.normalized()
print("SEPARACION final", round((cabeza('index_02_r') - cabeza('middle_02_r')).length, 4))

# 2. Pulgar: se busca la pose que deja su yema en la base del émbolo. Es decir: a la distancia justa de los dos
# dedos, centrada entre ellos, con el dispositivo cruzado respecto a los dedos y el pulgar empujando de frente.
dist = EMBOLO - HOMBROS + GROSOR_DEDO
reposo = {n: pb[n].matrix.copy() for n in ('thumb_01_r', 'thumb_02_r', 'thumb_03_r')}


def poner_pulgar(p):
    for n in ('thumb_01_r', 'thumb_02_r', 'thumb_03_r'):
        pb[n].matrix = reposo[n]
        upd()
    girar('thumb_01_r', Np, p[0]); girar('thumb_01_r', D, p[1]); girar('thumb_01_r', K, p[2])
    eje = (cabeza('thumb_03_r') - cabeza('thumb_02_r')).cross(Np).normalized()
    girar('thumb_02_r', eje, p[3]); girar('thumb_03_r', eje, p[4])


def error(p):
    poner_pulgar(p)
    v = yema() - Pf
    hacia = (yema() - cabeza('thumb_03_r')).normalized().dot(-v.normalized())
    limite = sum(max(0.0, abs(a) - lim) for a, lim in zip(p, (1.4, 1.6, 1.4, 1.0, 1.0)))
    return abs(v.length - dist) + 0.6 * abs(v.dot(entre)) + 0.02 * abs(v.normalized().dot(a_lo_largo)) + 0.01 * (1 - hacia) + 0.05 * limite


p = [0.0, 0.0, 0.0, 0.2, 0.2]
mejor = error(p)
paso = 0.35
for vuelta in range(80):
    cambio = False
    for i in range(5):
        for s in (1, -1):
            q = list(p); q[i] += s * paso
            e = error(q)
            if e < mejor - 1e-5:
                p, mejor, cambio = q, e, True
    if not cambio:
        paso *= 0.5
        if paso < 0.01:
            break
poner_pulgar(p)
Pt = yema()
v = Pt - Pf
print("PULGAR pose", [round(a, 2) for a in p], "error", round(mejor, 4), "yema-dedos", round(v.length, 4), "objetivo", round(dist, 4),
      "descentrado", round(v.dot(entre), 4), "cruce", round(v.normalized().dot(a_lo_largo), 2))
# 3. Sistema del dispositivo: z de la yema del pulgar hacia los dos dedos; x del dedo del corazón al índice.
z = (Pf - Pt).normalized()
x = cabeza('index_02_r') - cabeza('middle_02_r'); x = (x - z * x.dot(z)).normalized()
y = z.cross(x).normalized()
punta = Pf + z * (HOMBROS - GROSOR_DEDO)  # los dedos apoyan en los hombros del cuerpo

# 4. Malla de la piel con la pose aplicada, recortada a la mano y el antebrazo.
dg = bpy.context.evaluated_depsgraph_get()
ev = piel.evaluated_get(dg)
me = bpy.data.meshes.new_from_object(ev)
MANO = ('hand_r', 'index_', 'middle_', 'ring_', 'pinky_', 'thumb_')
nombres = {g.index: g.name for g in piel.vertex_groups}
peso_mano, peso_brazo = [], []
for v in piel.data.vertices:
    pm = sum(g.weight for g in v.groups if nombres[g.group].endswith('_r') and nombres[g.group].startswith(MANO))
    pa = sum(g.weight for g in v.groups if nombres[g.group] == 'elR')
    peso_mano.append(pm); peso_brazo.append(pa)

bm = bmesh.new(); bm.from_mesh(me)
bm.verts.ensure_lookup_table()
capa = bm.verts.layers.float.new("antebrazo")  # peso del hueso del antebrazo, para separar guante y manga
for v in bm.verts:
    v[capa] = peso_brazo[v.index]
quitar = [v for v in bm.verts if peso_mano[v.index] + peso_brazo[v.index] < 0.5]
bmesh.ops.delete(bm, geom=quitar, context='VERTS')
# Tapa del corte del codo, para que no se vea hueco (solo ese borde: los demás bordes abiertos son de la malla).
bordes = [e for e in bm.edges if e.is_boundary and all(v[capa] > 0.5 for v in e.verts)]
if bordes:
    bmesh.ops.holes_fill(bm, edges=bordes, sides=0)
# A coordenadas del dispositivo (three.js) y de ahí a Blender para exportar: three (x, y, z) = Blender (x, z, -y).
def a_final(p):
    d = p - punta
    tx, ty, tz = d.dot(x), d.dot(y), d.dot(z)
    return Vector((tx, -tz, ty))


for v in bm.verts:
    v.co = a_final(MP @ v.co)
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
# Guante y manga: se corta la malla con un plano 4.5 cm más arriba de la muñeca, para que el borde de la manga
# salga recto, y las caras de ese lado llevan el material de la manga.
muneca, codo = a_final(cabeza('hand_r')), a_final(cabeza('elR'))
brazo = (codo - muneca).normalized()
corte = muneca + brazo * 0.045
bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], dist=1e-5, plane_co=corte, plane_no=brazo)
es_manga = [(f.calc_center_median() - corte).dot(brazo) > 0 for f in bm.faces]
bm.to_mesh(me); bm.free()
# Las normales que venían del GLB ya no sirven con la pose nueva: se recalculan.
if "custom_normal" in me.attributes:
    me.attributes.remove(me.attributes["custom_normal"])

for o in list(sc.objects):
    bpy.data.objects.remove(o, do_unlink=True)
mano = bpy.data.objects.new("Mano_naloxona", me); sc.collection.objects.link(mano)


def material(nombre, color, rough):
    m = bpy.data.materials.new(nombre); m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1); b.inputs["Roughness"].default_value = rough
    m.diffuse_color = (*color, 1)  # color en las vistas de revisión
    return m


guante = material("Guante", (0.16, 0.42, 0.72), 0.5)   # nitrilo azul
manga = material("Manga", (0.035, 0.05, 0.14), 0.85)    # azul marino
me.materials.clear(); me.materials.append(guante); me.materials.append(manga)
for pol, manga_aqui in zip(me.polygons, es_manga):
    pol.material_index = 1 if manga_aqui else 0
    pol.use_smooth = True
zs = [p.center.z for p in me.polygons]
print("MALLA", len(me.vertices), "vertices", len(me.polygons), "caras", "largo", round(max(zs) - min(zs), 3), "manga", sum(es_manga))

if args.prev:
    os.makedirs(args.prev, exist_ok=True)
    # Dispositivo de referencia (solo para las vistas de revisión; no se exporta).
    def caja(n, w, h, d, pos, col):
        bpy.ops.mesh.primitive_cube_add(size=1); o = bpy.context.active_object; o.name = n
        o.scale = (w, d, h); o.location = (pos[0], -pos[2], pos[1])
        o.data.materials.append(material(n, col, 0.4)); return o
    ref = [caja("ref_boquilla", 0.0104, 0.0104, 0.036, (0, 0, -0.018), (0.95, 0.95, 0.94)),
           caja("ref_cuerpo", 0.044, 0.015, 0.037, (0, 0, -0.0465), (0.95, 0.95, 0.94)),
           caja("ref_embolo", 0.0116, 0.0116, 0.026, (0, 0, -0.062), (0.76, 0.09, 0.36))]
    sc.render.engine = 'BLENDER_WORKBENCH'
    sc.display.shading.light = 'STUDIO'; sc.display.shading.color_type = 'MATERIAL'
    sc.render.resolution_x, sc.render.resolution_y = 560, 460
    sc.render.image_settings.file_format = 'PNG'
    cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam")); sc.collection.objects.link(cam); sc.camera = cam
    cam.data.lens = 70
    centro = Vector((0, 0.04, 0.03))
    for nombre, desde in (("lado_x", (0.36, 0.04, 0.03)), ("lado_menos_x", (-0.36, 0.04, 0.03)), ("punta", (0.06, -0.36, 0.06)), ("atras", (0.06, 0.4, 0.08))):
        cam.location = Vector(desde)
        cam.rotation_euler = (centro - cam.location).to_track_quat('-Z', 'Y').to_euler()
        sc.render.filepath = os.path.join(os.path.abspath(args.prev), f"mano_{nombre}.png")
        bpy.ops.render.render(write_still=True)
    for o in ref:
        bpy.data.objects.remove(o, do_unlink=True)

bpy.ops.object.select_all(action='DESELECT')
mano.select_set(True); bpy.context.view_layer.objects.active = mano
ruta = os.path.abspath(args.out)
bpy.ops.export_scene.gltf(filepath=ruta, export_format='GLB', use_selection=True, export_apply=True,
                          export_animations=False, export_skins=False, export_morph=False, export_cameras=False, export_lights=False)
print("GLB exportado:", ruta, round(os.path.getsize(ruta) / 1024), "KB")
