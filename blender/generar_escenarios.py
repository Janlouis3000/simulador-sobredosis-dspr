"""
Genera los cuatro escenarios del simulador en Blender, hornea su luz con Cycles y los exporta a GLB.

Uso (desde la carpeta del proyecto):
    blender --background --python blender/generar_escenarios.py -- --out modelos
    blender --background --python blender/generar_escenarios.py -- --out modelos --solo fentanilo --muestras 32

Qué hace con cada escenario:
  1. Arma el cuarto (piso, dos paredes) y los muebles simples con biseles, con materiales procedurales de Blender
     (losa, madera, concreto, ladrillo, repello, tela, alfombra). Los muebles y enseres de la Asset Store
     (House Interior y Appliances) se leen del proyecto de Unity (--unity) con mueble().
  2. Pone un sol en la misma dirección que la luz principal de scene.js, cielo y las lámparas del cuarto.
  3. Hornea en dos texturas (piso y resto) la luz difusa (directa + rebotada) y el color, y las combina:
     color × luz. La luz se suaviza para quitar el ruido de Cycles; el color queda nítido.
  4. Cambia los materiales a negro con la textura horneada como emisión: en three.js eso muestra la luz
     horneada y deja que el navegador agregue los reflejos (la rugosidad se conserva por material).
  5. Los objetos que brillan o reflejan (espejo, grifos, bombillas, pantalla de la lámpara, charco) no se
     hornean: se exportan con su material normal.

Coordenadas: las posiciones se escriben como en scene.js (x, y arriba, z hacia la cámara) y P() las pasa a
Blender (z arriba). La pared de fondo está en z = -1.75 y la izquierda en x = -1.45, como en ambiente.js.
"""
import bpy, bmesh, sys, os, math, argparse, re
import numpy as np
from mathutils import Vector, Matrix

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--out", default="modelos")
ap.add_argument("--solo", default="")
ap.add_argument("--muestras", type=int, default=64)
# Tamaños de los atlas horneados. Se compararon en capturas iguales (misma cámara, persona y luz):
# - Todo en 4096 deja nítidas las juntas del piso y las franjas de la alfombra, pero duplica el GLB (+535 KB en el
#   baño) y cuadruplica la memoria de la tarjeta gráfica; paredes y muebles casi no cambian porque no se ven de cerca.
# - Piso en 3072 y alfombras en su propio atlas de 1024 se ven casi igual que 4096 junto a la persona por +84 KB.
# - Más muestras no cambian la nitidez: el ruido de 64 muestras solo queda en zonas tapadas que no se ven.
ap.add_argument("--tam", type=int, default=2048, help="lado en px del atlas horneado de paredes y muebles")
ap.add_argument("--tam-piso", type=int, default=3072, help="lado en px del atlas del piso (0 = el de --tam)")
ap.add_argument("--tam-cerca", type=int, default=1024,
                help="lado en px del atlas propio de los objetos junto a la persona (CERCA: las alfombras); 0 = van en el de --tam")
ap.add_argument("--calidad", default="85",
                help="calidad WebP de las texturas al exportar (0-100). Varias separadas por coma (p. ej. 85,90,95) "
                     "exportan un GLB por calidad desde el mismo horneado, con el sufijo _q<calidad>, para compararlas")
ap.add_argument("--texturas", default="", help="carpeta donde guardar las texturas horneadas en PNG para revisarlas")
ap.add_argument("--unity", default=os.path.join(os.path.expanduser("~"), "UnityProjects", "SimuladorDSPR-assets", "Assets"),
                help="carpeta Assets del proyecto de Unity con House Interior (nappin) y Appliances (Alstra Infinite)")
ap.add_argument("--objetos", default="", help="carpeta de modelos/objetos, si el script se corre desde otra carpeta")
args = ap.parse_args(argv)

ESCENAS = ["fentanilo", "pastillas", "xilazina", "tardio"]
# Área del piso visible (coordenadas de scene.js): de la pared izquierda a x = 3.4 y de la de fondo a z = 3.2.
X0, X1, Z0, Z1, ALTO = -1.45, 3.4, -1.75, 3.2, 2.6
# Giro que deja de frente a la cámara los enseres de Appliances (Alstra Infinite), y alto del gavetero de House
# Interior escalado a 1 m de largo (para poner cosas encima).
ROT_ALSTRA = 0.0
ALTO_GAVETERO = 0.75


def P(x, y, z):
    return (x, -z, y)


def srgb(h):
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in c) + (1.0,)


# ---------- Materiales procedurales ----------
def nuevo_mat(nombre, rough=0.8):
    m = bpy.data.materials.new(nombre)
    if hasattr(m, "use_nodes") and not m.use_nodes:
        m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    b.inputs["Roughness"].default_value = rough
    m["rugosidad"] = rough
    return m, nt, b


def sock(node, ident, out=False):
    return next(s for s in (node.outputs if out else node.inputs) if s.identifier == ident)


def coords(nt, escala=1.0):
    tc = nt.nodes.new("ShaderNodeTexCoord")
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = (escala, escala, escala)
    nt.links.new(tc.outputs["Object"], mp.inputs["Vector"])
    return mp.outputs["Vector"]


def multiplicar(nt, a, b):
    mx = nt.nodes.new("ShaderNodeMix"); mx.data_type = 'RGBA'; mx.blend_type = 'MULTIPLY'
    mx.inputs[0].default_value = 1.0
    nt.links.new(a, sock(mx, "A_Color")); nt.links.new(b, sock(mx, "B_Color"))
    return sock(mx, "Result_Color", out=True)


def relieve(nt, b, altura, fuerza=0.3, invertir=False):
    bp = nt.nodes.new("ShaderNodeBump"); bp.invert = invertir
    bp.inputs["Strength"].default_value = fuerza; bp.inputs["Distance"].default_value = 0.002
    nt.links.new(altura, bp.inputs["Height"]); nt.links.new(bp.outputs["Normal"], b.inputs["Normal"])


def ruido(nt, vec, escala, detalle=6):
    n = nt.nodes.new("ShaderNodeTexNoise")
    n.inputs["Scale"].default_value = escala; n.inputs["Detail"].default_value = detalle
    nt.links.new(vec, n.inputs["Vector"])
    return n


def rampa(nt, fac, colores):
    r = nt.nodes.new("ShaderNodeValToRGB")
    els = r.color_ramp.elements
    for i, (pos, col) in enumerate(colores):
        e = els[i] if i < len(els) else els.new(pos)
        e.position = pos; e.color = srgb(col)
    nt.links.new(fac, r.inputs["Fac"])
    return r.outputs["Color"]


