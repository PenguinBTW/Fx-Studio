// s3_type (bars 19-26, 36.73 - 52.28 s): the camera flies -z through heavy Blender-extruded words, one word per
// two bars. Each word slides past the lens on a different side; 2D width-morph echoes count the beats.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { Layer2D } from '../../engine/gl';
import { LineBatch } from '../../engine/lines';
import { F } from '../../engine/type';
import { clamp, ease, prog, hash } from '../../engine/util';
import { createInWorldText } from '../../engine/text_lighting';
import { solveDollyZoom } from '../../engine/rig';
import { C, HALO, BAR, BEAT, bar, sceneTime, model, studioEnv, slam, typeLine, applyCam, lin, DoFPresenter } from './kit';

const ORDER = ['KINETIC', 'TYPE', 'IN', '3D', 'ANY', 'FONT'];
const BLENDER = 4, FONT_FACES = 6;
const SP = 40;
const LEAD = 26;
const V = SP / (1.3 * BAR);
const T0 = bar(19);
const PASS: [number, number][] = [[0, 4.8], [-8.5, 0.4], [0, -4.8], [7.5, 0.8], [-6.5, 3.6], [6.5, -3.2]];
const STREAKS = 420;
// The type canyon: monolith walls either side of the flight path, light strips that chase toward camera on each kick,
// and a gridded mirror-black floor, so the words fly through a place instead of a starfield.
const SLOTS = 70, SLOT = 2.4, WALL = 17, FLOOR_Y = -8;
const ACCENT = ['#46E0FF', '#FF5A1F', '#FFB547', '#FF3D8B', '#46E0FF', '#FF5A1F'];
const TF_VS = `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const TF_FS = `uniform vec3 uAcc; uniform float uKick; varying vec3 vW;
void main(){ vec2 p = vW.xz * 0.25; vec2 q = abs(fract(p) - 0.5) / fwidth(p); float g = 1.0 - min(min(q.x, q.y), 1.0);
  float d = length(vW - cameraPosition), fade = exp(-d * 0.03);
  vec3 c = vec3(0.006, 0.008, 0.014) + uAcc * g * fade * (0.08 + 0.25 * uKick) + uAcc * 0.05 * exp(-abs(vW.x) * 0.25) * fade
    + uAcc * (0.12 + 0.5 * uKick) * exp(-abs(abs(vW.x) - 15.5) * 0.7) * (0.6 + 0.4 * sin(vW.z * 0.9 + vW.x)) * fade;
  gl_FragColor = vec4(c, 1.0); }`;
// Vertigo on "3D": a dolly-zoom (engine solveDollyZoom) holds the word's size while the lens opens 26 -> 88 deg.
const T3 = T0 + (LEAD + 3 * SP) / V;
const DZ0 = T3 - 2.4, DZ1 = T3 - 0.55;

export default class S3Type extends Scene {
  private scene = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(60, 16 / 9, 0.05, 400);
  private layer = new Layer2D();
  private streaks = new LineBatch(STREAKS + 8, { screen2D: false, worldWidth: true, blend: 'add', depthTest: true });
  private words: THREE.Object3D[] = [];
  private panelTex?: THREE.Texture;
  private slabMat?: THREE.MeshStandardMaterial;
  private sig = new THREE.PointLight(new THREE.Color(C.signal), 0, 60, 1.6);
  private dof = new DoFPresenter();
  private w3 = 6;
  private slabs!: THREE.InstancedMesh;
  private strips!: THREE.InstancedMesh;
  private floorM!: THREE.Mesh;
  private floorU = { uAcc: { value: new THREE.Vector3() }, uKick: { value: 0 } };
  private m4 = new THREE.Matrix4(); private cc = new THREE.Color(); private pv = new THREE.Vector3(); private sv = new THREE.Vector3(); private qq = new THREE.Quaternion();

  override async init() {
    const inst = await model(this.ctx, 'type_words');
    this.scene.add(inst.root);
    inst.root.traverse((o) => { if (o.name.startsWith('word_') && !ORDER.slice(0, BLENDER).includes(o.name.slice(5))) o.visible = false; });
    this.scene.environment = studioEnv(this.ctx.renderer);
    this.scene.environmentIntensity = 0.22;
    this.scene.fog = new THREE.FogExp2(0x070a14, 0.016);
    this.scene.background = new THREE.Color(0x070a14);
    // Monolith faces: panel seams plus sparse lit cells, so the walls read as built surfaces at speed.
    const pc = document.createElement('canvas'); pc.width = 256; pc.height = 512;
    const px = pc.getContext('2d')!; px.fillStyle = '#000'; px.fillRect(0, 0, 256, 512);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 4; x++) {
      const r = hash(x * 31 + y, 5);
      px.fillStyle = r > 0.82 ? '#fff' : r > 0.6 ? '#3a3a3a' : '#101010';
      px.fillRect(x * 64 + 3, y * 32 + 3, 58, r > 0.82 ? 6 : 26);
    }
    const pt = new THREE.CanvasTexture(pc); pt.colorSpace = THREE.SRGBColorSpace;
    this.panelTex = pt;
    const slabMat = new THREE.MeshStandardMaterial({ color: 0x1a1c22, metalness: 0.85, roughness: 0.32, emissive: new THREE.Color(C.ice), emissiveMap: pt, emissiveIntensity: 0.6 });
    this.slabMat = slabMat;
    this.slabs = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), slabMat, SLOTS * 2);
    this.strips = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff }), SLOTS * 2 * 3);
    this.slabs.frustumCulled = this.strips.frustumCulled = false;
    this.floorM = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.ShaderMaterial({ vertexShader: TF_VS, fragmentShader: TF_FS, uniforms: this.floorU }));
    this.floorM.rotation.x = -Math.PI / 2; this.floorM.position.y = FLOOR_Y;
    this.scene.add(this.slabs, this.strips, this.floorM);
    const chrome = new THREE.MeshStandardMaterial({ color: 0xa8a49c, metalness: 0.9, roughness: 0.38 });
    const hot = new THREE.MeshStandardMaterial({ color: new THREE.Color(C.signal), metalness: 0.6, roughness: 0.25, emissive: new THREE.Color(C.signal), emissiveIntensity: 0.35 });
    ORDER.forEach((n, i) => {
      let o: THREE.Object3D | undefined;
      if (i < BLENDER) o = inst.root.getObjectByName('word_' + n);
      else if (i === 5) {
        // FONT is six Blender-extruded faces of the same word; render() shows one per beat.
        o = new THREE.Group();
        for (let v = 0; v < FONT_FACES; v++) {
          const w = inst.root.getObjectByName('word_FONT_' + v);
          if (!w) throw new Error('type_words missing word_FONT_' + v);
          const b = new THREE.Box3().setFromObject(w);
          w.position.set(0, 0, 0); w.rotation.set(0, 0, 0); w.scale.setScalar(1 / Math.max(b.max.y - b.min.y, 1e-3));
          w.traverse((m) => { if ((m as THREE.Mesh).isMesh) (m as THREE.Mesh).material = hot; });
          o.add(w);
        }
        this.scene.add(o);
      }
      else {
        // Engine in-world extruded text (text_lighting): any string, lit and shadowed like the Blender words.
        const t = createInWorldText(n, { size: 1, depth: 0.32, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.03, letterSpacing: 0.1, material: i === 5 ? hot : chrome });
        const c = new THREE.Box3().setFromObject(t).getCenter(new THREE.Vector3());
        t.position.sub(c);
        o = new THREE.Group();
        o.add(t);
        this.scene.add(o);
      }
      if (!o) throw new Error('type_words missing word_' + n);
      const box = new THREE.Box3().setFromObject(o);
      const h = box.max.y - box.min.y;
      o.scale.multiplyScalar(5.2 / Math.max(h, 1e-3));
      o.traverse((m) => { const mm = m as THREE.Mesh; if (mm.isMesh && i < BLENDER) mm.material = i === 3 ? hot : chrome; });
      this.words[i] = o;
      if (i === 3) { const b = new THREE.Box3().setFromObject(o); this.w3 = b.max.x - b.min.x; }
    });
    const key = new THREE.DirectionalLight(0xfff1e0, 1.6);
    key.position.set(-6, 8, 6);
    const rim = new THREE.DirectionalLight(new THREE.Color(C.ice), 3.0);
    rim.position.set(8, -2, -10);
    this.scene.add(key, rim, new THREE.AmbientLight(0xffffff, 0.06), this.sig);
  }

  private camPath(T: number) {
    const z = LEAD - (T - T0) * V;
    return { x: 0.8 * Math.sin(T * 0.45), y: 0.4 * Math.sin(T * 0.31), z };
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const T = sceneTime(this.ctx, f.t);
    const lt = T - T0;
    const p = this.camPath(T);
    const k = f.a.kick;
    const inDZ = T >= DZ0 && T < DZ1;

    this.words.forEach((o, i) => {
      const [ox, oy] = PASS[i]!.map((v) => v * 0.72) as [number, number];
      const zW = -i * SP;
      // Word stands on the path at its own z, offset so the lens slips past it; a slow twist reads the extrusion.
      const tPass = T0 + (LEAD + i * SP) / V;
      const u = i === 3 && inDZ ? -1.1 : T - tPass;
      const pp = this.camPath(tPass);
      // Just before the pass the word is flung outward past the frame edge instead of filling the lens.
      const fling = 1 + 2.6 * ease.inCubic(clamp((u + 0.55) / 0.55));
      o.position.set(pp.x + ox * fling, pp.y + oy * fling, zW);
      o.rotation.set(0.0, (i % 2 ? -1 : 1) * (0.18 + 0.12 * Math.tanh(u)), (i % 2 ? 1 : -1) * 0.04);
      const s = 1 + 0.05 * k;
      o.scale.setScalar(o.scale.x / (o.userData.s ?? 1) * s);
      o.userData.s = s;
      o.visible = (u > -2.8 && u < 1.5) || (inDZ && i === 4);
      if (i === 5) { const fv = ((Math.floor((T - T0) / BEAT) % FONT_FACES) + FONT_FACES) % FONT_FACES; o.children.forEach((c, v) => (c.visible = v === fv)); }
      // Keep close passes from blowing out: emissive and lit energy fall off inside the last few metres.
      const near = clamp(1 - (p.z - o.position.z - 2) / 14, 0, 1);
      o.traverse((m) => { const mm = (m as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined; if (mm && 'emissiveIntensity' in mm) { mm.userData.e0 ??= mm.emissiveIntensity; mm.emissiveIntensity = mm.userData.e0 * (0.25 + 0.75 * (1 - near)); } });
    });

    const roll = 0.1 * Math.sin(lt * 0.6) + 0.05 * k;
    let focus = 20;
    if (inDZ) {
      // Solve against the word's real front face so its screen size holds while the background stretches.
      const o3 = this.words[3]!;
      o3.updateMatrixWorld(true);
      const bb = new THREE.Box3().setFromObject(o3), w = bb.getCenter(new THREE.Vector3());
      const fov = 26 + 62 * ease.inOutCubic(clamp((T - DZ0) / (DZ1 - DZ0)));
      const dz = solveDollyZoom([w.x, w.y, bb.max.z], [0, 0, -1], bb.max.x - bb.min.x, fov, 0.8);
      applyCam(this.cam, { pos: dz.position, tgt: [w.x, w.y, w.z], fov: dz.fov, roll: 0.04 * Math.sin(lt * 2) }, 0);
      focus = dz.position[2] - w.z;
    } else {
      applyCam(this.cam, { pos: [p.x, p.y, p.z], tgt: [p.x * 0.6, p.y * 0.6, p.z - 20], fov: 62 + 6 * Math.sin(lt * 0.4), roll }, k);
      // Rack focus to the next word ahead of the lens; words that rush past go to bokeh.
      for (const o of this.words) { const d = p.z - o.position.z; if (o.visible && d > 3) { focus = d; break; } }
    }
    this.sig.position.set(p.x, p.y + 1, p.z - 12);
    this.sig.intensity = 6 + 30 * f.a.snare;

    {
      const wi = clamp(Math.floor((T - T0 + LEAD / V) / (1.3 * BAR)), 0, 5);
      const acc = new THREE.Color(ACCENT[wi]!);
      this.floorU.uAcc.value.set(acc.r, acc.g, acc.b); this.floorU.uKick.value = f.a.kick;
      if (this.slabMat) { this.slabMat.emissive.copy(acc).lerp(new THREE.Color(C.ice), 0.5); this.slabMat.emissiveIntensity = 0.35 + 0.9 * f.a.kick; }
      this.floorM.position.set(p.x, FLOOR_Y, p.z);
      const span = SLOTS * SLOT, bt = ((T - bar(1)) / BEAT) % 1;
      for (let i = 0; i < SLOTS; i++) for (let sd = 0; sd < 2; sd++) {
        const k = i * 2 + sd, side = sd ? 1 : -1;
        const z = p.z + 6 - ((((hash(k * 0.7) * 0 + i * SLOT - (p.z - LEAD)) % span) + span) % span);
        const hgt = 10 + 26 * hash(k * 3.3), wd = 2 + 5 * hash(k * 5.1), dep = SLOT * (0.55 + 0.4 * hash(k * 2.2));
        const x = side * (WALL + wd / 2 + 3 * hash(k * 1.9));
        this.slabs.setMatrixAt(k, this.m4.compose(this.pv.set(x, FLOOR_Y + hgt / 2, z), this.qq.identity(), this.sv.set(wd, hgt, dep)));
        const dist = p.z - z, wave = Math.exp(-Math.pow((dist / span - bt) * 7, 2)) * f.a.kick;
        for (let j = 0; j < 3; j++) {
          const yy = FLOOR_Y + hgt * (0.25 + 0.3 * j + 0.1 * hash(k * 7 + j));
          this.strips.setMatrixAt(k * 3 + j, this.m4.compose(this.pv.set(x - side * (wd / 2 + 0.02), yy, z), this.qq.identity(), this.sv.set(0.06, 0.12, dep * 0.9)));
          const on = hash(k * 11 + j + wi * 17) < 0.55 ? 1 : 0.08;
          this.cc.copy(acc).multiplyScalar(on * (0.6 + 6 * wave + 1.2 * f.a.snare));
          this.strips.setColorAt(k * 3 + j, this.cc);
        }
      }
      this.slabs.instanceMatrix.needsUpdate = true; this.strips.instanceMatrix.needsUpdate = true;
      if (this.strips.instanceColor) this.strips.instanceColor.needsUpdate = true;
    }
    const L = this.streaks;
    L.clear();
    const ice = lin(C.ice, 1.1), bone = lin(C.bone, 0.9);
    const len = 1.5 + 2.5 * f.a.rms;
    for (let i = 0; i < STREAKS; i++) {
      const a = hash(i * 3.1) * Math.PI * 2;
      const r = 2.5 + hash(i * 7.7) * 14;
      const span = 120;
      const z0 = hash(i * 1.3) * span;
      const z = p.z - 4 - ((((z0 - (p.z - LEAD)) % span) + span) % span);
      const c = i % 5 === 0 ? ice : bone;
      const al = 0.25 + 0.5 * hash(i * 9.1);
      L.seg(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r, z, p.x + Math.cos(a) * r, p.y + Math.sin(a) * r, z + len, 0.02, c[0], c[1], c[2], al);
    }

    const g = this.layer.ctx;
    this.layer.clear();
    const WB = 1.3 * BAR;
    const lead = LEAD / V - WB;
    const wi = clamp(Math.floor((lt - lead) / WB), 0, ORDER.length - 1);
    const nb = Math.max(0, Math.floor((lt - lead - wi * WB) / BEAT));
    const bt = T0 + lead + wi * WB + nb * BEAT;
    if (lt >= 0 && lt < 8 * BAR) {
    }

    this.dof.render(this.ctx, out, this.scene, this.cam, { focus, aperture: inDZ ? 6 : 10, maxRadius: 14 }, this.layer, (rt) => L.render(this.ctx.renderer, rt, this.cam));
    const wordHit = Math.exp(-((((lt) % (2 * BAR)) + 2 * BAR) % (2 * BAR)) * 6);
    const exit = prog(T, bar(26), bar(27), ease.inQuad);
    return {
      exposure: 1.05,
      bloom: 0.45 + 0.25 * k,
      bloomThreshold: 0.88,
      vignette: 0.5,
      ca: 0.5 + 1.2 * k + 3 * exit,
      grain: 0.05,
      zoom: 1 + 0.03 * wordHit + 0.05 * exit,
      shake: [0.1 * k, -0.6 * (0.1 * k)],
    };
  }

  override dispose(): void {
    this.dof.dispose();
    for (const m of [this.slabs, this.strips]) { m.geometry.dispose(); (m.material as THREE.Material).dispose(); m.dispose(); }
    this.floorM.geometry.dispose(); (this.floorM.material as THREE.Material).dispose();
    this.panelTex?.dispose();
    this.words.slice(BLENDER, 5).forEach((o) => o?.traverse((m) => { const mm = m as THREE.Mesh; if (mm.isMesh) { mm.geometry.dispose(); (mm.material as THREE.Material).dispose(); } }));
  }
}
