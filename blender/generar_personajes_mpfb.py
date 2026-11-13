"""
Genera los personajes realistas del simulador con MPFB (MakeHuman para Blender) y los exporta a GLB.

Requisitos (una sola vez):
  - Extensión MPFB 2 instalada en Blender (extensions.blender.org/add-ons/mpfb).
  - Paquetes CC0 "MakeHuman system assets" y "Faceunits 01" cargados en MPFB
    (Ajustes de MPFB > Asset packs > Load pack from zip, o el operador mpfb.load_pack).

Uso (desde la carpeta del proyecto):
    blender --background --python blender/generar_personajes_mpfb.py -- --out modelos
    blender --background --python blender/generar_personajes_mpfb.py -- --out modelos --solo h1

Qué hace con cada variante de VARIANTES:
  1. Crea el humano (género, edad, mezcla de ancestría, peso) con piel, ojos, cejas, pestañas, pelo y ropa.
  2. Agrega el rig "Game engine" y cambia el nombre de los huesos a los del simulador (scene.js).
  3. Carga las unidades faciales eyeBlinkLeft/eyeBlinkRight y las pasa a pestañas y cejas: así se cierran los ojos.
  4. Fija las formas del cuerpo, aplica las máscaras de la ropa y borra la geometría auxiliar.
  5. Mezcla dos pieles de MakeHuman (mismo mapa UV) para lograr tonos intermedios de piel.
  6. Guarda en el color de vértice las zonas de cianosis (labios, uñas y dedos) para el shader de scene.js.
  7. Reduce las texturas, quita los mapas normales y de oclusión, y exporta GLB con texturas WebP.

Todo lo que usa (MPFB, pieles, ropa, pelo) produce personajes CC0.
"""
import bpy, sys, os, argparse, re
import numpy as np
from bl_ext.user_default.mpfb.services.humanservice import HumanService
from bl_ext.user_default.mpfb.services.targetservice import TargetService
from bl_ext.user_default.mpfb.services.faceservice import FaceService
from bl_ext.user_default.mpfb.services.exportservice import ExportService
from bl_ext.user_default.mpfb.services.locationservice import LocationService

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--out", default="modelos")
ap.add_argument("--solo", default="", help="id de una sola variante")
args = ap.parse_args(argv)

