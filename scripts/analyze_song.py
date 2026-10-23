import argparse
import json
import math

def analyze(audio_path='app/public/audio/no_takebacks.mp3', out_path='app/public/data/audio.json', timeline_duration=77.0, timeline_audio_start=17.0, song_offset=2.0):
    try:
        import numpy as np
        import scipy.signal as signal
        import librosa
    except ImportError as e:
        print(f"Error: Missing required audio analysis dependencies ({e.name}).")
        print("Please install them via: pip install numpy scipy librosa")
        return

    print(f"Loading {audio_path}...")
    y, sr = librosa.load(audio_path, sr=22050, mono=True)
    raw_duration = len(y) / sr
    print(f"Loaded raw audio: {raw_duration:.2f}s at {sr}Hz")

    # Tempo and beat tracking
    onset_env = librosa.onset.onset_strength(y=y, sr=sr)
    tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr, onset_envelope=onset_env)
    bpm = float(np.atleast_1d(tempo)[0])
    beat_times = librosa.frames_to_time(beat_frames, sr=sr)
    print(f"BPM: {bpm:.2f}, found {len(beat_times)} beats")

    # Timeline mapping parameters:
    # timeline_duration: Total video timeline duration in seconds
    # timeline_audio_start: Timestamp in video timeline where audio starts
    # song_offset: Offset in audio file corresponding to timeline_audio_start

    fps = 100
    n_frames = int(timeline_duration * fps)

    # Filter bands
    def butter_bandpass(lowcut, highcut, fs, order=4):
        nyq = 0.5 * fs
        low = max(0.001, lowcut / nyq)
        high = min(0.999, highcut / nyq)
        return signal.butter(order, [low, high], btype='band')

    def butter_lowpass(cutoff, fs, order=4):
        nyq = 0.5 * fs
        return signal.butter(order, cutoff / nyq, btype='low')

    def butter_highpass(cutoff, fs, order=4):
        nyq = 0.5 * fs
        return signal.butter(order, cutoff / nyq, btype='high')

    b_low, a_low = butter_lowpass(250, sr)
    b_mid, a_mid = butter_bandpass(250, 3000, sr)
    b_high, a_high = butter_highpass(3000, sr)

    y_low = signal.filtfilt(b_low, a_low, y)
    y_mid = signal.filtfilt(b_mid, a_mid, y)
    y_high = signal.filtfilt(b_high, a_high, y)

    def compute_envelope(signal_data):
        # 100 fps RMS window
        hop_length = int(sr / fps)
        win_length = int(sr * 0.04) # 40ms window
        frames = []
        for i in range(0, len(signal_data) - win_length, hop_length):
            chunk = signal_data[i:i + win_length]
            frames.append(np.sqrt(np.mean(chunk**2)))
        frames = np.array(frames)
        p99 = np.percentile(frames, 98)
        if p99 > 1e-6:
            frames = np.clip(frames / p99, 0.0, 1.0)
        return frames

    env_raw_rms = compute_envelope(y)
    env_raw_low = compute_envelope(y_low)
    env_raw_mid = compute_envelope(y_mid)
    env_raw_high = compute_envelope(y_high)

    # Smooth follower
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

    env_rms = smooth(env_raw_rms)
    env_low = smooth(env_raw_low)
    env_mid = smooth(env_raw_mid)
    env_high = smooth(env_raw_high)

    # Now create timeline envelopes (0..77.0s)
    rms_tl = np.zeros(n_frames, dtype=np.float32)
    low_tl = np.zeros(n_frames, dtype=np.float32)
    mid_tl = np.zeros(n_frames, dtype=np.float32)
    high_tl = np.zeros(n_frames, dtype=np.float32)

    start_frame = int(timeline_audio_start * fps)
    song_offset_frames = int(song_offset * fps)

    for i in range(start_frame, n_frames):
        song_i = (i - start_frame) + song_offset_frames
        if 0 <= song_i < len(env_rms):
            rms_tl[i] = env_rms[song_i]
            low_tl[i] = env_low[song_i]
            mid_tl[i] = env_mid[song_i]
            high_tl[i] = env_high[song_i]

    # Map beats to timeline
    timeline_beats = []
    for b in beat_times:
        if b >= song_offset:
            tb = timeline_audio_start + (b - song_offset)
            if tb <= timeline_duration:
                timeline_beats.append(round(float(tb), 4))

    # Downbeats: every 4th beat
    timeline_downbeats = [timeline_beats[i] for i in range(0, len(timeline_beats), 4)]

    # Sections: every 16 beats (4 bars) or 32 beats (8 bars)
    sections = []
    for idx, i in enumerate(range(0, len(timeline_beats), 16)):
        s_start = timeline_beats[i]
        s_end = timeline_beats[min(i + 16, len(timeline_beats) - 1)] if i + 16 < len(timeline_beats) else timeline_duration
        sections.append({
            "name": f"phrase_{idx + 1}",
            "start": round(s_start, 3),
            "end": round(s_end, 3)
        })

    # Onsets detection (kick, snare, hat)
    def detect_onsets(signal_env, threshold=0.35, min_dist=15):
        peaks, props = signal.find_peaks(signal_env, height=threshold, distance=min_dist)
        return [(round(float(p / fps), 4), round(float(props['peak_heights'][j]), 3)) for j, p in enumerate(peaks)]

    raw_kicks = detect_onsets(env_low, threshold=0.3)
    raw_snares = detect_onsets(env_mid, threshold=0.28)
    raw_hats = detect_onsets(env_high, threshold=0.25, min_dist=8)

    def map_onsets_to_timeline(raw_list):
        mapped = []
        for t_raw, strength in raw_list:
            if t_raw >= song_offset:
                t_mapped = timeline_audio_start + (t_raw - song_offset)
                if t_mapped <= timeline_duration:
                    mapped.append([round(float(t_mapped), 4), strength])
        return mapped

    onsets_tl = {
        "kick": map_onsets_to_timeline(raw_kicks),
        "snare": map_onsets_to_timeline(raw_snares),
        "hat": map_onsets_to_timeline(raw_hats),
        "vonset": []
    }

    out_data = {
        "duration": timeline_duration,
        "bpm": round(bpm, 2),
        "fps": fps,
        "beats": timeline_beats,
        "downbeats": timeline_downbeats,
        "sections": sections,
        "features": {
            "rms": [round(float(v), 4) for v in rms_tl],
            "low": [round(float(v), 4) for v in low_tl],
            "mid": [round(float(v), 4) for v in mid_tl],
            "high": [round(float(v), 4) for v in high_tl],
            "vocal": [round(float(v), 4) for v in mid_tl],
            "drums": [round(float(v), 4) for v in (low_tl * 0.7 + high_tl * 0.3)],
            "bass": [round(float(v), 4) for v in low_tl],
            "other": [round(float(v), 4) for v in (mid_tl * 0.5 + high_tl * 0.5)]
        },
        "onsets": onsets_tl
    }

    with open(out_path, 'w') as f:
        json.dump(out_data, f)
    print(f"Successfully wrote {out_path}: {len(timeline_beats)} beats, {len(timeline_downbeats)} downbeats, {len(rms_tl)} envelope frames")

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Acoustic analysis pipeline for f(x) Studio.")
    parser.add_argument('--audio', type=str, default='app/public/audio/no_takebacks.mp3', help='Path to input audio file')
    parser.add_argument('--out', type=str, default='app/public/data/audio.json', help='Output JSON path')
    parser.add_argument('--duration', type=float, default=77.0, help='Total video timeline duration in seconds')
    parser.add_argument('--start', type=float, default=17.0, help='Timestamp in timeline where audio begins')
    parser.add_argument('--offset', type=float, default=2.0, help='Offset into audio file to start from')
    args = parser.parse_args()
    analyze(args.audio, args.out, args.duration, args.start, args.offset)
