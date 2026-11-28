# THRESHOLD Z7 vending-machine family: four hero base machines plus modular damage/coin/sticker variants.
# Blender Z-up; exported GLB is engine Y-up. 1 unit = 1 metre.
import bpy, os, sys, math, random
sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
from _bl import *

reset()
R = random.Random(2707)

METAL = mat('MachineEnamelNavy', (0.018, 0.035, 0.055), 0.34, metal=0.58)
METAL_EDGE = mat('MachineEdgeWorn', (0.09, 0.12, 0.15), 0.28, metal=0.72)
INNER = mat('MachineInteriorDark', (0.006, 0.012, 0.018), 0.72, metal=0.12)
CHROME = mat('CoinChrome', (0.34, 0.39, 0.43), 0.18, metal=0.9)
RUBBER = mat('SealRubber', (0.006, 0.008, 0.009), 0.86)
LIGHT = mat('ColdMachineLight', (0.36, 0.68, 1.0), 0.24, emit=(0.28, 0.68, 1.0), strength=5.5)
WARM_LABEL = mat('WarmProductLabel', (0.95, 0.34, 0.06), 0.5, emit=(0.7, 0.08, 0.015), strength=0.45)
RED = mat('BallPitRedPlastic', (0.62, 0.018, 0.012), 0.28)
BLUE = mat('PoolTileBlue', (0.025, 0.24, 0.42), 0.25)
PAPER = mat('LibraryPaperLabel', (0.66, 0.55, 0.34), 0.82)
FELT = mat('TheatreFeltProduct', (0.32, 0.025, 0.035), 0.94)
BEIGE = mat('BeigePhoneProduct', (0.72, 0.62, 0.43), 0.46)
GREEN = mat('OfficeGreenProduct', (0.12, 0.33, 0.22), 0.52)
BLACK = mat('VoidBlack', (0.002, 0.003, 0.004), 0.92)
STickerA = mat('StickerMagenta', (0.9, 0.025, 0.24), 0.5)
STickerB = mat('StickerTeal', (0.02, 0.74, 0.67), 0.42)
GLASS = mat('ScratchedVendingGlass', (0.08, 0.18, 0.24), 0.16, metal=0.05)
GLASS.node_tree.nodes['Principled BSDF'].inputs['Alpha'].default_value = 0.28
try:
    GLASS.surface_render_method = 'DITHERED'
except Exception:
    try: GLASS.blend_method = 'BLEND'
    except Exception: pass

root = empty('z7_vending_machines_root')
root['fx_part'] = 'root'
seen_parts = set()

def mark(o, part):
    if part and part not in seen_parts:
        o['fx_part'] = part
        seen_parts.add(part)
    return o

def add(o, part=None, par=root):
    parent(o, par)
    return mark(o, part)

def group(name, part, loc=(0, 0, 0), par=root):
    g = empty(name, loc)
    parent(g, par)
    mark(g, part)
    return g

def scratch_stripes(prefix, cx, front_y, width, z0, z1, count, par):
    for i in range(count):
        x = cx + R.uniform(-width * 0.42, width * 0.42)
        z = R.uniform(z0, z1)
        length = R.uniform(0.035, 0.11)
        strip = box(f'{prefix}_scratch_{i}', (0.006, 0.008, length), (x, front_y - 0.012, z), CHROME, bev=0.001, seg=1, rot=(0, R.uniform(-0.18, 0.18), R.uniform(-0.45, 0.45)))
        add(strip, 'wear', par)

def coil_row(prefix, cx, y, z, width, count, par):
    spacing = width / count
    for i in range(count):
        x = cx - width * 0.5 + spacing * (i + 0.5)
        ring = torus(f'{prefix}_coil_{z:.2f}_{i}', 0.064, 0.0075, (x, y, z), CHROME, rot=(math.radians(90), 0, 0), major_segments=24, minor_segments=6)
        add(ring, 'spiral_coils', par)

def product_row(prefix, cx, y, z, width, kind, par):
    mats = [RED, BLUE, PAPER, FELT, BEIGE, GREEN]
    count = 5 if width > 0.9 else 4
    spacing = width / count
    for i in range(count):
        x = cx - width * 0.5 + spacing * (i + 0.5)
        material = mats[(i + int(z * 10)) % len(mats)]
        if kind == 'drinks':
            ob = cyl(f'{prefix}_bottle_{z:.2f}_{i}', 0.038, 0.19, (x, y, z + 0.105), material, verts=16, bev=0.006)
            neck = cyl(f'{prefix}_bottle_neck_{z:.2f}_{i}', 0.016, 0.055, (x, y, z + 0.225), material, verts=12, bev=0.003)
            add(ob, 'products', par); add(neck, 'products', par)
        elif kind == 'glass':
            ob = sphere(f'{prefix}_capsule_{z:.2f}_{i}', 0.052, (x, y, z + 0.085), material, scale=(0.85, 0.85, 1.15), segments=16, rings=8)
            add(ob, 'products', par)
        else:
            ob = box(f'{prefix}_packet_{z:.2f}_{i}', (0.075, 0.035, 0.13), (x, y, z + 0.075), material, bev=0.009, seg=2, rot=(0, 0, R.uniform(-0.08, 0.08)))
            add(ob, 'products', par)
            label = box(f'{prefix}_packet_label_{z:.2f}_{i}', (0.055, 0.006, 0.028), (x, y - 0.021, z + 0.09), WARM_LABEL, bev=0.001, seg=1)
            add(label, 'product_labels', par)

