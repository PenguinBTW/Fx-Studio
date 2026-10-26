#!/usr/bin/env bun
// Self-test for events.ts + mixdown.ts + scripts/verify_audio.py.
//   bun scripts/test_mixdown.ts
// Builds synthetic sine stems and a tiny mix.json in a temp dir, resolves events from a fake project,
// mixes, runs the verifier (LUFS, true peak, exact-zero Void interval, +-1 frame cues), and muxes
// through ExportPipeline to check the explicit pad/trim (no -shortest) path.
import path from 'node:path';
import { mkdtempSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { mixdown, writeWav, applyGate, type MixManifest } from './mixdown';
import { resolveEvents, EventRegistry } from '../src/engine/events';
import { ExportPipeline } from '../src/engine/export';

const SR = 48000;
const ROOT = path.resolve(import.meta.dir, '..', '..');
let failed = 0;
const assert = (ok: boolean, msg: string) => { console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${msg}`); if (!ok) failed++; };

function sine(dur: number, hz: number, amp: number, lead = 0, attack = 0.0005): Float32Array {
  const n = Math.round(dur * SR);
  const o = new Float32Array(n * 2);
  const l = Math.round(lead * SR);
  for (let i = l; i < n; i++) {
    const t = (i - l) / SR;
    const env = Math.min(1, t / attack) * Math.exp(-t * 6);
    const v = Math.sin(2 * Math.PI * hz * t) * amp * (attack > 0 ? env : 1);
    o[i * 2] = v; o[i * 2 + 1] = v;
  }
  return o;
}

const tmp = mkdtempSync(path.join(tmpdir(), 'test_mixdown-'));
try {
  console.log('events');
  const project: any = {
    project: 'selftest',
    entries: [
      { scene: 'a', id: 'a', start: 0, end: 5 },
      { scene: 'b', id: 'b', start: 4.5, end: 10 },
    ],
    transitions: [{ id: 'T4', transition: 'x', from: 'a', to: 'b', at: 4.5, dur: 0.5 }],
    events: [
      { id: 'T4.voidIn', transition: 'T4', from: 'end', offset: 0.03, snap: { tolerance: 0.05 } },
      { id: 'T4.voidOut', at: 8.0 },
      { id: 'hit.late', entry: 'b', offset: 4.0 },
    ],
  };
  const reg = new EventRegistry();
  reg.register('a', [{ id: 'a.click', local: 2.0 }]);
  const evs = resolveEvents(project, { downbeats: [5.0, 5.5] }, { fps: 60, registry: reg });
  const by = Object.fromEntries(evs.map((e) => [e.id, e]));
  assert(by['T4.voidIn']!.t === 5.0 && by['T4.voidIn']!.frame === 300, `snap to downbeat: T4.voidIn raw 5.03 -> ${by['T4.voidIn']!.t}`);
  assert(by['a.click']!.t === 2.0 && by['hit.late']!.t === 8.5, 'scene-registered and entry-relative events resolve');
  const again = JSON.stringify(resolveEvents(project, { downbeats: [5.0, 5.5] }, { fps: 60, registry: reg }));
  assert(again === JSON.stringify(evs), 'resolveEvents deterministic');
  let threw = false;
  try { resolveEvents({ ...project, events: [{ id: 'x', at: 1, entry: 'a' }] }, null, { registry: new EventRegistry() }); } catch { threw = true; }
  assert(threw, 'ambiguous anchor rejected');

  console.log('gate');
  const g = new Float32Array(20).fill(0.5);
  applyGate(g, [{ s0: 2, s1: 5 }]);
  assert(g[3] === 0.5 && g[4] === 0 && g[9] === 0 && g[10] === 0.5, 'applyGate zeroes exactly [s0,s1) with no ramp');

  console.log('mixdown');
  writeWav(path.join(tmp, 'music.wav'), sine(10, 220, 0.12, 0, 0), SR, 32);
  writeWav(path.join(tmp, 'hit.wav'), sine(0.5, 1000, 0.9, 0.05), SR, 32);
  writeWav(path.join(tmp, 'sub.wav'), sine(1.0, 45, 0.8, 0, 0.002), SR, 32);
  writeWav(path.join(tmp, 'guide.wav'), sine(0.3, 2000, 0.5), SR, 32);
  const eventsFile = path.join(tmp, 'events.json');
  writeFileSync(eventsFile, JSON.stringify({ fps: 60, events: evs }));
  const mix: MixManifest = {
    sampleRate: SR,
    stems: [
      { id: 'music', file: 'music.wav', bus: 'music', gainDb: -3, automation: [{ t: 0, gainDb: -6 }, { t: 2, gainDb: 0 }] },
      { id: 'click', file: 'hit.wav', bus: 'sfx', eventId: 'a.click', onset: 0.05, pan: -0.5 },
      { id: 'late', file: 'hit.wav', bus: 'sfx', eventId: 'hit.late', onset: 0.05 },
      { id: 'inside', file: 'hit.wav', bus: 'sfx', at: 6.5 },
      { id: 'boom', file: 'sub.wav', bus: 'sub', at: 5.9 },
      { id: 'tick', file: 'guide.wav', bus: 'foley_guide', eventId: 'a.click' },
    ],
    duck: { cues: ['click', 'late'], amountDb: 4.5, attack: 0.02, release: 0.4 },
    mutes: [{ id: 'void', fromEvent: 'T4.voidIn', toEvent: 'T4.voidOut' }],
    master: { lufs: -14, truePeak: -1 },
    foleyGuide: { out: 'guide_only.wav' },
  };
  writeFileSync(path.join(tmp, 'mix.json'), JSON.stringify(mix));
  const out = path.join(tmp, 'mix.wav');
  const rep = await mixdown({ mix: path.join(tmp, 'mix.json'), events: eventsFile, from: 0, to: 10, out, log: () => {} });
  assert(rep.samples === 10 * SR, `output length ${rep.samples} samples == video duration`);
  assert(rep.mutes.length === 1 && rep.mutes[0]!.s0 === 5 * SR && rep.mutes[0]!.s1 === 8 * SR, 'void interval 5.0-8.0 resolved from events');
  assert(existsSync(path.join(tmp, 'guide_only.wav')), 'foley_guide-only output written');

  console.log('verify_audio.py');
  const py = process.platform === 'win32' ? 'python' : 'python3';
  const v = Bun.spawnSync([py, path.join(ROOT, 'scripts/verify_audio.py'), out, '--report', path.join(tmp, 'mix.mix_report.json'), '--events', eventsFile, '--cue-threshold', '0.3'], { stdout: 'pipe', stderr: 'pipe' });
  console.log(v.stdout.toString().split('\n').map((l) => '    ' + l).join('\n').trimEnd());
  if (v.stderr.length) console.log(v.stderr.toString());
  assert(v.exitCode === 0, 'verifier exits 0 (LUFS -14 +-1, TP <= -1, void exactly 0, cues within 1 frame)');
  const gv = Bun.spawnSync([py, path.join(ROOT, 'scripts/verify_audio.py'), path.join(tmp, 'guide_only.wav'), '--no-loudness', '--mute', '5', '8'], { stdout: 'pipe', stderr: 'pipe' });
  assert(gv.exitCode === 0, 'foley-only file verifies (void zero)');

  console.log('mux (no -shortest, explicit pad)');
  const base = { format: 'mp4' as const, outPath: path.join(tmp, 'v.mp4'), width: 320, height: 240, fps: 30 as const, from: 0, to: 12 };
  const legacy = ExportPipeline.buildFFmpegArgs({ ...base, audioTrack: 'a.mp3' });
  assert(legacy.includes('-shortest') && legacy.includes('-ss'), 'legacy single-track args unchanged (-ss/-t/-shortest)');
  const mixed = ExportPipeline.buildFFmpegArgs({ ...base, audioTrack: out, audioMixed: true });
  assert(!mixed.includes('-shortest') && mixed.includes('-af'), 'mixed args use apad/atrim, no -shortest');
  const args = ExportPipeline.buildFFmpegArgs({ ...base, audioTrack: out, audioMixed: true });
  const ff = Bun.spawn(args, { stdin: 'pipe', stdout: 'ignore', stderr: 'pipe' });
  const frame = new Uint8Array(320 * 240 * 4).fill(40);
  for (let i = 0; i < 360; i++) ff.stdin.write(frame);
  await ff.stdin.end();
  await ff.exited;
  const probe = (s: string) => Number(Bun.spawnSync(['ffprobe', '-v', 'error', '-select_streams', s, '-show_entries', 'stream=duration', '-of', 'csv=p=0', base.outPath]).stdout.toString().trim());
  const vd = probe('v:0'), ad = probe('a:0');
  assert(Math.abs(vd - ad) < 0.06 && vd > 11.9, `10 s mix padded to 12 s video: video ${vd}s audio ${ad}s`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
console.log(failed ? `\n${failed} FAILED` : '\nALL PASS');
process.exit(failed ? 1 : 0);
