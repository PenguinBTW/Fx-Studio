---
name: design-around-audio
description: Workflow and technical standards for synchronizing scene visuals, camera velocity, cutting cadence, and motion design to musical structure, transients, and frequency dynamics. Use when audio stems, soundtracks, or sound design guide the visual edit.
---
# Design Around Audio

Standards, technical workflows, mathematical foundations, and visual-musical mapping principles for scoring animation, camera movement, and visual pacing to music and sound design in Viopls video essays.

## When to Use

- Planning edit pacing, cut points, and shot durations against an audio track or narration.
- Extracting stems, beat grids, downbeat bar phase, transients, and frequency envelopes from raw audio.
- Driving dynamic camera impulses, focal shifts, spring dampers, and scene velocity via musical transients.
- Syncing particle systems, light flashes, UI pulses, and 3D object motion to rhythm.
- Designing build-ups, structural drops, tension ramps, and quiet narrative breathing zones.
- Auditing a visual sequence for rhythmic coherence, downbeat phase alignment, and optical sync.

---

## 1. Core Philosophy: Audio as Visual Physics

Audio is not a cosmetic background layer; it is the **temporal skeleton and physical momentum** of the scene. 

In a deterministic rendering engine, every visual frame is a pure mathematical function of song time:

$$\text{Frame} = f(t)$$

Because time $t$ is continuous and exact, visuals must never guess or approximate rhythm. Instead, audio features act directly as physical forces:
- **Transients (Kicks/Snares/Stabs)** act as physical impulses (instantaneous acceleration or force applied to cameras, lighting, focal lengths, or particle velocities).
- **Frequencies (Sub-Bass vs. Highs)** dictate physical weight, scale, inertia, and visual density.
- **Phrasing (Bars & Measures)** dictates spatial transitions, camera perspective cuts, and narrative acts.
- **Envelopes (Continuous Energy)** dictate persistent velocity, camera drift speed, field-of-view breathing, and environmental bloom.

---

## 2. Technical Audio Deconstruction & Feature Extraction Pipeline [RULE]

Never cut footage or place keyframes against unanalyzed audio or subjective listening alone. Every production track must pass through a multi-stage offline deconstruction pipeline that exports deterministic mathematical features (`audio.json` and `lyrics.json`).

```
[AUDIO ANALYSIS & PROVENANCE PIPELINE]

  Raw Audio (Mix) + Lyrics (.txt)
          │
          ├───► Stem Separation (Demucs 4-stem: drums, bass, vocals, other)
          │        └── LAME Encoder Delay Compensation (-1015 samples / 23.01 ms)
          │
          ├───► Constant-Tempo Beat Grid Fitting (Two-pass coarse & fine onset search)
          │        └── Kick Attack Phase Refinement (eliminate timing drift, SD < 10 ms)
          │
          ├───► Multi-Evidence Bar Phase & Downbeat Selection (Bass onset clustering on Beat 1)
          │
          ├───► Multi-Band Transient & Onset Detection
          │        ├── Kick: <120 Hz log-energy rise
          │        ├── Snare: 1.5–5 kHz attack + 40–120 ms noise tail qualification
          │        ├── Hi-Hat: >7 kHz attack + kick/snare collision rejection
          │        └── Vocal: Log-mel spectral flux peaks + pYIN pitch jumps (>0.8 semitone)
          │
          ├───► 100 FPS Multi-Band & Stem Energy Envelopes
          │        └── One-Pole Follower (10 ms attack / 90 ms release) + 99th percentile norm
          │
          ├───► Speech-to-Text Fusion & Syllable Alignment (Whisper -> Diff SequenceMatcher -> CTC)
          │
          └───► Semantic Downbeat Section Anchoring (Zero hardcoded cut timestamps in scenes)
```

### 2.1 Stem Separation & Codec Phase Alignment
A raw master mix cannot yield isolated transients because low frequencies mask kick attacks, and brass/lead synths obscure snare snaps.
1. **4-Stem Demixing:** Separate the mix using Demucs (`htdemucs_ft` or equivalent) into four discrete 44.1 kHz 32-bit float stems:
   - `drums`: Isolated kick, snare, hi-hats, percussive transients.
   - `bass`: Sub fundamentals, basslines, 808 glide.
   - `vocals`: Lead vocals and panned backing harmonies (optionally split stereo `vocL`/`vocR` for double-tracked choruses).
   - `other`: Chords, guitars, keys, ambient pads, sound effects.
