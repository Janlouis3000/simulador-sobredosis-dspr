"""
Hilos de saliva entre los labios, para los segundos antes de vomitar (scene.js los muestra con la boca abierta).

Uso (desde la carpeta del proyecto):
    npm run saliva                       # exporta modelos/saliva.glb
    npm run saliva -- --prev carpeta     # además guarda vistas de revisión (Workbench, gris) de varios cuadros

Cómo se hace:
  1. Modelado: un hilo es un tubo de 6 lados hecho con anillos (cortes de bucle sobre las aristas verticales de un
     cilindro, sin cuchillo): todo en cuadriláteros, con el flujo de aristas a lo largo del hilo.
  2. Modificador Array (5 hilos) y modificador Curve: los hilos se reparten siguiendo la curva del labio, que se
     adelanta en el centro. Después cada hilo cambia un poco de grosor, de lugar y de largo, para que no se vean
     copiados.
  3. Rig: los anillos de arriba quedan fijos al labio de arriba y los de abajo van con un gancho (Hook) a un vacío
     "Mandibula" que baja como la mandíbula al abrir la boca.
  4. Simulación de tela (Cloth): los extremos van fijos (grupo "fijos") y el resto se estira, cuelga con la gravedad
     y se mece. Se simula a 10 veces el tamaño real (a escala de milímetros la tela se vuelve inestable) y se
     escala al final.
  5. Al estirarse, cada anillo se adelgaza según cuánto se alargó su tramo (la tela no conserva volumen) y quedan
     dos o tres gotitas más gruesas, como en un hilo de saliva real.
  6. Se exportan CUADROS cuadros de la simulación como claves de forma (s1, s2…) sobre el primero: scene.js pasa de
     una a la siguiente según cuánto está abierta la boca.

Ejes en el GLB: x de un lado de la boca al otro, y hacia arriba (de la barbilla a la nariz), z hacia afuera de la
cara. El extremo de arriba de los hilos está en y = 0; con la boca abierta del todo (última clave) llegan a
y = -ABRE. scene.js escala el GLB a la boca de cada personaje.
"""
import bpy, bmesh, sys, os, math, argparse, random
from mathutils import Vector, Matrix

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--out", default="modelos/saliva.glb")
ap.add_argument("--prev", default="", help="carpeta para vistas de revisión de la simulación")
args = ap.parse_args(argv)

E = 10.0              # se simula a 10 veces el tamaño real
ANCHO = 0.032         # de un hilo de los extremos al otro (m)
ABRE = 0.02           # cuánto baja el labio de abajo en la última clave (m)
R0 = 0.0008           # radio de un hilo recién formado (m); al estirarse queda entre 0.2 y 0.6 mm
ANILLOS = 18          # anillos por hilo (cortes de bucle)
HILOS = 5
CUADROS = (1, 8, 14, 20, 26, 32, 38, 44)  # cuadros que se exportan (24 por segundo)
random.seed(11)

bpy.ops.wm.read_homefile(use_empty=True)
sc = bpy.context.scene
sc.frame_start, sc.frame_end = 1, CUADROS[-1]
sc.render.fps = 24
col = sc.collection


# ---------- 1. Un hilo: cilindro con cortes de bucle ----------
def hilo():
    bm = bmesh.new()
    largo = 0.003 * E
    bmesh.ops.create_cone(bm, cap_ends=False, segments=6, radius1=R0 * E, radius2=R0 * E, depth=largo,
                          matrix=Matrix.Translation((0, 0, -largo / 2)))
    # Cortes de bucle: se subdividen las aristas verticales (las que van a lo largo del hilo).
    verticales = [e for e in bm.edges if abs(e.verts[0].co.z - e.verts[1].co.z) > largo * 0.5]
    bmesh.ops.subdivide_edges(bm, edges=verticales, cuts=ANILLOS - 2, use_grid_fill=False)
    me = bpy.data.meshes.new("Saliva"); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new("Saliva", me); col.objects.link(o)
    return o


o = hilo()

# ---------- 2. Array y curva del labio ----------
paso = ANCHO * E / (HILOS - 1)
arr = o.modifiers.new("Array", 'ARRAY')
arr.count = HILOS; arr.use_relative_offset = False; arr.use_constant_offset = True
arr.constant_offset_displace = (paso, 0, 0)
# Curva del labio vista desde arriba: el centro de la boca va más adelante (-y de Blender) que las comisuras.
# La curva empieza en su origen, que coincide con el de los hilos: x local de los hilos = distancia sobre la curva.
cd = bpy.data.curves.new("Labio", 'CURVE'); cd.dimensions = '2D'  # 2D: la normal no gira y z sigue hacia arriba
sp = cd.splines.new('BEZIER'); sp.bezier_points.add(2)
for bp, (x, y) in zip(sp.bezier_points, ((0, 0.0035), (ANCHO / 2, -0.0035), (ANCHO, 0.0035))):
    bp.co = (x * E, y * E, 0); bp.handle_left_type = bp.handle_right_type = 'AUTO'
