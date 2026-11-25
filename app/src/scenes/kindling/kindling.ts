// kindling — combustion: a single match in the dark, extreme macro. Ignition flash, the
// bloom, a steady dancing flame eating down the stick, then death by ember and smoke.
// The catalog's first self-luminous subject: the flame IS the light source — a flickering
// point light at the flame heart illuminates the scene, driven by the same closed-form
// noise as the flame shader so light and shape never disagree. Flame is a billboard SDF
// shader (teardrop distorted by noise), sparks loft in convection spirals, the char front
// creeps up the stick — every element pure f(t).
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { W, H } from '../../engine/gl';
import { DepthDoFPass } from '../../engine/dof';
import { smoothstep } from '../../engine/util';

// deterministic closed-form noise, 1d — used identically in TS (light) and GLSL (shape)
function flick(t: number): number {
  return (
    Math.sin(t * 7.3) * 0.35 +
    Math.sin(t * 13.7 + 1.7) * 0.3 +
    Math.sin(t * 23.1 + 4.2) * 0.2 +
    Math.sin(t * 3.1 + 2.0) * 0.15
  );
}

export default class Kindling extends Scene {
  private cam = new THREE.PerspectiveCamera(34, W / H, 0.02, 40);
  private world = new THREE.Scene();
  private dof = new DepthDoFPass();
  private main: THREE.WebGLRenderTarget | null = null;
  private flameMat: THREE.ShaderMaterial | null = null;
  private flame: THREE.Mesh | null = null;
  private fireLight: THREE.PointLight | null = null;
  private stick: THREE.Mesh | null = null;
  private stickMat: THREE.MeshStandardMaterial | null = null;
  private emberMat: THREE.ShaderMaterial | null = null;
  private smokeMat: THREE.ShaderMaterial | null = null;
  private tmp = { a: new THREE.Vector3(), b: new THREE.Vector3() };