2. **Codec Delay Compensation [RULE]:** Compressed audio (MP3/AAC) introduces an encoder delay (e.g., LAME delay of 1015 samples @ 44.1 kHz $\approx 23.01\text{ ms}$). Because the gapless decode of the master track is the visual time reference, stems must be shifted earlier by `STEM_OFFSET_SEC = 1015 / 44100` before analysis. Failing to offset stems causes transients to hit one to two frames late at 60 FPS.

### 2.2 Constant-Tempo Beat Grid & Kick Phase Refinement
Never rely on single-pass or floating BPM detectors that drift across quiet passages.
1. **Two-Pass Tempo Search:**
   - Compute normalized onset strength envelopes (`librosa.onset.onset_strength`) for both drums stem and full mix.
   - **Coarse Pass:** Sweep a bounded BPM range (e.g., $98.0 \dots 112.0$ BPM in steps of 0.02 BPM) and phase offsets (steps of 4 ms), scoring candidate beat pulses:
     $$\text{score}(P, \text{off}) = \frac{1}{N} \sum_{k} \max(o[\text{idx}_k - 1], o[\text{idx}_k], o[\text{idx}_k + 1])$$
     where $P = 60 / \text{BPM}$ and $\text{idx}_k = \text{round}((\text{off} + k \cdot P) \cdot \text{FPS})$.
   - **Fine Pass:** Refine the winning parameters in steps of 0.001 BPM and 0.001s.
2. **Kick Attack Phase Refinement:**
   - Detect physical kick onsets in the drum stem ($<120\text{ Hz}$).
   - Measure the timing residuals: $\text{res}_k = t_{\text{kick}, k} - (\text{off} + n_k \cdot P)$.
   - Shift the grid offset by $\text{median}(\text{res})$ and verify the residual standard deviation ($\sigma \le 10\text{ ms}$).
3. **Continuous Extrapolation:** Extrapolate the beat grid uniformly across drum-less intros, breakdowns, ambient interludes, and fades. The beat clock must never stop or desync.

### 2.3 Deterministic Bar Phase & Downbeat Detection
In standard 4/4 meter, the beat grid provides four candidate downbeat phases ($0, 1, 2, 3$). Downbeat phase must be proven mathematically, not assumed:
1. **Bass Onset Clustering (Primary Evidence):**
   - Extract bass note onsets ($40 \dots 250\text{ Hz}$, steep log-energy rise). In contemporary arrangement, bass fundamentally articulates Beat 1.
   - For each candidate phase $p \in \{0, 1, 2, 3\}$, calculate the proportion of bass onsets falling within $\pm 150\text{ ms}$ of candidate downbeats.
   - **Confidence Margin Rule:** The winning phase must exceed the runner-up by $\ge 1.5\times$ margin. If the margin is $< 1.5\times$, trigger a hard exit and require manual verification (`PHASE_OVERRIDE`).
2. **Backbeat Snare Evidence (Secondary Evidence):**
   - In standard arrangements, snares fall on Beats 2 & 4. Compute the 8th-note position histogram across candidate measures. If snares peak at beats 2 and 4, verify that Beat 1 matches the bass phase. (If snare attacks are uniform, flag as a non-backbeat arrangement).
3. **Lyric Section-Head Closeness & Spectral Novelty:**
   - Sung lines at section starts (Chorus, Verse) overwhelmingly start on or immediately after downbeats (Gaussian density $\sigma = 0.15\text{s}$).
   - Verify alignment against spectral flux novelty peaks from mix STFT.
4. **Non-4/4 Time Signatures:** If working in $3/4$ or $6/8$ meter, set candidate phases to $M$ beats per measure accordingly before running onset clustering.

### 2.4 Multi-Band Transient Extraction
Simple amplitude thresholding generates false positives from bleed. Isolate frequency bands using Butterworth zero-phase filters (`sosfiltfilt`) and extract the steepest logarithmic energy rise:

