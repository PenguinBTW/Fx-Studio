# Visual Architecture Plan

**Chapter / Segment:** Child Lock, Act II to Act IV bridge, "The Interlock"
**Core Abstract Concept:** A system protects you by making your action stop meaning anything (disconnection, not blockage)
**Primary Physical Domain:** A car-door latch mechanism, then its engineering-drawing abstraction

---

## 1. The Conceptual Mapping Table

| Script Abstract Concept | Real-World Physical Metaphor | Tangible Form & Materials | Dynamic Visual State Change |
|---|---|---|---|
| Action that connects to nothing | Rod whose tip stops short of the latch | Bone solids with barycentric edge glow; thin red gap | Pulse travels the rod, flares red at the tip, sparks fall, the latch never moves |
| The protection itself | Child-lock slider | Brushed metal slot, ridged knob, rubber seal | Knob snaps 14 mm, red sliver is revealed behind it |
| The idea as a structure | Input, gap, output glyph "G" | Circle, broken line with red blocker, square | Mechanism dissolves to line art, then repeats at every scale |
| You are the one at the lever | Particle figure facing the lever | 20k bone points, idle drift | Reaches, pulse dies in the gap, about 4% of particles leak away |
| Ambiguity | Knob at exactly 50% | Same slot as Beat 0 | Red sliver half revealed, so on or off is unreadable |

---

## 2. Anti-Cliche Audit
- **Forbidden Cliche:** padlock icons, neon HUDs, glowing circuit boards.
- **Grounding Replacement:** lever, rod, pawl and latch interlock drawn as an engineering drawing coming to life.
- **Red rule:** `--signal` appears only at severed connections (slot sliver, rod gap, glyph blocker, lattice gap pinpoints).

---

## 3. Spatial Hierarchy & Eye-Tracking Map
- **Primary Hero (60%):** the knob / the red gap / the glyph, always near centre.
- **Secondary Support (30%):** rod, handle and latch in bone; the pulse.
- **Ambient Floor (10%):** ash wireframe context, lattice, monospace labels.

## 4. Scene / Transition Architecture

| Scene | Window | Seam into next |
|---|---|---|
| `beat0_switch` | 0 to 8.8 | `slot_breach`: camera pushes into the slot, the slot becomes a dark portal |
| `beat1_mechanism` | 8.0 to 20.8 | `gap_iris`: the red gap grows to fill the frame, then resolves into the abstraction |
| `beat2_abstraction` | 20.0 to 30.8 | `glyph_fold`: the glyph self-nests, entering the zoom-fold |
| `beat3_zoomfold` | 30.0 to 58.8 | `ash_sink`: lines sink to ash, the frame dims and settles on the left node |
| `beat4_inversion` | 58.0 to 72.0 | hard cut to black at 72.0 |
