// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
// frost — thermal-crystalline register: a windowpane at dawn in time-lapse.
// Condensation beads the dark glass, then dendritic ice feathers inward from the
// edges as the temperature drops, and the rising sun lights the crystals from
// behind — water becoming mineral in fast-forward. The catalog has crystal
// growth (geode) but nothing thermal: here the phase transition itself is the
// subject. Growth front, sparkle, dawn color — all closed-form in t.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { W, H } from '../../engine/gl';
import { DepthDoFPass } from '../../engine/dof';
import { smoothstep } from '../../engine/util';

export default class Frost extends Scene {
  private cam = new THREE.PerspectiveCamera(35, W / H, 0.02, 60);
  private world = new THREE.Scene();
  private dof = new DepthDoFPass();
  private main: THREE.WebGLRenderTarget | null = null;
  private paneMat: THREE.ShaderMaterial | null = null;
  private _paneGeo: THREE.BufferGeometry | null = null;
  private _bgMesh: THREE.Mesh | null = null;

  override async init() {
    // deep night-to-dawn backdrop behind the glass
    const bgMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: { uDawn: { value: 0 } },
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: `varying vec3 vP;
        uniform float uDawn;
        void main(){
          float h = normalize(vP).y;
          // night: deep blue-black. dawn: amber band rising at the horizon
          vec3 night = mix(vec3(0.008, 0.012, 0.03), vec3(0.02, 0.03, 0.07), smoothstep(-0.3, 0.8, h));
          vec3 dawn = mix(vec3(0.02, 0.02, 0.05), vec3(0.85, 0.45, 0.18), smoothstep(0.5, -0.1, h) * smoothstep(-0.4, 0.05, h));
          vec3 col = mix(night, dawn + night * 0.4, uDawn);
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    this._bgMesh = new THREE.Mesh(new THREE.SphereGeometry(40, 24, 12), bgMat);
    (this as any)._bgMat = bgMat;
    this.world.add(this._bgMesh);

    // the pane: one large shader plane — the entire scene is this surface
    this._paneGeo = new THREE.PlaneGeometry(6, 3.4);
    this.paneMat = new THREE.ShaderMaterial({
      transparent: true,
      uniforms: {
        uTime: { value: 0 },
        uDawn: { value: 0 },
        uCamPos: { value: new THREE.Vector3() },
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vW;
        void main(){
          vUv = uv;
          vec4 w = modelMatrix * vec4(position, 1.0);
          vW = w.xyz;
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: `
        varying vec2 vUv;
        varying vec3 vW;
        uniform float uTime;
        uniform float uDawn;
        uniform vec3 uCamPos;

        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
        float noise(vec2 p){
          vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f);
          return mix(mix(hash(i),hash(i+vec2(1,0)),u.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x), u.y);
        }
        float fbm(vec2 p){
          float v = 0.0, a = 0.5;
          for(int k=0;k<5;k++){ v += noise(p)*a; p *= 2.07; a *= 0.5; }
          return v;
        }
        // ridged fbm — veins/dendrites: sharp branching structure
        float ridged(vec2 p){
          float v = 0.0, a = 0.55;
          for(int k=0;k<5;k++){
            float n = noise(p);
            v += (1.0 - abs(2.0*n - 1.0)) * a;
            p *= 2.13; a *= 0.52;
          }
          return v;
        }