| Instrument | Filter Band | Attack Window | Minimum Gap | Verification & Bleed Rejection |
|---|---|---|---|---|
| **Kick Drum** | $<120\text{ Hz}$ | $12\text{ ms}$ | $150\text{ ms}$ | Peak rise $\ge 12\text{ dB}$; attack timestamp at steepest slope of $d(\text{dB})/dt$. |
| **Snare Drum** | $1500 \dots 5000\text{ Hz}$ | $10\text{ ms}$ | $150\text{ ms}$ | Peak rise $\ge 10\text{ dB}$. **Noise tail qualification:** require sustained tail energy $40 \dots 120\text{ ms}$ post-attack in $500 \dots 5000\text{ Hz}$ within $8\text{ dB}$ of local 2.5s maximum and $\ge -25\text{ dB}$ of song-wide 95th percentile. |
| **Hi-Hats** | $>7000\text{ Hz}$ | $6\text{ ms}$ | $60\text{ ms}$ | Peak rise $\ge 9\text{ dB}$. **Collision rejection:** discard candidates within $30\text{ ms}$ of a kick or $40\text{ ms}$ of a snare. |
| **Vocal Notes** | Vocal Stem | $5\text{ ms}$ hop | $90\text{ ms}$ | Log-mel spectral flux peaks + pYIN pitch jumps ($>0.8$ semitones) within active vocal presence mask ($\text{RMS} > -45\text{ dB}$). |

- **Strength Normalization:** Normalize transient strengths to $[0, 1]$ via percentile scaling (e.g., 5th–95th percentile mapped to $0.2 \dots 1.0$) so scene shaders can scale kinetic impulse responses linearly.

### 2.5 Continuous 100 FPS Multi-Band & Stem Energy Envelopes
Export frame-by-frame RMS power at 100 FPS ($10\text{ ms}$ hop, $46\text{ ms}$ RMS window) across 8 discrete channels:
- **Mix Envelopes:** Broadband `rms`, Low (`low`, $<150\text{ Hz}$), Mid (`mid`, $150 \dots 2000\text{ Hz}$), High (`high`, $>4000\text{ Hz}$).
- **Stem Envelopes:** `vocal`, `drums`, `bass`, `other`.
- **One-Pole Envelope Follower:** Smooth raw frame energy with asymmetric inertia (fast attack, smooth release):
  $$y_t = \alpha y_{t-1} + (1 - \alpha) x_t, \quad \alpha = \begin{cases} e^{-1 / (\tau_{\text{attack}} \cdot \text{FPS})} & \text{if } x_t > y_{t-1} \\ e^{-1 / (\tau_{\text{release}} \cdot \text{FPS})} & \text{if } x_t \le y_{t-1} \end{cases}$$
  Use $\tau_{\text{attack}} = 10\text{ ms}$ (instant snap to drum hits) and $\tau_{\text{release}} = 90\text{ ms}$ (natural kinetic decay).
- Divide each envelope by its 99th percentile and clip to $[0, 1]$.

### 2.6 Lyric Synchronization & Semantic Downbeat Anchoring
Visual cuts and scene changes must follow musical sections, but sections must never be hardcoded timestamp tables.
1. **Speech-to-Text & Authoritative Fusion:**
   - Extract raw word timestamps via speech recognition (e.g., Faster-Whisper `large-v3-turbo`).
   - Fuse word times onto authoritative written lyrics (`lyrics.txt`) using windowed ordered sequence matching (`SequenceMatcher`), enforcing:
     - Strict positive word durations: $\text{start} < \text{end}$ (minimum $120\text{ ms}$).
     - Monotonic non-decreasing timestamps (no backwards time travel).
     - Consecutive word overlap $\le 50\text{ ms}$.
     - Pacing sanity checks: reject hyper-compression ($<180\text{ ms/word}$) and unheld bloat ($>10\text{s}$ duration).
   - Stage 2 CTC forced alignment (e.g., MMS_FA / wav2vec2) refines phoneme & syllable boundaries (`syl`) for syllable-by-syllable kinetic typography.
2. **Downbeat & Rhetorical Section Anchoring [RULE]:**
   - **Rhythmic / Music Productions:** Structural sections (`Intro`, `Build`, `Drop`, `Outro`) snap backwards to the nearest musical downbeat:
     $$\text{section\_start} = \max(\{d \in \text{downbeats} \mid d \le t_{\text{anchor}} + 0.02\})$$
     Scene cuts declared in `project.json` snap to the last beat at or before the anchor:
     $$\text{cut}(a) = \text{timeOfBeat}(\lfloor \text{beatAt}(t_{\text{anchor}} + 0.02) \rfloor)$$
   - **Voiceover Video Essays:** In speech-led productions with ambient beds, scene boundaries are declared in `project.json` aligned to rhetorical pauses and conceptual turning points documented in `narration_guide.md`.
   - **Result:** Retiming audio or replacing temporary voiceover automatically updates edit timing with zero drift.