def ladrillo(nt, vec, c1, c2, mortero, ancho, alto, junta, desfase=0.5):
    t = nt.nodes.new("ShaderNodeTexBrick")
    t.offset = desfase; t.offset_frequency = 2
    t.inputs["Color1"].default_value = srgb(c1); t.inputs["Color2"].default_value = srgb(c2)
    t.inputs["Mortar"].default_value = srgb(mortero); t.inputs["Scale"].default_value = 1.0
    t.inputs["Mortar Size"].default_value = junta; t.inputs["Mortar Smooth"].default_value = 0.2
    t.inputs["Bias"].default_value = 0.0
    t.inputs["Brick Width"].default_value = ancho; t.inputs["Row Height"].default_value = alto
    nt.links.new(vec, t.inputs["Vector"])
    return t


def mat_color(nombre, color, rough=0.8, metal=0.0):
    m, nt, b = nuevo_mat(nombre, rough)
    b.inputs["Base Color"].default_value = srgb(color); b.inputs["Metallic"].default_value = metal
    return m


def mat_losa(nombre, base, junta, lado=0.3, rough=0.2):
    m, nt, b = nuevo_mat(nombre, rough)
    v = coords(nt)
    t = ladrillo(nt, v, base, base, junta, lado, lado, 0.004, desfase=0.0)
    n = ruido(nt, v, 3.0)
    var = rampa(nt, n.outputs["Fac"], [(0.3, "#f2f2f2"), (0.7, "#ffffff")])
    nt.links.new(multiplicar(nt, t.outputs["Color"], var), b.inputs["Base Color"])
    relieve(nt, b, t.outputs["Fac"], 0.35, invertir=True)
    return m


def mat_madera(nombre, c1, c2, junta="#2a1c12", rough=0.45):
    m, nt, b = nuevo_mat(nombre, rough)
    v = coords(nt)
    t = ladrillo(nt, v, c1, c2, junta, 1.3, 0.16, 0.0025)
    # Veta: ruido estirado a lo largo de la tabla (eje x)
    mp = nt.nodes.new("ShaderNodeMapping"); mp.inputs["Scale"].default_value = (1.5, 40.0, 1.0)
    nt.links.new(v, mp.inputs["Vector"])
    n = ruido(nt, mp.outputs["Vector"], 2.0, 8)
    veta = rampa(nt, n.outputs["Fac"], [(0.35, "#c9b8a6"), (0.65, "#ffffff")])
    nt.links.new(multiplicar(nt, t.outputs["Color"], veta), b.inputs["Base Color"])
    relieve(nt, b, t.outputs["Fac"], 0.25, invertir=True)
    return m


def mat_concreto(nombre):
    m, nt, b = nuevo_mat(nombre, 0.9)
    v = coords(nt)
    n1 = ruido(nt, v, 1.5, 8); n2 = ruido(nt, v, 30.0, 4)
    c1 = rampa(nt, n1.outputs["Fac"], [(0.35, "#7d7f80"), (0.65, "#a3a5a4")])
    c2 = rampa(nt, n2.outputs["Fac"], [(0.4, "#e6e6e6"), (0.6, "#ffffff")])
    nt.links.new(multiplicar(nt, c1, c2), b.inputs["Base Color"])
    relieve(nt, b, n2.outputs["Fac"], 0.15)
    return m


def mat_ladrillo(nombre):
    m, nt, b = nuevo_mat(nombre, 0.9)
    v = coords(nt)
    t = ladrillo(nt, v, "#8c3b2a", "#a4553a", "#bdb5a8", 0.22, 0.075, 0.011)
    n = ruido(nt, v, 25.0)
    var = rampa(nt, n.outputs["Fac"], [(0.3, "#d8d8d8"), (0.7, "#ffffff")])
    nt.links.new(multiplicar(nt, t.outputs["Color"], var), b.inputs["Base Color"])
    relieve(nt, b, t.outputs["Fac"], 0.5, invertir=True)
    return m


def mat_repello(nombre, color):
    m, nt, b = nuevo_mat(nombre, 0.85)
    v = coords(nt)
    n = ruido(nt, v, 60.0, 4)
    var = rampa(nt, n.outputs["Fac"], [(0.35, "#ececec"), (0.65, "#ffffff")])
    base = nt.nodes.new("ShaderNodeRGB"); base.outputs[0].default_value = srgb(color)
    nt.links.new(multiplicar(nt, base.outputs[0], var), b.inputs["Base Color"])
    relieve(nt, b, n.outputs["Fac"], 0.08)
    return m


def mat_tela(nombre, color, rough=0.95):
    m, nt, b = nuevo_mat(nombre, rough)
    v = coords(nt)
    n = ruido(nt, v, 220.0, 2)
    var = rampa(nt, n.outputs["Fac"], [(0.3, "#d9d9d9"), (0.7, "#ffffff")])
    base = nt.nodes.new("ShaderNodeRGB"); base.outputs[0].default_value = srgb(color)
    nt.links.new(multiplicar(nt, base.outputs[0], var), b.inputs["Base Color"])
    if "Sheen Weight" in b.inputs:
        b.inputs["Sheen Weight"].default_value = 0.3
    return m


def mat_alfombra(nombre, colores, escala=6.0):
    m, nt, b = nuevo_mat(nombre, 1.0)
    v = coords(nt)
    w = nt.nodes.new("ShaderNodeTexWave"); w.wave_type = 'BANDS'; w.bands_direction = 'X'
    w.inputs["Scale"].default_value = escala; w.inputs["Distortion"].default_value = 0.0
    nt.links.new(v, w.inputs["Vector"])
    r = nt.nodes.new("ShaderNodeValToRGB"); r.color_ramp.interpolation = 'CONSTANT'
    els = r.color_ramp.elements
    for i, col in enumerate(colores):
        e = els[i] if i < len(els) else els.new(i / len(colores))
        e.position = i / len(colores); e.color = srgb(col)
    nt.links.new(w.outputs["Fac"], r.inputs["Fac"])
    n = ruido(nt, v, 300.0, 2)
    var = rampa(nt, n.outputs["Fac"], [(0.3, "#cfcfcf"), (0.7, "#ffffff")])
    nt.links.new(multiplicar(nt, r.outputs["Color"], var), b.inputs["Base Color"])
    relieve(nt, b, n.outputs["Fac"], 0.2)
    return m


def mat_emision(nombre, color, fuerza):
    m, nt, b = nuevo_mat(nombre, 0.5)
    b.inputs["Base Color"].default_value = srgb(color)
    b.inputs["Emission Color"].default_value = srgb(color); b.inputs["Emission Strength"].default_value = fuerza
    return m


# ---------- Geometría ----------
COL = None


