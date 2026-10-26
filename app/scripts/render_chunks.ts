#!/usr/bin/env bun
// Per-act chunked render: renders each {name,from,to} range as its own video-only file (one browser session per chunk,
// so a crash costs one chunk), joins them with ffmpeg concat (stream copy), verifies frame counts, then builds the master audio.
//   bun scripts/render_chunks.ts --chunks chunks.json --project smoke10 --out ../out/film.mp4 [--fps 60] [--crf 16] [--scale 1]
//        [--mix mix.json [--events events.json]] [--audio file] [--work ../out/chunks] [--retries 1] [--force] [--render-args "--gpu"]
// chunks.json: { "chunks": [ { "name": "act1", "from": 0, "to": 40 }, ... ] }  (seconds; contiguous chunks must share boundaries)
// Audio: --mix runs scripts/mixdown.ts's mixdown() over [first.from, last.to] (same call render.ts --mix makes) and muxes it with
// -c:v copy; --audio muxes a single track sliced to that window; neither gives a silent master.
import { existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const opt = (k: string, d?: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 && argv[i + 1] && !argv[i + 1]!.startsWith('--') ? argv[i + 1]! : d; };
const flag = (k: string) => argv.includes(`--${k}`);
const APP = path.resolve(import.meta.dir, '..');
const ROOT = path.resolve(APP, '..');
const abs = (p: string) => (path.isAbsolute(p) ? p : path.resolve(process.cwd(), p));

const chunksPath = opt('chunks');
if (!chunksPath) { console.error('usage: bun scripts/render_chunks.ts --chunks chunks.json --out film.mp4 [--project id] [--fps 60] [--mix mix.json]'); process.exit(2); }
const spec = await Bun.file(abs(chunksPath)).json() as { chunks: { name: string; from: number; to: number }[] };
const fps = +(opt('fps', '60')!);
const out = abs(opt('out', path.join(ROOT, 'out/film.mp4'))!);
const work = abs(opt('work', path.join(path.dirname(out), 'chunks'))!);
const project = opt('project');
const retries = +(opt('retries', '1')!);
mkdirSync(work, { recursive: true });

const frames = (c: { from: number; to: number }) => Math.round(c.to * fps) - Math.round(c.from * fps);
for (let i = 0; i < spec.chunks.length; i++) {
  const c = spec.chunks[i]!;
  if (!(c.to > c.from)) throw new Error(`chunk ${c.name}: to <= from`);
  const prev = spec.chunks[i - 1];
  if (prev && Math.round(prev.to * fps) !== Math.round(c.from * fps)) throw new Error(`chunks ${prev.name} and ${c.name} are not contiguous (gap/overlap would desync the audio)`);
}

async function exec(cmd: string[], cwd?: string) {
  const p = Bun.spawn(cmd, { cwd, stdout: 'pipe', stderr: 'pipe' });
  const [o, e] = await Promise.all([new Response(p.stdout).text(), new Response(p.stderr).text(), p.exited]);
  if (p.exitCode !== 0) throw new Error(`${cmd.slice(0, 3).join(' ')} failed (${p.exitCode}): ${e.slice(-500)}`);
  return o.trim();
}
const countFrames = async (f: string) => +(await exec(['ffprobe', '-v', 'error', '-count_frames', '-select_streams', 'v:0', '-show_entries', 'stream=nb_read_frames', '-of', 'csv=p=0', f]));
const durationOf = async (f: string, stream = 'v:0') => +(await exec(['ffprobe', '-v', 'error', '-select_streams', stream, '-show_entries', 'stream=duration', '-of', 'csv=p=0', f]));

const files: string[] = [];
for (const c of spec.chunks) {
  const file = path.join(work, `${c.name}.mp4`);
  files.push(file);
  const want = frames(c);
  if (existsSync(file) && !flag('force')) {
    try {
      const got = await countFrames(file);
      if (got === want) { console.log(`[chunks] ${c.name}: exists (${got} frames), skipping`); continue; }
      console.warn(`[chunks] ${c.name}: existing file has ${got} frames, expected ${want}; re-rendering`);
    } catch { console.warn(`[chunks] ${c.name}: existing file unreadable; re-rendering`); }
  }
  const part = path.join(work, `${c.name}.part.mp4`);
  const args = ['bun', 'scripts/render.ts', 'video', '--noaudio', '--from', String(c.from), '--to', String(c.to), '--fps', String(fps), '--out', part];
  if (project) args.push('--project', project);
  for (const k of ['crf', 'scale', 'samples', 'shutter', 'url']) { const v = opt(k); if (v !== undefined) args.push(`--${k}`, v); }
  const extra = opt('render-args'); if (extra) args.push(...extra.split(/\s+/).filter(Boolean));
  let ok = false;
  for (let attempt = 0; attempt <= retries && !ok; attempt++) {
    console.log(`[chunks] ${c.name}: rendering ${c.from}-${c.to}s (${want} frames)${attempt ? ` retry ${attempt}` : ''}`);
    rmSync(part, { force: true });
    const p = Bun.spawn(args, { cwd: APP, stdout: 'inherit', stderr: 'pipe' });
    const [err] = await Promise.all([new Response(p.stderr).text(), p.exited]);
    process.stderr.write(err);
    const sceneErrors = /SCENE ERRORS:|BROWSER LOG:\\n\\[pageerror\\]/.test(err);
    if (sceneErrors) console.error(`[chunks] ${c.name}: scene errors reported by the render, treating as failed`);
    try { ok = p.exitCode === 0 && !sceneErrors && (await countFrames(part)) === want; } catch { ok = false; }
  }
  if (!ok) throw new Error(`chunk ${c.name} failed after ${retries + 1} attempts; rerun to resume (finished chunks are kept)`);
  renameSync(part, file);
}

const list = path.join(work, 'concat.txt');
writeFileSync(list, files.map((f) => `file '${f.replace(/\\/g, '/')}'`).join('\n') + '\n');
const joined = path.join(work, 'joined.video.mp4');
await exec(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', joined]);

const sumFrames = spec.chunks.reduce((s, c) => s + frames(c), 0);
const perChunk = await Promise.all(files.map(countFrames));
const joinedFrames = await countFrames(joined);
const sumDur = (await Promise.all(files.map((f) => durationOf(f)))).reduce((a, b) => a + b, 0);
const joinedDur = await durationOf(joined);
console.log(`[chunks] frames per chunk ${perChunk.join('+')} = ${perChunk.reduce((a, b) => a + b, 0)}; expected ${sumFrames}; joined ${joinedFrames}`);
console.log(`[chunks] duration sum ${sumDur.toFixed(4)}s, joined ${joinedDur.toFixed(4)}s`);
if (joinedFrames !== sumFrames || perChunk.reduce((a, b) => a + b, 0) !== sumFrames) throw new Error('frame count mismatch after join (duplicate or dropped frames)');
if (Math.abs(joinedDur - sumDur) > 1 / fps) throw new Error('joined duration differs from the sum of chunk durations');

const t0 = spec.chunks[0]!.from, t1 = spec.chunks[spec.chunks.length - 1]!.to;
const mixPath = opt('mix'), audioArg = opt('audio');
if (mixPath) {
  const { mixdown } = await import('./mixdown');
  const wav = path.join(work, 'master.mix.wav');
  await mixdown({ mix: abs(mixPath), events: opt('events') ? abs(opt('events')!) : null, from: t0, to: t1, out: wav });
  const vdur = ((Math.round(t1 * fps) - Math.round(t0 * fps)) / fps).toFixed(6);
  await exec(['ffmpeg', '-y', '-loglevel', 'error', '-i', joined, '-i', wav, '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-af', `apad=whole_dur=${vdur},atrim=duration=${vdur}`, '-c:a', 'aac', '-b:a', '320k', '-t', vdur, '-movflags', '+faststart', out]);
} else if (audioArg) {
  const vdur = ((Math.round(t1 * fps) - Math.round(t0 * fps)) / fps).toFixed(6);
  await exec(['ffmpeg', '-y', '-loglevel', 'error', '-i', joined, '-ss', String(t0), '-t', vdur, '-i', abs(audioArg), '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '320k', '-t', vdur, '-movflags', '+faststart', out]);
} else {
  renameSync(joined, out);
}
if (existsSync(joined)) rmSync(joined, { force: true });
const outFrames = await countFrames(out);
const outV = await durationOf(out);
const hasAudio = (await exec(['ffprobe', '-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=codec_name', '-of', 'csv=p=0', out])).length > 0;
console.log(`[chunks] wrote ${out}: ${outFrames} frames, video ${outV.toFixed(4)}s${hasAudio ? `, audio ${(await durationOf(out, 'a:0')).toFixed(4)}s` : ', no audio'}`);
if (outFrames !== sumFrames) throw new Error(`master has ${outFrames} frames, expected ${sumFrames}`);