# Diversidad de Puerto Rico: mezclas de ancestría africana, europea y taína/asiática y tonos de piel de claro a oscuro.
# "piel" mezcla dos texturas de MakeHuman: t = 0 es la piel clara, t = 1 la oscura. La luz de la escena aclara
# bastante las caras, así que los tonos medios van por encima de 0.5.
# El simulador escoge al azar entre las variantes del género que pide cada caso; ningún caso queda atado a un tono de piel.
VARIANTES = [
    {"id": "h1", "genero": 1.0, "edad": 0.5, "peso": 0.5, "musculo": 0.5,
     "raza": {"african": 0.30, "caucasian": 0.60, "asian": 0.10},
     "piel": ("young_caucasian_male", "young_african_male", 0.5),     "cejas": "eyebrow001", "pestanas": "eyelashes01", "pelo": "short02", "ropa": ["male_casualsuit03", "shoes01"]},
    {"id": "h2", "genero": 1.0, "edad": 0.68, "peso": 0.62, "musculo": 0.45,
     "raza": {"african": 0.60, "caucasian": 0.40, "asian": 0.0},
     "piel": ("middleage_caucasian_male", "middleage_african_male", 0.8),     "cejas": "eyebrow002", "pestanas": "eyelashes01", "pelo": "short04", "ropa": ["male_casualsuit01", "shoes02"]},
    {"id": "h3", "genero": 1.0, "edad": 0.45, "peso": 0.45, "musculo": 0.55,
     "raza": {"african": 0.15, "caucasian": 0.75, "asian": 0.10},
     "piel": ("young_caucasian_male", "young_african_male", 0.2),     "cejas": "eyebrow003", "pestanas": "eyelashes02", "pelo": "short01", "ropa": ["male_casualsuit05", "shoes01"]},
    {"id": "m1", "genero": 0.0, "edad": 0.45, "peso": 0.5, "musculo": 0.45,
     "raza": {"african": 0.40, "caucasian": 0.50, "asian": 0.10},
     "piel": ("young_caucasian_female", "young_african_female", 0.55),     "cejas": "eyebrow010", "pestanas": "eyelashes03", "pelo": "ponytail01", "ropa": ["female_casualsuit01", "shoes03"]},
    {"id": "m2", "genero": 0.0, "edad": 0.5, "peso": 0.55, "musculo": 0.45,
     "raza": {"african": 0.65, "caucasian": 0.35, "asian": 0.0},
     "piel": ("young_caucasian_female", "young_african_female", 0.85),     "cejas": "eyebrow011", "pestanas": "eyelashes03", "pelo": "afro01", "ropa": ["female_casualsuit01", "shoes03"]},
    # Adolescentes (caso 2). En MPFB, edad 0.1875 = 11 años y 0.5 = 25 años: 0.30 ≈ 16 años.
    # Pelo sin flequillo sobre los ojos (bob01/bob02 los tapan y no se verían las pupilas; bob02 además es rubio platino).
    {"id": "a1", "genero": 0.0, "edad": 0.30, "peso": 0.42, "musculo": 0.4,
     "raza": {"african": 0.35, "caucasian": 0.55, "asian": 0.10},
     "piel": ("young_caucasian_female", "young_african_female", 0.45),     "cejas": "eyebrow010", "pestanas": "eyelashes03", "pelo": "long01", "ropa": ["female_casualsuit01", "shoes03"]},
    {"id": "a2", "genero": 0.0, "edad": 0.30, "peso": 0.48, "musculo": 0.4,
     "raza": {"african": 0.70, "caucasian": 0.30, "asian": 0.0},
     "piel": ("young_caucasian_female", "young_african_female", 0.9),     "cejas": "eyebrow011", "pestanas": "eyelashes03", "pelo": "afro01", "ropa": ["female_casualsuit01", "shoes03"]},
    # Adultos mayores (caso 4). 0.5 = 25 años y 1.0 = 90 años: 0.86 ≈ 72 años. "canas" aclara pelo y cejas hacia gris.
    {"id": "v1", "genero": 1.0, "edad": 0.86, "peso": 0.55, "musculo": 0.35,
     "raza": {"african": 0.25, "caucasian": 0.65, "asian": 0.10},
     "piel": ("old_caucasian_male", "old_african_male", 0.4),     "cejas": "eyebrow002", "pestanas": "eyelashes01", "pelo": "short02", "canas": 0.85, "ropa": ["male_casualsuit01", "shoes02"]},
    {"id": "v2", "genero": 1.0, "edad": 0.86, "peso": 0.6, "musculo": 0.35,
     "raza": {"african": 0.65, "caucasian": 0.35, "asian": 0.0},
     "piel": ("old_caucasian_male", "old_african_male", 0.85),     "cejas": "eyebrow001", "pestanas": "eyelashes01", "pelo": "short04", "canas": 0.75, "ropa": ["male_casualsuit05", "shoes01"]},
]
# Ropa: male_casualsuit02/04/06 y female_casualsuit01/02 traen el logo de MakeHuman en la camisa, y en el simulador
# del DSPR no debe aparecer la marca de otra organización. Los hombres usan prendas sin logo; a las camisetas de
# mujer se les borra el logo en la textura (LOGOS: centro u, v desde arriba y radio, en fracción de la textura).
# female_casualsuit02 trae pantalón muy corto y female_sportsuit01 un top corto; se usan mahones y camiseta.
LOGOS = {"female_casualsuit01": (0.8125, 0.225, 0.10), "female_casualsuit02": (0.80, 0.225, 0.10)}

# Huesos del rig "Game engine" que usa POSES de scene.js. Los demás (dedos, clavículas, spine_01/02) conservan su nombre.
HUESOS = {"pelvis": "spine", "spine_03": "chest", "neck_01": "neck", "head": "head"}
for lado, s in (("l", "L"), ("r", "R")):
    HUESOS.update({f"upperarm_{lado}": "sh" + s, f"lowerarm_{lado}": "el" + s, f"thigh_{lado}": "hip" + s,
                   f"calf_{lado}": "knee" + s, f"foot_{lado}": "ankle" + s})

# Tamaño máximo de textura por tipo de malla (px). La piel lleva más detalle porque la cámara de cara se acerca.
# Los ojos usan la textura café por defecto de MPFB (brown_eye.png): scene.js agranda o achica su pupila con un
# shader que depende de la posición de los ojos en esa textura, así que no se cambia por otra.
TEX = {"Piel": 1024, "Ropa": 1024, "Pelo": 512, "Zapatos": 512, "Ojos": 512, "Cejas": 256, "Pestanas": 256}
DATA = LocationService.get_user_data()