curva = bpy.data.objects.new("Labio", cd); col.objects.link(curva)
cm = o.modifiers.new("Curva", 'CURVE'); cm.object = curva; cm.deform_axis = 'POS_X'

bpy.context.view_layer.objects.active = o; o.select_set(True)
for m in list(o.modifiers):
    bpy.ops.object.modifier_apply(modifier=m.name)
o.select_set(False)
for v in o.data.vertices:  # centro de la boca en x = 0
    v.co.x -= ANCHO * E / 2

# Cada hilo (isla) cambia un poco: grosor, lugar a lo largo del labio y si arranca algo más atrás.
bm = bmesh.new(); bm.from_mesh(o.data)
bm.verts.ensure_lookup_table()
islas, visto = [], set()
for v in bm.verts:
    if v.index in visto:
        continue
    pila, isla = [v], []
    while pila:
        w = pila.pop()
        if w.index in visto:
            continue
        visto.add(w.index); isla.append(w)
        pila.extend(e.other_vert(w) for e in w.link_edges)
    islas.append(isla)
for isla in islas:
    c = sum((w.co for w in isla), Vector()) / len(isla)
    g, dx = random.uniform(0.6, 1.35), random.uniform(-0.25, 0.25) * paso
    for w in isla:
        d = w.co - Vector((c.x, c.y, w.co.z))
        w.co = Vector((c.x + dx, c.y, w.co.z)) + d * g
islas = [[w.index for w in isla] for isla in islas]  # índices: los BMVert dejan de existir con bm.free()
bm.to_mesh(o.data); bm.free()

# ---------- 3. Grupos y gancho de la mandíbula ----------
zs = [v.co.z for v in o.data.vertices]
arriba_z, abajo_z = max(zs), min(zs)
g_fijos = o.vertex_groups.new(name="fijos"); g_abajo = o.vertex_groups.new(name="abajo")
for v in o.data.vertices:
    if abs(v.co.z - arriba_z) < 1e-6:
        g_fijos.add([v.index], 1.0, 'REPLACE')
    elif abs(v.co.z - abajo_z) < 1e-6:
        g_fijos.add([v.index], 1.0, 'REPLACE'); g_abajo.add([v.index], 1.0, 'REPLACE')

mand = bpy.data.objects.new("Mandibula", None); col.objects.link(mand)
mand.location = (0, 0, abajo_z)
gancho = o.modifiers.new("Mandibula", 'HOOK'); gancho.object = mand; gancho.vertex_group = "abajo"
gancho.center = mand.location
bpy.context.view_layer.update()
gancho.matrix_inverse = mand.matrix_world.inverted()  # sin esto el gancho mueve los anillos de abajo por la posición del vacío
# La mandíbula baja en 1.5 s con un arranque y una llegada suaves, y la boca se adelanta un poco al abrir.
for f, z, y in ((1, abajo_z, 0.0), (CUADROS[-1] - 6, -ABRE * E, -0.002 * E), (CUADROS[-1], -ABRE * E, -0.002 * E)):
    mand.location = (0, y, z); mand.keyframe_insert("location", frame=f)

# ---------- 4. Tela ----------
tela = o.modifiers.new("Tela", 'CLOTH')
s = tela.settings
s.quality = 12; s.mass = 0.002; s.air_damping = 2.0
s.tension_stiffness = 1.5; s.compression_stiffness = 1.5; s.shear_stiffness = 1.0; s.bending_stiffness = 0.02
s.vertex_group_mass = "fijos"; s.pin_stiffness = 1.0
tela.point_cache.frame_start, tela.point_cache.frame_end = 1, CUADROS[-1]
sc.gravity = (0, 0, -9.81 * 0.4)  # algo menos que la real: a 10 veces el tamaño, la gravedad pesaría de más

# ---------- 5. Simular, adelgazar y guardar cuadros ----------
n = len(o.data.vertices)
anillo = [round((v.co.z - arriba_z) / (abajo_z - arriba_z) * (ANILLOS - 1)) for v in o.data.vertices]
isla_de = {}
for k, isla in enumerate(islas):
    for w in isla:
        isla_de[w] = k
