"""SPILL mix: the supplied song (never committed) + procedural SFX on the picture's hit list.
  python mix.py <song.wav|mp3> <out.wav>
Song 0..29.06 s, ducked under hits, low-passed inside the heron (12.2-13.39 s), -14 LUFS-ish via ffmpeg loudnorm."""
import sys, subprocess, numpy as np
from scipy.signal import butter, sosfilt
SR = 48000; BEAT = 60 / 137.89; BAR = 4 * BEAT; DROP = 6.432; bar = lambda n: DROP + n * BAR
END = bar(13); N = int(END * SR); rng = np.random.default_rng(7)
def t_(d): return np.arange(int(d * SR)) / SR
def env(d, a=0.005, r=None):
    t = t_(d); r = r or d; return np.minimum(1, t / a) * np.exp(-t / (r / 5))
def lp(x, f): return sosfilt(butter(2, f, 'lp', fs=SR, output='sos'), x)
def hp(x, f): return sosfilt(butter(2, f, 'hp', fs=SR, output='sos'), x)
def bp(x, lo, hi): return sosfilt(butter(2, [lo, hi], 'bp', fs=SR, output='sos'), x)
def noise(d): return rng.standard_normal(int(d * SR))
def sweep(f0, f1, d, wave=np.sin):
    t = t_(d); f = f0 * (f1 / f0) ** (t / d); return wave(2 * np.pi * np.cumsum(f) / SR)
sq = lambda p: np.sign(np.sin(p)); saw = lambda p: 2 * ((p / (2 * np.pi)) % 1) - 1
L = np.zeros(N); R = np.zeros(N)
def put(at, x, g=1.0, pan=0.0):
    x = np.asarray(x, dtype=np.float64)
    i = int(at * SR); x = x[: max(0, N - i)]; L[i:i + len(x)] += g * x * np.sqrt(0.5 * (1 - pan)); R[i:i + len(x)] += g * x * np.sqrt(0.5 * (1 + pan))
def thud(f=55, d=0.5): return sweep(f * 2.5, f, d) * env(d, 0.002, d)
def crack(d=0.35): return hp(noise(d), 2500) * env(d, 0.001, d * 0.5)
def whoosh(d, lo=300, hi=3000, up=True):
    t = t_(d); s = np.sin(np.pi * t / d) ** 2; c = np.linspace(lo, hi, len(t)) if up else np.linspace(hi, lo, len(t))
    out = np.zeros(len(t)); x = noise(d); blk = 2048
    for k in range(0, len(t), blk): out[k:k + blk] = bp(x[k:k + blk], c[k] * 0.7, c[k] * 1.3)
    return out * s
def chime(f, d=1.2): t = t_(d); return (np.sin(2 * np.pi * f * t) + 0.5 * np.sin(2 * np.pi * f * 2.76 * t) + 0.25 * np.sin(2 * np.pi * f * 5.4 * t)) * env(d, 0.002, d)
def blip(f, d=0.09): return sq(2 * np.pi * f * t_(d)) * env(d, 0.001, d) * 0.5

# 0-3 s: breakout. charge hum, three comic rams, glass blow-out
put(0.0, lp(saw(2 * np.pi * 55 * t_(1.45)), 400) * np.linspace(0.2, 1, int(1.45 * SR)), 0.18)
for i, h in enumerate([0.34, 0.94, 1.45]):
    put(h, thud(48 + 6 * i, 0.6), 0.9); put(h, crack(0.25 + 0.15 * i), 0.35 + 0.2 * i, (-1) ** i * 0.3)
