"""
Prepara para el simulador los objetos 3D que aportó la persona a cargo (descargas de Poly Haven, CC0).

Uso (desde la carpeta del proyecto):
    npm run objetos                                  # lee los .zip de la carpeta Descargas
    npm run objetos -- --fuente C:/ruta/a/los/zip --solo reloj_pared

Qué hace con cada objeto (tabla OBJETOS):
  1. Lee el .zip tal como se bajó (<asset>_4k.zip o <asset>_4k.blend.zip) y saca solo el .blend y la textura de color
     (y la de alfa del reloj) a una carpeta temporal. Las demás texturas de 4K (normal, rugosidad, metal) no se usan:
     los objetos de los escenarios se hornean y su relieve fino no se ve a la distancia de la cámara.
  2. Une las partes, quita las que no se usan (la variante oxidada del zafacón, el vidrio del reloj de pared, la
     tapa de la canasta), simplifica la malla hasta max_tris y achica la textura de color a `tex` px.
  3. Borra los logos de las texturas (como en generar_personajes_mpfb.py): marcas en la esfera del reloj de pared
     y en el bisel del reloj de pulsera.
  4. Si falta la textura de color, usa un color plano (`colores`); los cuadros llevan una pintura abstracta hecha
     aquí (`lienzo`), porque la imagen del lienzo no vino en la descarga.
  5. Exporta un GLB liviano a modelos/objetos/<nombre>.glb, con la base en el origen (o la espalda, si va en la
     pared) y el frente hacia la cámara (-Y de Blender, +z de scene.js).

generar_escenarios.py los coloca con pieza() y los hornea con el cuarto: la textura de color se lee de su UV y la
luz va al atlas del escenario, así que ninguna textura de 4K llega al navegador.

El reloj de pulsera es distinto: va en la muñeca de la persona y se mueve con ella, así que no se hornea. Se curva
en un aro alrededor del eje X (el antebrazo), con la esfera hacia +Z, y se exporta a modelos/reloj_pulsera.glb, que
scene.js ajusta a la muñeca de cada personaje.
"""
import bpy, bmesh, sys, os, math, argparse, zipfile, tempfile, shutil
import numpy as np
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--fuente", default=os.path.join(os.path.expanduser("~"), "Downloads"),
                help="carpeta con los .zip de Poly Haven tal como se bajaron")
ap.add_argument("--out", default="modelos/objetos", help="carpeta de salida de los objetos de los escenarios")
ap.add_argument("--reloj", default="modelos/reloj_pulsera.glb", help="salida del reloj de pulsera")
ap.add_argument("--solo", default="", help="nombres de salida separados por coma (p. ej. reloj_pared,sillon)")
ap.add_argument("--calidad", type=int, default=85, help="calidad WebP de las texturas")
args = ap.parse_args(argv)

# Rectángulos (x0, y0, x1, y1) en fracciones de la textura, con el origen abajo a la izquierda como en Blender.
LOGO_RELOJ_PARED = [(0.235, 0.348, 0.31, 0.405)]  # "URBAN quartz" en la esfera
LOGO_RELOJ_PULSERA = [(0.525, 0.365, 0.568, 0.578), (0.398, 0.365, 0.445, 0.578),  # textos del bisel: derecha e izquierda
                      (0.43, 0.54, 0.545, 0.575), (0.43, 0.365, 0.545, 0.4)]          # arriba y abajo