---

## 3. Kinetic Mapping Rules

### 3.1 Avoid the "Beat-Cut Trap" [RULE]
- **Do NOT cut the camera on every single beat.** Cutting on every quarter note or snare hit destroys spatial continuity, disorients the viewer, and looks amateur.
- Use the **Hierarchy of Visual Reaction**:
  - **Downbeat / Measure Start (Beat 1):** Ideal for camera cuts, perspective shifts, focal length changes, or scene wipes.
  - **Backbeat / Snare (Beats 2 & 4):** Ideal for camera pushes, trajectory angle swerves, typography reveals, or lighting flashes.
  - **Subdivisions / Hi-Hats / 16ths:** Ideal for internal particle vibration, secondary animation, UI flicker, or depth-of-field breathing.

```
[WRONG: Cut on every beat]
Beat:  | 1 (Cut) | 2 (Cut) | 3 (Cut) | 4 (Cut) |  <-- Jarring & Disorienting

[RIGHT: Layered Reaction Hierarchy]
Beat:  | 1 (Scene Cut / Downbeat) | 2 (Camera Accel) | 3 (Subtle Pan) | 4 (Light Pulse / Snare) |
```

### 3.2 Visual Weight by Frequency Range [GUIDANCE]
Map frequency bands to physical visual characteristics:

| Frequency Band | Musical Elements | Visual Translation |
|---|---|---|
| **Sub-Bass (<60Hz)** | 808s, drone rumbles, seismic impacts | Low-frequency camera shake, deep volumetric bloom, heavy environmental inertia. |
| **Bass (60Hz–250Hz)** | Bass guitars, kick punch, synth plucks | Camera impulse velocity, heavy object landings, bass-reactive depth scale. |
| **Midrange (250Hz–4kHz)** | Lead synth, brass, vocals, chords | Subject transformation, core kinetic animation, spatial text reveals. |
| **Highs (>4kHz)** | Hi-hats, cymbals, air, glitched foley | Specular glints, HUD/data element flickers, sparks, chromatic aberration pulses. |

### 3.3 Dynamic Breathing & Deceleration [RULE]
- If the audio track strips away percussion or transitions into an ambient pad/drone, **instantly kill fast kinetic cutting**.
- Replace rapid motion with long, sweeping camera drifts, macro close-ups, and slow environmental parallax.
- Respect the audio's decay: let camera momentum smoothly glide to a halt as long reverb tails wash out.

### 3.4 Non-Lyric, Ambient & Voiceover-Led Audio Scoring [RULE]
Many Viopls productions are spoken video essays accompanied by non-percussive ambient scores, drone beds, or fluid orchestral arrangements without a constant 4/4 drum grid.

#### 1. The Narration Spine vs. Musical Bed
- In voiceover-led productions, **spoken delivery is the primary temporal clock**, not musical bars.
- Cuts and camera perspective changes align to **rhetorical thoughts and vocal pauses** (governed by `design-around-narration`), while the background score provides continuous emotional gravity and physical inertia.
- Never force an artificial 4/4 beat grid onto free-form ambient drones or orchestral strings.

#### 2. Continuous Spectral Envelope Modulation
Even without percussive transients (kicks/snares), `scripts/analyze_song.py` generates continuous 100 FPS multi-band envelopes (`f.a.low`, `f.a.mid`, `f.a.high`, `f.a.rms`):
- **Sub-Bass / Drone Lows (`f.a.low`, $<150\text{ Hz}$):** Drives camera elevation, world-space depth fog density, or subtle volumetric bloom radius.
- **Mid-Range Pads & Strings (`f.a.mid`, $150\text{--}2500\text{ Hz}$):** Modulates continuous secondary motion velocity, camera focal length breathing, and line stroke weight.
- **High-Frequency Air & Textures (`f.a.high`, $>4000\text{ Hz}$):** Modulates procedural film grain intensity, micro-particle drift, and specular line glints.
- **Broadband Energy (`f.a.rms`):** Scales overall scene lighting intensity and camera drift speed so visuals naturally swell and recede with the music.

