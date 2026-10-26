import argparse
import json
import math
import sys

USAGE_EXAMPLE = (
    "python scripts/analyze_song.py --audio song/track.mp3 --out app/public/data/audio.json "
    "[--duration S --start S --offset S] [--tempo-overrides tempo_overrides.json] [--verify]"
)

SILENCE_DB = -60.0
SILENCE_MIN_S = 0.5
ENV_FPS = 100
FAST_FPS = 60
BEATS_PER_BAR = 4
BPM_LO, BPM_HI = 80.0, 160.0


def load_overrides(path):
    if not path:
        return None
    with open(path, 'r') as f:
        data = json.load(f)
    if not isinstance(data, dict) or not isinstance(data.get('segments'), list):
        raise SystemExit(f"{path}: expected {{\"segments\": [...]}} (see docs/audio/song-analysis.md)")
    for i, s in enumerate(data['segments']):
        for k in ('start', 'end', 'bpm'):
            if k not in s:
                raise SystemExit(f"{path}: segments[{i}] is missing '{k}'")
    return data


def find_silences(np, y, sr):
    """Stretches below SILENCE_DB (dBFS, 20 ms RMS) lasting at least SILENCE_MIN_S, in audio-file seconds."""
    hop = int(sr * 0.01)
    win = int(sr * 0.02)
    n = max(0, (len(y) - win) // hop + 1)
    sq = y.astype(np.float64) ** 2
    cs = np.concatenate([[0.0], np.cumsum(sq)])
    idx = np.arange(n) * hop
    rms = np.sqrt((cs[idx + win] - cs[idx]) / win)
    db = 20 * np.log10(np.maximum(rms, 1e-10))
    quiet = db < SILENCE_DB
    out = []
    i = 0
    while i < n:
        if quiet[i]:
            j = i
            while j < n and quiet[j]:
                j += 1
            s, e = i * 0.01, j * 0.01 + 0.02
            if j == n:
                e = len(y) / sr
            if e - s >= SILENCE_MIN_S:
                out.append([round(s, 3), round(e, 3)])
            i = j
        else:
            i += 1
    return out


def fit_grid(np, times):
    """Least-squares beat grid (phase, period) through detected beat times."""
    k = np.arange(len(times))
    period, phase = np.polyfit(k, times, 1)
    return float(phase), float(period)


def build_tempo_map(np, librosa, y, onset_env, sr, hop, silences, duration, global_bpm, overrides):
    """Piecewise regular beat grids over each non-silent stretch. Returns (segments, beats, downbeats)."""
    seg_bounds = []
    cur = 0.0
    for s, e in silences:
        if s - cur > 1.0:
            seg_bounds.append((cur, s))
        cur = e
    if duration - cur > 1.0:
        seg_bounds.append((cur, duration))

    segments = []
    frame_t = librosa.frames_to_time(np.arange(len(onset_env)), sr=sr, hop_length=hop)
    loudness = librosa.feature.rms(y=y, frame_length=2048, hop_length=hop)[0][:len(onset_env)]
    loudness = loudness / (float(np.percentile(loudness, 98)) + 1e-9)

    def downbeat_phase(beats):
        strengths = np.zeros(len(beats))
        for off in np.arange(0.0, 0.1, 0.02):
            strengths = np.maximum(strengths, np.interp(beats + off, frame_t, loudness))
        best, best_score = 0, -1.0
        for p in range(BEATS_PER_BAR):
            sc = strengths[p::BEATS_PER_BAR]
            score = float(np.mean(sc)) if len(sc) else 0.0
            if score > best_score:
                best, best_score = p, score
        return best

    for (a, b) in seg_bounds:
        i0, i1 = int(a * sr / hop), int(b * sr / hop)
        env = onset_env[i0:i1]
        if len(env) < 4 * sr / hop:
            continue
        _, bf = librosa.beat.beat_track(onset_envelope=env, sr=sr, hop_length=hop,
                                        start_bpm=global_bpm, tightness=100)
        bt = a + librosa.frames_to_time(bf, sr=sr, hop_length=hop)
        if len(bt) < 4:
            continue
        phase, period = fit_grid(np, bt)
        while 60.0 / period < BPM_LO:
            period /= 2.0
        while 60.0 / period >= BPM_HI:
            period *= 2.0
        segments.append({'start': a, 'end': b, 'bpm': 60.0 / period, 'first_beat': phase, 'bar_phase': None,
                         'source': 'auto'})

    if overrides:
        for o in overrides['segments']:
            a, b, bpm = float(o['start']), float(o['end']), float(o['bpm'])
            kept = []
            for s in segments:
                if s['end'] <= a or s['start'] >= b:
                    kept.append(s)
                    continue
                if s['start'] < a:
                    kept.append({**s, 'end': a})
                if s['end'] > b:
                    kept.append({**s, 'start': b})
            first = o.get('first_beat')
            if first is None:
                period = 60.0 / bpm
                i0, i1 = int(a * sr / hop), int(b * sr / hop)
                env = onset_env[i0:i1]
                cand = np.arange(0.0, period, 0.005)
                ts = np.arange(0.0, b - a, period)
                scores = [float(np.sum(np.interp(a + c + ts, frame_t, onset_env))) for c in cand]
                first = a + float(cand[int(np.argmax(scores))])
            kept.append({'start': a, 'end': b, 'bpm': bpm, 'first_beat': float(first),
                         'bar_phase': o.get('bar_phase'), 'source': 'override'})
            segments = kept
        segments.sort(key=lambda s: s['start'])

    beats, downbeats = [], []
    for s in segments:
        period = 60.0 / s['bpm']
        k0 = math.ceil((s['start'] - s['first_beat']) / period - 1e-6)
        bt = []
        k = k0
        while s['first_beat'] + k * period < s['end'] - 1e-6:
            bt.append(s['first_beat'] + k * period)
            k += 1
        if not bt:
            continue
        bt = np.array(bt)
        if s['bar_phase'] is not None:
            p = int(s['bar_phase']) % BEATS_PER_BAR
        else:
            p = downbeat_phase(bt)
        s['bar_phase'] = p
        for i, t in enumerate(bt):
            beats.append(float(t))
            if i % BEATS_PER_BAR == p:
                downbeats.append(float(t))
    return segments, beats, downbeats


def detect_sections(np, y, sr, silences, duration, downbeats):
    """Silence spans plus novelty boundaries on a slow energy/brightness curve, snapped to downbeats."""
    import librosa
    import scipy.signal as signal
    hop = int(sr * 0.25)
    rms = librosa.feature.rms(y=y, frame_length=hop * 2, hop_length=hop)[0]
    db = 20 * np.log10(np.maximum(rms, 1e-6))
    cent = librosa.feature.spectral_centroid(y=y, sr=sr, n_fft=hop * 2, hop_length=hop)[0]
    n = min(len(db), len(cent))
    db, cent = db[:n], cent[:n]
    live = db > SILENCE_DB
    feat = np.stack([np.clip(db, -60, 0) / 20.0, np.log2(np.maximum(cent, 50)) / 2.0])
    w = 16
    nov = np.zeros(n)
    for i in range(w, n - w):
        a = feat[:, i - w:i]
        b = feat[:, i:i + w]
        if not (live[i - w:i].all() and live[i:i + w].all()):
            continue
        nov[i] = float(np.linalg.norm(a.mean(axis=1) - b.mean(axis=1)))
    peaks, _ = signal.find_peaks(nov, height=max(0.35, float(np.percentile(nov[nov > 0], 75)) if (nov > 0).any() else 1.0),
                                 distance=int(8 / 0.25))
    cuts = []
    db_arr = np.array(downbeats) if len(downbeats) else None
    for p in peaks:
        t = p * 0.25
        if db_arr is not None:
            near = float(db_arr[int(np.argmin(np.abs(db_arr - t)))])
            if abs(near - t) < 2.0:
                t = near
        cuts.append(t)
    bounds = [0.0]
    sil = []
    for s, e in silences:
        sil.append((s, e))
        bounds += [s, e]
    bounds += cuts + [duration]
    bounds = sorted(set(round(b, 3) for b in bounds if 0.0 <= b <= duration))
    merged = [bounds[0]]
    for b in bounds[1:]:
        if b - merged[-1] >= 1.0 or b == duration:
            merged.append(b)
    if merged[-1] != duration:
        merged.append(duration)

    out = []
    live_db = db[live] if live.any() else db
    lo, hi = np.percentile(live_db, 33), np.percentile(live_db, 80)
    for a, b in zip(merged[:-1], merged[1:]):
        if b <= a:
            continue
        mid = (a + b) / 2
        if any(s - 0.05 <= mid <= e + 0.05 for s, e in sil):
            kind = 'silence'
        else:
            i0, i1 = int(a / 0.25), max(int(a / 0.25) + 1, int(b / 0.25))
            seg = db[i0:i1]
            m = float(np.mean(seg)) if len(seg) else -90.0
            slope = 0.0
            if len(seg) > 8:
                slope = float(np.polyfit(np.arange(len(seg)) * 0.25, seg, 1)[0]) * 10.0
            if slope > 3.0:
                kind = 'build'
            elif m >= hi:
                kind = 'peak'
            elif m <= lo:
                kind = 'quiet'
            else:
                kind = 'body'
        if out and out[-1]['kind'] == kind and kind == 'silence':
            out[-1]['end'] = round(b, 3)
        else:
            out.append({'start': round(a, 3), 'end': round(b, 3), 'kind': kind})
    return out


def analyze(audio_path, out_path, timeline_duration=None, timeline_audio_start=0.0, song_offset=0.0,
            tempo_overrides=None, verify=False):
    try:
        import numpy as np
        import scipy.signal as signal
        import librosa
    except ImportError as e:
        raise SystemExit(f"Missing required audio analysis dependency ({e.name}). "
                         "Install: pip install numpy scipy librosa soundfile")

    print(f"Loading {audio_path}...")
    sr = 22050
    y, sr = librosa.load(audio_path, sr=sr, mono=True)
    raw_duration = len(y) / sr
    print(f"Loaded raw audio: {raw_duration:.2f}s at {sr}Hz")
    if timeline_duration is None:
        timeline_duration = raw_duration - song_offset + timeline_audio_start
    timeline_duration = float(timeline_duration)

    fps = ENV_FPS
    n_frames = int(timeline_duration * fps)
    hop = 512

    def to_tl(t_song):
        return timeline_audio_start + (t_song - song_offset)

    def span_to_tl(a, b):
        a2, b2 = to_tl(a), to_tl(b)
        a2, b2 = max(a2, 0.0), min(b2, timeline_duration)
        return [round(a2, 3), round(b2, 3)] if b2 > a2 else None

    silences_song = find_silences(np, y, sr)

    onset_env = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop)
    tempo, _ = librosa.beat.beat_track(y=y, sr=sr, onset_envelope=onset_env, hop_length=hop)
    bpm = float(np.atleast_1d(tempo)[0])
    while bpm < BPM_LO:
        bpm *= 2.0
    while bpm >= BPM_HI:
        bpm /= 2.0

    segs, beat_song, down_song = build_tempo_map(np, librosa, y, onset_env, sr, hop, silences_song, raw_duration, bpm,
                                                 tempo_overrides)
    if segs:
        bpm = float(np.median([s['bpm'] for s in segs]))
    print(f"BPM (median): {bpm:.2f}, {len(segs)} tempo segment(s), {len(beat_song)} beats, {len(down_song)} downbeats")

    def b_lp(c): return signal.butter(4, c / (0.5 * sr), btype='low')
    def b_bp(lo, hi): return signal.butter(4, [lo / (0.5 * sr), min(0.999, hi / (0.5 * sr))], btype='band')
    def b_hp(c): return signal.butter(4, c / (0.5 * sr), btype='high')

    y_low = signal.filtfilt(*b_lp(250), y)
    y_mid = signal.filtfilt(*b_bp(250, 3000), y)
    y_high = signal.filtfilt(*b_hp(3000), y)

    def compute_envelope(x, rate=ENV_FPS, normalise=True):
        h = int(sr / rate)
        win = int(sr * 0.04)
        n = max(0, (len(x) - win) // h)
        sq = np.concatenate([[0.0], np.cumsum(x.astype(np.float64) ** 2)])
        idx = np.arange(n) * h
        frames = np.sqrt((sq[idx + win] - sq[idx]) / win)
        if normalise and len(frames):
            p = np.percentile(frames, 98)
            if p > 1e-6:
                frames = np.clip(frames / p, 0.0, 1.0)
        return frames

    def smooth(arr, attack=0.015, release=0.08):
        aa = math.exp(-1.0 / (attack * fps))
        ar = math.exp(-1.0 / (release * fps))
        out = np.zeros_like(arr)
        s = 0.0
        for i, v in enumerate(arr):
            a = aa if v > s else ar
            s = a * s + (1.0 - a) * v
            out[i] = s
        return out

    env_rms = smooth(compute_envelope(y))
    env_low = smooth(compute_envelope(y_low))
    env_mid = smooth(compute_envelope(y_mid))
    env_high = smooth(compute_envelope(y_high))

    def to_timeline(env):
        tl = np.zeros(n_frames, dtype=np.float32)
        start_frame = int(timeline_audio_start * fps)
        off = int(song_offset * fps)
        for i in range(start_frame, n_frames):
            si = (i - start_frame) + off
            if 0 <= si < len(env):
                tl[i] = env[si]
        return tl

    rms_tl, low_tl, mid_tl, high_tl = (to_timeline(e) for e in (env_rms, env_low, env_mid, env_high))

    # 60 Hz continuous envelopes on the timeline
    n_fast = int(timeline_duration * FAST_FPS)
    fast_hop = int(sr / FAST_FPS)
    fast_rms_raw = compute_envelope(y, FAST_FPS, normalise=False)
    p98 = np.percentile(fast_rms_raw, 98) if len(fast_rms_raw) else 0.0
    fast_rms_n = np.clip(fast_rms_raw / p98, 0, 1) if p98 > 1e-6 else fast_rms_raw
    cent = librosa.feature.spectral_centroid(y=y, sr=sr, n_fft=2048, hop_length=fast_hop)[0]
    cent_n = np.clip(cent / 8000.0, 0, 1)
    live_mask = (fast_rms_raw > 10 ** (SILENCE_DB / 20)).astype(float)
    m = min(len(cent_n), len(live_mask))
    cent_n[:m] *= live_mask[:m]
    rms60 = np.zeros(n_fast, dtype=np.float32)
    cent60 = np.zeros(n_fast, dtype=np.float32)
    s0 = int(round(timeline_audio_start * FAST_FPS))
    o0 = int(round(song_offset * FAST_FPS))
    for i in range(s0, n_fast):
        si = (i - s0) + o0
        if 0 <= si < len(fast_rms_n):
            rms60[i] = fast_rms_n[si]
        if 0 <= si < len(cent_n):
            cent60[i] = cent_n[si]

    # Onsets
    def detect_onsets(env, threshold=0.35, min_dist=15):
        peaks, props = signal.find_peaks(env, height=threshold, distance=min_dist)
        return [(round(float(p / fps), 4), round(float(props['peak_heights'][j]), 3)) for j, p in enumerate(peaks)]

    def map_onsets(raw):
        out = []
        for t_raw, strength in raw:
            if t_raw >= song_offset:
                t = to_tl(t_raw)
                if t <= timeline_duration:
                    out.append([round(float(t), 4), strength])
        return out

    y_harm, _y_perc = librosa.effects.hpss(y)
    h_env = librosa.onset.onset_strength(y=y_harm, sr=sr, hop_length=hop)
    h_peak = float(np.percentile(h_env, 99)) if len(h_env) else 0.0
    mel_raw = []
    if h_peak > 1e-6:
        hn = h_env / h_peak
        fr = librosa.onset.onset_detect(onset_envelope=hn, sr=sr, hop_length=hop, backtrack=False,
                                        delta=0.15, wait=int(0.06 * sr / hop))
        for f in fr:
            mel_raw.append((round(float(librosa.frames_to_time(f, sr=sr, hop_length=hop)), 4),
                            round(float(min(1.0, hn[f])), 3)))
    melodic = map_onsets(mel_raw)

    onsets_tl = {
        'kick': map_onsets(detect_onsets(env_low, threshold=0.3)),
        'snare': map_onsets(detect_onsets(env_mid, threshold=0.28)),
        'hat': map_onsets(detect_onsets(env_high, threshold=0.25, min_dist=8)),
        'vonset': [],
        'melodic': melodic,
        'piano': melodic,
    }

    def tl_list(times):
        return [round(to_tl(t), 4) for t in times if 0 <= to_tl(t) <= timeline_duration]

    timeline_beats = tl_list(beat_song)
    timeline_downbeats = tl_list(down_song)
    silences_tl = [s for s in (span_to_tl(a, b) for a, b in silences_song) if s]

    sec_song = detect_sections(np, y, sr, silences_song, raw_duration, down_song)
    sections = []
    for i, s in enumerate(sec_song):
        sp = span_to_tl(s['start'], s['end'])
        if sp:
            sections.append({'name': f"{s['kind']}_{i + 1}", 'start': sp[0], 'end': sp[1], 'kind': s['kind']})

    tempo_map = []
    for s in segs:
        sp = span_to_tl(s['start'], s['end'])
        if sp:
            tempo_map.append({'start': sp[0], 'end': sp[1], 'bpm': round(s['bpm'], 3),
                              'bar_phase': s['bar_phase'], 'source': s['source']})

    out_data = {
        'duration': timeline_duration,
        'bpm': round(bpm, 2),
        'fps': fps,
        'beats': timeline_beats,
        'downbeats': timeline_downbeats,
        'sections': sections,
        'silences': silences_tl,
        'tempo_map': tempo_map,
        'features': {
            'rms': [round(float(v), 4) for v in rms_tl],
            'low': [round(float(v), 4) for v in low_tl],
            'mid': [round(float(v), 4) for v in mid_tl],
            'high': [round(float(v), 4) for v in high_tl],
            'vocal': [round(float(v), 4) for v in mid_tl],
            'drums': [round(float(v), 4) for v in (low_tl * 0.7 + high_tl * 0.3)],
            'bass': [round(float(v), 4) for v in low_tl],
            'other': [round(float(v), 4) for v in (mid_tl * 0.5 + high_tl * 0.5)],
        },
        'envelopes': {
            'fps': FAST_FPS,
            'rms': [round(float(v), 4) for v in rms60],
            'centroid': [round(float(v), 4) for v in cent60],
        },
        'onsets': onsets_tl,
    }

    with open(out_path, 'w') as f:
        json.dump(out_data, f)
    print(f"Wrote {out_path}: {len(timeline_beats)} beats, {len(timeline_downbeats)} downbeats, "
          f"{len(sections)} sections, {len(silences_tl)} silences, {len(melodic)} melodic onsets")

    if verify:
        print_verify(out_data)
    return out_data


def print_verify(d):
    print("\n--- verify (timeline seconds) ---")
    print("tempo map:")
    for s in d['tempo_map']:
        print(f"  {s['start']:8.3f} -> {s['end']:8.3f}  {s['bpm']:8.3f} bpm  bar_phase={s['bar_phase']}  [{s['source']}]")
    print("sections:")
    for s in d['sections']:
        print(f"  {s['start']:8.3f} -> {s['end']:8.3f}  {s['kind']}")
    print("silences (< %d dB):" % SILENCE_DB)
    for a, b in d['silences']:
        print(f"  {a:8.3f} -> {b:8.3f}")
    print("downbeats (bar: time, gap to previous):")
    prev = None
    for i, t in enumerate(d['downbeats']):
        gap = f"{t - prev:6.3f}" if prev is not None else "     -"
        print(f"  bar {i + 1:3d}: {t:9.3f}  (+{gap})")
        prev = t
    print("If a downbeat is wrong, add a segment to tempo_overrides.json (first_beat / bpm / bar_phase) and re-run.")


def main(argv=None):
    parser = argparse.ArgumentParser(description="Acoustic analysis pipeline for f(x) Studio.",
                                     epilog="Example: " + USAGE_EXAMPLE)
    parser.add_argument('--audio', type=str, help='Path to input audio file (required)')
    parser.add_argument('--out', type=str, help='Output JSON path (required)')
    parser.add_argument('--duration', type=float, default=None,
                        help='Total video timeline duration in seconds (default: audio length mapped through --start/--offset)')
    parser.add_argument('--start', type=float, default=0.0, help='Timeline time at which the audio begins (default 0)')
    parser.add_argument('--offset', type=float, default=0.0, help='Offset into the audio file that plays at --start (default 0)')
    parser.add_argument('--tempo-overrides', type=str, default=None, help='tempo_overrides.json (see docs/audio/song-analysis.md)')
    parser.add_argument('--verify', action='store_true', help='Print tempo map, sections, silences and downbeat times')
    args = parser.parse_args(argv)
    if not args.audio or not args.out:
        parser.print_usage(sys.stderr)
        print("error: --audio and --out are required. Example:\n  " + USAGE_EXAMPLE, file=sys.stderr)
        raise SystemExit(2)
    analyze(args.audio, args.out, args.duration, args.start, args.offset,
            load_overrides(args.tempo_overrides), args.verify)


if __name__ == '__main__':
    main()
