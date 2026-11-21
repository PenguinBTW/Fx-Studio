# Visual Architecture Plan — Dimension Flight

One swallow, one continuous 82 s flight, five dimensions, four "correct" gateways. Stylised, not blocky: every world keeps its Minecraft palette and silhouettes but is built from smooth, organic, cinematic forms.

## 1. Conceptual Mapping Table

| Dimension | Reference (out/refs) | Palette (3–4) | Hero forms | Atmosphere | Gateway out |
|---|---|---|---|---|---|
| Overworld 0–16 s | `r_overworld.png` (Vibrant Visuals) | meadow green `#5f9a3c`, sky blue `#8fc4ee`, cherry pink `#f2a7c3`, river teal `#3a8aa0` | river valley, rolling hills, cherry + oak groves, snowy peaks | dawn haze, pollen, low mist | **Nether portal**: obsidian frame (crying-obsidian flecks), violet swirling film |
| Nether 16–32 s | `r_nether.png`, `r_nether_portal.png` | crimson `#8a1c1c`, lava orange `#ff7a1a`, warped teal `#1f8f86`, basalt black `#1a1414` | lava sea, crimson + warped fungi forests, basalt pillars, glowstone clusters | red haze, embers, ash | **End portal**: stronghold-style ring frame with 12 green-eyed stones, horizontal starry void film |
| End 32–48 s | `r_end.png`, `r_end_outer.png`, `r_end_portal.png` | void violet `#0d0618`, end-stone cream `#e6e2a6`, obsidian `#140c22`, chorus purple `#9b6bb0` | main island, obsidian spires with crystals, outer islands, chorus groves, end gateway | starfield, violet void haze | **Aether portal**: glowstone frame, blue water film |
| Aether 48–64 s | `a_ae2_5.png` + mod descriptions | sky blue `#7ec8ff`, cloud white `#f4f8ff`, aether grass `#7fd37a`, gold `#f2c94c` | floating holystone islands, skyroot + golden oak trees, waterfalls, cloud sea | bright day, cloud wisps, gold motes | **Deep Dark portal** (ancient-city arch of deepslate, sculk-cyan glow) floating on a ruined fragment |
| The Sift 64–82 s | `r_sift.png`, `r_xw_2.png`, `r_sift_portal.png` | mint sky `#6fdccb`, salmon sculk `#e98a86`, teal flora `#2fb3a8`, pale stone `#d9d4cc` | coral-like salmon meadows, cliffs and ravines, pale giant trees, glowing ichor pools | souls rising from ravines (tide pulse), drifting spores | final ascent toward the pale great tree; fade |

The Sift is the real upcoming dimension (Minecraft Dungeons II, Minecraft 2027): red "healthy sculk" ground, teal vegetation, ichor pools, souls, tides. It is reached through the ancient city's Deep Dark portal.

## 2. Anti-Cliché Audit

| Avoid | Instead |
|---|---|
| Block/voxel art | smooth sculpted terrain, bevelled modelled props (Blender), soft PBR |
| Pastel rubber blobs (rounded boxes as trees) | modelled canopies with lobed silhouettes and trunks |
| Empty void framing | every End/Aether shot has foreground islands and scale cues |
| Generic purple glow everywhere | each portal's film has its own physical look: swirl, starfield, water, sculk pulse |
| 10-step god-ray ghosting | 48-step jittered rays |

## 3. Spatial Hierarchy & Eye-Tracking Map

- The swallow is the hero: highest local contrast, in focus (thin-lens DoF on the bird), framed in the centre third.
- Each portal is foreshadowed ≥ 4 s before crossing, kept on the bird's flight axis (screen centre) so the gaze carries through the seam.
- Screen travel: the bird always flies into the frame (away from camera, slightly left→right), never reversing across a portal.