#### 3. Harmonic Shifts as Visual Milestones
- In drone and orchestral scoring, chord progressions and filter sweeps (low-pass cutoff opening) substitute for downbeats.
- Use spectral novelty peaks (`onset_strength`) to trigger smooth camera trajectory arcs or focal depth pulls.

#### 4. Offline Analysis for Speech & Ambient Tracks
```bash
# Analyze ambient soundtrack or voiceover mix
python scripts/analyze_song.py --audio app/public/audio/score.mp3 --out app/public/data/audio.json --duration 60.0
```
- In the resulting `audio.json`, envelope channels (`low`, `mid`, `high`, `rms`) are fully populated even if `kick` and `snare` remain at zero.
- Scenes query `ctx.audio.sample(f.t)` or `f.a` envelopes smoothly with zero runtime overhead.

---

## 4. The Drop & Buildup Formula [RULE]

When scoring high-energy moments (risers into drops):

```
[AUDIO RISER]                            [THE HIT / DROP]
Tension ramps up                         Explosive release
Frequency cutoff opens                   Full frequency spectrum returns
Tempo doubles or pitch climbs            Heavy bass / kick impact
      |                                        |
      V                                        V
[VISUAL BUILDUP]                         [VISUAL IMPACT]
Camera tightens (push-in / zoom)         Instant perspective change (Hero Wide / Low Angle)
Motion accelerates                       Momentum vector snaps into full forward flight
Depth of field narrows                   Lighting explodes / Environmental shockwave
```

1. **The Riser (Tension):** Push the camera forward steadily into a subject or tighten the field of view. Increase motion frequency or rotational tilt.
2. **The Vacuum (Zero Beat):** If the music abruptly cuts out for a split-second silence right before the drop, freeze the visual motion or cut to an extreme macro silhouette. Let visual gravity suspend.
3. **The Impact (Drop):** Snap on exact frame 0 of the downbeat to an expansive, high-energy wide shot with maximum depth and momentum. (Optionally cut 1 frame early for perceptual impact).

---

## 5. Spatial Audio & Panning Alignment [GUIDANCE]

- If the audio track or sound design has distinct stereo/binaural panning:
  - An element sweeping hard left-to-right across the stereo field should match a left-to-right visual velocity vector on screen.
  - Distant reverb-heavy sounds correlate to deep background elements; dry, high-transient sounds belong in the foreground macro space.

---

## 6. Runtime Engine Integration: Audio-Driven Scene Architecture [RULE]

In the render engine, scenes consume precomputed audio data via an `AudioData` interface. All audio lookups must be $O(1)$ or $O(\log N)$ binary searches, operating purely on continuous song time $t$.

### 6.1 Continuous Audio API Contract
Scenes must interface with audio through these mathematical primitives:

```typescript
export interface AudioSample {
  rms: number; low: number; mid: number; high: number;
  vocal: number; drums: number; bass: number; other: number;
  kick: number; snare: number; hat: number; vonset: number;
}

// In scene render loop:
const s = au.sample(t);
const beat = au.beatAt(t);   // Continuous fractional beat (e.g., 14.25)
const bar = au.barAt(t);     // Continuous fractional measure
```

### 6.2 Transient Impulse & Decay (The `hit` Function)
Do not trigger instant on/off booleans for beats. Instead, model transients as decaying physical impulses with calibrated half-lives:

$$V_{\text{hit}}(t, \text{kind}) = \max_{i} \left( s_i \cdot 0.5^{(t - t_i) / \tau} \right)$$

- **Kick ($\tau \approx 120\text{ ms}$):** Heavy, punchy impact. Drives camera Z-kick and low-pass bloom.
- **Snare ($\tau \approx 140\text{ ms}$):** Snappy impact with longer tail. Drives camera roll impulses and light exposure bursts.
- **Hi-Hat ($\tau \approx 60\text{ ms}$):** Razor-sharp, rapid decay. Drives chromatic aberration glitches, micro-shakes, and line stroke widths.
- **Vocal Onset ($\tau \approx 150\text{ ms}$):** Syllable impulse. Drives typographic scale pops and focal racks.

