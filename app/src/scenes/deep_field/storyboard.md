# Production Storyboard: Deep Field (Lagrange L2)

**Project:** `deep_field`  
**Duration:** 26.4s (Broadcast 1080p 60fps, 1584 frames)  
**Music:** Lorn — Anvil (Stem-Separated: Drums, Bass, Other, Vocals)  
**BPM:** 100.16 | **Downbeat Interval:** ~2.396s  

---

## Shot Sequence Breakdown

### Shot 1: "The Golden Eye" (`scene_optic`)
- **Time Range:** $t = 0.0\text{s} \to 11.2\text{s}$ (Frames 0–672)
- **Shot Scale:** Extreme Close-Up (ECU) $\to$ Medium Close-Up (MCU) Macro Orbit
- **Lens:** $85\text{mm}$ Anamorphic Macro (Horizontal FOV $\approx 28^\circ$, shallow DoF at $1.8\text{m}$)
- **Camera Choreography:**
  - $t = 0.0\text{s} \to 2.4\text{s}$: Camera glides on a low-angle tangent grazing the edge of gold hexagonal segment #1. Shallow focus blurs the distant secondary spider into soft golden bokeh circles.
  - $t = 2.4\text{s}$ (Downbeat 2): Rhythmic transient hits. An emerald laser alignment grid ($532\text{nm}$) fires across the gap between segments #1, #2, and #3. Camera pulls upward in a sweeping orbital roll.
  - $t = 4.8\text{s}$ (Downbeat 3): Actuators engage. A secondary telemetry read-out materializes on the gold mirror bevel.
  - $t = 7.19\text{s}$ (Downbeat 4): Deep sub-bass swell. Camera tilts upward toward the Cassegrain optical baffle tube as the secondary mirror spider arm locks into focal alignment.
  - $t = 9.59\text{s}$ (Downbeat 5): High-frequency riser initiates. Camera accelerates with massive forward momentum directly toward the central optical aperture ($Z = 0$), pulling focus sharply into the light-gathering tunnel.
- **Diegetic Typography:**
  - $t = 2.2\text{s} \to 8.8\text{s}$: Stamped 3D extruded gold-edged typography positioned at $Y = +1.2\text{m}$, $Z = -0.5\text{m}$:
    `PRIMARY MIRROR // 6.5M BERYLLIUM-GOLD ARRAY`
- **Audio Cue Guide:**
  - $t = 0.0\text{s}$: Dark sub-bass rumble and low-pass filtered synth drone.
  - $t = 2.4\text{s}$: First acoustic kick transient; tactile sub-hit and laser servo hum.
  - $t = 7.2\text{s}$: Snare transient with mechanical latch click.
  - $t = 9.6\text{s}$: Aerodynamic / vacuum frequency riser building toward the drop.

---

### Transition: "Cassegrain Convergence" (`transitions/optical_singularity`)
- **Time Range:** $t = 10.0\text{s} \to 11.5\text{s}$ (Overlap window, Peak at $11.0\text{s}$)
- **Mechanic:** Spatial Cassegrain Camera Punch-Through with Multi-Wavelength Diffraction Flare
- **Continuity Logic:**
  - Camera plunges into the central Cassegrain baffle opening of Scene 1 at maximum velocity ($\vec{v} = (0, 0, -12\text{m/s})$).
  - High-velocity optical flare clips to brilliant solar gold, splitting into signature JWST 6-pointed diffraction spikes.
  - As the flare clears on Downbeat 6 ($t = 11.99\text{s}$), the camera momentum naturally carries backward into Scene 2's grand orbital wide shot.
- **Audio Synchrony:** Riser peaks at $t = 10.95\text{s}$, drops into an instantaneous $120\text{ms}$ sub-vacuum silence, and explodes on the heavy downbeat at $t = 11.2\text{s}$ with the main drum groove.

---

### Shot 2: "Lagrange Point L2 // First Light" (`scene_lagrange`)
- **Time Range:** $t = 10.5\text{s} \to 26.4\text{s}$ (Frames 630–1584)
- **Shot Scale:** Extreme Wide Shot (EWS) $\to$ Monumental Orbital Sweep
- **Lens:** $35\text{mm}$ Deep-Space Vista (FOV $\approx 54^\circ$, focal plane at $8.5\text{m}$)
- **Camera Choreography:**
  - $t = 10.5\text{s} \to 14.38\text{s}$: Camera pulls backward from the observatory on an expansive orbital crane path ($\text{Radius} = 9.5\text{m} \to 13.0\text{m}$, Elevation $= +2.5\text{m} \to +1.8\text{m}$).
  - The complete James Webb Space Telescope commands the center-left visual space, illuminated by direct solar chiaroscuro on the Kapton sunshield and gold mirror array.
  - $t = 14.38\text{s}$ (Downbeat 7): The cold instrument side is silhouetted against deep space. Volumetric starfield parallax reveals the vast depth of the L2 halo orbit ($1.5\text{ million kilometers}$ from Earth).
  - $t = 16.78\text{s}$ (Downbeat 8): Camera smoothly rolls $-4^\circ$, aligning the primary mirror's optical axis directly with a distant cosmic sector.
  - $t = 19.17\text{s}$ (Downbeat 9 - Climax Drop): Full rhythm section drops. NIRCam detector triggers: an audio-reactive optical shockwave pulses outward from the secondary mirror, illuminating an ancient gravitational lensing Einstein ring and cluster of redshifted proto-galaxies ($z = 13.2$).
  - $t = 21.57\text{s} \to 26.4\text{s}$: Majestic slow drift; stars and gravitational arcs burn in deep space as the master thesis settles into eternal silence.
- **Diegetic Typography:**
  - $t = 12.0\text{s} \to 18.5\text{s}$: In-world architectural 3D floating title:
    `LAGRANGE POINT L2 // 1.5M KM DEEP SPACE`
  - $t = 19.2\text{s} \to 25.5\text{s}$: Climax thesis statement anchored to orbital space:
    `THE FIRST LIGHT // 13.6 BILLION YEARS AGO`
- **Audio Cue Guide:**
  - $t = 11.2\text{s}$: Full bass and drum groove drop.
  - $t = 14.4\text{s}$: Vocal stem enters with sweeping spatial reverb.
  - $t = 19.17\text{s}$: Heavy sub-bass impact hit with cosmic detuned resonance.
  - $t = 24.0\text{s} \to 26.4\text{s}$: Reverb tail decay into vacuum silence.

---

## 3. Screen Geography & 180° Rule Verification
- **Primary Optical Axis:** Vector $(0, 0, -1)$ in world space points along the telescope's line of sight toward deep space.
- **Solar Vector:** Vector $(1.0, 0.4, 0.8)$ normalized defines unfiltered solar radiation.
- **Camera Sector:** Both Scene 1 and Scene 2 operate strictly in the hemisphere facing the sunlit mirror and sunshield facade, preventing disorienting axis flips between cuts.

// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL