"""
Renderiza una miniatura de cada escenario horneado para la pantalla "Escoge el escenario" del simulador.

Uso (con los GLB SIN comprimir, tal como salen de generar_escenarios.py, antes de `npm run comprimir`):
    blender --background --python blender/miniaturas_escenarios.py -- --glb carpeta_con_glb --out src/assets

Salida: src/assets/escena_<caso>.webp (960 x 600). Los escenarios ya traen su luz horneada como emisión, así que
el render es rápido; un sol y un cielo suaves iluminan los objetos que no se hornean (espejo, grifos, utilería).
"""
import bpy, sys, os, argparse
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--glb", required=True)
ap.add_argument("--out", default="src/assets")
args = ap.parse_args(argv)

# Cámara por caso, en coordenadas de scene.js (x, y arriba, z hacia la cámara): (posición, punto al que mira).
VISTAS = {
    "fentanilo": ((2.3, 1.75, 2.1), (0.15, 0.55, -0.95)),
    "pastillas": ((2.4, 1.7, 2.2), (0.1, 0.55, -0.9)),
    "xilazina": ((2.5, 1.7, 2.3), (0.3, 0.6, -0.9)),
    "tardio": ((2.5, 1.75, 2.2), (0.0, 0.55, -0.9)),
}
P = lambda x, y, z: Vector((x, -z, y))

os.makedirs(args.out, exist_ok=True)
for caso, (pc, pt) in VISTAS.items():
    ruta = os.path.join(args.glb, f"escenario_{caso}.glb")
    if not os.path.exists(ruta):
        print("FALTA", ruta); continue
    bpy.ops.wm.read_homefile(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=ruta)
    sc = bpy.context.scene
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam")); sc.collection.objects.link(cam); sc.camera = cam
    cam.data.lens = 24
    cam.location = P(*pc); cam.rotation_euler = (P(*pt) - P(*pc)).to_track_quat('-Z', 'Y').to_euler()
    sol = bpy.data.objects.new("sol", bpy.data.lights.new("sol", 'SUN')); sc.collection.objects.link(sol)
    sol.data.energy = 2.0; sol.rotation_euler = (-Vector(P(1.6, 3.4, 1.4)).normalized()).to_track_quat('-Z', 'Y').to_euler()
    w = bpy.data.worlds.new("w"); sc.world = w
    if hasattr(w, "use_nodes") and not w.use_nodes:
        w.use_nodes = True
    w.node_tree.nodes["Background"].inputs[0].default_value = (0.8, 0.86, 0.93, 1)
    w.node_tree.nodes["Background"].inputs[1].default_value = 0.6
    sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = 48
    sc.cycles.use_denoising = True
    sc.render.resolution_x, sc.render.resolution_y = 960, 600  # el doble de lo que mide la tarjeta: nítida en pantallas de alta densidad
    sc.render.image_settings.file_format = 'WEBP'; sc.render.image_settings.quality = 84
    sc.render.filepath = os.path.abspath(os.path.join(args.out, f"escena_{caso}.webp"))
    bpy.ops.render.render(write_still=True)
    print("MINIATURA", sc.render.filepath, round(os.path.getsize(sc.render.filepath) / 1024), "KB")