```typescript
// Engine implementation of decaying hit impulse:
hit(kind: string, t: number, halfLife = 0.11): number {
  const list = this.onsets[kind];
  if (!list || list.length === 0) return 0;
  // Binary search to last onset before time t
  let lo = 0, hi = list.length;
  while (lo < hi) {
    const m = (lo + hi) >> 1;
    if (list[m][0] <= t) lo = m + 1; else hi = m;
  }
  let v = 0;
  for (let i = lo - 1; i >= 0 && i >= lo - 6; i--) {
    const [ot, s] = list[i];
    const dt = t - ot;
    if (dt > halfLife * 8) break;
    v = Math.max(v, s * Math.pow(0.5, dt / halfLife));
  }
  return v;
}
```

### 6.3 Peak-Hold Windows for Visual Anticipation
Human visual perception requires 40–80 ms to register visual changes. Use `envPeak(name, t, w = 0.08)` to evaluate the maximum envelope power over a rolling historical window $[t - w, t]$ to prevent instantaneous envelope troughs from dropping visual brightness between samples.

---

## 7. QA Validation, Spectrogram Auditing & Motion Telemetry Gate [RULE]

Never ship a render without verifying audio analysis integrity and motion telemetry against automated gates.

### 7.1 Hard-Fail Data Validation (`validate_data.py`)
Run before building or rendering:
- **Duration & Monotonicity:** `beats` and `downbeats` strictly increasing within $[0, \text{duration}]$.
- **Section Coverage:** Sections contiguous, sorted, starting at $0.000\text{s}$ and covering exactly to track end.
- **Envelope Frame Count:** Every feature array must contain exactly $\lceil \text{duration} \times 100 \rceil$ frames.
- **Semantic Text Drift:** Aligned lyric lines must match authoritative text character-for-character.
- **Manifest Scene Resolution:** Every scene and cut in `project.json` must resolve to valid scene files and timestamps.

### 7.2 Spectrogram QA Auditing (`qa_plot.py`)
Inspect the generated spectrogram overview plots (`qa/audio_overview.png` and window strips):
- **Kick Red Triangles:** Align to the bottom sub-bass bursts ($<120\text{ Hz}$) on the drums spectrogram.
- **Snare White Triangles:** Align to broadband noise bursts ($1.5 \dots 5\text{ kHz}$) with evident resonance tails.
- **Downbeat Cyan/Black Lines:** Fall on musical bar starts with heavy bass onset clustering.
- **Red Section Flags:** Coincide exactly with the downbeat preceding the first sung word.

### 7.3 Motion Telemetry Profiling (`scripts/render.ts motion`)
Profile the rendered scene in headless Chrome:
- **Temporal Cadence (FFT):** Verifies that visual velocity peaks match the musical tempo and measure frequency, rather than erratic stuttering.
- **Optical Flow & Luma Delta:** Ensures energy ramps match audio build-ups without static frozen stretches.
- **Text Probe Interceptor:** Verifies that kinetic typographic words appear within $\pm 50\text{ ms}$ of their audio word boundaries.

---

## 8. Pre-Render Audio Sync Checklist

Before locking down an edit, camera pass, or motion graphics render:

- [ ] **Track Deconstruction Complete:** Are `audio.json` and `lyrics.json` generated from isolated stems and verified by `validate_data.py`?
- [ ] **Stem Offset Applied:** Has the 1015-sample ($23.01\text{ ms}$) codec delay been compensated so transients align to mix frames?
- [ ] **Downbeat Phase Proven:** Was downbeat phase selected via bass onset clustering with $\ge 1.5\times$ margin (or explicit `PHASE_OVERRIDE`)?
- [ ] **Zero Hardcoded Timestamps:** Are scene cut points and sections anchored to lyric downbeats rather than arbitrary numbers?
- [ ] **No "Beat-Cut Trap":** Are cuts reserved for measure starts (Beat 1) and phrase transitions, while snares/kicks drive velocity impulses, lighting, and camera bumps?
- [ ] **Physical Impulse Feel:** Do camera bumps, focal pops, and light flares use half-life decaying hit impulses ($\tau \approx 60 \dots 140\text{ ms}$)?
- [ ] **Energy Congruence:** Does quiet musical passage have sweeping, slow camera drift rather than hyper-kinetic cuts?
- [ ] **The "Mute Test":** If you mute the video, does the pacing still feel naturally dynamic and readable without feeling erratic?
- [ ] **The "Blind Test":** If you only listen to the audio, does every crescendo, riser, and drop create natural physical anticipation of the visual payoff?