def textura_de_piel(nombre):
    mhmat = os.path.join(DATA, "skins", nombre, nombre + ".mhmat")
    with open(mhmat, encoding="utf-8") as f:
        m = re.search(r"^diffuseTexture\s+(\S+)", f.read(), re.M)
    return os.path.join(os.path.dirname(mhmat), os.path.basename(m.group(1)))


def pixeles(img):
    a = np.empty(img.size[0] * img.size[1] * 4, dtype=np.float32)
    img.pixels.foreach_get(a)
    return a


def mezclar_piel(clara, oscura, t, lado):
    a = bpy.data.images.load(textura_de_piel(clara)); a.scale(lado, lado)
    b = bpy.data.images.load(textura_de_piel(oscura)); b.scale(lado, lado)
    out = bpy.data.images.new("piel", lado, lado, alpha=True)
    out.pixels.foreach_set((1 - t) * pixeles(a) + t * pixeles(b))
    out.pack()
    return out


def quitar_logo(img, u, v_arriba, r):
    """Pinta encima del logo con el color de la tela que lo rodea.

    En un cuadro alrededor del logo, los píxeles que se alejan del color mediano de la tela (el naranja y el gris
    del logo) se reemplazan por el promedio de los demás."""
    w, h = img.size
    a = pixeles(img).reshape(h, w, 4)
    cx, cy, rr = int(u * w), int((1 - v_arriba) * h), int(r * 1.3 * w)
    box = a[cy - rr:cy + rr, cx - rr:cx + rr, :3]
    tela = np.median(box.reshape(-1, 3), axis=0)
    logo = np.linalg.norm(box - tela, axis=2) > 0.12
    # Se agranda la máscara dos píxeles para no dejar bordes del logo.
    for _ in range(2):
        logo = logo | np.roll(logo, 1, 0) | np.roll(logo, -1, 0) | np.roll(logo, 1, 1) | np.roll(logo, -1, 1)
    box[logo] = box[~logo].mean(axis=0)
    a[cy - rr:cy + rr, cx - rr:cx + rr, :3] = box
    img.pixels.foreach_set(a.ravel())
    img.pack()


def canas(img, c):
    """Lleva el color del pelo hacia un gris claro (c = 0 sin canas, 1 todo gris). Conserva la transparencia."""
    a = pixeles(img).reshape(-1, 4)
    lum = a[:, :3] @ np.array([0.299, 0.587, 0.114], dtype=np.float32)
    gris = (0.5 + 0.45 * lum)[:, None]
    a[:, :3] = a[:, :3] * (1 - c) + gris * c
    img.pixels.foreach_set(a.ravel())
    img.pack()