def keypad(prefix, x, y, z, par):
    panel = box(f'{prefix}_keypad_panel', (0.14, 0.025, 0.25), (x, y, z), METAL_EDGE, bev=0.012, seg=2)
    add(panel, 'keypads', par)
    for row in range(4):
        for col in range(3):
            b = box(f'{prefix}_key_{row}_{col}', (0.024, 0.012, 0.018), (x - 0.035 + col * 0.035, y - 0.018, z + 0.075 - row * 0.043), CHROME, bev=0.003, seg=1)
            add(b, 'keypad_buttons', par)

def coin_panel(prefix, x, y, z, par):
    plate = box(f'{prefix}_coin_plate', (0.15, 0.028, 0.22), (x, y, z), CHROME, bev=0.014, seg=3)
    add(plate, 'coin_slots', par)
    slot = box(f'{prefix}_coin_slot', (0.012, 0.012, 0.07), (x - 0.028, y - 0.018, z + 0.025), BLACK, bev=0.003, seg=1)
    add(slot, 'coin_slots', par)
    ret = cyl(f'{prefix}_coin_return', 0.033, 0.014, (x + 0.025, y - 0.019, z - 0.045), BLACK, rot=(math.radians(90), 0, 0), verts=20)
    add(ret, 'coin_returns', par)

def make_machine(kind, cx, w, h, d, product_kind, shelves):
    mg = group(f'{kind}_machine_root', kind, (cx, 0, 0))
    front_y = -d * 0.5
    back_y = d * 0.5
    # Carcass as separate real panels so the glass front reveals an interior cavity.
    add(box(f'{kind}_side_l', (0.07, d, h), (cx - w * 0.5 + 0.035, 0, h * 0.5), METAL, bev=0.025, seg=3), 'carcasses', mg)
    add(box(f'{kind}_side_r', (0.07, d, h), (cx + w * 0.5 - 0.035, 0, h * 0.5), METAL, bev=0.025, seg=3), 'carcasses', mg)
    add(box(f'{kind}_top', (w, d, 0.09), (cx, 0, h - 0.045), METAL, bev=0.025, seg=3), 'carcasses', mg)
    add(box(f'{kind}_bottom', (w, d, 0.11), (cx, 0, 0.055), METAL, bev=0.025, seg=3), 'carcasses', mg)
    add(box(f'{kind}_back', (w, 0.055, h), (cx, back_y - 0.027, h * 0.5), INNER, bev=0.012, seg=2), 'carcasses', mg)
    # Front door frame and rubber seals.
    frame_z = h * 0.56
    frame_h = h * 0.72
    add(box(f'{kind}_door_top', (w - 0.1, 0.07, 0.08), (cx, front_y - 0.01, frame_z + frame_h * 0.5), METAL_EDGE, bev=0.018, seg=3), 'door_frames', mg)
    add(box(f'{kind}_door_bottom', (w - 0.1, 0.07, 0.08), (cx, front_y - 0.01, frame_z - frame_h * 0.5), METAL_EDGE, bev=0.018, seg=3), 'door_frames', mg)
    add(box(f'{kind}_door_left', (0.075, 0.07, frame_h), (cx - w * 0.42, front_y - 0.01, frame_z), METAL_EDGE, bev=0.018, seg=3), 'door_frames', mg)
    add(box(f'{kind}_door_right', (0.075, 0.07, frame_h), (cx + w * 0.42, front_y - 0.01, frame_z), METAL_EDGE, bev=0.018, seg=3), 'door_frames', mg)
    # Interior backing, glass, edge light, shelves, coils and products.
    add(box(f'{kind}_inner_back', (w - 0.18, 0.035, frame_h - 0.1), (cx, back_y - 0.07, frame_z), INNER, bev=0.006, seg=1), 'interiors', mg)
    add(box(f'{kind}_glass', (w - 0.24, 0.018, frame_h - 0.14), (cx - w * 0.04, front_y - 0.046, frame_z), GLASS, bev=0.008, seg=2), 'glass_fronts', mg)
    add(box(f'{kind}_light_strip', (0.025, 0.025, frame_h - 0.16), (cx - w * 0.37, front_y - 0.065, frame_z), LIGHT, bev=0.006, seg=2), 'edge_lights', mg)
    add(box(f'{kind}_logo_panel', (w - 0.22, 0.045, 0.18), (cx, front_y - 0.035, h - 0.17), LIGHT if kind != 'retro' else WARM_LABEL, bev=0.018, seg=3), 'logo_panels', mg)
    usable_w = w - 0.32
    z_bottom = frame_z - frame_h * 0.39
    step = (frame_h * 0.72) / max(1, shelves)
    for si in range(shelves):
        z = z_bottom + si * step
        add(box(f'{kind}_shelf_{si}', (usable_w, d * 0.48, 0.035), (cx, -0.02, z), METAL_EDGE, bev=0.008, seg=2), 'shelves', mg)
        coil_row(f'{kind}_{si}', cx, front_y + 0.09, z + 0.095, usable_w * 0.9, 4 if w < 1.0 else 5, mg)
        product_row(f'{kind}_{si}', cx, front_y + 0.12, z + 0.02, usable_w * 0.86, product_kind, mg)
    # Lower dispense flap and right-side controls.
    flap = box(f'{kind}_dispense_flap', (w * 0.48, 0.045, 0.22), (cx - w * 0.12, front_y - 0.045, 0.27), BLACK, bev=0.018, seg=3, rot=(math.radians(-4), 0, 0))
    add(flap, 'dispense_flaps', mg)
    keypad(kind, cx + w * 0.36, front_y - 0.065, h * 0.55, mg)
    coin_panel(kind, cx + w * 0.36, front_y - 0.065, h * 0.33, mg)
    # Modular variant evidence: damage plate, stickers, broken-glass shards, missing side panel.
    damage = box(f'{kind}_damage_dented_panel', (w * 0.32, 0.025, 0.16), (cx - w * 0.22, front_y - 0.075, h * 0.82), METAL_EDGE, bev=0.012, seg=2, rot=(0.03, 0.04, -0.06))
    add(damage, 'damage_variants', mg)
    for si, (matv, dx, dz) in enumerate([(STickerA, -0.25, 0.68), (STickerB, 0.18, 0.76), (PAPER, 0.29, 0.2)]):
        st = box(f'{kind}_sticker_{si}', (0.11, 0.009, 0.045), (cx + dx * w, front_y - 0.083, h * dz), matv, bev=0.003, seg=1, rot=(0, 0, R.uniform(-0.1, 0.1)))
        add(st, 'sticker_variants', mg)
    for si in range(4):
        shard = box(f'{kind}_broken_glass_shard_{si}', (0.012, 0.008, 0.12 + si * 0.018), (cx - w * 0.12 + si * 0.07, front_y - 0.086, frame_z + 0.12 - si * 0.07), GLASS, bev=0.001, seg=1, rot=(0, 0, -0.55 + si * 0.28))
        add(shard, 'broken_glass_variants', mg)
    missing = box(f'{kind}_missing_panel_dark_opening', (0.012, d * 0.44, h * 0.2), (cx + w * 0.5 + 0.006, 0.04, h * 0.32), BLACK, bev=0.002, seg=1)
    add(missing, 'missing_panel_variants', mg)
    scratch_stripes(kind, cx, front_y, w, h * 0.18, h * 0.9, 7, mg)
    return mg