  override async init() {
    const rr = this.ctx.renderer;
    (this as any)._prevShadow = rr.shadowMap.enabled;
    rr.shadowMap.enabled = true;

    // near-black void — faint cool fill so unlit shapes barely read
    this.world.add(new THREE.HemisphereLight(0x2a3848, 0x0a0806, 0.9));
    const moon = new THREE.DirectionalLight(0x4a5a70, 1.2);
    moon.position.set(-2.5, 3, -1.5);
    this.world.add(moon);

    // the fire light: flickering point at the flame heart — THE light source of the scene
    this.fireLight = new THREE.PointLight(0xff8844, 0, 9, 2.0);
    this.fireLight.castShadow = true;
    this.fireLight.shadow.mapSize.set(1024, 1024);
    this.world.add(this.fireLight);

    // matchstick: slender wood box, angled — tip up-left at the flame anchor
    this.stickMat = new THREE.MeshStandardMaterial({ color: 0xb98d54, roughness: 0.8, metalness: 0 });
    this.stickMat.onBeforeCompile = (sh) => {
      sh.uniforms.uChar = { value: 0 };
      sh.uniforms.uEmberLife = { value: 1 };
      (this as any)._charU = sh.uniforms.uChar;
      (this as any)._emberU = sh.uniforms.uEmberLife;
      sh.fragmentShader = ('uniform float uChar;\nuniform float uEmberLife;\nvarying vec3 vObjPos;\n' + sh.fragmentShader)
        .replace('#include <emissivemap_fragment>', `
          #include <emissivemap_fragment>
          // charring: blacken from the tip downward as uChar advances, with a glowing ember edge
          float tipness = clamp(vObjPos.y / 1.5 * 0.5 + 0.5, 0.0, 1.0);
          // the char front starts at the tip (tipness 1) and descends as uChar grows
          float front = 1.0 - uChar;
          float char = smoothstep(front - 0.06, front + 0.06, tipness) * step(0.005, uChar);
          vec3 charcoal = vec3(0.03, 0.02, 0.02);
          diffuseColor.rgb = mix(diffuseColor.rgb, charcoal, char);
          // ember line right at the char front, dying with the flame life
          float ember = (1.0 - smoothstep(0.0, 0.09, abs(tipness - front))) * step(0.01, uChar);
          totalEmissiveRadiance += vec3(1.0, 0.32, 0.05) * ember * 1.4 * uEmberLife;
        `);
      sh.vertexShader = ('varying vec3 vObjPos;\n' + sh.vertexShader)
        .replace('#include <begin_vertex>', '#include <begin_vertex>\n vObjPos = position;');
    };
    const stickGeo = new THREE.BoxGeometry(0.055, 3.0, 0.055);
    this.stick = new THREE.Mesh(stickGeo, this.stickMat);
    this.stick.position.set(0, -1.15, 0);
    this.stick.rotation.z = 0.22;
    this.stick.castShadow = true;
    this.world.add(this.stick);

    // match head: small rough blob at the tip
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.075, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0x7a1f18, roughness: 0.9 }),
    );
    head.position.set(0, 1.52, 0);
    (this as any)._headRef = head;
    this.stick.add(head);

    // --- the flame: billboard plane, SDF teardrop distorted by noise — layered
    // blue base cone, orange body, white-yellow core; alpha-shaped, additive.
    this.flameMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: {
        uTime: { value: 0 },
        uLife: { value: 0 },   // 0 unlit → 1 full flame → 0 dead
        uFlick: { value: 0 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main(){
          vUv = uv;
          // cylindrical billboard: rotate around Y to face the camera
          vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
          vec2 scale = vec2(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz));
          mv.xy += position.xy * scale;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        varying vec2 vUv;
        uniform float uTime;
        uniform float uLife;
        uniform float uFlick;
        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
        float noise(vec2 p){
          vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f);
          return mix(mix(hash(i),hash(i+vec2(1,0)),u.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x), u.y);
        }
        void main(){
          if (uLife < 0.005) { gl_FragColor = vec4(0.0); return; }
          // flame space: x centered, y 0 at base 1 at tip
          vec2 p = vec2(vUv.x - 0.5, vUv.y);
          // sway + turbulence: horizontal distortion grows with height
          float sway = (noise(vec2(uTime * 1.8, 3.7)) - 0.5) * 0.5 + uFlick * 0.05;
          p.x += sway * p.y * p.y * 1.6;
          p.x += (noise(vec2(p.y * 5.0 - uTime * 3.2, uTime * 0.9)) - 0.5) * 0.14 * p.y;
          // teardrop SDF: width profile widest at 30% height, narrowing to a tip
          float w = 0.34 * (1.0 - smoothstep(0.0, 1.0, p.y)) * (0.35 + 0.65 * smoothstep(0.0, 0.28, p.y));
          w *= 1.0 + uFlick * 0.06;
          float d = abs(p.x) - w;
          // vertical extent + flickering tip
          float tip = 0.92 + uFlick * 0.05 + (noise(vec2(uTime * 2.4, 8.1)) - 0.5) * 0.1;
          float body = (1.0 - smoothstep(tip - 0.25, tip, p.y)) * (1.0 - smoothstep(-0.06, 0.0, d));
          body *= smoothstep(0.0, 0.03, p.y);
          // inner core: hotter brighter center
          float core = (1.0 - smoothstep(0.0, 0.05, abs(p.x) - w * 0.45)) * (1.0 - smoothstep(0.0, 0.55, p.y));
          // blue base cone
          float blue = (1.0 - smoothstep(0.0, 0.1, abs(p.x) - w * 0.5)) * (1.0 - smoothstep(0.0, 0.22, p.y));
          vec3 col = vec3(0.0);
          col += vec3(1.0, 0.45, 0.08) * body * 1.1;           // orange body
          col += vec3(1.0, 0.85, 0.4) * core * body * 1.2;     // yellow-white core
          col += vec3(0.25, 0.45, 1.0) * blue * 0.55;          // blue root
          float a = clamp(body + core * body + blue, 0.0, 1.0) * uLife;
          gl_FragColor = vec4(col * uLife, a);
        }`,
    });
    this.flame = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.6), this.flameMat);
    // flame base sits at the match head
    this.flame.position.set(0, 1.55, 0);
    this.stick.add(this.flame);
    this.flame.position.set(0.0, 1.68, 0);

    // --- sparks: tiny points lofting in convection spirals — closed-form helix paths
    const sparkN = 26;
    const sparkPos = new Float32Array(sparkN * 3);
    const sparkGeo = new THREE.BufferGeometry();
    sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
    const seeds = new Float32Array(sparkN);
    for (let i = 0; i < sparkN; i++) seeds[i] = (i * 0.6180339887) % 1;
    sparkGeo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
    this.emberMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uLife: { value: 0 } },
      vertexShader: `
        attribute float aSeed;
        uniform float uTime;
        uniform float uLife;
        varying float vA;
        void main(){
          // helix loft: each spark cycles from the flame base upward along an expanding spiral
          float cyc = fract(uTime * (0.14 + aSeed * 0.1) + aSeed * 7.31);
          float ang = cyc * 12.0 + aSeed * 40.0;
          float r = 0.04 + cyc * 0.5;
          vec3 p = vec3(cos(ang) * r, cyc * 2.6, sin(ang) * r);
          p.x += sin(uTime * 2.0 + aSeed * 20.0) * 0.05 * cyc;
          vA = (1.0 - cyc) * (0.4 + aSeed * 0.6) * uLife * smoothstep(0.0, 0.06, cyc);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = (3.2 - cyc * 2.2) * (120.0 / -mv.z) * 0.02;
          if (uLife < 0.01) gl_PointSize = 0.0;
        }`,
      fragmentShader: `
        varying float vA;
        void main(){
          vec2 c = gl_PointCoord - 0.5;
          float d = 1.0 - smoothstep(0.1, 0.5, length(c));
          gl_FragColor = vec4(vec3(1.0, 0.5, 0.12) * 1.6, d * vA);
        }`,
    });
    const sparks = new THREE.Points(sparkGeo, this.emberMat);
    (this as any)._sparksRef = sparks;
    sparks.frustumCulled = false;
    sparks.position.set(0, 1.55, 0);
    this.stick.add(sparks);

    // --- smoke wisp: ribbon curling up from the tip — visible mostly at death
    this.smokeMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uAmt: { value: 0 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `
        varying vec2 vUv;
        uniform float uTime;
        uniform float uAmt;
        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
        float noise(vec2 p){
          vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f);
          return mix(mix(hash(i),hash(i+vec2(1,0)),u.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x), u.y);
        }
        void main(){
          // meandering column: noise-displaced centerline, soft edges, rising scroll
          vec2 p = vUv;
          float cx = 0.5 + (noise(vec2(p.y * 2.2 - uTime * 0.5, 4.4)) - 0.5) * 0.5 * p.y;
          float d = abs(p.x - cx);
          float body = 1.0 - smoothstep(0.02, 0.1 + p.y * 0.12, d);
          float n = pow(noise(p * vec2(5.0, 3.0) + vec2(0.0, -uTime * 0.8)), 2.4);
          float a = clamp(body * n, 0.0, 1.0) * (1.0 - smoothstep(0.6, 1.0, p.y)) * smoothstep(0.0, 0.15, p.y) * uAmt * 0.11;
          gl_FragColor = vec4(vec3(0.4, 0.45, 0.55) * a, a);
        }`,
    });
    const smoke = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 3.0), this.smokeMat);
    (this as any)._smokeRef = smoke;
    smoke.position.set(0, 3.0, 0);
    this.stick.add(smoke);

    // table hint: large dim surface catching the flicker
    const table = new THREE.Mesh(
      new THREE.CircleGeometry(9, 32),
      new THREE.MeshStandardMaterial({ color: 0x0c0a09, roughness: 0.9, metalness: 0 }),
    );
    table.rotation.x = -Math.PI / 2;
    table.position.y = -2.72;
    table.receiveShadow = true;
    this.world.add(table);
  }

  // fire lifecycle: 0–3 unlit, 3–3.5 strike flash, 3.5–8 bloom, 8–22 steady, 22–28 dying, 28+ ember
  private life(t: number): number {
    if (t < 3) return 0;
    if (t < 3.5) return smoothstep(3, 3.5, t) * 1.5;         // flash overshoot
    if (t < 8) return 1.5 - smoothstep(3.5, 8, t) * 0.5;     // settle to 1.0
    if (t < 22) return 1.0;
    if (t < 28) return 1.0 - smoothstep(22, 28, t) * 0.85;   // dying
    return Math.max(0, 0.15 - smoothstep(28, 30, t) * 0.15); // ember glow gone by 30
  }

  override render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const lt = f.t;
    const rr = this.ctx.renderer;

    const life = this.life(lt);
    const fl = flick(lt);

    this.flameMat!.uniforms.uTime.value = lt;
    this.flameMat!.uniforms.uLife.value = Math.min(life, 1.15);
    this.flameMat!.uniforms.uFlick.value = fl;
    this.emberMat!.uniforms.uTime.value = lt;
    this.emberMat!.uniforms.uLife.value = life;
    this.smokeMat!.uniforms.uTime.value = lt;
    // smoke: thin during burn, blooming at death
    this.smokeMat!.uniforms.uAmt.value = 0.25 * smoothstep(4, 8, lt) * (1 - smoothstep(20, 24, lt))
      + smoothstep(24, 28, lt);
    const charV = smoothstep(5, 27, lt);
    (this as any)._charVal = charV;
    if ((this as any)._charU) (this as any)._charU.value = charV;
    if ((this as any)._emberU) (this as any)._emberU.value = 1.0 - smoothstep(24, 29, lt);
    // the combustion front descends the stick as charring progresses — the flame rides it.
    // tipness 1 = local +1.5; front tipness = 1-charV → local y
    const frontY = ((1 - charV) - 0.5) * 3.0;
    // the flame root is the billboard's bottom edge — center sits half the scaled plane above the front
    const flameHalf = 0.8 * (0.42 + life * 0.4);
    const flameY = frontY + flameHalf;
    this.flame!.position.y = flameY;
    if ((this as any)._sparksRef) (this as any)._sparksRef.position.y = frontY + 0.1;
    if ((this as any)._smokeRef) (this as any)._smokeRef.position.y = flameY + 1.4;

    // flame scale swells with life — bloom is bigger than steady state
    const fs = 0.42 + life * 0.4 + fl * 0.03 * life;
    this.flame!.scale.set(fs, fs, 1);
    // the match head combusts entirely within the first seconds — shrink it away
    if ((this as any)._headRef) {
      const hs = Math.max(0.001, 1.0 - smoothstep(3.5, 7, lt));
      (this as any)._headRef.scale.setScalar(hs);
    }

    // fire light tracks the flame heart in world, flickers WITH the shape noise
    this.flame!.getWorldPosition(this.tmp.a);
    this.tmp.a.y += 0.5 * fs;
    this.fireLight!.position.copy(this.tmp.a);
    this.fireLight!.intensity = life * (2.1 + fl * 0.6);
    this.fireLight!.color.setHSL(0.07 - life * 0.01, 0.95, 0.55);

    // camera: slow drift-in with a slight arc, macro on the flame
    const k = smoothstep(0, 30, lt);
    const az = 0.5 + lt * 0.035;
    const rad = 2.1 - k * 0.7;
    const cy = 0.4 + Math.sin(lt * 0.11) * 0.15 - k * 0.1;
    this.cam.position.set(Math.sin(az) * rad, cy, Math.cos(az) * rad);
    this.cam.up.set(0, 1, 0);
    // frame on the flame heart, drifting up as smoke becomes the subject at death
    this.flame!.getWorldPosition(this.tmp.b);
    this.tmp.b.y += 0.02 + smoothstep(6, 10, lt) * 0.13 + smoothstep(22, 29, lt) * 0.18;
    this.cam.lookAt(this.tmp.b);

    // DoF on the flame heart — view-axis depth
    const fwd = this.cam.getWorldDirection(new THREE.Vector3());
    const focusD = this.tmp.a.clone().sub(this.cam.position).dot(fwd);

    if (!this.main) {
      this.main = new THREE.WebGLRenderTarget(out.width, out.height, {
        type: THREE.HalfFloatType,
        depthTexture: new THREE.DepthTexture(out.width, out.height, THREE.UnsignedInt248Type),
      });
    }
    rr.setRenderTarget(this.main);
    rr.clear(true, true, true);
    rr.render(this.world, this.cam);

    this.dof.render(rr, this.main.texture, this.main.depthTexture!, {
      enabled: true,
      focusDistance: focusD,
      aperture: 3.5,
      maxRadius: 11,
      samples: 36,
      near: 0.02,
      far: 40,
    }, out);
    rr.resetState();
    return { exposure: 1.0, bloom: 0.5, vignette: 0.6 } as PostOverrides;
  }

  override dispose() {
    const rr = this.ctx.renderer;
    rr.shadowMap.enabled = (this as any)._prevShadow ?? false;
    this.main?.dispose();
    this.dof.dispose();
    this.world.traverse((o: any) => {
      if (o.isMesh || o.isPoints) {
        o.geometry?.dispose?.();
        const m = o.material;
        if (Array.isArray(m)) m.forEach((x) => x?.dispose?.());
        else m?.dispose?.();
      }
      if (o.isLight) o.dispose?.();
    });
    super.dispose();
  }
}