def crear(v):
    info = HumanService._create_default_human_info_dict()
    info["name"] = "persona_" + v["id"]
    info["phenotype"].update({"gender": v["genero"], "age": v["edad"], "weight": v["peso"], "muscle": v["musculo"], "race": v["raza"]})
    info["rig"] = "game_engine"
    info["eyes"] = "low-poly/low-poly.mhclo"
    info["eyebrows"] = f"{v['cejas']}/{v['cejas']}.mhclo"
    info["eyelashes"] = f"{v['pestanas']}/{v['pestanas']}.mhclo"
    info["hair"] = f"{v['pelo']}/{v['pelo']}.mhclo"
    info["clothes"] = [f"{c}/{c}.mhclo" for c in v["ropa"]]
    info["skin_mhmat"] = f"skins/{v['piel'][0]}/{v['piel'][0]}.mhmat"
    info["skin_material_type"] = "MAKESKIN"
    info["eyes_material_type"] = "MAKESKIN"
    settings = HumanService.get_default_deserialization_settings()
    settings["subdiv_levels"] = 0
    body = HumanService.deserialize_from_dict(info, settings)
    rig = body.parent

    # Formas del cuerpo fijas; solo quedan los párpados como claves de forma.
    TargetService.bake_targets(body)
    FaceService.load_targets(body, load_microsoft_visemes=False, load_meta_visemes=False, load_arkit_faceunits=True)
    for kb in list(body.data.shape_keys.key_blocks):
        if kb.name not in ("Basis", "eyeBlinkLeft", "eyeBlinkRight"):
            body.shape_key_remove(kb)
    FaceService.interpolate_targets(body)
    ExportService.bake_modifiers_remove_helpers(body, bake_masks=True, bake_subdiv=False, remove_helpers=True, also_proxy=True)
    for m in list(body.modifiers):
        if m.type in ("MASK", "SUBSURF"):
            body.modifiers.remove(m)

    # Zonas de cianosis en el color de vértice: rojo = labios, verde = uñas, azul = dedos (falanges 2 y 3).
    # Labios y uñas llevan una orilla suave de dos anillos; los dedos usan el peso de sus huesos, que ya es gradual.
    n = len(body.data.vertices)
    ed = np.empty(len(body.data.edges) * 2, dtype=np.int32); body.data.edges.foreach_get("vertices", ed); ed = ed.reshape(-1, 2)

    def pesos(nombres):
        idx = {body.vertex_groups[g].index for g in nombres if g in body.vertex_groups}
        w = np.zeros(n, dtype=np.float32)
        for vert in body.data.vertices:
            for ge in vert.groups:
                if ge.group in idx:
                    w[vert.index] = max(w[vert.index], ge.weight)
        return w

    def orilla(w, anillos=2):
        for _ in range(anillos):
            nb = np.zeros(n, dtype=np.float32)
            np.maximum.at(nb, ed[:, 0], w[ed[:, 1]]); np.maximum.at(nb, ed[:, 1], w[ed[:, 0]])
            w = np.maximum(w, nb * 0.5)
        return w

    dedos = [g.name for g in body.vertex_groups if re.fullmatch(r"(index|middle|ring|pinky|thumb)_0[23]_[lr]", g.name)]
    attr = body.data.color_attributes.new("cianosis", 'FLOAT_COLOR', 'POINT')
    col = np.zeros((n, 4), dtype=np.float32)
    col[:, 0] = orilla(pesos(["lips"])); col[:, 1] = orilla(pesos(["fingernails", "toenails"])); col[:, 2] = pesos(dedos); col[:, 3] = 1
    attr.data.foreach_set("color", col.ravel())
    body.data.color_attributes.active_color = attr

    # Nombres de huesos del simulador (Blender cambia también los grupos de vértices).
    for viejo, nuevo in HUESOS.items():
        rig.data.bones[viejo].name = nuevo
    rig.name = "Esqueleto"

    # Materiales con nombres estables para scene.js y texturas más livianas.
    for o in rig.children:
        if o.type != 'MESH':
            continue
        nombre = o.name.split(".", 1)[-1]
        if o == body:
            tipo = "Piel"
        elif nombre in v["ropa"]:
            tipo = "Zapatos" if nombre.startswith("shoes") else "Ropa"
        elif nombre == v["pelo"]:
            tipo = "Pelo"
        elif nombre == v["cejas"]:
            tipo = "Cejas"
        elif nombre == v["pestanas"]:
            tipo = "Pestanas"
        else:
            tipo = "Ojos"
        o.name = tipo if tipo != "Ropa" else "Ropa_" + nombre
        for mat in o.data.materials:
            mat.name = o.name
            nodes = mat.node_tree.nodes
            for nd in list(nodes):
                if nd.type == 'NORMAL_MAP' or (nd.type == 'TEX_IMAGE' and nd.image and re.search(r"normal|_ao", nd.image.name, re.I)):
                    nodes.remove(nd)
            for nd in nodes:
                if nd.type == 'TEX_IMAGE' and nd.image:
                    if tipo == "Piel":
                        nd.image = mezclar_piel(*v["piel"], TEX["Piel"])
                    else:
                        if max(nd.image.size) > TEX[tipo]:
                            nd.image.scale(TEX[tipo], TEX[tipo])
                            nd.image.pack()
                        if nombre in LOGOS and "diffuse" in nd.image.name:
                            quitar_logo(nd.image, *LOGOS[nombre])
                        if v.get("canas") and tipo in ("Pelo", "Cejas") and not re.search(r"normal|_ao|bump", nd.image.name, re.I):
                            canas(nd.image, v["canas"])
    return rig


def exportar(rig, ruta):
    bpy.ops.object.select_all(action='DESELECT')
    rig.select_set(True)
    for o in rig.children:
        o.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=ruta, export_format='GLB', use_selection=True, export_apply=False,
        export_skins=True, export_morph=True, export_morph_normal=False, export_try_sparse_sk=True,
        export_animations=False, export_yup=True, export_tangents=False,
        export_vertex_color='ACTIVE', export_image_format='WEBP', export_image_quality=80)


os.makedirs(args.out, exist_ok=True)
for v in VARIANTES:
    if args.solo and v["id"] not in args.solo.split(","):
        continue
    bpy.ops.wm.read_homefile(use_empty=True)
    rig = crear(v)
    ruta = os.path.abspath(os.path.join(args.out, f"persona_{v['id']}.glb"))
    exportar(rig, ruta)
    print("GLB exportado:", ruta, round(os.path.getsize(ruta) / 1024), "KB")