put(1.45, hp(noise(1.6), 3500) * env(1.6, 0.002, 1.6), 0.35, 0.2)
for k in range(24): put(1.5 + 0.06 * k + 0.05 * rng.random(), chime(2500 + 3000 * rng.random(), 0.3), 0.05, rng.uniform(-0.9, 0.9))
for i, h in enumerate([1.73, 2.02, 2.29, 2.61, 2.88]): put(h - 0.1, whoosh(0.3, 600, 2500), 0.25, (-1) ** i * 0.5)
put(3.0, whoosh(3.4, 200, 1800), 0.35)  # the fall
# 6.43 whale slam + splash + moan
put(DROP, thud(38, 1.2), 1.0); put(DROP, lp(noise(0.9), 1500) * env(0.9, 0.003, 0.9), 0.5)
put(DROP + 0.25, lp(sweep(140, 90, 2.2, lambda p: np.sin(p) + 0.3 * np.sin(2 * p)), 800) * np.sin(np.pi * t_(2.2) / 2.2), 0.25)
# paper canopy: flaps and crane flock
for k in range(10): put(bar(1) + 0.1 * k + 0.05 * rng.random(), bp(noise(0.12), 1500, 6000) * env(0.12, 0.002, 0.1), 0.25, rng.uniform(-0.8, 0.8))
# clay: squelch, frog boing, snail honk
put(bar(2), lp(sweep(400, 120, 0.25), 900) * env(0.25), 0.6); put(bar(2) + 0.3, sweep(180, 520, 0.35, lambda p: np.sin(p)) * env(0.35, 0.003, 0.35), 0.35, -0.3)
put(bar(2) + 0.8, lp(saw(2 * np.pi * 233 * t_(0.4)) + saw(2 * np.pi * 293 * t_(0.4)), 2200) * env(0.4, 0.01, 0.8), 0.18, 0.4)
# ink: plops on the pads, gulp, hiccup spit
for k, h in enumerate([11.75, 11.95, 12.1]): put(h, sweep(900, 300, 0.12) * env(0.12), 0.35, -0.3 + 0.3 * k)
put(12.2, lp(sweep(220, 50, 0.6), 600) * env(0.6, 0.01, 0.7), 0.9); put(12.25, lp(noise(0.5), 300) * env(0.5), 0.4)
put(13.39, sweep(200, 900, 0.12) * env(0.12), 0.7); put(13.39, lp(noise(0.1), 3000) * env(0.1), 0.5)
for k in range(3): put(13.6 + 0.3 * k, sweep(1200, 500, 0.08) * env(0.08), 0.25, 0.3 * k)
# pixel falls: 8-bit jump + coins
put(bar(5), sq(2 * np.pi * np.cumsum(np.linspace(200, 900, int(0.25 * SR))) / SR) * env(0.25) * 0.5, 0.35)
for k in range(6): put(bar(5) + 0.35 + 0.22 * k, np.concatenate([blip(988, 0.06), blip(1319, 0.18)]), 0.25, rng.uniform(-0.6, 0.6))
# felt: soft hoof thuds and a squeaky baa
for k in range(14): put(bar(6) + 0.11 * k, lp(noise(0.08), 400) * env(0.08), 0.45, rng.uniform(-0.7, 0.7))
put(bar(6) + 0.5, bp(saw(2 * np.pi * (380 + 30 * np.sin(2 * np.pi * 9 * t_(0.45))).cumsum() / SR), 600, 2500) * env(0.45, 0.02, 0.6), 0.2, 0.3)
# rubber hose: slide whistle, hat tip ding, bounce boings
put(bar(7), sweep(500, 1500, 0.5) * env(0.5, 0.02, 0.8), 0.18); put(bar(7) + 0.75, chime(1760, 0.6), 0.2, 0.4)
for k in range(4): put(bar(7) + k * BEAT, sweep(150, 300, 0.15) * env(0.15), 0.25)
# stained glass: chimes on beats
for k, f in enumerate([1047, 1319, 1568, 2093]): put(bar(8) + k * BEAT, chime(f, 1.4), 0.12, (-1) ** k * 0.5)
# PS1: crunchy low-poly roar (bit-crushed)
roar = lp(saw(2 * np.pi * np.cumsum(70 + 25 * np.sin(2 * np.pi * 6 * t_(1.0))) / SR) + 0.6 * noise(1.0), 1200) * env(1.0, 0.04, 1.4)
put(bar(9) + 0.45, np.round(roar * 8) / 8, 0.45)
# vista shimmer swell
put(bar(10), (chime(784, 2.5) + chime(1175, 2.5) * 0.7) * np.sin(np.pi * t_(2.5) / 5) ** 0.5, 0.15)
# the scream from above: two formant-filtered saws gliding down, with a thud
scr = saw(2 * np.pi * np.cumsum(np.linspace(780, 520, int(1.5 * SR)) * (1 + 0.02 * np.sin(2 * np.pi * 7 * t_(1.5)))) / SR)
scr = bp(scr, 700, 1300) * 1.2 + bp(scr, 2200, 3200) * 0.8 + bp(noise(1.5), 2000, 5000) * 0.3
put(bar(11), scr * np.minimum(1, t_(1.5) / 0.04) * np.exp(-t_(1.5) / 1.2), 0.5); put(bar(11), thud(60, 0.5), 0.6)
# whip into the phone, landing in the cell
put(bar(12), whoosh(END - bar(12) - 0.42, 300, 5000), 0.55); put(END - 0.42, thud(70, 0.3), 0.5); put(END - 0.42, crack(0.15), 0.2)
put(END - 0.6, lp(noise(0.6), 2500) * np.linspace(0, 1, int(0.6 * SR)) ** 3, 0.5)
put(0.0, lp(noise(0.35), 2500) * np.linspace(1, 0, int(0.35 * SR)) ** 1.5, 0.5)   # the seam swell carries on past frame 0
sfx = np.stack([L, R])

song = subprocess.run(['ffmpeg', '-v', 'error', '-i', sys.argv[1], '-t', str(END + 0.4), '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-'], capture_output=True, check=True).stdout
m = np.frombuffer(song, np.float32).reshape(-1, 2).T.astype(np.float64); mfull = m; m = np.pad(m, ((0, 0), (0, max(0, N - m.shape[1]))))[:, :N]
tt = np.arange(N) / SR
muf = np.clip(np.minimum((tt - 12.15) / 0.08, (13.42 - tt) / 0.06), 0, 1)       # inside the heron
ml = np.stack([lp(m[0], 500), lp(m[1], 500)]); m = m * (1 - muf) + ml * muf * 0.8
duck = np.ones(N)
for h in [0.34, 0.94, 1.45, DROP, 12.2, 13.39, bar(11)]:
    k = (tt >= h) * np.exp(-np.maximum(0, tt - h) / 0.25); duck = np.minimum(duck, 1 - 0.35 * k)
fade = np.clip(np.minimum(tt / 0.02, 0.3 + 0.7 * np.clip((END - tt) / 0.3, 0, 1) ** 1.5), 0, 1) * np.clip((END - tt) / 0.004, 0, 1)
mix = (m * 0.8 * duck + sfx) * fade
TL = int(0.5 * SR); tail = mfull[:, N:N + TL]; tail = np.stack([lp(tail[0], 2500), lp(tail[1], 2500)]) * np.cos(np.linspace(0, np.pi / 2, tail.shape[1])) ** 1.5
mix[:, :tail.shape[1]] += 0.8 * 0.7 * tail   # the loop's head carries the song's own continuation
mix /= max(1.0, np.abs(mix).max() / 0.98)
raw = sys.argv[2] + '.raw.wav'
import wave
with wave.open(raw, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((mix.T * 32767).astype('<i2').tobytes())
subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', raw, '-af', 'loudnorm=I=-14:TP=-1:LRA=11', '-ar', str(SR), sys.argv[2]], check=True)
print('wrote', sys.argv[2], f'{END:.3f}s')