OBJETOS = {
    # Sala (caso 2) y cuarto (caso 4): la suculenta de mesa. Escala real (17 cm de alto).
    "planta_suculenta": dict(zip="potted_plant_04", max_tris=4000, tex=512, rugosidad=0.7),
    # Sala: canasta de mimbre sin la tapa (estaba recostada al lado).
    "canasta_mimbre": dict(zip="wicker_basket_02", quitar=("wicker_basket_02_lid",), max_tris=3000, tex=1024, rugosidad=0.85),
    # Sala: los dos cuadros, en la pared.
    "marco_dorado": dict(zip="fancy_picture_frame_02", max_tris=5000, tex=1024, rugosidad=0.45, pared=True,
                         lienzo=("fancy_picture_frame_02_canvas", "mar")),
    "marco_clasico": dict(zip="fancy_picture_frame_01", max_tris=1500, tex=1024, rugosidad=0.45, pared=True,
                          lienzo=("fancy_picture_frame_01_canvas", "campo")),
    # Sala: sillón. La descarga no trajo sus texturas: tela gris azulada y patas de madera.
    "sillon": dict(zip="modern_arm_chair_01", max_tris=6000, tex=512, rugosidad=0.9,
                   colores={"modern_arm_chair_01_pillow": "#7f8a95", "modern_arm_chair_01_legs": "#6e4a2f"}),
    # Cuarto (caso 4): gavetero con repisas y reloj de pared (sin el vidrio: horneado se vería opaco).
    "gavetero_repisas": dict(zip="drawer_cabinet", max_tris=8000, tex=1024, rugosidad=0.6),
    "reloj_pared": dict(zip="wall_clock", quitar_mat=("wall_clock_glass",), max_tris=3000, tex=1024, rugosidad=0.4,
                        pared=True, logos=LOGO_RELOJ_PARED),
    # Callejón (caso 3): bolsa de basura y zafacón (sin la variante oxidada, cuyas texturas no vinieron).
    "bolsa_basura": dict(zip="trashbag", max_tris=3000, tex=1024, rugosidad=0.3),
    "zafacon": dict(zip="metal_trash_can", quitar=("metal_trash_can_rust", "metal_trash_can_rust_lid",
                                                   "metal_trash_can_rust_handle_left", "metal_trash_can_rust_handle_right"),
                    max_tris=5000, tex=1024, rugosidad=0.55),
}
# No se usan (se explica en CLAUDE.md): potted_plant_02 (sus hojas necesitan la textura de alfa, que no vino),
# Sofa_01 y sofa_03 (el sofá de la sala se quedó como estaba).


def buscar_zip(nombre):
    for f in os.listdir(args.fuente):
        b = f.lower()
        if b in (f"{nombre}_4k.zip".lower(), f"{nombre}_4k.blend.zip".lower()):
            return os.path.join(args.fuente, f)
    return None


def extraer(ruta_zip):
    """Saca del .zip solo el .blend y las texturas de color y alfa, por su nombre (sin rutas del zip)."""
    tmp = tempfile.mkdtemp(prefix="dspr_obj_")
    with zipfile.ZipFile(ruta_zip) as z:
        for info in z.infolist():
            base = os.path.basename(info.filename)
            low = base.lower()
            if low.endswith(".blend"):
                dest = os.path.join(tmp, base)
            elif ("_diff_" in low or "_alpha_" in low) and low.endswith((".jpg", ".png")):
                dest = os.path.join(tmp, "textures", base)
            else:
                continue
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            with z.open(info) as src, open(dest, "wb") as out:
                shutil.copyfileobj(src, out)
    return tmp


def cargar_blend(tmp, quitar=()):
    blend = next(os.path.join(tmp, f) for f in os.listdir(tmp) if f.lower().endswith(".blend"))
    bpy.ops.wm.read_homefile(use_empty=True)
    with bpy.data.libraries.load(blend, link=False) as (src, dst):
        dst.objects = list(src.objects)
    objs = []
    for o in dst.objects:
        if not o:
            continue
        if o.type != 'MESH' or o.name in quitar:
            bpy.data.objects.remove(o)
            continue
        bpy.context.scene.collection.objects.link(o)
        objs.append(o)
    return objs


def unir(objs):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
    bpy.ops.object.convert(target='MESH')  # aplica sus modificadores (la suculenta trae subdivisión) antes de contar
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    if len(objs) > 1:
        bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active
    while len(o.data.uv_layers) > 1:
        o.data.uv_layers.remove(o.data.uv_layers[-1])
    if o.data.uv_layers:
        o.data.uv_layers[0].name = "textura"
    return o


