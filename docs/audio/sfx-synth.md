# Deterministic Procedural SFX Synthesizer

**Platform Version**: v0.7.0  
**Implementation Script**: [`app/scripts/sfx/synth.ts`](../../app/scripts/sfx/synth.ts)  
**Output Target**: 48 kHz / 24-bit stereo PCM WAV files  

---

## 1. Overview

The **f(x) Studio Procedural SFX Synthesizer** is a zero-dependency, code-only sound design engine. It synthesizes broadcast-quality sound effects, cinematic risers, sub drops, and tactile micro-sync foley purely from mathematical primitives and deterministic pseudorandom number generators (`mulberry32`).

### Architectural Invariants:
* **Zero External Audio Samples**: Every waveform—from granular ticks to deep planetary atmospheric rumbles—is computed analytically in software.
* **Deterministic Reproducibility**: Given the same cue definition and seed, the output WAV buffer is bit-identical across runs and platforms.
* **Zero C++ Dependencies**: Executes directly in the Bun runtime without requiring native audio compilation or node-gyp bindings.
* **Event-Time Precision**: Reverse reverbs and impact swells calculate analytical pre-delay offsets (`landing`) so that the acoustic peak lands sample-accurately on the picture cut.

---

## 2. CLI Usage & Commands

```bash
# List all registered procedural recipes and their default parameters:
bun scripts/sfx/synth.ts --list

# Render all cues declared in a project's sfx_cues.json:
bun scripts/sfx/synth.ts --cues path/to/sfx_cues.json --out out/sfx/

# Render cues with dynamic event timestamps resolved from events.json:
bun scripts/sfx/synth.ts --cues path/to/sfx_cues.json --events out/events.json --out out/sfx/
```

---

## 3. Acoustic Primitives & DSP Architecture

### 3.1 PolyBLEP Anti-Aliased Oscillators (`Osc`)
Naively computing digital square and sawtooth waves causes severe Nyquist aliasing (inharmonic high-frequency squealing). `synth.ts` implements **Polynomial Band-Limited Step (PolyBLEP)** residual correction to suppress aliasing while preserving sharp analog attack transients:
$$d(t) = \begin{cases} 2\frac{t}{dt} - \left(\frac{t}{dt}\right)^2 - 1 & 0 \le t < dt \\ 2\frac{t}{dt} + \left(\frac{t}{dt}\right)^2 + 1 & -dt < t < 0 \\ 0 & \text{otherwise} \end{cases}$$

Supported waveforms: `sine`, `saw`, `square`, `tri`.

### 3.2 State Variable Filters (`SVF`)
Zero-delay feedback (ZDF) Chamberlin / Cytomic state variable filters offering continuous cutoff frequency and resonance ($Q$) modulation:
* Low-pass (`lp`)
* High-pass (`hp`)
* Band-pass (`bp`)
* Notch (`notch`)

### 3.3 Noise Color Generators (`Noise`)
Deterministic seeded generators providing:
* **White Noise**: Uniform random distribution.
* **Pink Noise**: $1/f$ spectral slope via Paul Kellet's 3-pole filter array.
* **Brown Noise**: $1/f^2$ integration modeling seismic rumbling and deep pressure.

### 3.4 Convolution Reverb & Reverse Pre-Delay Alignment
Implements fast FFT-based convolution reverb (`makeIR`, `reverb`, `reverseReverb`).
When rendering a reverse swell leading into a cut, `synth.ts` calculates the impulse response length:
$$\text{landing} = L_{\text{IR}} - 1 \text{ samples}$$
The audio stem is placed so the swell peaks exactly on the visual event, with zero manual trimming needed in post.

---

## 4. Automation Lanes (`Lane`)

Parameters can be modulated continuously across the cue duration using flexible automation definitions:

```typescript
export type Lane =
  | number                                          // Constant value
  | Array<[number, number]>                         // Breakpoint array: [[t0, v0], [t1, v1], ...]
  | { pts: Array<[number, number]>; curve?: "lin" | "exp" | "smooth" }
  | { adsr: { a: number; d: number; s: number; r: number; gate: number } };
```

---

## 5. Recipe Library Reference

Run `bun scripts/sfx/synth.ts --list` to inspect all built-in recipes:

| Recipe | Domain / Act | Primary DSP Mechanics | Typical Visual Motivation |
| :--- | :--- | :--- | :--- |
| **`ignition`** | Void / Act 0 | 4 kHz rising sine over 30 Hz/31 Hz beating sub with quadratic pitch curve. | Big bang, cosmic genesis, light birth. |
| **`tick`** | Act 1 / Macro | High-frequency granular grains with exponential decay ($6\text{ ms}$) and photon pan. | Photon Brownian collision, dial tick, clock ratchets. |
| **`pressure`** | Act 1 / Pull | Filtered brown noise with exponential cutoff sweep ($70\text{--}1800\,\text{Hz}$). | Vacuum expansion, chamber decompression. |
| **`convection`**| Act 2 / Solar | Band-passed pink roar with modulated center ($160\,\text{Hz}$) and Shepard layer. | Solar furnace, convection cells, turbulence. |
| **`breakout`**  | Act 2 / Seam | Sudden transient punch with sub drop and wide stereo noise burst. | Seam rupture, barrier penetration. |
| **`rayleigh`**  | Act 3 / Scatter | Dual high-passed white noise sweeps with micro-jittered grain clouds. | Atmospheric blue light scattering. |
| **`dispersion`**| Act 4 / Prism | Discrete spectral panned chirps ($400\text{--}700\,\text{nm}$) matching wavelength order. | Glass prism refraction, rainbow caustics. |
| **`caustic`**   | Act 5 / Droplet | High-$Q$ resonant droplet clicks ($42.37^\circ$) with plate reverb tail. | Raindrop lens impact, optical caustics. |

---

## 6. Cue Manifest Schema (`sfx_cues.json`)

```json
{
  "cues": [
    {
      "id": "cue_ignition",
      "recipe": "ignition",
      "seed": 42,
      "eventId": "T0.ignition",
      "params": {
        "rise": 2.5,
        "tail": 1.2,
        "fStart": 3200,
        "fHigh": 4000,
        "subHz": 32
      }
    },
    {
      "id": "cue_photon_scatter",
      "recipe": "tick",
      "seed": 108,
      "at": 18.81,
      "params": {
        "count": 4,
        "spacing": 0.04,
        "freq": 3600,
        "pan": -0.4
      }
    }
  ]
}
```

The output stems are written to `--out` and directly ingested by `mixdown.ts` via the project's `mix.json`.
