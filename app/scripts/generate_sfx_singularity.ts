// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
// Procedural Sound Design & Foley Generator for 'The Memory Singularity'
// Generates 48 kHz 24-bit stereo WAVs with physical envelope shaping and spectral filtering.

import path from 'node:path';
import { writeFileSync, mkdirSync } from 'node:fs';

const SR = 48000;
const OUT_DIR = path.resolve(import.meta.dir, 'sfx');
mkdirSync(OUT_DIR, { recursive: true });

function encodeWav24(pcmLeft: Float32Array, pcmRight: Float32Array): Uint8Array {
  const numFrames = pcmLeft.length;
  const byteRate = SR * 2 * 3; // 48000 * 2 channels * 3 bytes/sample
  const dataSize = numFrames * 2 * 3;
  const buf = new Uint8Array(44 + dataSize);
  const view = new DataView(buf.buffer);

  // RIFF header
  buf.set([0x52, 0x49, 0x46, 0x46], 0); // 'RIFF'
  view.setUint32(4, 36 + dataSize, true);
  buf.set([0x57, 0x41, 0x56, 0x45], 8); // 'WAVE'

  // fmt chunk
  buf.set([0x66, 0x6d, 0x74, 0x20], 12); // 'fmt '
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 2, true); // Stereo
  view.setUint32(24, SR, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, 6, true); // Block align (2 * 3)
  view.setUint16(34, 24, true); // 24 bits

  // data chunk
  buf.set([0x64, 0x61, 0x74, 0x61], 36); // 'data'
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < numFrames; i++) {
    // Clamp to [-1, 1]
    const sL = Math.max(-1, Math.min(1, pcmLeft[i]!));
    const sR = Math.max(-1, Math.min(1, pcmRight[i]!));
    const intL = Math.round(sL * 8388607);
    const intR = Math.round(sR * 8388607);

    // Left 24-bit little endian
    buf[offset++] = intL & 0xff;
    buf[offset++] = (intL >> 8) & 0xff;
    buf[offset++] = (intL >> 16) & 0xff;

    // Right 24-bit little endian
    buf[offset++] = intR & 0xff;
    buf[offset++] = (intR >> 8) & 0xff;
    buf[offset++] = (intR >> 16) & 0xff;
  }

  return buf;
}

// 1. Conduit Thrum (continuous 52Hz sub-drone with 3rd harmonic and slow stereo pulse)
{
  const dur = 12.0;
  const n = Math.round(dur * SR);
  const l = new Float32Array(n);
  const r = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const f0 = 52.0;
    const env = Math.min(1, t / 1.5) * Math.min(1, (dur - t) / 1.0);
    const pulseL = 0.5 + 0.5 * Math.sin(2 * Math.PI * 0.25 * t);
    const pulseR = 0.5 + 0.5 * Math.sin(2 * Math.PI * 0.25 * t + Math.PI * 0.5);
    const sub = Math.sin(2 * Math.PI * f0 * t) * 0.65;
    const h2 = Math.sin(2 * Math.PI * (f0 * 2) * t) * 0.22;
    const h3 = Math.sin(2 * Math.PI * (f0 * 3) * t) * 0.12;
    const noise = (Math.random() * 2 - 1) * 0.03;
    l[i] = (sub + h2 * 0.8 + h3 + noise) * env * pulseL * 0.75;
    r[i] = (sub + h2 * 1.2 + h3 + noise) * env * pulseR * 0.75;
  }
  writeFileSync(path.join(OUT_DIR, 'plasma_conduit_hum.wav'), encodeWav24(l, r));
  console.log('generated plasma_conduit_hum.wav');
}

// 2. Thermal Rupture (Catastrophic cryo-venting rupture at 11.98s phase collapse)
{
  const dur = 3.5;
  const n = Math.round(dur * SR);
  const l = new Float32Array(n);
  const r = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const subPitch = 95.0 * Math.exp(-t * 6.0) + 38.0;
    const sub = Math.sin(2 * Math.PI * subPitch * t) * Math.exp(-t * 3.5) * 0.9;
    const hiss = (Math.random() * 2 - 1) * Math.exp(-t * 1.8) * Math.min(1, t * 150) * 0.45;
    const crackle = (Math.random() > 0.985 ? (Math.random() * 2 - 1) * 0.7 : 0) * Math.exp(-t * 4.0);
    l[i] = (sub * 0.9 + hiss * 0.85 + crackle) * 0.85;
    r[i] = (sub * 0.9 + hiss * 1.15 + crackle * 0.7) * 0.85;
  }
  writeFileSync(path.join(OUT_DIR, 'thermal_rupture.wav'), encodeWav24(l, r));
  console.log('generated thermal_rupture.wav');
}

// 3. Pre-Drop Vacuum (Reverse acoustic vacuum sucking energy inward before drop 21.57s)
{
  const dur = 2.4;
  const n = Math.round(dur * SR);
  const l = new Float32Array(n);
  const r = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const u = t / dur; // 0 to 1
    const env = Math.pow(u, 2.5); // exponential rise
    const sweepHz = 40.0 + Math.pow(u, 3.0) * 450.0;
    const tone = Math.sin(2 * Math.PI * sweepHz * t) * 0.45;
    const noise = (Math.random() * 2 - 1) * 0.35 * Math.sin(2 * Math.PI * 4.0 * t);
    l[i] = (tone + noise) * env * 0.8;
    r[i] = (tone - noise) * env * 0.8;
  }
  writeFileSync(path.join(OUT_DIR, 'pre_drop_vacuum.wav'), encodeWav24(l, r));
  console.log('generated pre_drop_vacuum.wav');
}

// 4. Singularity Impact 808 (Bone-shattering sub impact + metallic crunch on drop 21.57s)
{
  const dur = 4.2;
  const n = Math.round(dur * SR);
  const l = new Float32Array(n);
  const r = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const f0 = 120.0 * Math.exp(-t * 14.0) + 32.0;
    const sub = Math.sin(2 * Math.PI * f0 * t) * Math.exp(-t * 1.4) * 0.95;
    const crunch = (Math.random() * 2 - 1) * Math.exp(-t * 22.0) * 0.55;
    const clang = Math.sin(2 * Math.PI * 440.0 * t) * Math.exp(-t * 8.0) * 0.25;
    l[i] = (sub + crunch * 0.9 + clang * 0.8) * 0.9;
    r[i] = (sub + crunch * 1.1 + clang * 1.2) * 0.9;
  }
  writeFileSync(path.join(OUT_DIR, 'singularity_impact_808.wav'), encodeWav24(l, r));
  console.log('generated singularity_impact_808.wav');
}

// 5. Dielectric Shimmer (4kHz crystal resonance tail holding across macro inspection)
{
  const dur = 5.2;
  const n = Math.round(dur * SR);
  const l = new Float32Array(n);
  const r = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const env = Math.min(1, t * 15) * Math.exp(-t * 0.7);
    const p1 = Math.sin(2 * Math.PI * 3420 * t);
    const p2 = Math.sin(2 * Math.PI * 4180 * t);
    const p3 = Math.sin(2 * Math.PI * 5220 * t);
    const beat = 0.5 + 0.5 * Math.sin(2 * Math.PI * 1.8 * t);
    l[i] = (p1 * 0.4 + p2 * 0.35 + p3 * 0.25) * env * beat * 0.45;
    r[i] = (p1 * 0.35 + p2 * 0.4 + p3 * 0.25) * env * (1 - beat) * 0.45;
  }
  writeFileSync(path.join(OUT_DIR, 'dielectric_shimmer.wav'), encodeWav24(l, r));
  console.log('generated dielectric_shimmer.wav');
}