make_machine('snacks', -2.25, 1.18, 2.05, 0.68, 'snacks', 5)
make_machine('drinks', -0.75, 1.02, 2.12, 0.66, 'drinks', 4)
make_machine('glass_front', 0.75, 1.10, 2.28, 0.62, 'glass', 5)
make_machine('retro', 2.2, 0.9, 1.78, 0.58, 'snacks', 3)

# Loose variant modules at the family base: coin-door, open-door hinge panel, keypad blank,
# product capsule tray, THANK YOU stencil plate, and a severed cable harness. They are separate
# named parts so zone integration can clone/omit them per machine variant.
mods = group('variant_module_root', 'variant_modules', (0, 0, 0))
for i in range(6):
    x = -2.5 + i * 0.95
    plate = box(f'loose_variant_panel_{i}', (0.34, 0.045, 0.22), (x, 0.58, 0.13), [METAL_EDGE, CHROME, STickerA, STickerB, PAPER, BEIGE][i], bev=0.015, seg=2, rot=(math.radians(78), 0, R.uniform(-0.1, 0.1)))
    add(plate, 'loose_variant_panels', mods)
# A hinged glass door sample opened outward, proving the door is a separate object rather than a flat facade.
door = box('open_variant_glass_door', (0.5, 0.025, 1.25), (3.05, -0.28, 0.95), GLASS, bev=0.01, seg=2, rot=(0, math.radians(-28), 0))
add(door, 'open_door_variant', mods)
for z in (0.48, 0.95, 1.42):
    hinge = cyl(f'open_door_hinge_{z}', 0.025, 0.11, (2.78, -0.13, z), CHROME, verts=16)
    add(hinge, 'door_hinges', mods)
# Cable harness with plug, useful for damaged/retro variants.
cable_pts = [(2.55, 0.45, 0.1), (2.8, 0.5, 0.18), (2.95, 0.38, 0.12), (3.05, 0.22, 0.2)]
add(curve('loose_power_cable', cable_pts, 0.018, RUBBER), 'cable_harness', mods)
add(box('loose_power_plug', (0.09, 0.06, 0.07), (3.06, 0.2, 0.21), BLACK, bev=0.01, seg=2), 'cable_harness', mods)

export(HERE)
