#!/usr/bin/env python
"""Verify a mixdown: integrated LUFS, true peak, Void Cut digital silence, per-cue timing.

  python scripts/verify_audio.py mix.wav [--events events.json] [--report mix.mix_report.json]
         [--mute FROM TO]... [--mute-event ID_FROM ID_TO]... [--window-from 0]
         [--fps 60] [--target-lufs -14] [--lufs-tol 1.0] [--max-tp -1.0] [--cue-window 0.25]
         [--cue-threshold 0.2] [--json]

Mute intervals are in project seconds; --window-from is the project time of sample 0 of the file
(the mixdown's --from). With --report the mutes and cue list are read from mix_report.json.
Exit code 0 = every check passed, 1 = a check failed, 2 = usage error.
Requires numpy + soundfile; LUFS / true peak come from ffmpeg's ebur128 filter.
"""
import argparse
import json
import re
import subprocess
import sys

import numpy as np
import soundfile as sf


def ebur128(path):
    p = subprocess.run(
        ["ffmpeg", "-hide_banner", "-nostats", "-i", path, "-af", "ebur128=peak=true", "-f", "null", "-"],
        capture_output=True, text=True,
    )
    tail = p.stderr[p.stderr.rfind("Summary:"):]
    i = re.search(r"I:\s+(-?[\d.]+|-inf)\s+LUFS", tail)
    tp = re.search(r"True peak:.*?Peak:\s+(-?[\d.]+|-inf)\s+dBFS", tail, re.S)
    if not i or not tp:
        raise RuntimeError("could not parse ebur128 summary:\n" + tail[-500:])
    return float(i.group(1)), float(tp.group(1))


def first_onset(x, sr, t, win, thr):
    """First sample in [t-win, t+win] whose |x| exceeds thr * local peak. Returns time or None."""
    a = max(0, int(round((t - win) * sr)))
    b = min(x.shape[0], int(round((t + win) * sr)))
    if b <= a:
        return None
    seg = np.abs(x[a:b]).max(axis=1)
    pk = seg.max()
    if pk <= 0:
        return None
    idx = int(np.argmax(seg >= thr * pk))
    return (a + idx) / sr


def verify(a):
    x, sr = sf.read(a.wav, dtype="float64", always_2d=True)
    res = {"file": a.wav, "sampleRate": sr, "duration": x.shape[0] / sr, "checks": []}

    def check(name, ok, detail):
        res["checks"].append({"name": name, "ok": bool(ok), "detail": detail})

    lufs, tp = ebur128(a.wav)
    res["lufs"], res["truePeak"] = lufs, tp
    if not a.no_loudness:
        check("integrated LUFS", abs(lufs - a.target_lufs) <= a.lufs_tol,
              f"{lufs:.2f} LUFS (target {a.target_lufs} +-{a.lufs_tol})")
        check("true peak", tp <= a.max_tp, f"{tp:.2f} dBTP (max {a.max_tp})")

    mutes = [(f, t) for f, t in a.mute]
    cues = []
    ev = {}
    if a.events:
        ev = {e["id"]: e["t"] for e in json.load(open(a.events))["events"]}
    if a.report:
        rep = json.load(open(a.report))
        mutes += [(m["from"], m["to"]) for m in rep.get("mutes", [])]
        cues += [(c.get("eventId") or c["stem"], c["expectedT"]) for c in rep.get("cues", []) if c.get("eventId")]
    for i, (fa, fb) in enumerate(a.mute_event):
        mutes.append((ev[fa], ev[fb]))
    res["mutes"] = []
    for f, t in mutes:
        s0 = int(round((f - a.window_from) * sr))
        s1 = int(round((t - a.window_from) * sr))
        s0c, s1c = max(0, s0), min(x.shape[0], s1)
        seg = x[s0c:s1c]
        mn = float(np.abs(seg).min()) if seg.size else float("nan")
        mx = float(np.abs(seg).max()) if seg.size else float("nan")
        res["mutes"].append({"from": f, "to": t, "samples": int(seg.shape[0]), "minAbs": mn, "maxAbs": mx})
        check(f"void interval {f:.3f}-{t:.3f}", seg.size > 0 and mx == 0.0,
              f"{seg.shape[0]} samples, min|x|={mn!r}, max|x|={mx!r} (must be exactly 0)")

    res["cues"] = []
    tol = 1.0 / a.fps
    for cid, t in cues:
        got = first_onset(x, sr, t - a.window_from, a.cue_window, a.cue_threshold)
        if got is None:
            check(f"cue {cid}", False, "no onset found near expected time")
            continue
        got += a.window_from
        err = got - t
        res["cues"].append({"id": cid, "expected": t, "detected": got, "errorMs": err * 1000})
        check(f"cue {cid}", abs(err) <= tol, f"error {err * 1000:+.2f} ms (limit +-{tol * 1000:.1f} ms)")
    return res


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("wav")
    ap.add_argument("--events")
    ap.add_argument("--report")
    ap.add_argument("--mute", nargs=2, type=float, action="append", default=[], metavar=("FROM", "TO"))
    ap.add_argument("--mute-event", nargs=2, action="append", default=[], metavar=("ID_FROM", "ID_TO"))
    ap.add_argument("--window-from", type=float, default=0.0)
    ap.add_argument("--fps", type=float, default=60.0)
    ap.add_argument("--target-lufs", type=float, default=-14.0)
    ap.add_argument("--lufs-tol", type=float, default=1.0)
    ap.add_argument("--max-tp", type=float, default=-1.0)
    ap.add_argument("--cue-window", type=float, default=0.25)
    ap.add_argument("--cue-threshold", type=float, default=0.2)
    ap.add_argument("--no-loudness", action="store_true", help="report LUFS/TP but do not gate on them")
    ap.add_argument("--json", action="store_true")
    a = ap.parse_args()
    if not (a.mute or a.mute_event or a.report):
        print("note: no void interval given (--mute / --mute-event / --report)", file=sys.stderr)
    try:
        res = verify(a)
    except Exception as e:  # noqa: BLE001
        print(f"error: {e}", file=sys.stderr)
        return 2
    if a.json:
        print(json.dumps(res, indent=2))
    else:
        print(f"{res['file']}  {res['duration']:.3f}s @ {res['sampleRate']} Hz")
        print(f"integrated {res['lufs']:.2f} LUFS   true peak {res['truePeak']:.2f} dBTP")
        for c in res["checks"]:
            print(f"  [{'PASS' if c['ok'] else 'FAIL'}] {c['name']}: {c['detail']}")
    ok = all(c["ok"] for c in res["checks"])
    print("RESULT: " + ("PASS" if ok else "FAIL"))
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
