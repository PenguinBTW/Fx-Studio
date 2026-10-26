import { recipes, renderCue, spectralCentroid, SR, fft } from "./synth";

let fails = 0;
const check = (ok: boolean, msg: string) => {
  if (!ok) {
    fails++;
    console.log(`  FAIL ${msg}`);
  }
};
const db = (v: number) => (v > 0 ? 20 * Math.log10(v) : -Infinity);

console.log("recipe".padEnd(16), "dur(s)".padStart(7), "peak dB".padStart(8), "rms dB".padStart(8), "centroid Hz".padStart(12));
const cent: Record<string, number> = {};
for (const name of Object.keys(recipes)) {
  const cue = { id: name, recipe: name, params: {}, seed: 7 };
  const a = renderCue(cue);
  const b = renderCue(cue);
  check(a.wav.equals(b.wav), `${name}: not byte-identical`);
  const w = a.wav;
  check(w.toString("ascii", 0, 4) === "RIFF" && w.toString("ascii", 8, 12) === "WAVE", `${name}: bad RIFF/WAVE`);
  check(w.readUInt16LE(20) === 1 && w.readUInt16LE(22) === 2 && w.readUInt32LE(24) === SR && w.readUInt16LE(34) === 24, `${name}: bad fmt`);
  check(w.readUInt32LE(40) === w.length - 44 && w.readUInt32LE(4) === w.length - 8, `${name}: bad sizes`);
  let nan = false;
  for (let i = 0; i < a.audio.l.length; i++) if (!Number.isFinite(a.audio.l[i]) || !Number.isFinite(a.audio.r[i])) { nan = true; break; }
  check(!nan, `${name}: NaN/Inf`);
  check(a.peak <= 1 - 1e-6, `${name}: peak ${a.peak} clips`);
  if (name === "voidSilence") {
    check(a.peak === 0 && w.subarray(44).every((x) => x === 0), "voidSilence not exact zeros");
  } else {
    check(a.peak > 1e-4, `${name}: silent`);
  }
  const c = a.peak > 0 ? spectralCentroid(a.audio) : 0;
  cent[name] = c;
  console.log(name.padEnd(16), (a.audio.l.length / SR).toFixed(2).padStart(7), db(a.peak).toFixed(1).padStart(8), db(a.rms).toFixed(1).padStart(8), c.toFixed(0).padStart(12));
}

const seedDiff = renderCue({ id: "x", recipe: "rain", params: {}, seed: 1 }).wav.equals(renderCue({ id: "x", recipe: "rain", params: {}, seed: 2 }).wav);
check(!seedDiff, "different seeds give identical output");

check(cent.subHit < 200, `subHit centroid ${cent.subHit.toFixed(0)} Hz should be < 200`);
check(cent.shimmer > 2000, `shimmer centroid ${cent.shimmer.toFixed(0)} Hz should be > 2000`);
check(cent.airSwell < 1500, `airSwell centroid ${cent.airSwell.toFixed(0)} Hz should be < 1500`);
check(cent.thrum < 200, `thrum centroid ${cent.thrum.toFixed(0)} Hz should be < 200`);
check(cent.click > 2000, `click centroid ${cent.click.toFixed(0)} Hz should be > 2000`);

{
  const re = new Float64Array(8), im = new Float64Array(8);
  re[1] = 1;
  fft(re, im);
  fft(re, im, true);
  check(Math.abs(re[1] - 1) < 1e-12 && Math.abs(re[0]) < 1e-12, "fft round trip");
}

console.log(fails ? `\n${fails} FAILURE(S)` : "\nall SFX synth checks passed");
process.exit(fails ? 1 : 0);
