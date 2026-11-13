"""
Genera el personaje del simulador de sobredosis en Blender y lo exporta como GLB.

Uso (desde una terminal):
    blender --background --python blender/generar_personaje.py -- --out public/modelos/persona.glb --preview preview.png

O dentro de Blender: Scripting > Abrir > Ejecutar.

Qué hace:
  1. Crea un esqueleto de vértices (pelvis, columna, cabeza, brazos, piernas).
  2. Le aplica el modificador Skin + Subdivision para formar una malla orgánica continua.
  3. Crea una armadura con huesos con nombre (los mismos que usa el simulador web).
  4. Asigna pesos automáticos y materiales (piel, camisa, pantalón, zapatos, pelo, labios).
  5. Exporta GLB (con huesos) y, si se pide, un render de vista previa.

Los nombres de los huesos coinciden con las articulaciones de scene.js:
  spine, chest, neck, head, shL, elL, shR, elR, hipL, kneeL, ankleL, hipR, kneeR, ankleR
"""
import bpy, bmesh, sys, math, argparse
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--out", default="persona.glb")
ap.add_argument("--preview", default="")
ap.add_argument("--skin", default="#9a6647")
ap.add_argument("--shirt", default="#3e6f91")
ap.add_argument("--pants", default="#2e3a48")
args = ap.parse_args(argv)


def hex_rgba(h):
    h = h.lstrip("#")
    srgb = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    lin = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in srgb]
    return (*lin, 1.0)


# ---------- Escena limpia ----------
bpy.ops.wm.read_factory_settings(use_empty=True)

# ---------- Esqueleto (Blender: Z arriba, la persona mira hacia -Y) ----------
# Altura total aprox. 1.75 m. Pelvis en z = 0.95.
J = {
    "pelvis": (0, 0, 0.95), "spine": (0, 0, 1.08), "chest": (0, 0, 1.30), "neck": (0, 0, 1.47),
    "head": (0, 0, 1.56), "headtop": (0, -0.01, 1.70), "face": (0, -0.07, 1.60),
    "shL": (0.19, 0, 1.40), "elL": (0.22, 0.01, 1.12), "wrL": (0.23, -0.01, 0.88), "haL": (0.235, -0.02, 0.80),
    "shR": (-0.19, 0, 1.40), "elR": (-0.22, 0.01, 1.12), "wrR": (-0.23, -0.01, 0.88), "haR": (-0.235, -0.02, 0.80),
    "hipL": (0.095, 0, 0.90), "kneeL": (0.10, -0.01, 0.50), "ankleL": (0.10, 0.01, 0.09), "toeL": (0.10, -0.15, 0.04),
    "hipR": (-0.095, 0, 0.90), "kneeR": (-0.10, -0.01, 0.50), "ankleR": (-0.10, 0.01, 0.09), "toeR": (-0.10, -0.15, 0.04),
}
EDGES = [
    ("pelvis", "spine"), ("spine", "chest"), ("chest", "neck"), ("neck", "head"), ("head", "headtop"), ("head", "face"),
    ("chest", "shL"), ("shL", "elL"), ("elL", "wrL"), ("wrL", "haL"),
    ("chest", "shR"), ("shR", "elR"), ("elR", "wrR"), ("wrR", "haR"),
    ("pelvis", "hipL"), ("hipL", "kneeL"), ("kneeL", "ankleL"), ("ankleL", "toeL"),
    ("pelvis", "hipR"), ("hipR", "kneeR"), ("kneeR", "ankleR"), ("ankleR", "toeR"),
]
# Radios (x, y) del modificador Skin por vértice
RAD = {
    "pelvis": (0.16, 0.115), "spine": (0.15, 0.105), "chest": (0.19, 0.12), "neck": (0.055, 0.055),
    "head": (0.1, 0.105), "headtop": (0.085, 0.09), "face": (0.075, 0.06),
    "shL": (0.055, 0.055), "elL": (0.045, 0.045), "wrL": (0.035, 0.028), "haL": (0.04, 0.018),
    "hipL": (0.075, 0.075), "kneeL": (0.055, 0.055), "ankleL": (0.04, 0.04), "toeL": (0.035, 0.03),
}
for k in list(RAD):
    if k.endswith("L"):
        RAD[k[:-1] + "R"] = RAD[k]

names = list(J)
me = bpy.data.meshes.new("persona")
me.from_pydata([J[n] for n in names], [(names.index(a), names.index(b)) for a, b in EDGES], [])
obj = bpy.data.objects.new("Persona", me)
bpy.context.collection.objects.link(obj)
bpy.context.view_layer.objects.active = obj
obj.select_set(True)

skin = obj.modifiers.new("Skin", "SKIN")
skin.use_smooth_shade = True
for i, n in enumerate(names):
    sv = me.skin_vertices[0].data[i]
    sv.radius = RAD[n]
    if n == "pelvis":
        sv.use_root = True
