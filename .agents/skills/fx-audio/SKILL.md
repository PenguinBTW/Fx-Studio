---
name: fx-audio
description: Technical standards, internal invariants, and engineering workflows for the Unified Audiovisual Production Engine, Multi-Stem NLE, 3D Object-Bound Spatial Audio, Parameter Smoothing, and Cinematic Blending DSP in f(x) Studio (app/src/engine/audio/).
---
# f(x) Studio: Unified Audiovisual Production & Scene-Bound Audio System

Technical standards, architectural invariants, and engineering workflows for **f(x) Studio's native audio engine** (`app/src/engine/audio/`). Governs declarative mix authoring (`defineMix`), Float32 PCM multi-stem timeline assembly (`stem_nle.ts`), 3D object-bound spatial telemetry (`spatializer.ts`, `telemetry.ts`), 1-pole parameter smoothing (`smoother.ts`), and cinematic blending DSP (`dsp.ts`).

## When to Use

- Authoring, configuring, or modifying mix manifests (`mix.ts`, `mix.json`) using `defineMix()`.
- Emitting 3D object-bound spatial telemetry (`AudioTelemetryEmitter`, `projectWorldToScreenPan`) inside Three.js visual scenes.
- Non-destructive stem editing (`stem_nle.ts`): master transient lock (`-2.38ms`), asymmetric cosine crossfades, harmonic tail spillover, and vocal breath gating.
- Implementing or tuning cinematic DSP (`dsp.ts`): 2-pole Linkwitz-Riley split-band ducking @ 250Hz, dynamic Vocal Sanctuary notch @ 2.2kHz, True Peak lookahead mastering limiter ($\le -1.5\text{ dBTP}$), and pre-drop silence vacuums.
- Debugging spatial audio, parameter smoothing, air absorption LPF rolloff, or acoustic occlusion filtering.
- Running offline song analysis (`scripts/analyze_song.py`) or headless CLI mixdowns (`app/scripts/mixdown.ts`, `bun run app/scripts/render.ts audio`).

---

## 1. Upstream & Sibling Skill Relationships

- **`design-around-audio` (Directorial Upstream):** Visual-musical synchronization, transient hit impulses ($V_{\text{hit}}$), beat-grid fitting, and cutting cadence.
- **`sound-design-and-foley` (Curation Upstream):** Sound effects selection, tactile micro-sync, and spectral budgeting.
- **`fx-engine` (System Parent):** Central architectural index and coordinator.
- **`fx-scenes` (Visual Sibling):** Visual scene authoring where `AudioTelemetryEmitter` captures screen coordinates and object velocities.
- **`video-assembly-and-finishing` (Packaging Downstream):** Multi-scene timeline assembly in `project.json` and FFmpeg lossless multiplexing.

---

## 2. The Strict 3-Pass Linear Production Pipeline [RULE]

To guarantee 100% deterministic, zero-jitter rendering, f(x) Studio strictly enforces complete architectural decoupling between analysis, visuals, and audio mixdown:

```
                      [ THE 3-PASS LINEAR PIPELINE ]

  Pass 1: Offline Acoustic Analysis (scripts/analyze_song.py)
  ├── Extract beat grid, downbeats, BPM, RMS, and spectral chroma.
  └── Output: app/public/data/audio.json & audio_audit.json (Deterministic Metadata)
            │
            ▼
  Pass 2: Visual Scene & Motion Evaluation (app/src/engine/)
  ├── Three.js scene evaluation @ 60 fps (zero DSP in the WebGL render loop).
  ├── Frames rendered to WebGL render targets.
  └── AudioTelemetryEmitter streams transforms & tags to: out/events.jsonl
            │
            ▼
  Pass 3: Unified Audio Composition & Mastering (app/scripts/mixdown.ts)
  ├── Multi-stem NLE assembly with master transient lock (-2.38 ms).
  ├── 3D spatializer evaluates out/events.jsonl through 1-pole smoothed IIR filters.
  ├── Cinematic DSP suite: Vocal Sanctuary notch + split-band ducking + lookahead limiter.
  ├── Output: out/master.wav (48kHz 24-bit stereo PCM)
            │
            ▼
  Lossless Mux: FFmpeg Multiplexer (app/scripts/render.ts)
  └── Mux visual frame sequence + out/master.wav -> out/final_video.mp4
```

