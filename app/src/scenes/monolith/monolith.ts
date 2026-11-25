// monolith — typographic mass. The word GRAVITY falls out of the sky letter by letter,
// each glyph a tonne of bronze slamming into the ground plane: shockwave dust rings,
// camera tremor per impact, then a low arc that racks focus down the word while a rim
// light sweeps the extruded edges. The type IS the subject — in-world extruded lettering
// with real shadows, physical DoF, and closed-form mass motion throughout.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { W, H } from '../../engine/gl';
import { DepthDoFPass } from '../../engine/dof';
import { AnalyticalParticles } from '../../engine/particles';
import { createInWorldText } from '../../engine/text_lighting';
import { smoothstep } from '../../engine/util';

const WORD = 'GRAVITY';
const N = WORD.length;
const FIRST_HIT = 1.0;
const HIT_GAP = 1.0;             // one letter per second
const FALL_DUR = 0.55;           // accelerating drop time
const DROP_H = 6.0;              // fall height in world units
const SIZE = 1.05;

const hitTime = (i: number) => FIRST_HIT + i * HIT_GAP;

// closed-form per-letter transform: accelerating drop, then a damped bounce and rock.
// returns [yOffset, rockAngle, landedness]
function glyphMotion(lt: number, i: number): [number, number, number] {
  const hit = hitTime(i);
  const t0 = hit - FALL_DUR;
  if (lt < t0) return [DROP_H, 0, 0];
  if (lt < hit) {
    const q = (lt - t0) / FALL_DUR;         // 0..1 during fall
    return [DROP_H * (1 - q * q), 0, 0];    // ease-in: velocity grows toward impact
  }
  const dt = lt - hit;
  // damped oscillation settling onto the plane — mass with a slightly soft mount
  const bounce = 0.09 * Math.exp(-5.5 * dt) * Math.sin(26 * dt);
  const rock = 0.05 * Math.exp(-4.5 * dt) * Math.sin(21 * dt + i * 0.7);
  return [Math.max(0, bounce), rock, 1];
}

// camera tremor: sum of decaying impact impulses, zero before the first hit
function tremor(lt: number): number {
  let s = 0;
  for (let i = 0; i < N; i++) {
    const dt = lt - hitTime(i);
    if (dt > 0) s += Math.exp(-6 * dt) * Math.sin(34 * dt + i * 1.3);
  }
  return s * 0.035;
}

// camera choreography: wide frontal hold → slow push → low arc during the focus rack
// → settle to a hero three-quarter. piecewise over smoothstep weights, all closed-form.
function camPos(lt: number, out: THREE.Vector3): THREE.Vector3 {
  const push = smoothstep(8, 16, lt);
  const arc = smoothstep(16, 17.5, lt) * (1 - smoothstep(23.5, 25, lt));
  const settle = smoothstep(24, 28, lt);
  // base dolly: frontal wide → closer
  const z = 7.6 - 2.1 * push;
  const y = 1.25 - 0.25 * push;
  // low arc around the word: angle sweeps 0 → 1.2 rad, radius tightens, drops low
  const ang = 1.2 * smoothstep(16, 24, lt);
  const arcR = 4.4;
  const ax = Math.sin(ang) * arcR;
  const az = Math.cos(ang) * arcR;
  const ay = 0.55;
  // hero three-quarter settle
  const hx = 2.2, hy = 2.1, hz = 7.6;
  let x = 0, yy = y, zz = z;
  x = x * (1 - arc) + ax * arc; yy = yy * (1 - arc) + ay * arc; zz = zz * (1 - arc) + az * arc;
  x = x * (1 - settle) + hx * settle; yy = yy * (1 - settle) + hy * settle; zz = zz * (1 - settle) + hz * settle;
  // slow continuous drift through the settle — a locked-off frame reads dead
  const drift = smoothstep(24, 30, lt);
  x -= 0.5 * drift; zz -= 0.9 * drift; yy -= 0.15 * drift;
  out.set(x, yy, zz);
  return out;
}
function camTarget(lt: number, focusX: number, out: THREE.Vector3): THREE.Vector3 {
  const arc = smoothstep(16, 17.5, lt) * (1 - smoothstep(23.5, 25, lt));
  // during the arc the gaze tracks the focus letter; otherwise mid-word chest height
  const tx = focusX * arc;
  const ty = 0.85 + 0.15 * smoothstep(24, 28, lt);
  out.set(tx, ty, 0);
  return out;
}

