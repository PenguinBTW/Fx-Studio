# Camera Rig Solvers (`engine/rig.ts`)

Pure, deterministic helpers. Each exists as an exported function, a `CameraRig` static, and (where state is useful) an instance method.

| Function | Purpose |
|---|---|
| `dollyDistance(width, fovDeg, screenFraction=1)` | `d = width / (2·tan(fov/2)·screenFraction)` |
| `solveDollyZoom(target, dir, width, fovDeg, screenFraction=1)` | Camera position on the view ray plus fov |
| `dollyZoomAt(target, dir, width, fovOfT, t, screenFraction=1)` | Same, driven by a `fov(t)` function (pure per-time sampler) |
| `orbitPosition(target, radius, pitch, yaw)` | Polar orbit point. Yaw 0, pitch 0 is +Z of the target; +pitch raises the camera |
| `focusDistance(camPos, target, forward?)` | World distance along the view axis (the depth-buffer metric). Without `forward` it is Euclidean |
| `computeScreenFocusRadius(target, threeCam, aspect)` | Legacy radial screen metric for the old `post.ts` radial DoF |

Instance methods: `rig.dollyZoom(target, width, fovDeg)` (also sets position, target and lens), `rig.orbit(...)`, `rig.focusDistance(target)`, `rig.computeScreenFocusRadius(...)`, `rig.getForwardVector()`.

## Dolly-zoom maths

The plan's formula `D = W / (2·tan(fov/2))` is correct, with `fov` the **vertical** fov and `W` the world extent perpendicular to the view axis, which then fills the full frame height. Use `screenFraction` (e.g. 0.3) for a partial frame. A horizontal width needs `W / aspect` first. The distance is measured along the view axis to the subject plane. Keep the subject on the axis, since off-axis subjects drift as fov changes. `rig.dollyZoom` also sets `focalLengthPx = (H/2)/tan(fov/2)` so the lens agrees with the solved fov.

```ts
const fov = t => 20 + 70 * t;
const { position } = dollyZoomAt(core, forward, 2.5, fov, t, 0.4);
```

## Autofocus

Depth DoF: `depthFocusDist = rig.focusDistance(photonPos)`. Use the axis-projected distance (default through the rig method), not the Euclidean one, because the depth buffer stores view-space depth. Legacy radial DoF: `focusDist = computeScreenFocusRadius(...)`.

## Test

`bun run test:rig` (`app/scripts/test_rig_solvers.ts`) checks projected size constant to far better than 0.1% over fov 20..90, orbit radius invariance, and `focusDistance` against THREE projection depth.