### Prohibited Patterns [STRICT]
- **No Mesh Raycasting for Acoustics:** Never perform real-time geometric ray-tracing against 3D visual meshes to calculate audio reverb or reflections. Visual geometry is for graphics; acoustics are governed by declarative tags and camera matrix projections.
- **No Real-Time Phase Vocoders:** Never pitch-shift or time-stretch polyphonic music stems in real time during rendering. All stem alterations must use discrete excision cuts, harmonic crossfades, or offline pre-processing.
- **No Circular Render Dependencies:** The visual render pass must never wait on audio buffers, and the audio engine must never block visual frame capture.

---

## 3. Subsystem Architecture (`app/src/engine/audio/`)

### 3.1 Declarative Mix Manifest DSL (`manifest.ts`)
Mix configurations are defined using `defineMix()` which validates schemas, gain ranges, bus assignments, and edits at compile time:

```typescript
import { defineMix, type MixConfig } from '../../../engine/audio';

export const mix: MixConfig = defineMix({
  sampleRate: 48000,
  soundtracks: [
    {
      id: 'main_theme',
      bus: 'music',
      stems: {
        drums: 'drums.wav',
        bass: 'bass.wav',
        vocals: 'vocals.wav',
        other: 'other.wav',
      },
      gainDb: -1.0,
      edits: {
        quantize: 'bars',
        excise: [
          {
            fromBar: 2,
            toBar: 4,
            stems: {
              drums: { transientLock: true },
              vocals: { breathGate: true },
              other: { tailSpillover: { spillSec: 2.0, tauSec: 0.7 } },
            },
          },
        ],
      },
    },
  ],
  spatialSources: [
    {
      id: 'thruster_spatial',
      file: 'thruster.wav',
      bus: 'sfx',
      bindTo: 'cargo_ship',
      spatial: {
        mode: 'screen_vector',
        maxPan: 0.65,
        distanceAttenDb: 18.0,
        distanceLpfHz: [20000, 2500],
      },
      modulation: {
        velocityToGainDb: [0, 3.0],
      },
    },
  ],
  stems: [
    { id: 'dock_clamp', file: 'dock_clamp.wav', bus: 'sfx', at: 14.8, gainDb: +1.0 },
    { id: 'station_voice', file: 'station_voice.wav', bus: 'vo', at: 2.5, gainDb: +1.5 },
  ],
  buses: {
    music: {
      gainDb: -0.5,
      splitBandDuck: {
        cues: ['dock_clamp'],
        splitHz: 250,
        attenDb: -4.5,
        attackMs: 20,
        releaseMs: 400,
      },
      vocalSanctuary: { centerHz: 2200, q: 1.2, cutDb: -3.5 },
    },
    sfx: { gainDb: 0.0 },
    vo: { gainDb: +1.0 },
  },
  master: { lufs: -14.0, truePeak: -1.5, limiterLookaheadMs: 1.5 },
});
```

#### The 6 Standard Mixing Buses
1. `music`: Separated musical stems (`drums`, `bass`, `vocals`, `other`).
2. `sfx`: Diegetic sound design, impacts, mechanical latches, and spatial effects.
3. `sub`: Dedicated low-frequency LFE channel ($< 90\text{ Hz}$).
4. `vo`: Spoken dialogue, voiceover, and EVA radio communications.
5. `foley_guide`: Non-rendering tactile reference channel for animators and sound designers.
6. `ambient`: Non-directional atmospheric background beds.

---

### 3.2 Multi-Stem NLE & Timeline Assembly (`stem_nle.ts`)
The non-linear editor reconstructs musical timelines directly in memory from separated stems while preserving acoustic coherence:

1. **Master Transient Lock (`transientLock`) [INVARIANT]:**
   When cutting or excising musical bars, the downbeat kick attack does not align with the mathematical bar boundary due to acoustic pre-attack energy. Applying an individual transient search to each separated stem causes phase smearing due to Demucs separation bleed.
   **Rule:** The pre-attack kick offset (`PRE_ATTACK_KICK_OFFSET_MS = -2.38` ms, ~114 samples @ 48kHz) MUST be computed from the master mix / drum downbeat and applied **collectively across all stems simultaneously**.
2. **Asymmetric Cosine Crossfades:**
   At cut seams, apply an asymmetric fade: a $3\,\text{ms}$ smooth cosine fade-out on outgoing audio, and an immediate $0\,\text{ms}$ hard attack on incoming downbeats to retain transient snap.
