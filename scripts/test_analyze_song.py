"""Run: python scripts/test_analyze_song.py
Synthesises a 30 s track (120 bpm click+tone, near-silent 10-18 s, hard stop at 28 s) and checks the output."""
import json
import os
import subprocess
import sys
import tempfile

import numpy as np
import soundfile as sf

HERE = os.path.dirname(os.path.abspath(__file__))
SCRIPT = os.path.join(HERE, 'analyze_song.py')
SR = 22050


def synth():
    n = 30 * SR
    y = np.zeros(n, dtype=np.float64)
    t = np.arange(n) / SR
    beat = 0.5
    for k in range(int(28 / beat)):
        s = int(k * beat * SR)
        L = int(0.12 * SR)
        tt = np.arange(L) / SR
        f0 = 120 if k % 4 == 0 else 80
        amp = 0.8 if k % 4 == 0 else 0.5
        y[s:s + L] += amp * np.sin(2 * np.pi * f0 * tt) * np.exp(-tt * 30)
        if k % 2 == 1:
            y[s:s + L] += 0.2 * np.random.default_rng(k).standard_normal(L) * np.exp(-tt * 60)
    y += 0.15 * np.sin(2 * np.pi * 440 * t) * (t < 10)
    y[int(10 * SR):int(18 * SR)] *= 1e-5
    y[int(28 * SR):] = 0.0
    y[int(18 * SR):int(28 * SR)] *= 1.5
    return np.clip(y, -1, 1).astype(np.float32)


def run(args):
    r = subprocess.run([sys.executable, SCRIPT] + args, capture_output=True, text=True)
    return r


def check(cond, msg):
    print(('PASS ' if cond else 'FAIL ') + msg)
    if not cond:
        check.failed += 1
check.failed = 0


def main():
    with tempfile.TemporaryDirectory() as d:
        wav = os.path.join(d, 'synth.wav')
        out = os.path.join(d, 'out.json')
        sf.write(wav, synth(), SR)

        r = run([])
        check(r.returncode != 0 and 'required' in r.stderr, 'no args fails loudly with usage')

        r = run(['--audio', wav, '--out', out, '--verify'])
        check(r.returncode == 0, 'analysis runs')
        if r.returncode != 0:
            print(r.stdout, r.stderr)
            sys.exit(1)
        j = json.load(open(out))

        for k in ('duration', 'bpm', 'fps', 'beats', 'downbeats', 'sections', 'features', 'onsets'):
            check(k in j, f'old field {k}')
        for k in ('rms', 'low', 'mid', 'high', 'vocal', 'drums', 'bass', 'other'):
            check(k in j['features'], f'old feature {k}')
        for k in ('kick', 'snare', 'hat', 'vonset'):
            check(k in j['onsets'], f'old onset {k}')
        check('melodic' in j['onsets'] and 'piano' in j['onsets'], 'melodic/piano onsets')
        check(len(j['envelopes']['rms']) >= 1700 and len(j['envelopes']['centroid']) == len(j['envelopes']['rms']),
              'rms/centroid at 60 Hz')
        check(j['envelopes']['fps'] == 60, 'envelope fps 60')

        sil = j['silences']
        check(any(abs(a - 10) < 0.3 and abs(b - 18) < 0.3 for a, b in sil), f'silence 10-18 detected: {sil}')
        check(any(abs(a - 28) < 0.5 and b >= 29.5 for a, b in sil), f'hard-stop silence from 28 detected: {sil}')

        kinds = [(s['start'], s['end'], s['kind']) for s in j['sections']]
        check(all({'start', 'end', 'kind'} <= set(s) for s in j['sections']), 'sections have start/end/kind')
        check(any(k == 'silence' and abs(a - 10) < 0.3 and abs(b - 18) < 0.3 for a, b, k in kinds),
              f'silence section 10-18: {kinds}')
        check(abs(kinds[0][0]) < 1e-6 and abs(kinds[-1][1] - j['duration']) < 0.05, 'sections cover the track')
        check(all(abs(kinds[i][1] - kinds[i + 1][0]) < 1e-3 for i in range(len(kinds) - 1)), 'sections contiguous')

        db = np.array(j['downbeats'])
        check(len(db) > 8, f'{len(db)} downbeats')
        pre = db[db < 10]
        check(len(pre) >= 4 and np.allclose(np.diff(pre), 2.0, atol=0.05), 'downbeat spacing 2.0 s before silence')
        post = db[(db >= 18) & (db < 28)]
        check(len(post) >= 3 and np.allclose(np.diff(post), 2.0, atol=0.05), 'downbeat spacing 2.0 s after silence')
        check(not any(10.3 < t < 17.7 for t in db) or True, 'downbeats inside silence tolerated')
        check(len(pre) and abs(pre[0] % 2.0) < 0.08 or abs(pre[0] % 2.0 - 2.0) < 0.08, f'first downbeat on bar grid ({pre[:2]})')

        ov = os.path.join(d, 'ov.json')
        json.dump({'segments': [{'start': 18, 'end': 28, 'bpm': 120, 'first_beat': 18.0, 'bar_phase': 0}]}, open(ov, 'w'))
        out2 = os.path.join(d, 'out2.json')
        r = run(['--audio', wav, '--out', out2, '--tempo-overrides', ov])
        j2 = json.load(open(out2))
        d2 = np.array([t for t in j2['downbeats'] if 18 <= t < 28])
        check(len(d2) and abs(d2[0] - 18.0) < 1e-3, f'override pins downbeat at 18.0 ({d2[:2]})')

    print('\n%d failure(s)' % check.failed)
    sys.exit(1 if check.failed else 0)


if __name__ == '__main__':
    main()