// focus rack during the arc: sweeps letter G (index 0) → Y (index 6)
function rackIndex(lt: number): number {
  return smoothstep(16.5, 23.5, lt) * (N - 1);
}

export default class Monolith extends Scene {
  private cam = new THREE.PerspectiveCamera(42, W / H, 0.05, 80);
  private world = new THREE.Scene();
  private dof = new DepthDoFPass();
  private main: THREE.WebGLRenderTarget | null = null;
  private textGroup: THREE.Group | null = null;
  private glyphs: { mesh: THREE.Mesh; base: number[]; i: number }[] = [];
  private rings: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; hit: number; x: number }[] = [];
  private dust: AnalyticalParticles | null = null;
  private keyLight: THREE.SpotLight | null = null;
  private rimLight: THREE.DirectionalLight | null = null;
  private tmp = { a: new THREE.Vector3(), b: new THREE.Vector3(), c: new THREE.Vector3() };
  private probeBox = new THREE.Box3();
  private probeScratch = new Float32Array(16);
  private probeFrustum = new THREE.Frustum();
  private probeMat = new THREE.Matrix4();

  private prevShadowEnabled = false;
  private prevShadowType: THREE.ShadowMapType | null = null;

  override init() {
    const r = this.ctx.renderer;
    this.prevShadowEnabled = r.shadowMap.enabled;
    this.prevShadowType = r.shadowMap.type;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    this.world.background = new THREE.Color(0x050403);
    this.world.fog = new THREE.FogExp2(0x050403, 0.028);

    // ground: vast dark plane drinking the light
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(40, 48),
      new THREE.MeshStandardMaterial({ color: 0x0d0b09, roughness: 0.85, metalness: 0.15 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.world.add(ground);

    // the word: extruded bronze with clearcoat — heavy, machined, real
    const bronzeMat = new THREE.MeshPhysicalMaterial({
      color: 0x8a6540,
      roughness: 0.42,
      metalness: 0.85,
      clearcoat: 0.6,
      clearcoatRoughness: 0.3,
      depthWrite: true,
      depthTest: true,
    });
    this.textGroup = createInWorldText(WORD, {
      size: SIZE,
      depth: 0.34,
      bevelEnabled: true,
      bevelThickness: 0.045,
      bevelSize: 0.03,
      bevelSegments: 4,
      letterSpacing: 0.14,
      material: bronzeMat,
      castShadow: true,
      receiveShadow: true,
    } as any);
    this.world.add(this.textGroup);
    for (const child of this.textGroup.children) {
      const g = (child as any).userData.glyph;
      if (!g) continue;
      this.glyphs.push({ mesh: child as THREE.Mesh, base: g.base ? [...g.base] : [(child as any).position.x, 0, 0], i: g.index });
    }
    this.glyphs.sort((a, b) => a.i - b.i);
    // park every letter at drop height — render() drives them down deterministically
    for (const gl of this.glyphs) gl.mesh.position.y = DROP_H;

    // shockwave rings: one additive flat ring per letter, dormant until impact
    for (let i = 0; i < N; i++) {
      const gl = this.glyphs[i];
      if (!gl) continue;
      const mat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(0.9, 0.65, 0.35),
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.965, 1.0, 48), mat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(gl.base[0]! + SIZE * 0.4, 0.02, 0.2);
      this.world.add(ring);
      this.rings.push({ mesh: ring, mat, hit: hitTime(i), x: gl.base[0]! });
    }

    // warm key spot from above-front-left, hard shadowed; cool rim from behind for the sweep
    const key = new THREE.SpotLight(0xffc078, 420, 40, 0.85, 0.7, 1.6);
    key.position.set(-3.0, 12.5, 5.5);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.bias = -0.0004;
    const keyTarget = new THREE.Object3D();
    keyTarget.position.set(0, 0.8, 0);
    this.world.add(keyTarget);
    key.target = keyTarget;
    this.world.add(key);
    this.keyLight = key;

    const rim = new THREE.DirectionalLight(0x8fb4ff, 0.0);
    rim.position.set(2.0, 3.0, -6.0);
    this.world.add(rim);
    this.rimLight = rim;

    this.world.add(new THREE.AmbientLight(0x201812, 0.6));
    // warm frontal fill so the face planes read, cool-ish bounce off the ground
    const fill = new THREE.DirectionalLight(0xffd9a8, 0.85);
    fill.position.set(1.5, 2.0, 8.0);
    this.world.add(fill);

    // dust motes drifting in the key beam — one continuous analytical emitter,
    // zero gravity so nothing re-seeds wrongly (gravity uniform is shared)
    this.dust = new AnalyticalParticles(2048, 7331);
    this.dust.addEmitter('beam', {
      capacity: 2048,
      origin: [-0.5, 4.2, 1.5],
      direction: [0.25, -1.0, -0.3],
      speed: 0.35,
      spread: 1.5,
      lifetime: 11.0,
      gravity: [0, 0, 0] as any,
      turbulence: 0.35,
      size: 0.008,
      color: [1.0, 0.75, 0.45, 0.28],
      glow: 0.5,
    } as any);
  }

  private mainRT(out: THREE.WebGLRenderTarget) {
    if (this.main && this.main.width === out.width && this.main.height === out.height) return this.main;
    this.main?.dispose();
    this.main = new THREE.WebGLRenderTarget(out.width, out.height, {
      type: THREE.HalfFloatType, depthTexture: new THREE.DepthTexture(out.width, out.height),
    });
    return this.main;
  }

  override render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const lt = f.lt, r = this.ctx.renderer;

    // letters: closed-form mass motion
    for (const gl of this.glyphs) {
      const [dy, rock] = glyphMotion(lt, gl.i);
      gl.mesh.position.y = gl.base[1]! + dy;
      gl.mesh.rotation.z = rock;
    }

    // shockwave rings: expand with the impact, fade fast — dust blasted outward
    for (const rg of this.rings) {
      const dt = lt - rg.hit;
      if (dt < 0 || dt > 1.1) { rg.mat.opacity = 0; continue; }
      const rad = 0.5 + 4.6 * Math.sqrt(dt / 1.1);
      rg.mesh.scale.setScalar(rad);
      rg.mat.opacity = 0.22 * (1 - dt / 1.1);
    }

    // rim light sweep: cold edge grows through the arc, peaks at the settle
    if (this.rimLight) {
      this.rimLight.intensity = 2.2 * smoothstep(15, 26, lt);
    }
    // key breathes slightly brighter with each impact — flashes on hits
    if (this.keyLight) {
      let flash = 0;
      for (let i = 0; i < N; i++) {
        const dt = lt - hitTime(i);
        if (dt > 0) flash += Math.exp(-7 * dt) * 60;
      }
      this.keyLight.intensity = 420 + flash;
    }

    // camera: choreography + tremor impulses from every impact so far
    const rack = rackIndex(lt);
    const li = Math.min(N - 1, Math.floor(rack));
    const lf = rack - li;
    const xa = this.glyphs[li]?.base[0] ?? 0;
    const xb = this.glyphs[Math.min(N - 1, li + 1)]?.base[0] ?? xa;
    const focusX = xa + (xb - xa) * lf;

    camPos(lt, this.tmp.a);
    camTarget(lt, focusX, this.tmp.b);
    const tr = tremor(lt);
    this.tmp.a.x += tr * 0.7;
    this.tmp.a.y += tr;
    this.cam.position.copy(this.tmp.a);
    this.cam.lookAt(this.tmp.b);
    this.cam.updateMatrixWorld();

    // telemetry: union screen-space bbox of the glyphs — invariant 5 of the raw-scene
    // rules, so diagnostics can check the lettering for clipping/overlap
    const P = (window as any).__motion;
    // gate on P.probe like the engine's own text does — otherwise the paused preview
    // loop, which never clears the probe array, leaks a record per rendered frame
    if (P?.probe && P?.textProbes && P.recordText !== false) {
      this.probeMat.multiplyMatrices(this.cam.projectionMatrix, this.cam.matrixWorldInverse);
      this.probeFrustum.setFromProjectionMatrix(this.probeMat);
      let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9, any = false;
      const corner = this.tmp.c;
      for (const gl of this.glyphs) {
        this.probeBox.setFromObject(gl.mesh);
        const b = this.probeBox;
        // skip glyphs fully outside the frame (e.g. still falling above the top):
        // including them inflates the union box and pulls the onion-skin trail's
        // center into empty space
        // exact frustum test — a glyph spanning the viewport can have no corner
        // inside the frame yet fill it entirely; corner sampling alone misses that
        const visible = this.probeFrustum.intersectsBox(b);
        // reuse flat scratch — no per-corner tuple allocations in a probed export
        const pts = this.probeScratch;
        for (let k = 0; k < 8; k++) {
          corner.set(
            k & 1 ? b.max.x : b.min.x,
            k & 2 ? b.max.y : b.min.y,
            k & 4 ? b.max.z : b.min.z,
          ).project(this.cam);
          pts[k * 2] = (corner.x + 1) / 2 * W;
          pts[k * 2 + 1] = (1 - corner.y) / 2 * H;
        }
        if (!visible) continue;
        for (let k = 0; k < 8; k++) {
          // true projected bounds, NOT clamped: analyzeTextProbes detects clipping by
          // comparing the box against its own viewport intersection — clamping here
          // would make clipping undetectable. Full-offscreen glyphs are already excluded.
          const sx = pts[k * 2]!;
          const sy = pts[k * 2 + 1]!;
          if (sx < minX) minX = sx;
          if (sy < minY) minY = sy;
          if (sx > maxX) maxX = sx;
          if (sy > maxY) maxY = sy;
          any = true;
        }
      }
      if (any) {
        P.textProbes.push({
          frameIdx: P.currentFrameIdx ?? 0,
          t: f.t,
          text: WORD,
          fontFamily: 'extruded-3d',
          fontPx: maxY - minY,
          fillStyle: '#8a6540',
          globalAlpha: 1,
          layerId: 'inworld_text',
          bbox: [minX, minY, maxX, maxY],
          w: maxX - minX,
          h: maxY - minY,
          cx: (minX + maxX) / 2,
          cy: (minY + maxY) / 2,
          hPct: ((maxY - minY) / 1080) * 100,
          isStroke: false,
        });
      }
    }

    // present: world into depth RT, then physical DoF into out.
    // focus: before the arc, hold the word centre at its true axial depth; during the
    // rack, measure to the tracked letter — both endpoints are f(lt), so the composed
    // distance is still closed-form. Axial projection, not Euclidean (depth pass).
    const rt = this.mainRT(out);
    r.setRenderTarget(rt);
    r.setClearColor(0x050403, 1);
    r.clear();
    r.render(this.world, this.cam);
    this.dust?.render(r, this.cam, rt, lt);
    const fwd = this.tmp.c;
    this.cam.getWorldDirection(fwd);
    const rackW = smoothstep(16, 17.5, lt) * (1 - smoothstep(23.5, 25, lt));
    const cx = focusX * rackW;
    const focusDist = (this.tmp.b.x - this.cam.position.x) * fwd.x * 0 +
      ((cx - this.cam.position.x) * fwd.x + (0.85 - this.cam.position.y) * fwd.y + (-0.15 - this.cam.position.z) * fwd.z);
    this.dof.render(r, rt.texture, rt.depthTexture!, {
      enabled: true,
      focusDistance: Math.max(0.3, focusDist),
      aperture: 7.0,
      maxRadius: 15,
      near: this.cam.near,
      far: this.cam.far,
      samples: 12,
    }, out);
    r.resetState();
    return { bloom: 0.5, vignette: 0.4 };
  }

  override dispose() {
    const r = this.ctx.renderer;
    r.shadowMap.enabled = this.prevShadowEnabled;
    if (this.prevShadowType !== null) r.shadowMap.type = this.prevShadowType;
    this.main?.dispose();
    this.dof.dispose();
    this.dust?.dispose();
    this.keyLight?.shadow.map?.dispose();
    this.world.traverse((o: any) => {
      o.geometry?.dispose?.();
      const m = o.material;
      if (Array.isArray(m)) m.forEach((x) => x.dispose?.());
      else m?.dispose?.();
    });
  }
}