3. **Harmonic Tail Spillover (`tailSpillover`):**
   When drums and bass are abruptly cut or muted, harmonic stems (`other`, keys, synths, guitars) must not cut to dead digital silence. Overlay an exponential decay envelope across the seam:
   $$\text{Decay}(t) = \exp(-t / \tau), \quad \tau = 0.7\,\text{s}, \quad \text{duration} = 2.0\,\text{s}$$
4. **Vocal Breath Gating (`breathGate`):**
   Examine a $120\,\text{ms}$ window preceding the cut downbeat. If vocal RMS is below $-35\,\text{dBFS}$, snap the cut to the vocal silence interval, preventing truncated vocal syllables or isolated breath gasps.

---

### 3.3 Visual to Audio Telemetry Bridge (`telemetry.ts`)
Captures 3D world transforms on the visual side without Three.js runtime overhead during mixdown:

```typescript
// Inside visual scene render loop (app/src/scenes/<project>/scene.ts):
import {
  AudioTelemetryEmitter,
  projectWorldToScreenPan,
} from '../../engine/audio/telemetry';

export const telemetryEmitter = new AudioTelemetryEmitter();

// In render():
const shipWorldPos: [number, number, number] = [posX, posY, posZ];
const camMatInv = this.camera3D.matrixWorldInverse.elements;
const camProjMat = this.camera3D.projectionMatrix.elements;

// Projects 3D world position into screen NDC [-1, +1] and pan [-0.65, +0.65]
const spatial = projectWorldToScreenPan(shipWorldPos, camMatInv, camProjMat, 0.65);

telemetryEmitter.emit('cargo_ship', {
  pos: shipWorldPos,
  screenPos: spatial.ndc,
  pan: spatial.pan,
  distance: spatial.distance,
  velocity: 8.5,
  zone: 'deep_space',
  occluded: false,
});

telemetryEmitter.captureFrame(frameIndex, t);
```

---

### 3.4 1-Pole Parameter Smoothing Bridge (`smoother.ts`)
Visual frames evaluate at 60 Hz ($16.67\,\text{ms}$ intervals), while audio processes at 48,000 Hz ($0.0208\,\text{ms}$ intervals). Stepping parameters abruptly at 60 Hz causes audible zipper noise.

`ParameterSmoother` applies recursive 1-pole lowpass IIR filtering:
$$y[n] = y[n-1] + \alpha (x[n] - y[n-1]), \quad \alpha = 1 - e^{-1 / (f_s \cdot \tau)}$$

- **Panning smoothing:** $\tau = 25\,\text{ms}$ ($\alpha \approx 0.00083$). Smooths rapid camera whip pans.
- **Volume / Distance smoothing:** $\tau = 15\,\text{ms}$ ($\alpha \approx 0.00138$). Smooths rapid zooms.
- **Filter Cutoff smoothing:** $\tau = 20\,\text{ms}$ ($\alpha \approx 0.00104$). Smooths air absorption rolloff.

---

### 3.5 3D Stereo Spatializer (`spatializer.ts`)
Converts dry mono or stereo SFX buffers into fully spatialized stereo PCM buffers based on telemetry streams:

1. **Equal-Power Vector Panning:**
   $$G_L = \cos\left(\frac{\pi}{4}(1 + p)\right), \quad G_R = \sin\left(\frac{\pi}{4}(1 + p)\right), \quad p \in [-0.65, +0.65]$$
   Stereo width is clamped to $[-0.65, +0.65]$ by default to preserve center channel mono compatibility and prevent ear fatigue on headphones.
2. **Clamped Distance Attenuation:**
   Inverse-square distance falloff clamped to an ambient floor (default $-18\,\text{dB}$):
   $$\text{Gain}(d) = \max\left(10^{-18/20}, \frac{d_{\text{ref}}}{d_{\text{ref}} + d}\right)$$
3. **Cytomic SVF Air Absorption Filter:**
   Zero-delay feedback State Variable Filter rolling off high frequencies exponentially with distance:
   $$f_c(d) = f_{\text{min}} + (f_{\text{max}} - f_{\text{min}}) \cdot e^{-d / d_{\text{ref}}}, \quad f_{\text{max}} = 20\,\text{kHz}, \quad f_{\text{min}} = 2.5\,\text{kHz}$$