sub = obj.modifiers.new("Subdiv", "SUBSURF")
sub.levels = 2
sub.render_levels = 2
bpy.ops.object.modifier_apply(modifier="Skin")
bpy.ops.object.modifier_apply(modifier="Subdiv")
bpy.ops.object.shade_smooth()

# ---------- Armadura con nombres del simulador ----------
BONES = [
    ("spine", "pelvis", "chest", None), ("chest", "chest", "neck", "spine"),
    ("neck", "neck", "head", "chest"), ("head", "head", "headtop", "neck"),
    ("shL", "shL", "elL", "chest"), ("elL", "elL", "haL", "shL"),
    ("shR", "shR", "elR", "chest"), ("elR", "elR", "haR", "shR"),
    ("hipL", "hipL", "kneeL", "spine"), ("kneeL", "kneeL", "ankleL", "hipL"), ("ankleL", "ankleL", "toeL", "kneeL"),
    ("hipR", "hipR", "kneeR", "spine"), ("kneeR", "kneeR", "ankleR", "hipR"), ("ankleR", "ankleR", "toeR", "kneeR"),
]
arm_data = bpy.data.armatures.new("Esqueleto")
arm = bpy.data.objects.new("Esqueleto", arm_data)
bpy.context.collection.objects.link(arm)
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode="EDIT")
eb = arm_data.edit_bones
for name, a, b, parent in BONES:
    bone = eb.new(name)
    bone.head = Vector(J[a])
    bone.tail = Vector(J[b])
    if parent:
        bone.parent = eb[parent]
bpy.ops.object.mode_set(mode="OBJECT")

# Pesos automáticos
bpy.ops.object.select_all(action="DESELECT")
obj.select_set(True)
arm.select_set(True)
bpy.context.view_layer.objects.active = arm
bpy.ops.object.parent_set(type="ARMATURE_AUTO")

# ---------- Materiales por región ----------
def make_mat(name, color, rough=0.7):
    m = bpy.data.materials.new(name)
    if hasattr(m, 'use_nodes') and not m.use_nodes: m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = hex_rgba(color)
    bsdf.inputs["Roughness"].default_value = rough
    return m

MATS = {
    "piel": make_mat("Piel", args.skin, 0.55),
    "camisa": make_mat("Camisa", args.shirt, 0.85),
    "pantalon": make_mat("Pantalon", args.pants, 0.9),
    "zapato": make_mat("Zapato", "#1d1f24", 0.5),
    "pelo": make_mat("Pelo", "#1b1512", 0.8),
}
for m in MATS.values():
    obj.data.materials.append(m)
idx = {k: i for i, k in enumerate(MATS)}

def region(p):
    x, y, z = p
    if z > 1.64 or (z > 1.52 and y > 0.0):
        return "pelo"
    if z > 1.44:
        return "piel"
    if z < 0.12:
        return "zapato"
    if z < 1.0 and abs(x) < 0.2:
        return "pantalon"
    if abs(x) > 0.15 and z < 1.15:
        return "piel"  # antebrazos y manos
    return "camisa"

bm = bmesh.new()
bm.from_mesh(obj.data)
for f in bm.faces:
    f.material_index = idx[region(f.calc_center_median())]
bm.to_mesh(obj.data)
bm.free()

# Clave de forma para la cianosis no es necesaria: el color se cambia en el material desde three.js.

# ---------- Exportar ----------
bpy.ops.object.select_all(action="SELECT")
bpy.ops.export_scene.gltf(filepath=args.out, export_format="GLB", use_selection=True, export_skins=True, export_apply=False)
print("GLB exportado:", args.out)

# ---------- Vista previa opcional ----------
if args.preview:
    cam_data = bpy.data.cameras.new("Cam")
    cam = bpy.data.objects.new("Cam", cam_data)
    bpy.context.collection.objects.link(cam)
    cam.location = (1.6, -2.6, 1.5)
    direction = Vector((0, 0, 0.9)) - cam.location
    cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = cam
    sun = bpy.data.objects.new("Sol", bpy.data.lights.new("Sol", "SUN"))
    sun.data.energy = 3.5
    sun.rotation_euler = (math.radians(50), 0, math.radians(30))
    bpy.context.collection.objects.link(sun)
    world = bpy.data.worlds.new("Mundo")
    if not world.use_nodes: world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (0.6, 0.65, 0.7, 1)
    world.node_tree.nodes["Background"].inputs[1].default_value = 0.8
    bpy.context.scene.world = world
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.samples = 24
    sc.cycles.device = "CPU"
    sc.render.resolution_x, sc.render.resolution_y = 640, 800
    sc.render.filepath = args.preview
    bpy.ops.render.render(write_still=True)
    print("Vista previa:", args.preview)