def objeto(nombre, bm, mat, pos, rot=(0, 0, 0), bisel=0.0, dinamico=False):
    me = bpy.data.meshes.new(nombre); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(nombre, me); COL.objects.link(o)
    o.location = P(*pos)
    o.rotation_euler = (rot[0], -rot[2], rot[1])  # rotaciones de scene.js (x, y arriba, z) a Blender
    for m in (mat if isinstance(mat, list) else [mat]):
        o.data.materials.append(m)
    if bisel > 0:
        md = o.modifiers.new("Bisel", 'BEVEL'); md.width = bisel; md.segments = 3; md.limit_method = 'ANGLE'
    o["dinamico"] = dinamico
    return o


def caja(nombre, w, h, d, pos, mat, rot=(0, 0, 0), bisel=0.008, dinamico=False):
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=(w, d, h), verts=bm.verts)
    return objeto(nombre, bm, mat, pos, rot, bisel, dinamico)


def cilindro(nombre, r1, r2, h, pos, mat, rot=(0, 0, 0), seg=32, dinamico=False, tapas=True):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=tapas, segments=seg, radius1=r2, radius2=r1, depth=h)
    o = objeto(nombre, bm, mat, pos, rot, 0.0, dinamico)
    for p in o.data.polygons:
        p.use_smooth = len(p.vertices) == 4
    return o


def esfera(nombre, r, pos, mat, escala=(1, 1, 1), dinamico=False):
    bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=24, v_segments=14, radius=r)
    bmesh.ops.scale(bm, vec=(escala[0], escala[2], escala[1]), verts=bm.verts)
    o = objeto(nombre, bm, mat, pos, (0, 0, 0), 0.0, dinamico)
    for p in o.data.polygons:
        p.use_smooth = True
    return o


def toro(nombre, R, r, pos, mat, escala=(1, 1, 1)):
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r, major_segments=40, minor_segments=12)
    o = bpy.context.active_object; o.name = nombre
    for c in o.users_collection:
        c.objects.unlink(o)
    COL.objects.link(o)
    o.location = P(*pos); o.scale = (escala[0], escala[2], escala[1])
    o.data.materials.append(mat); o["dinamico"] = False
    for p in o.data.polygons:
        p.use_smooth = True
    return o


def tina(nombre, w, h, d, pared, pos, mat):
    """Bañera hueca: fondo y cuatro paredes con biseles (pos es el centro de la caja completa)."""
    x, y, z = pos
    # El fondo cabe dentro de las cuatro paredes. Si llegara hasta afuera, sus lados quedarían encimados con la
    # cara exterior de las paredes y esa franja de abajo saldría con un tramado negro y blanco.
    caja(nombre + "_fondo", w - 2 * pared, 0.1, d - 2 * pared, (x, y - h / 2 + 0.05, z), mat, bisel=0.0)
    # Las paredes de los lados caben entre las de las puntas, sin encajarse (las caras encimadas salen negras).
    lado = d - 2 * pared
    for i, (ww, dd, dx, dz) in enumerate(((w, pared, 0, (d - pared) / 2), (w, pared, 0, -(d - pared) / 2),
                                          (pared, lado, (w - pared) / 2, 0), (pared, lado, -(w - pared) / 2, 0))):
        caja(f"{nombre}_pared{i}", ww, h, dd, (x + dx, y, z + dz), mat, bisel=0.012)


def plano(nombre, w, h, pos, mat, rot):
    bm = bmesh.new(); bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=0.5)
    bmesh.ops.scale(bm, vec=(w, h, 1), verts=bm.verts)
    return objeto(nombre, bm, mat, pos, rot)


def charco(nombre, R, pos, mat, semilla=3):
    bm = bmesh.new()
    c = bm.verts.new((0, 0, 0.001)); anillo = []
    f = [semilla * 1.3, semilla * 2.1, semilla * 0.7]
    for i in range(48):
        a = i / 48 * math.tau
        rr = R * (1 + 0.22 * math.sin(3 * a + f[0]) + 0.13 * math.sin(5 * a + f[1]) + 0.07 * math.sin(9 * a + f[2]))
        anillo.append(bm.verts.new((math.cos(a) * rr * 1.25, math.sin(a) * rr * 0.85, 0.001)))
    for i in range(48):
        bm.faces.new((c, anillo[i], anillo[(i + 1) % 48]))
    return objeto(nombre, bm, mat, pos, (0, 0, 0), 0.0, dinamico=True)


# ---------- Objetos de modelos/objetos (pastillas, jeringuilla, frasco, cigarrillos, botella) ----------
OBJETOS = args.objetos or os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "modelos", "objetos")


def objeto_glb(archivo, pos, rot=(0, 0, 0), escala=1.0, nitido=False):
    """Importa un objeto GLB y lo coloca. Queda dinámico: conserva su textura y no se hornea, pero está en la
    escena al hornear, así que su sombra queda en la mesa o el piso. Sus texturas son pequeñas y vienen con
    filtro 'más cercano' (se ven pixeladas); se cambian a lineal, salvo con nitido=True (cuadros de colores
    como los del cubo de Rubik, que se ven mejor con bordes duros)."""
    antes = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(OBJETOS, archivo + ".glb"))
    for o in set(bpy.data.objects) - antes:
        if o.type != 'MESH':
            continue
        o.rotation_mode = 'XYZ'  # el importador los deja en cuaternión y rotation_euler no tendría efecto
        o.location = P(*pos); o.rotation_euler = (rot[0], -rot[2], rot[1]); o.scale = (escala, escala, escala)
        o["dinamico"] = True
        for m in o.data.materials:
            for nd in m.node_tree.nodes:
                if nd.type == 'TEX_IMAGE':
                    nd.interpolation = 'Closest' if nitido else 'Linear'