reposo = {}  # largo de cada tramo en el primer cuadro
gotas = {k: random.sample(range(4, ANILLOS - 4), 2) for k in range(len(islas))}
cuadros = {}
for f in range(1, CUADROS[-1] + 1):
    sc.frame_set(f)
    if f not in CUADROS:
        continue
    dg = bpy.context.evaluated_depsgraph_get()
    me = o.evaluated_get(dg).to_mesh()
    pos = [Vector(v.co) for v in me.vertices]
    o.evaluated_get(dg).to_mesh_clear()
    # Centro de cada anillo de cada hilo.
    centros = {}
    for i in range(n):
        centros.setdefault((isla_de[i], anillo[i]), []).append(pos[i])
    centros = {k: sum(v, Vector()) / len(v) for k, v in centros.items()}
    if not reposo:
        reposo = {k: (centros[k] - centros[(k[0], max(0, k[1] - 1))]).length for k in centros}
    out = []
    for i in range(n):
        k = (isla_de[i], anillo[i])
        a = centros[(k[0], max(0, k[1] - 1))]; b = centros[(k[0], min(ANILLOS - 1, k[1] + 1))]
        tramo = (b - a).length / (2 if 0 < k[1] < ANILLOS - 1 else 1)
        estira = max(1.0, tramo / max(reposo[k] if reposo[k] > 0 else tramo, 1e-6))
        g = max(0.22, estira ** -0.75)
        if k[1] in gotas[k[0]]:
            g = max(g, 0.85)  # gotitas: no se adelgazan
        if k[1] in (0, ANILLOS - 1):
            g = 1.0  # donde se pega al labio queda el grosor entero, de los dos lados
        out.append(centros[k] + (pos[i] - centros[k]) * g)
    cuadros[f] = [p / E for p in out]
    zs_f = [p.z for p in cuadros[f]]; xs_f = [p.x for p in cuadros[f]]
    print(f"cuadro {f}: alto {1000 * (max(zs_f) - min(zs_f)):.1f} mm, ancho {1000 * (max(xs_f) - min(xs_f)):.1f} mm")

# ---------- 6. Malla final con claves de forma ----------
for m in list(o.modifiers):
    o.modifiers.remove(m)
o.location = (0, 0, 0)
for v, p in zip(o.data.vertices, cuadros[CUADROS[0]]):
    v.co = p
o.shape_key_add(name="Basis")
for i, f in enumerate(CUADROS[1:], 1):
    k = o.shape_key_add(name=f"s{i}")
    for d, p in zip(k.data, cuadros[f]):
        d.co = p
for p in o.data.polygons:
    p.use_smooth = True
for g in list(o.vertex_groups):
    o.vertex_groups.remove(g)
bpy.data.objects.remove(curva); bpy.data.objects.remove(mand)

m = bpy.data.materials.new("Saliva")
if hasattr(m, "use_nodes") and not m.use_nodes:
    m.use_nodes = True
b = next(nd for nd in m.node_tree.nodes if nd.type == 'BSDF_PRINCIPLED')
b.inputs["Base Color"].default_value = (0.9, 0.88, 0.84, 1); b.inputs["Roughness"].default_value = 0.08
b.inputs["IOR"].default_value = 1.34; b.inputs["Alpha"].default_value = 0.55
o.data.materials.append(m)

if args.prev:
    os.makedirs(args.prev, exist_ok=True)
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam")); col.objects.link(cam); sc.camera = cam
    cam.data.lens = 80
    cam.location = (0.03, -0.16, -0.012)
    cam.rotation_euler = (Vector((0, 0, -0.011)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
    sc.render.engine = 'BLENDER_WORKBENCH'; sc.display.shading.light = 'STUDIO'
    sc.render.resolution_x, sc.render.resolution_y = 360, 300
    for i in range(len(CUADROS)):
        for j, k in enumerate(o.data.shape_keys.key_blocks[1:], 1):
            k.value = 1.0 if j == i else 0.0
        sc.render.filepath = os.path.join(os.path.abspath(args.prev), f"saliva_{i}.png")
        bpy.ops.render.render(write_still=True)
    for k in o.data.shape_keys.key_blocks[1:]:
        k.value = 0.0

bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active = o
ruta = os.path.abspath(args.out)
os.makedirs(os.path.dirname(ruta), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=ruta, export_format='GLB', use_selection=True, export_apply=False,
                          export_morph=True, export_morph_normal=True, export_animations=False)
tris = sum(len(p.vertices) - 2 for p in o.data.polygons)
print(f"saliva: {len(islas)} hilos, {tris} triángulos, {len(CUADROS) - 1} claves, {round(os.path.getsize(ruta) / 1024)} KB")