def textura_de(mat, nucleo):
    """Ruta de la textura `nucleo` ('diff' o 'alpha') que usa el material original, si vino en la descarga."""
    if not (mat and mat.use_nodes):
        return None
    for nd in mat.node_tree.nodes:
        if nd.type == 'TEX_IMAGE' and nd.image and f"_{nucleo}_" in os.path.basename(nd.image.filepath).lower():
            return os.path.basename(nd.image.filepath)
    return None


def borrar_logos(im, rects):
    w, h = im.size
    px = np.empty(w * h * 4, dtype=np.float32); im.pixels.foreach_get(px); px = px.reshape(h, w, 4)
    for x0, y0, x1, y1 in rects:
        a, b, c, d = int(y0 * h), int(y1 * h), int(x0 * w), int(x1 * w)
        # Color del borde del rectángulo (la esfera o el bisel alrededor del texto), sin el texto.
        borde = np.concatenate([px[a - 2:a, c:d].reshape(-1, 4), px[b:b + 2, c:d].reshape(-1, 4),
                                px[a:b, c - 2:c].reshape(-1, 4), px[a:b, d:d + 2].reshape(-1, 4)])
        px[a:b, c:d] = np.median(borde, axis=0)
    im.pixels.foreach_set(px.ravel())


def pintura(tema, w=512, h=384):
    """Pintura abstracta para el lienzo de los cuadros (la imagen original no vino): degradados suaves."""
    y = np.linspace(1, 0, h)[:, None] * np.ones((1, w)); x = np.ones((h, 1)) * np.linspace(0, 1, w)[None, :]
    mezcla = lambda a, b, t: np.array(a)[None, None, :] * (1 - t[..., None]) + np.array(b)[None, None, :] * t[..., None]
    if tema == "mar":  # atardecer sobre el mar
        cielo = mezcla((0.98, 0.62, 0.35), (0.55, 0.7, 0.88), np.clip((y - 0.45) / 0.55, 0, 1))
        mar = mezcla((0.12, 0.33, 0.45), (0.3, 0.52, 0.6), np.clip(y / 0.45, 0, 1))
        img = np.where((y > 0.45)[..., None], cielo, mar)
        sol = np.exp(-(((x - 0.62) * 1.3) ** 2 + ((y - 0.55) * 1.7) ** 2) / 0.004)[..., None]
        img = img * (1 - sol) + np.array([1.0, 0.88, 0.6]) * sol
    else:  # campo verde con montes
        monte = 0.42 + 0.08 * np.sin(x * 7.0) + 0.05 * np.sin(x * 15.0 + 1.0)
        cielo = mezcla((0.95, 0.93, 0.82), (0.6, 0.76, 0.9), np.clip((y - 0.4) / 0.6, 0, 1))
        campo = mezcla((0.28, 0.45, 0.22), (0.5, 0.62, 0.3), np.clip(y / 0.5, 0, 1))
        img = np.where((y > monte)[..., None], cielo, campo)
    # Textura de pincel: un ruido leve para que no se vea como un degradado digital.
    rng = np.random.default_rng(7)
    img = np.clip(img * (1 + 0.04 * rng.standard_normal((h, w, 1))), 0, 1)
    im = bpy.data.images.new(f"lienzo_{tema}", w, h)
    im.pixels.foreach_set(np.dstack([img[::-1], np.ones((h, w, 1))]).astype(np.float32).ravel())
    im.pack()
    return im


def nuevo_material(nombre, imagen=None, color=None, rugosidad=0.7, metal=0.0):
    m = bpy.data.materials.new(nombre)
    if hasattr(m, "use_nodes") and not m.use_nodes:
        m.use_nodes = True
    b = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    b.inputs["Roughness"].default_value = rugosidad
    b.inputs["Metallic"].default_value = metal
    if imagen:
        t = m.node_tree.nodes.new("ShaderNodeTexImage"); t.image = imagen
        m.node_tree.links.new(t.outputs["Color"], b.inputs["Base Color"])
    elif color:
        h = color.lstrip("#"); c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
        b.inputs["Base Color"].default_value = (*[x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c], 1)
    return m