        void main(){
          vec2 uv = vUv;
          vec2 asp = vec2(6.0/3.4, 1.0);
          vec2 p = uv * asp;

          // ---- frost growth front --------------------------------------
          // nucleation at the edges/corners: distance-to-edge delays the front.
          // growth clock: frost creeps inward 4s..24s, closed form.
          float edgeDist = min(min(uv.x, 1.0-uv.x) * asp.x, min(uv.y, 1.0-uv.y));
          // dendrite structure: two interleaved ridged fields at different scales —
          // large feathers + fine fern detail
          // needle dendrites: stretched ridged fields in two crossing orientations —
          // frost crystals grow as directional needles, not isotropic noise
          vec2 d1 = vec2(p.x * 1.2 + p.y * 0.4, p.y * 5.5 - p.x * 0.3);
          vec2 d2 = vec2(p.x * 5.0 + p.y * 0.5, p.y * 1.1 + p.x * 0.35);
          float needles = max(ridged(d1 * 1.4), ridged(d2 * 1.4 + 3.3));
          float dend = needles * 0.75 + ridged(p * 8.0 + 4.7) * 0.25;
          // growth threshold advances inward: edge grows first (small edgeDist),
          // dendrite veins lead the front (high dend freezes earlier)
          float clock = smoothstep(3.0, 27.0, uTime);
          float front = clock * 3.2;
          float frozenAt = pow(edgeDist, 0.72) * 2.4 + (1.0 - dend) * 1.05;
          float frost = smoothstep(frozenAt - 0.06, frozenAt + 0.02, front);
          // fine crystal texture inside frozen regions
          float crystal = ridged(p * 55.0 + dend * 8.0) * 0.7 + ridged(p * 24.0 + dend * 3.0) * 0.3;

          // ---- condensation beads (pre-frost, evaporate as frost overtakes) --
          float beadField = noise(p * 85.0) * noise(p * 60.0 + 9.0);
          float beads = smoothstep(0.48, 0.52, beadField) * 0.4 * (1.0 - frost) * (1.0 - smoothstep(frozenAt - 0.5, frozenAt + 0.02, front));

          // ---- lighting ---------------------------------------------------
          // night glass: dark reflective blue. dawn: backlit amber scattering
          // through the frost — ice transmits diffusely, clear glass stays dark.
          vec3 nightGlass = vec3(0.015, 0.025, 0.05);
          vec3 frostNight = vec3(0.05, 0.08, 0.13);
          vec3 dawnLight = vec3(1.0, 0.55, 0.22);
          vec3 dawnSky = vec3(0.5, 0.35, 0.3);

          // frost scattering: bright where frozen, brighter with crystal detail
          float scatter = frost * (0.4 + crystal * 0.35);
          vec3 iceCool = vec3(0.55, 0.7, 0.9);
          vec3 iceWarm = vec3(1.0, 0.8, 0.55);
          vec3 frostCol = mix(frostNight, mix(iceCool, iceWarm, uDawn * 0.8) * (0.5 + crystal * 0.5), 0.35 + uDawn * 0.65) * scatter;

          // clear glass shows the backdrop through it: dark at night, warm at dawn
          vec3 glassCol = mix(nightGlass, dawnSky * 0.25, uDawn);

          // beads: tiny lenses catching the dawn — glints
          float beadGlint = beads * (0.2 + uDawn * 0.8);

          // sparkle: view-dependent-ish glints inside frost — high freq glitter
          // keyed to fine noise cells, twinkling as the light angle changes
          float cell = hash(floor(p * 90.0));
          float twinkle = step(0.985, cell) * frost * uDawn * (0.5 + 0.5 * sin(uTime * 2.0 + cell * 40.0));

          vec3 col = glassCol * (1.0 - frost * 0.85) + frostCol + vec3(1.0, 0.9, 0.8) * (beadGlint * 0.5 + twinkle * 0.9);
          // growth-front highlight: the advancing edge catches light — crystallizing rim
          float rim = smoothstep(frozenAt - 0.05, frozenAt, front) * (1.0 - smoothstep(frozenAt, frozenAt + 0.05, front));
          col += vec3(0.6, 0.8, 1.0) * rim * (0.3 + uDawn * 0.6);

          float alpha = clamp(frost * 0.9 + beads * 0.5 + 0.08, 0.0, 1.0);
          gl_FragColor = vec4(col, alpha);
        }`,
    });
    const pane = new THREE.Mesh(this._paneGeo, this.paneMat);
    this.world.add(pane);
  }

  override render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const rr = this.ctx.renderer;
    const lt = f.t;

    // dawn rises: cold blue night to amber morning, 8s..26s
    const dawn = smoothstep(8, 26, lt);
    this.paneMat!.uniforms.uTime.value = lt;
    this.paneMat!.uniforms.uDawn.value = dawn;
    (this as any)._bgMat.uniforms.uDawn.value = dawn;

    // camera: macro on the pane, very slow push-in with a slight lateral drift —
    // the growth is the motion, the camera just breathes
    const k = smoothstep(0, 30, lt);
    this.cam.position.set(Math.sin(lt * 0.04) * 0.25, 0.05 + Math.sin(lt * 0.07) * 0.08, 3.4 - k * 0.8);
    this.cam.up.set(0, 1, 0);
    this.cam.lookAt(Math.sin(lt * 0.03) * 0.15, 0.0, 0.0);
    this.paneMat!.uniforms.uCamPos.value.copy(this.cam.position);

    const fwd = this.cam.getWorldDirection(new THREE.Vector3());
    const focusD = new THREE.Vector3(0, 0, 0).sub(this.cam.position).dot(fwd);

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
      focusDistance: Math.max(0.3, focusD),
      aperture: 4,
      maxRadius: 8,
      samples: 16,
      near: 0.02,
      far: 60,
    }, out);
    rr.resetState();
    // exposure rises gently with the dawn
    return { exposure: 0.95 + dawn * 0.2, bloom: 0.35, vignette: 0.45 } as PostOverrides;
  }

  override dispose() {
    this._paneGeo?.dispose();
    this.paneMat?.dispose();
    this._bgMesh?.geometry.dispose();
    ((this as any)._bgMat as THREE.Material | undefined)?.dispose();
    this.main?.dispose();
    this.dof.dispose?.();
  }
}