4. **Occlusion Shelf Filter:**
   When telemetry flags `occluded: true`, apply a $-6.0\,\text{dB}$ low-shelf cut at $1.2\,\text{kHz}$.

---

### 3.6 Cinematic Blending DSP Suite (`dsp.ts`)

#### Sub-Bass Decoupled Split-Band Ducking (`applySplitBandDuck`) [INVARIANT]
Standard sidechain ducking attenuates the entire music mix when sound effects or dialogue hit, causing weak, hollow kicks and noticeable volume "pumping."
**Rule:** When heavy SFX impacts hit (e.g. explosions, hydraulic docking clamps, vehicle crashes), use `applySplitBandDuck`:
1. Decompose the musical audio into **Sub-Bass** ($< 250\text{ Hz}$) and **Mid/High** ($> 250\text{ Hz}$) bands using a 2-pole Linkwitz-Riley crossover ($Q = 0.5$).
2. Apply gain ducking ($-4.5\,\text{dB}$, $20\,\text{ms}$ attack, $400\,\text{ms}$ release) **strictly to the Mid/High band**.
3. Sum the untouched Sub-Bass band ($0\,\text{dB}$ unity) back with the ducked Mid/High band.
4. *Result:* Massive sub-bass weight and 808 punch are completely preserved while the midrange opens up clear headroom for the SFX.

#### Dynamic Vocal Sanctuary Notch (`applyVocalSanctuary`)
Voiceover and dialogue live primarily in the $1.5\,\text{kHz} \to 3.5\,\text{kHz}$ presence band.
- Rather than ducking the entire music volume when speech occurs, dynamically engage a Cytomic SVF notch filter centered at $2.2\,\text{kHz}$ ($Q = 1.2$, $-3.5\,\text{dB}$).
- Modulated by the envelope of the `vo` bus.
- Preserves the musical groove, bassline, and drum clarity while carving an acoustic frequency pocket for voice intelligibility.

#### True Peak Mastering Limiter (`applyLookaheadLimiter`)
Enforces strict broadcast compliance without clipping distortion:
- **Ceiling:** $\le -1.5\,\text{dBTP}$ (true peak).
- **Lookahead Window:** $1.5\,\text{ms}$ (72 samples @ 48kHz).
- **Peak Finding:** Double-ended monotonic deque ($O(N)$ linear complexity).
- **Release:** $50\,\text{ms}$ exponential release curve.

#### Pre-Drop Silence Vacuum (`applyPreDropVacuum`)
To maximize the perceived physical impact of a structural drop, downbeat, or massive visual explosion:
- Zero out audio for $40\text{--}120\,\text{ms}$ immediately preceding the impact.
- Apply a $2\,\text{ms}$ cosine fade-down into the silence to prevent digital DC clicks.

---

## 4. Headless CLI Workflows & Verification

Licensed songs are never committed: every `audio/` folder is gitignored (`**/audio/`). Commit the mix script, not the song or the rendered mix, and point `project.json` `audio` at the rendered mix (not the raw song) so renders include the SFX.

### Running Offline Song Analysis
```bash
python scripts/analyze_song.py --audio song/track.mp3 \
  --out app/src/scenes/<project>/audio/analysis/audio.json \
  --audit-out app/src/scenes/<project>/audio/analysis/audio_audit.json
```

### Running Dedicated Audio Mixdown
```bash
bun run app/scripts/mixdown.ts \
  --mix app/src/scenes/<project>/audio/mix.ts \
  --analysis app/src/scenes/<project>/audio/analysis/audio.json \
  --events out/events.jsonl \
  --to 20.0 \
  --out out/master.wav
```

### Rendering Full Video with Multiplexed Audio
```bash
bun run app/scripts/render.ts video \
  --project <project> \
  --mix app/src/scenes/<project>/audio/mix.ts \
  --from 0 \
  --to 20 \
  --fps 60 \
  --out out/final_video.mp4
```

### Auditing Broadcast Compliance (EBU R128)
```bash
ffmpeg -i out/master.wav -af ebur128 -f null -
```
**Verification Targets:**
- Integrated Loudness: $-14.0 \pm 1.0\,\text{LUFS}$
- Maximum True Peak: $\le -1.5\,\text{dBTP}$
- Loudness Range (LRA): $3.0\text{--}7.0\,\text{LU}$
