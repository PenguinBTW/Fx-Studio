# vaulted — visual plan

## Concept
A ruined abbey nave at night: the roof is breached, so moonlight falls
through the gap as pale volumetric shafts onto the flagstones. The only
warmth in the ruin is a single candle burning in a wall sconce. Cold
moonlight vs one small flame — that contrast IS the image.

## Medium: real 3D (defended)
Architecture + volumetric light is where real 3D earns its keep: god rays
only read when they land on geometry with normals, and the ruin only reads
as a place when the camera can dolly through it with parallax. A 2D/SDF
version would collapse to silhouette bands — rejected.

## Assets (Blender → GLB, `assets/abbey/`)
- `floor` — flagstone slab, vertex-colour mottling.
- `columns` — two arcades of lathed drums (plinth, shaft, capital); three
  are snapped — jagged displaced break caps, with fallen drums in the rubble.
- `arches` — pointed arcade arches as swept tubes on the intact bays;
  two broken rib arcs overhead frame the breach.
- `wall` — low ruined side walls (varying course heights), an east end wall,
  and the tall west gable: two piers flanking a pointed lancet opening with
  a snapped mullion and crumbled tooth courses, glowing sky behind it.
- `rubble` — displaced stones + fallen column drums scattered on the floor.
- `ivy` — spiral climbing tubes with leaf clusters on three columns.
- `sconce` — iron bracket + candle + emissive flame on the south arcade.

## Staging
- Camera: low slow dolly down the nave (z −14 → −8), slight sway, gaze
  drifting up toward the shafts mid-scene; the end-wall lancet stays in
  frame as a distant dark aperture.
- Moon shafts: three tilted volumetric cones (outer veil + hot inner core)
  from the breach, striated like light through broken ribs, landing on
  additive floor pools; dust motes drift down inside them. A moon disc
  hangs in the lancet. Shaft intensity breathes f(t).
- Candle: warm PointLight + emissive flame quad, strong flicker f(t);
  it grazes the nearest column so its capital glows amber against blue.
- Lighting rig: cold ambient + moon key along the shaft direction +
  faint floor bounce + warm candle accent. Fog for aerial depth.
- Post: exposure/bloom/vignette/grain tuned for the cold/warm contrast.

## Determinism
Everything is closed-form f(t): shaft sway/intensity, dust drift, candle
flicker, camera path. No simulation state, no mixers.

## Beats (20 s)
1. Still nave — shafts pale, candle already lit (0–5)
2. Light through the breach — shafts strengthen, motes drift (5–10)
3. One small flame — camera closes on the warm column (10–15)
4. The stones keep watch — shafts ease back, settle (15–20)

## Rejects to watch
- Shafts must land ON the floor/rubble visibly — not stop mid-air.
- Broken column tops must read jagged, not cleanly sliced.
- If a still could pass for a flat poster: more depth separation (fog,
  rim on column edges, rubble foreground).