def pieza(archivo, pos, rot_y=0.0, escala=1.0):
    """Importa un objeto de modelos/objetos preparado con preparar_objetos.py (muebles, cuadros, plantas de Poly Haven)
    y lo hornea con el cuarto, como los muebles de Unity: su textura de color se lee de su UV ("textura") y la luz va
    a una UV nueva. Base (o espalda, si va en la pared) en pos; rot_y gira alrededor de la vertical como en scene.js.
    Con rot_y = 0 el frente mira a la cámara (+z de scene.js)."""
    antes = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(OBJETOS, archivo + ".glb"))
    nuevos = set(bpy.data.objects) - antes
    for o in [o for o in nuevos if o.type != 'MESH']:
        bpy.data.objects.remove(o)
    o = next(o for o in nuevos if o.name in bpy.data.objects and o.type == 'MESH')
    o.name = "Pieza_" + archivo
    o.rotation_mode = 'XYZ'
    o.location = P(*pos); o.rotation_euler = (0, 0, rot_y); o.scale = (escala, escala, escala)
    if o.data.uv_layers:
        o.data.uv_layers[0].name = "textura"
    for m in o.data.materials:
        b = next((n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
        if b:
            m["rugosidad"] = b.inputs["Roughness"].default_value
    o["dinamico"] = False; o["con_textura"] = True
    return o


# ---------- Muebles y enseres de la Asset Store (proyecto de Unity) ----------
# House Interior - Free (nappin) y Appliances - SnapNSet Starter (Alstra Infinite), bajados por la persona a cargo con
# su cuenta de la Asset Store. Se leen los FBX y los materiales de Unity (.mat) directamente de la carpeta Assets.
# Quedan horneados como el resto del cuarto: su textura de color se lee con su UV original y la luz se hornea en
# una UV nueva ("horno"), que es la única que se exporta.
_UNITY = {}


def _indice_unity():
    if not _UNITY:
        import glob, re
        pngs = {}
        for meta in glob.glob(os.path.join(args.unity, "**", "*.png.meta"), recursive=True):
            m = re.search(r"^guid: (\w+)", open(meta, encoding="utf-8").read(), re.M)
            if m:
                pngs[m.group(1)] = meta[:-5]
        _UNITY["png"] = pngs
        _UNITY["mat"] = {os.path.basename(p)[:-4]: p for p in glob.glob(os.path.join(args.unity, "**", "*.mat"), recursive=True)}
        _UNITY["fbx"] = {os.path.basename(p).lower(): p for p in glob.glob(os.path.join(args.unity, "**", "*.fbx"), recursive=True)}
    return _UNITY


def _mat_unity(nombre):
    """Material de Blender a partir del .mat de Unity: textura (_BaseMap o _MainTex) × color, suavidad y metal."""
    import re
    U = _indice_unity()
    cache = U.setdefault("hechos", {})
    if nombre in cache:
        return cache[nombre]
    texto = open(U["mat"][nombre], encoding="utf-8").read() if nombre in U["mat"] else ""
    num = lambda clave, d: float(x.group(1)) if (x := re.search(r"- " + clave + r": ([\d.]+)", texto)) else d
    col = re.search(r"- _(?:BaseColor|Color): \{r: ([\d.]+), g: ([\d.]+), b: ([\d.]+)", texto)
    m, nt, b = nuevo_mat("U_" + nombre, 1.0 - num("_Smoothness", num("_Glossiness", 0.3)))
    cache[nombre] = m
    b.inputs["Metallic"].default_value = num("_Metallic", 0.0)
    if "MetallicBlack" in nombre:
        b.inputs["Base Color"].default_value = srgb("#1e1f22"); b.inputs["Metallic"].default_value = 0.6
    if col:
        b.inputs["Base Color"].default_value = (float(col.group(1)), float(col.group(2)), float(col.group(3)), 1)
    for clave in ("_BaseMap", "_MainTex"):
        t = re.search(r"- " + clave + r":\s*\n\s*m_Texture: \{fileID: \d+, guid: (\w+)", texto)
        if t and t.group(1) in U["png"]:
            im = nt.nodes.new("ShaderNodeTexImage"); im.image = bpy.data.images.load(U["png"][t.group(1)], check_existing=True)
            uv = nt.nodes.new("ShaderNodeUVMap"); uv.uv_map = "textura"
            nt.links.new(uv.outputs["UV"], im.inputs["Vector"])
            tinte = nt.nodes.new("ShaderNodeRGB"); tinte.outputs[0].default_value = tuple(b.inputs["Base Color"].default_value)
            nt.links.new(multiplicar(nt, im.outputs["Color"], tinte.outputs[0]), b.inputs["Base Color"])
            break
    return m


def mueble(fbx, pos, rot_y=0.0, medida=("largo", 1.0), max_tris=15000, dinamico=False):
    """Importa un FBX del proyecto de Unity, lo escala a una medida real y lo pone en pos (base en el piso).

    medida: ("largo", m) para el lado horizontal más largo o ("alto", m). Los modelos de House Interior vienen a
    una escala de casi el doble de la real, cada uno distinta, así que se escalan por su medida.
    rot_y gira alrededor de la vertical como en scene.js. Con rot_y = pi/2, los muebles de House Interior quedan
    con el respaldo o la cabecera hacia la pared de fondo y el frente hacia la cámara.
    max_tris: los modelos muy densos (camas, sofá) se simplifican para que el GLB no crezca de más."""
    U = _indice_unity()
    ruta = U["fbx"].get(fbx.lower() + ".fbx") or U["fbx"]["(msh)" + fbx.lower() + ".fbx"]
    antes = set(bpy.data.objects)
    bpy.ops.import_scene.fbx(filepath=ruta)
    nuevos = [o for o in set(bpy.data.objects) - antes]
    mallas = [o for o in nuevos if o.type == 'MESH']
    # Primero se sueltan de sus padres (que traen la escala del FBX) y después se borra lo que no es malla.
    bpy.ops.object.select_all(action='DESELECT')
    for o in mallas:
        o.select_set(True)
    bpy.context.view_layer.objects.active = mallas[0]
    bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
    for o in nuevos:
        if o.type != 'MESH':
            bpy.data.objects.remove(o)
    for o in mallas:
        if COL not in o.users_collection:
            for c in list(o.users_collection):
                c.objects.unlink(o)
            COL.objects.link(o)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    if len(mallas) > 1:
        bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active
    o.name = "Mueble_" + fbx
    # UV de la textura con nombre fijo; las demás (la de lightmap de Unity) sobran.
    while len(o.data.uv_layers) > 1:
        o.data.uv_layers.remove(o.data.uv_layers[-1])
    if o.data.uv_layers:
        o.data.uv_layers[0].name = "textura"
    for s in o.material_slots:
        if s.material:
            s.material = _mat_unity(re.sub(r"\.\d{3}$", "", s.material.name))
    tris = sum(len(p.vertices) - 2 for p in o.data.polygons)
    if tris > max_tris:
        md = o.modifiers.new("Simplificar", 'DECIMATE'); md.ratio = max_tris / tris
        bpy.ops.object.modifier_apply(modifier=md.name)
    # Escala por la medida pedida y base en el piso, centrado en x/y.
    vs = [Vector(v) for v in o.bound_box]
    mn = Vector((min(v.x for v in vs), min(v.y for v in vs), min(v.z for v in vs)))
    mx = Vector((max(v.x for v in vs), max(v.y for v in vs), max(v.z for v in vs)))
    d = mx - mn
    s = medida[1] / (d.z if medida[0] == "alto" else max(d.x, d.y))
    o.data.transform(Matrix.Translation(-Vector(((mn.x + mx.x) / 2, (mn.y + mx.y) / 2, mn.z))))
    o.data.transform(Matrix.Scale(s, 4))
    o.location = P(*pos); o.rotation_mode = 'XYZ'; o.rotation_euler = (0, 0, rot_y)
    o["dinamico"] = dinamico; o["con_textura"] = True
    print(f"Mueble {fbx}: {tris} triángulos -> {sum(len(p.vertices) - 2 for p in o.data.polygons)}, escala {s:.3f}, "
          f"{d.x * s:.2f} x {d.y * s:.2f} x {d.z * s:.2f} m")
    return o


def papelito(pos, rot_y):
    """Papel doblado en dos (el del caso de fentanilo): dos láminas en V."""
    papel = mat_color("Papel", "#f2efe6", 0.85)
    for i, a in enumerate((0.22, -0.22)):
        caja(f"Papelito_{i}", 0.028, 0.0015, 0.035, (pos[0] + (0.0125 if i else -0.0125), pos[1] + 0.004, pos[2]), papel,
             rot=(0, rot_y, a), bisel=0.0, dinamico=True)


# ---------- Cuarto ----------
def cuarto(m_piso, m_pared, zocalo=None, desde=0.0):
    # Los planos se crean en el plano XY de Blender (el piso) y las paredes se giran hacia el cuarto.
    # desde: altura donde empieza la pared pintada (en el baño, debajo va el enchapado).
    plano("Piso", X1 - X0, Z1 - Z0, ((X0 + X1) / 2, 0, (Z0 + Z1) / 2), m_piso, (0, 0, 0))
    alto = ALTO - desde
    f = plano("Pared_fondo", X1 - X0, alto, ((X0 + X1) / 2, desde + alto / 2, Z0), m_pared, (0, 0, 0))
    f.rotation_euler = (math.pi / 2, 0, 0)
    i = plano("Pared_izq", Z1 - Z0, alto, (X0, desde + alto / 2, (Z0 + Z1) / 2), m_pared, (0, 0, 0))
    i.rotation_euler = (math.pi / 2, 0, math.pi / 2)
    if zocalo:
        caja("Zocalo_fondo", X1 - X0, 0.09, 0.02, ((X0 + X1) / 2, 0.045, Z0 + 0.01), zocalo, bisel=0.003)
        caja("Zocalo_izq", 0.02, 0.09, Z1 - Z0, (X0 + 0.01, 0.045, (Z0 + Z1) / 2), zocalo, bisel=0.003)


def fentanilo():
    cuarto(mat_losa("Piso_losa", "#d3d9dc", "#8f989e", 0.3), mat_repello("Pared", "#bfd3de"), desde=1.2)
    enchape = mat_losa("Enchape", "#e8eef1", "#aeb8be", 0.2, 0.15)
    e1 = plano("Enchape_fondo", X1 - X0, 1.2, ((X0 + X1) / 2, 0.6, Z0 + 0.004), enchape, (0, 0, 0)); e1.rotation_euler = (math.pi / 2, 0, 0)
    e2 = plano("Enchape_izq", Z1 - Z0, 1.2, (X0 + 0.004, 0.6, (Z0 + Z1) / 2), enchape, (0, 0, 0)); e2.rotation_euler = (math.pi / 2, 0, math.pi / 2)
    blanco = mat_color("Porcelana", "#f4f6f6", 0.12)
    caja("Remate_fondo", X1 - X0, 0.03, 0.03, ((X0 + X1) / 2, 1.2, Z0 + 0.015), blanco, bisel=0.006)
    caja("Remate_izq", 0.03, 0.03, Z1 - Z0, (X0 + 0.015, 1.2, (Z0 + Z1) / 2), blanco, bisel=0.006)
    # Bañera con ducha, pegada a la pared de fondo y a la izquierda. Sin nada encima del borde: una toalla
    # amarilla que había ahí se leía como una tabla de madera.
    tina("Banera", 0.72, 0.55, 1.6, 0.06, (-1.06, 0.275, -0.94), blanco)
    metal = mat_color("Metal", "#c9ced3", 0.18, 1.0)
    cilindro("Grifo_tina", 0.012, 0.012, 0.16, (-1.06, 0.66, -1.66), metal, rot=(math.pi / 2, 0, 0), dinamico=True)
    # Ducha: tubo que sube por la pared de fondo, brazo y regadera.
    cilindro("Ducha_tubo", 0.011, 0.011, 1.15, (-1.06, 1.375, -1.735), metal, dinamico=True)
    cilindro("Ducha_brazo", 0.011, 0.011, 0.26, (-1.06, 1.95, -1.61), metal, rot=(math.pi / 2, 0, 0), dinamico=True)
    cilindro("Ducha_regadera", 0.075, 0.03, 0.045, (-1.06, 1.925, -1.48), metal, dinamico=True)
    # Inodoro (House Interior). La lavadora que había a su derecha se quitó a pedido de la persona a cargo.
    mueble("Toilet", (0.95, 0, -1.38), math.pi / 2, ("alto", 0.78))
    # Rollo de papel de baño en el piso, entre el gabinete y el inodoro, y un destapador a la derecha del inodoro
    # (los aportó la persona a cargo). El rollo viene de 14 cm; se baja a 11 cm.
    objeto_glb("toilet_paper_roll_mp_1", (0.58, 0.0, -1.55), rot=(0, 0.3, 0), escala=0.76)
    objeto_glb("toilet_plunger_mp_1", (1.29, 0.0, -1.62), rot=(0, 0.6, 0))
    # Gabinete con lavamanos
    gab = mat_color("Gabinete", "#6f8796", 0.55)
    caja("Gabinete", 0.7, 0.8, 0.45, (0.05, 0.4, -1.52), gab, bisel=0.01)
    for x in (-0.12, 0.22):
        caja(f"Puerta_{x}", 0.3, 0.66, 0.012, (x, 0.42, -1.292), mat_color("Puerta", "#7d94a3", 0.5), bisel=0.004)
    caja("Tope", 0.74, 0.04, 0.49, (0.05, 0.82, -1.5), blanco, bisel=0.01)
    cilindro("Grifo", 0.012, 0.012, 0.14, (0.05, 0.9, -1.66), metal, dinamico=True)
    mueble("SoapDispenser", (0.3, 0.84, -1.6), 0.4, ("alto", 0.17), max_tris=1500)
    # Espejo sobre el lavamanos: empieza a 1.32 m del piso (por encima del remate del enchape, que está a 1.2 m)
    # y su centro queda a 1.72 m, a la altura de la cara de una persona de pie.
    caja("Espejo", 0.62, 0.8, 0.02, (0.05, 1.72, -1.735), mat_color("Espejo", "#d9e2e6", 0.04, 1.0), bisel=0.0, dinamico=True)
    caja("Marco", 0.66, 0.84, 0.015, (0.05, 1.72, -1.742), mat_color("Marco", "#8a6a4a", 0.6), bisel=0.004)
    caja("Alfombra_bano", 0.55, 0.012, 0.8, (-0.48, 0.006, -0.55), mat_alfombra("Alfombra_bano", ["#2f6f7f", "#3f8796", "#e9eef0", "#3f8796"], 8), bisel=0.004)
    # "Cerca hay una jeringuilla y un papelito doblado" (content.js): en el piso, junto a la mano derecha.
    objeto_glb("syringe_mp_1", (0.58, 0.0, 0.18), rot=(0, 0.7, 0))
    papelito((0.66, 0.0, -0.06), 0.4)


def pastillas():
    cuarto(mat_madera("Piso_madera", "#9a6a41", "#86593a"), mat_repello("Pared", "#efe6d6"), mat_color("Zocalo", "#f4efe6", 0.5))
    # Sofá y lámpara de pie de House Interior.
    mueble("Sofa", (-0.1, 0, -1.43), math.pi / 2, ("largo", 2.1), max_tris=16000)
    mueble("CornerLight", (-1.2, 0, -0.85), 0.0, ("alto", 1.6))
    caja("Alfombra", 1.7, 0.012, 1.2, (0.85, 0.006, -0.2), mat_alfombra("Alfombra", ["#7a3b2e", "#c9683f", "#efe0c4", "#2f6f7f", "#efe0c4"], 3), bisel=0.004)
    mesa = mat_madera("Mesa", "#5e4130", "#6b4a35")
    caja("Mesa_tope", 0.9, 0.04, 0.5, (0.95, 0.4, -0.2), mesa, bisel=0.008)
    for x, z in ((0.55, -0.4), (1.35, -0.4), (0.55, 0), (1.35, 0)):
        cilindro(f"Pata_{x}_{z}", 0.02, 0.02, 0.38, (x, 0.19, z), mat_color("Pata", "#3e2b1e", 0.6))
    cilindro("Vaso_rojo", 0.035, 0.028, 0.1, (0.8, 0.47, -0.25), mat_color("Vaso_rojo", "#d7392f", 0.35))
    cilindro("Vaso_azul", 0.035, 0.028, 0.1, (1.05, 0.47, -0.1), mat_color("Vaso_azul", "#2f6fd7", 0.35))
    cilindro("Plato", 0.08, 0.05, 0.05, (1.2, 0.445, -0.3), mat_color("Plato", "#efe9df", 0.3))
    # "Una pastilla que le vendieron como Percocet" (content.js): pastillas sueltas en la mesa, y unos cigarrillos.
    objeto_glb("pills_3", (0.68, 0.42, -0.06), rot=(0, 0.5, 0))
    objeto_glb("cigs_packet_1", (1.2, 0.42, -0.06), rot=(0, -0.35, 0), escala=0.55)
    # Un cubo de Rubik en la mesa: es la fiesta de una adolescente. Viene de 10 cm; el real mide 5.7 cm.
    objeto_glb("rubiks_cube_mx_1", (0.6, 0.42, -0.36), rot=(0, 0.35, 0), escala=0.57, nitido=True)
    caja("Bocina", 0.28, 0.6, 0.28, (1.3, 0.3, -0.95), mat_color("Bocina", "#1c1e22", 0.5), bisel=0.01)
    # Objetos que aportó la persona a cargo (Poly Haven, preparados con preparar_objetos.py). Reemplazan la planta de
    # esferas que había en la esquina. El sofá se quedó: los dos que se aportaron son de estilo antiguo y este es el
    # de una casa donde vive una adolescente.
    pieza("planta_suculenta", (1.3, 0.6, -0.95), rot_y=0.4)               # sobre la bocina
    pieza("sillon", (2.15, 0, -1.12), rot_y=-0.6)                         # de frente a la mesa
    pieza("canasta_mimbre", (-1.15, 0, -0.3), rot_y=0.3, escala=1.8)      # junto a la lámpara (viene de 21 cm)
    pieza("marco_clasico", (-0.1, 1.42, Z0 + 0.002))                     # sobre el sofá
    pieza("marco_dorado", (2.15, 1.5, Z0 + 0.002))                        # sobre el sillón
    for i in range(18):
        x, y = -1.3 + i * 0.16, 2.15 - math.sin(i / 17 * math.pi) * 0.18
        c = ["#ffd36b", "#ff9a6b", "#9fd8ff", "#ffe9a8"][i % 4]
        esfera(f"Bombilla_{i}", 0.022, (x, y, -1.7), mat_emision(f"Bombilla_{i}", c, 6), dinamico=True)
    luz = bpy.data.lights.new("Calida", 'POINT'); luz.energy = 60; luz.color = (1.0, 0.8, 0.55); luz.shadow_soft_size = 0.4
    lo = bpy.data.objects.new("Calida", luz); COL.objects.link(lo); lo.location = P(0, 2.0, -1.4)


def xilazina():
    cuarto(mat_concreto("Piso_concreto"), mat_ladrillo("Pared_ladrillo"))
    verde = mat_color("Contenedor", "#2f5a44", 0.55, 0.3)
    caja("Contenedor", 1.4, 0.85, 0.75, (0.75, 0.5, -1.3), verde, rot=(0, -0.08, 0), bisel=0.02)
    caja("Contenedor_tapa", 1.44, 0.05, 0.8, (0.75, 0.96, -1.28), mat_color("Tapa", "#244636", 0.6, 0.3), rot=(0.12, -0.08, 0), bisel=0.01)
    for x in (0.15, 1.35):
        for z in (-1.58, -1.02):
            cilindro(f"Rueda_{x}_{z}", 0.05, 0.05, 0.04, (x, 0.05, z), mat_color("Rueda", "#1a1a1a", 0.7), rot=(0, 0, math.pi / 2))
    # Sin enseres en el callejón: la persona a cargo pidió quitar la secadora que había junto al contenedor.
    carton = mat_color("Carton", "#a58b62", 0.95)
    caja("Caja_1", 0.45, 0.35, 0.4, (-1.1, 0.175, -1.35), carton, rot=(0, 0.3, 0), bisel=0.01)
    caja("Caja_2", 0.35, 0.28, 0.32, (-1.12, 0.49, -1.36), mat_color("Carton2", "#9a7f57", 0.95), rot=(0, -0.2, 0), bisel=0.01)
    caja("Carton_piso", 0.55, 0.012, 0.42, (-0.9, 0.006, 0.9), carton, rot=(0, 0.3, 0), bisel=0.003)
    # Bolsa de basura y zafacón de metal (Poly Haven, preparados con preparar_objetos.py); la bolsa reemplaza la
    # esfera negra que había entre el tubo y el contenedor.
    pieza("bolsa_basura", (-0.2, 0, -1.42), rot_y=0.4)
    pieza("zafacon", (2.05, 0, -1.4), rot_y=0.3)
    cilindro("Tubo", 0.035, 0.035, ALTO, (-0.55, ALTO / 2, -1.7), mat_color("Tubo", "#7d858c", 0.4, 0.7))
    charco("Charco", 0.32, (0.7, 0, 0.9), mat_color("Agua", "#30363a", 0.04))
    # Basura del callejón, junto al contenedor y lejos de la persona: botella de cristal acostada.
    objeto_glb("glass_bottle_1", (1.2, 0.052, -0.68), rot=(0, 0.5, math.pi / 2))


def tardio():
    cuarto(mat_madera("Piso_madera", "#8a5d3b", "#9b6a45"), mat_repello("Pared", "#e3e7ef"), mat_color("Zocalo", "#f2f4f7", 0.5))
    madera = mat_madera("Mueble", "#5a3d2a", "#664632")
    # Cama con cabecera y gavetero de House Interior; cafetera de Appliances encima del gavetero.
    mueble("SingleBed", (-0.85, 0, -0.78), math.pi / 2, ("largo", 1.95), max_tris=20000)
    mueble("Dresser", (1.35, 0, -1.51), math.pi / 2, ("largo", 1.0))
    mueble("KA_CoffeeMaker_V1", (1.6, ALTO_GAVETERO, -1.55), ROT_ALSTRA, ("alto", 0.3))
    # Mesa de noche junto a la cama, con el frasco de pastillas, unas pastillas regadas y la lámpara.
    mx = 0.05
    caja("Mesa_noche", 0.42, 0.5, 0.4, (mx, 0.25, -1.5), madera, bisel=0.01)
    objeto_glb("pills_bottle_2", (mx - 0.13, 0.5, -1.41), escala=0.8)
    objeto_glb("pills_2_1", (mx + 0.11, 0.5, -1.37), rot=(0, 0.8, 0))
    cilindro("Lampara_base", 0.05, 0.07, 0.04, (mx, 0.52, -1.55), mat_color("Lampara", "#3a3d44", 0.4))
    cilindro("Lampara_tubo", 0.012, 0.012, 0.22, (mx, 0.65, -1.55), mat_color("Lampara", "#3a3d44", 0.4))
    cilindro("Pantalla", 0.08, 0.13, 0.16, (mx, 0.8, -1.55), mat_emision("Pantalla", "#f5e6c8", 3), tapas=False, dinamico=True)
    luz = bpy.data.lights.new("Lampara", 'POINT'); luz.energy = 25; luz.color = (1.0, 0.78, 0.5); luz.shadow_soft_size = 0.1
    lo = bpy.data.objects.new("Lampara_luz", luz); COL.objects.link(lo); lo.location = P(mx, 0.8, -1.55)
    caja("Alfombra", 1.5, 0.012, 1.0, (0.45, 0.006, 0.2), mat_alfombra("Alfombra", ["#5a4a6b", "#c9b38a", "#8a5a4a", "#e8dcc4"], 5), bisel=0.004)
    caja("Cuadro_marco", 0.7, 0.5, 0.02, (1.35, 1.55, -1.735), mat_color("Marco", "#6b5442", 0.6), bisel=0.004)
    caja("Cuadro", 0.62, 0.42, 0.004, (1.35, 1.55, -1.722), mat_color("Cuadro", "#8ab0c9", 0.9), bisel=0.0)
    # Objetos que aportó la persona a cargo (Poly Haven, preparados con preparar_objetos.py).
    pieza("reloj_pared", (mx, 1.8, Z0 + 0.002))                            # sobre la mesa de noche
    pieza("planta_suculenta", (1.08, ALTO_GAVETERO, -1.55), rot_y=-0.3)   # sobre el gavetero, junto a la cafetera
    pieza("gavetero_repisas", (X0 + 0.255, 0, 0.85), rot_y=math.pi / 2)   # contra la pared izquierda, al pie de la cama


# ---------- Luz y horneado ----------
# Objetos (por el comienzo de su nombre) que se hornean en su propio atlas (--tam-cerca) porque se ven de cerca.
CERCA = ("Alfombra",)
# Escenarios cuyo piso no tiene juntas ni tablas: en 3072 no se ve ninguna diferencia (el concreto del callejón
# pesaba 134 KB más), así que su piso se hornea con --tam.
PISO_SIN_JUNTAS = {"xilazina"}


def luces():
    # Sol en la dirección de la luz principal de scene.js: desde (1.6, 3.4, 1.4) hacia el origen.
    sol = bpy.data.lights.new("Sol", 'SUN'); sol.energy = 3.3; sol.color = (1.0, 0.95, 0.88); sol.angle = math.radians(6)
    so = bpy.data.objects.new("Sol", sol); COL.objects.link(so)
    d = -Vector(P(1.6, 3.4, 1.4)).normalized()
    so.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    w = bpy.data.worlds.new("Cielo")
    if hasattr(w, "use_nodes") and not w.use_nodes:
        w.use_nodes = True
    w.node_tree.nodes["Background"].inputs[0].default_value = (0.78, 0.84, 0.92, 1)
    w.node_tree.nodes["Background"].inputs[1].default_value = 0.55
    bpy.context.scene.world = w


def quitar_ocultas(o):
    """Borra las caras que nunca se ven (contra el piso o contra una pared) para no gastar textura en ellas."""
    if o.name.startswith(("Piso", "Pared", "Enchape")):
        return
    bm = bmesh.new(); bm.from_mesh(o.data)
    M = o.matrix_world; R = M.to_3x3().normalized()
    fondo, izq = -Z0, X0  # pared de fondo en y = 1.75 de Blender, izquierda en x = -1.45
    borrar = []
    for f in bm.faces:
        n = (R @ f.normal).normalized(); c = M @ f.calc_center_median()
        if (n.z < -0.95 and c.z < 0.03) or (n.y > 0.95 and c.y > fondo - 0.03) or (n.x < -0.95 and c.x < izq + 0.03):
            borrar.append(f)
    bmesh.ops.delete(bm, geom=borrar, context='FACES')
    bm.to_mesh(o.data); bm.free()


def preparar_uv(grupo):
    for o in grupo:
        bpy.context.view_layer.objects.active = o
        for md in list(o.modifiers):
            o.select_set(True)
            bpy.ops.object.modifier_apply(modifier=md.name)
        o.select_set(False)
        quitar_ocultas(o)
        if o.get("con_textura") and o.data.uv_layers:
            # La textura de color sigue leyendo "textura"; la luz se hornea en una UV nueva, que queda activa.
            h = o.data.uv_layers.new(name="horno")
            o.data.uv_layers.active = h
            o.data.uv_layers["textura"].active_render = True
    bpy.ops.object.select_all(action='DESELECT')
    for o in grupo:
        o.select_set(True)
    bpy.context.view_layer.objects.active = grupo[0]
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.002, scale_to_bounds=False)
    bpy.ops.uv.pack_islands(rotate=True, margin=0.003)
    bpy.ops.object.mode_set(mode='OBJECT')


def hornear(grupo, nombre, tam, muestras):
    preparar_uv(grupo)
    luz = bpy.data.images.new(f"luz_{nombre}", tam, tam, float_buffer=True)
    col = bpy.data.images.new(f"color_{nombre}", tam, tam, float_buffer=True)
    mats = {m for o in grupo for m in o.data.materials}
    nodos = {}
    for m in mats:
        n = m.node_tree.nodes.new("ShaderNodeTexImage"); nodos[m] = n
        m.node_tree.nodes.active = n
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'
    sc.render.bake.margin = 12
    bpy.ops.object.select_all(action='DESELECT')
    for o in grupo:
        o.select_set(True)
    bpy.context.view_layer.objects.active = grupo[0]
    for img, filtro, s in ((luz, {'DIRECT', 'INDIRECT'}, muestras), (col, {'COLOR'}, 4)):
        for n in nodos.values():
            n.image = img
        sc.cycles.samples = s
        bpy.ops.object.bake(type='DIFFUSE', pass_filter=filtro, margin=12, use_clear=True)
    # Luz suavizada (quita el ruido de Cycles) × color nítido, a sRGB de 8 bits.
    L = np.empty(tam * tam * 4, dtype=np.float32); luz.pixels.foreach_get(L); L = L.reshape(tam, tam, 4)[..., :3]
    C = np.empty(tam * tam * 4, dtype=np.float32); col.pixels.foreach_get(C); C = C.reshape(tam, tam, 4)[..., :3]
    # Suavizado que ignora los texeles sin luz (fondo vacío del atlas y caras ocultas), para que no oscurezcan
    # los bordes de las islas visibles: blur(L·m) / blur(m).
    def caja_blur(A, r):
        for ax in (0, 1):
            pad = [(r + 1, r) if a == ax else (0, 0) for a in range(2)] + [(0, 0)] * (A.ndim - 2)
            cs = np.cumsum(np.pad(A, pad, mode='edge'), axis=ax)
            A = (np.take(cs, range(2 * r + 1, cs.shape[ax]), axis=ax) - np.take(cs, range(0, cs.shape[ax] - 2 * r - 1), axis=ax)) / (2 * r + 1)
        return A
    m = (L.sum(axis=2, keepdims=True) > 0.004).astype(np.float32)
    r = max(2, tam // 700)
    num, den = L * m, m
    for _ in range(3):
        num, den = caja_blur(num, r), caja_blur(den, r)
    L = np.where(m > 0, num / np.maximum(den, 1e-4), L)
    lin = np.clip(C * L, 0, 1)
    s = np.where(lin <= 0.0031308, lin * 12.92, 1.055 * np.power(lin, 1 / 2.4) - 0.055)
    out = bpy.data.images.new(f"horno_{nombre}", tam, tam, alpha=False)
    out.pixels.foreach_set(np.dstack([s, np.ones((tam, tam, 1), np.float32)]).astype(np.float32).ravel())
    if args.texturas:
        out.filepath_raw = os.path.join(args.texturas, f"horno_{nombre}.png"); out.file_format = 'PNG'; out.save()
    out.pack()
    # Materiales finales: negro con la luz horneada como emisión; se conserva la rugosidad.
    for o in grupo:
        for i, m in enumerate(o.data.materials):
            fm, nt, b = nuevo_mat(m.name + "_h", m.get("rugosidad", 0.8))
            b.inputs["Base Color"].default_value = (0, 0, 0, 1)
            t = nt.nodes.new("ShaderNodeTexImage"); t.image = out
            nt.links.new(t.outputs["Color"], b.inputs["Emission Color"])
            b.inputs["Emission Strength"].default_value = 1.0
            fm["horneado"] = True
            o.data.materials[i] = fm
        if o.get("con_textura"):
            # Ya horneado, solo queda la UV de la luz.
            for capa in [c for c in o.data.uv_layers if c.name != "horno"]:
                o.data.uv_layers.remove(capa)
    for img in (luz, col):
        bpy.data.images.remove(img)


def construir(nombre):
    global COL
    bpy.ops.wm.read_homefile(use_empty=True)
    _UNITY.pop("hechos", None)  # los materiales de Unity se borraron con la escena anterior
    COL = bpy.context.scene.collection
    luces()
    globals()[nombre]()
    estaticos = [o for o in COL.objects if o.type == 'MESH' and not o.get("dinamico")]
    piso = [o for o in estaticos if o.name == "Piso"]
    # Las alfombras quedan junto a la cabeza o debajo de la persona: en la vista de la cara se ven de muy cerca.
    # En el atlas de paredes y muebles les tocaban unos 270 texeles por metro y sus franjas se veían en bloques;
    # en un atlas propio de 1024 px tienen de 700 a 1400 texeles por metro por poco peso.
    cerca = [o for o in estaticos if o.name.startswith(CERCA)] if args.tam_cerca else []
    resto = [o for o in estaticos if o.name != "Piso" and o not in cerca]
    tam_piso = args.tam if nombre in PISO_SIN_JUNTAS else (args.tam_piso or args.tam)
    hornear(piso, nombre + "_piso", tam_piso, args.muestras)
    if cerca:
        hornear(cerca, nombre + "_cerca", args.tam_cerca, args.muestras)
    hornear(resto, nombre + "_resto", args.tam, args.muestras)
    # Biseles de los dinámicos aplicados también
    for o in COL.objects:
        if o.type == 'MESH':
            o.select_set(True)
    calidades = [int(c) for c in args.calidad.split(",")]
    for cal in calidades:
        sufijo = f"_q{cal}" if len(calidades) > 1 else ""
        ruta = os.path.abspath(os.path.join(args.out, f"escenario_{nombre}{sufijo}.glb"))
        bpy.ops.export_scene.gltf(filepath=ruta, export_format='GLB', use_selection=False, export_apply=True,
                                  export_lights=False, export_cameras=False, export_animations=False,
                                  export_image_format='WEBP', export_image_quality=cal)
        print("GLB exportado:", ruta, round(os.path.getsize(ruta) / 1024), "KB")


os.makedirs(args.out, exist_ok=True)
for n in ESCENAS:
    if args.solo and n != args.solo:
        continue
    construir(n)