def cargar_textura(tmp, archivo, tam, logos=()):
    if not archivo or not os.path.exists(os.path.join(tmp, "textures", archivo)):
        return None
    ruta = os.path.join(tmp, "textures", archivo)
    im = bpy.data.images.load(ruta)
    im.scale(tam, tam)
    if logos:
        borrar_logos(im, logos)
    im.pack()
    return im


def materiales(o, tmp, nombre, cfg):
    hechos = {}
    for i, m in enumerate(o.data.materials):
        if m is None or m.name in hechos:
            if m:
                o.data.materials[i] = hechos[m.name]
            continue
        lienzo = cfg.get("lienzo")
        if m.name in cfg.get("quitar_mat", ()):  # sus caras ya se borraron
            hechos[m.name] = m
            continue
        if lienzo and m.name.startswith(lienzo[0]):
            nm = nuevo_material(f"{nombre}_lienzo", imagen=pintura(lienzo[1]), rugosidad=0.85)
        else:
            im = cargar_textura(tmp, textura_de(m, "diff"), cfg.get("tex", 1024), cfg.get("logos", ()))
            color = cfg.get("colores", {}).get(m.name)
            if im is None and color is None:
                raise SystemExit(f"{nombre}: falta la textura de color de {m.name} y no tiene color de reemplazo")
            nm = nuevo_material(f"{nombre}_{len(hechos)}", imagen=im, color=color, rugosidad=cfg.get("rugosidad", 0.7))
        hechos[m.name] = nm
        o.data.materials[i] = nm


def quitar_caras(o, mats):
    idx = {i for i, m in enumerate(o.data.materials) if m and m.name in mats}
    if not idx:
        return
    bm = bmesh.new(); bm.from_mesh(o.data)
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.material_index in idx], context='FACES')
    bm.to_mesh(o.data); bm.free()


def simplificar(o, max_tris):
    tris = sum(len(p.vertices) - 2 for p in o.data.polygons)
    if tris > max_tris:
        md = o.modifiers.new("Simplificar", 'DECIMATE'); md.ratio = max_tris / tris
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.modifier_apply(modifier=md.name)
    return tris, sum(len(p.vertices) - 2 for p in o.data.polygons)


def apoyar(o, pared):
    """Base en el origen (centrada en x/y) o, si va en la pared, la espalda (+Y) en el origen y centrada en x/z."""
    vs = [v.co for v in o.data.vertices]
    mn = Vector((min(v.x for v in vs), min(v.y for v in vs), min(v.z for v in vs)))
    mx = Vector((max(v.x for v in vs), max(v.y for v in vs), max(v.z for v in vs)))
    if pared:
        t = Vector(((mn.x + mx.x) / 2, mx.y, (mn.z + mx.z) / 2))
    else:
        t = Vector(((mn.x + mx.x) / 2, (mn.y + mx.y) / 2, mn.z))
    for v in o.data.vertices:
        v.co -= t
    return mx - mn


def exportar(o, ruta):
    bpy.ops.object.select_all(action='DESELECT')
    o.select_set(True); bpy.context.view_layer.objects.active = o
    bpy.ops.object.material_slot_remove_unused()  # el vidrio y otros materiales sin caras
    os.makedirs(os.path.dirname(os.path.abspath(ruta)), exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=os.path.abspath(ruta), export_format='GLB', use_selection=True, export_apply=True,
                              export_image_format='WEBP', export_image_quality=args.calidad, export_animations=False)
    return round(os.path.getsize(ruta) / 1024)


def preparar(nombre, cfg):
    ruta = buscar_zip(cfg["zip"])
    if not ruta:
        print(f"{nombre}: no se encontró {cfg['zip']}_4k.zip en {args.fuente}; se salta")
        return
    tmp = extraer(ruta)
    try:
        o = unir(cargar_blend(tmp, cfg.get("quitar", ())))
        quitar_caras(o, cfg.get("quitar_mat", ()))
        materiales(o, tmp, nombre, cfg)
        antes, despues = simplificar(o, cfg["max_tris"])
        d = apoyar(o, cfg.get("pared", False))
        o.name = o.data.name = nombre
        kb = exportar(o, os.path.join(args.out, nombre + ".glb"))
        print(f"{nombre}: {antes} -> {despues} triángulos, {d.x:.2f} x {d.y:.2f} x {d.z:.2f} m, {kb} KB")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


# ---------- Reloj de pulsera ----------
# Aro: la esfera queda plana arriba (a H del eje) y las correas siguen un círculo que pasa por los bordes de la
# esfera. La correa más larga (la del broche) pasa por fuera de la otra donde se enciman, abajo.
RELOJ_H = 0.024  # del eje del antebrazo a la parte de abajo de la esfera (m); scene.js lo ajusta a cada muñeca


def curvar_reloj(o, y0, h, z0, lado_largo):
    R = math.hypot(h, RELOJ_H); phi0 = math.atan2(h, RELOJ_H)
    for v in o.data.vertices:
        s = v.co.y - y0; zr = v.co.z - z0
        if abs(s) <= h:
            v.co.y, v.co.z = s, RELOJ_H + zr
            continue
        lado = 1 if s > 0 else -1
        th = phi0 + (abs(s) - h) / R
        r = R + zr
        if lado == lado_largo and th > math.pi - 0.35:
            r += 0.0045 * min(1.0, (th - (math.pi - 0.35)) / 0.35)
        v.co.y, v.co.z = lado * r * math.sin(th), r * math.cos(th)
    o.data.update()
    return R


def preparar_reloj():
    ruta = buscar_zip("digital_wrist_watch")
    if not ruta:
        print(f"reloj_pulsera: no se encontró digital_wrist_watch_4k.blend.zip en {args.fuente}; se salta")
        return
    tmp = extraer(ruta)
    try:
        objs = cargar_blend(tmp)
        cuerpo = next(o for o in objs if o.name == "digital_wrist_watch")
        larga = next(o for o in objs if o.name == "digital_wrist_watch_strap_b")
        bb = lambda ob: [ob.matrix_world @ Vector(c) for c in ob.bound_box]
        pc = bb(cuerpo)
        y0 = (min(p.y for p in pc) + max(p.y for p in pc)) / 2
        h = (max(p.y for p in pc) - min(p.y for p in pc)) / 2
        z0 = min(p.z for p in pc)
        lado_largo = 1 if sum(p.y for p in bb(larga)) / 8 > y0 else -1
        o = unir(objs)
        quitar_caras(o, ("digital_wrist_watch_glass",))
        # Un solo material: la textura de color (sin los textos del bisel), algo metálico.
        im = cargar_textura(tmp, "digital_wrist_watch_diff_4k.jpg", 512, LOGO_RELOJ_PULSERA)
        m = nuevo_material("reloj_pulsera", imagen=im, rugosidad=0.35, metal=0.6)
        o.data.materials.clear(); o.data.materials.append(m)
        antes, despues = simplificar(o, 3000)
        R = curvar_reloj(o, y0, h, z0, lado_largo)
        o.name = o.data.name = "reloj_pulsera"
        kb = exportar(o, args.reloj)
        print(f"reloj_pulsera: {antes} -> {despues} triángulos, esfera a {RELOJ_H * 100:.1f} cm del eje, "
              f"correa de radio {R * 100:.1f} cm, {kb} KB")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


solo = {s for s in args.solo.split(",") if s}
for nombre, cfg in OBJETOS.items():
    if not solo or nombre in solo:
        preparar(nombre, cfg)
if not solo or "reloj_pulsera" in solo:
    preparar_reloj()
