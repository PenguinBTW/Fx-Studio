// optica — caustics/optics: white light through a slowly rotating crystal paperweight,
// dispersing into a spectral caustic fan on black glass. The catalog's first pure
// optical study. The crystal is a faceted gem with physical transmission+ior+dispersion;
// the caustic fan is an analytic shader — a dispersive rainbow sweep whose angle and
// fanning track the crystal's rotation in closed form. No photon transport simulation:
// every refracted band is pure f(surface_uv, t).
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { W, H } from '../../engine/gl';
import { DepthDoFPass } from '../../engine/dof';
import { smoothstep } from '../../engine/util';

export default class Optica extends Scene {
  private cam = new THREE.PerspectiveCamera(36, W / H, 0.05, 60);
  private world = new THREE.Scene();
  private dof = new DepthDoFPass();
  private main: THREE.WebGLRenderTarget | null = null;
  private gem: THREE.Mesh | null = null;
  private causticMat: THREE.ShaderMaterial | null = null;
  private beam: THREE.Mesh | null = null;
  private tmp = { a: new THREE.Vector3(), b: new THREE.Vector3() };

  override async init() {
    const rr = this.ctx.renderer;
    (this as any)._prevShadow = rr.shadowMap.enabled;
    rr.shadowMap.enabled = true;

    // near-black studio — the light itself is the subject
    this.world.add(new THREE.HemisphereLight(0x182030, 0x050505, 0.22));
    const key = new THREE.SpotLight(0xffffff, 22, 20, 0.24, 0.5, 1.6);
    key.position.set(-4.5, 3.2, 1.5);
    key.target.position.set(0, 0.4, 0);
    key.castShadow = true;
    this.world.add(key, key.target);
    const heart = new THREE.PointLight(0xaaccff, 1.4, 2.0, 1.8);
    heart.position.set(0, 0.55, 0);
    this.world.add(heart);
    const rim = new THREE.DirectionalLight(0x8899ff, 0.4);
    rim.position.set(3, 2, -3);
    this.world.add(rim);

    // black-glass table
    const table = new THREE.Mesh(
      new THREE.CircleGeometry(100, 48),
      new THREE.MeshStandardMaterial({ color: 0x08090c, roughness: 0.5, metalness: 0.4 }),
    );
    table.rotation.x = -Math.PI / 2;
    table.receiveShadow = true;
    this.world.add(table);

    // the crystal: a faceted paperweight — squashed icosahedron, flat-shaded physical glass
    const gemGeo = new THREE.IcosahedronGeometry(0.62, 0);
    gemGeo.scale(1, 0.82, 1);
    const gemMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      metalness: 0,
      roughness: 0.02,
      transmission: 0.96,
      thickness: 0.9,
      ior: 1.52,
      dispersion: 4.5,
      clearcoat: 0.4,
      emissive: 0x1a2a55,
      emissiveIntensity: 0.7,
      flatShading: true,
    });
    this.gem = new THREE.Mesh(gemGeo, gemMat);
    this.gem.position.set(0, 0.44, 0);
    this.gem.castShadow = true;
    this.world.add(this.gem);

    // the incident beam: a slim visible shaft of white light entering from the key
    const beamGeo = new THREE.CylinderGeometry(0.05, 0.09, 5.4, 10, 1, true);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xfff4e0,
      transparent: true,
      opacity: 0.06,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    this.beam = new THREE.Mesh(beamGeo, beamMat);
    this.beam.position.set(-2.3, 1.8, 0.75);
    this.beam.lookAt(0, 0.45, 0);
    this.beam.rotateX(Math.PI / 2);
    this.world.add(this.beam);

    // --- the caustic fan: analytic shader on the table plane just above the surface.
    // A spectral fan spreading from the crystal's base — band angles disperse with
    // the crystal's rotation (dispersion tracks gem yaw in closed form), brightness
    // concentrated in caustic-ish veins via multi-octave ridged noise.
    this.causticMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uYaw: { value: 0 },
      },
      vertexShader: `varying vec2 vUv; varying vec3 vW; void main(){ vUv=uv; vW=(modelMatrix*vec4(position,1.0)).xyz; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
      fragmentShader: `varying vec2 vUv; varying vec3 vW; uniform float uTime; uniform float uYaw;
        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
        float noise(vec2 p){
          vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f);
          return mix(mix(hash(i),hash(i+vec2(1,0)),u.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x), u.y);
        }
        // spectral palette: wavelength-ish violet->red across fan coordinate s in 0..1
        vec3 spectrum(float s){
          vec3 c = vec3(0.0);
          c.r = smoothstep(0.35, 0.65, s) * 1.1 + (1.0 - smoothstep(0.0, 0.12, s)) * 0.35;
          c.g = (1.0 - abs(s - 0.5) * 2.4) * 0.9;
          c.b = (1.0 - smoothstep(0.35, 0.65, s)) * 1.2;
          return max(c, vec3(0.0));
        }
        void main(){
          vec2 p = vW.xz - vec2(0.0, 0.0);
          float dist = length(p);
          if (dist < 0.45) discard;
          vec2 dir = normalize(p);
          // fan axis rotates WITH the gem yaw (refraction path swings) plus slow sway
          float axisA = uYaw * 0.9 + 0.6;
          vec2 axis = vec2(cos(axisA), sin(axisA));
          float along = dot(dir, axis);
          if (along < 0.25) { gl_FragColor = vec4(0.0); return; }
          // fan spread coordinate: perpendicular offset normalized by distance — the fan widens with range
          vec2 perp = vec2(-axis.y, axis.x);
          float s = dot(dir, perp) / max(0.18, along * 0.55) * 0.5 + 0.5;
          if (s < 0.0 || s > 1.0) { gl_FragColor = vec4(0.0); return; }
          // caustic veins: ridged noise concentrated bands, slowly evolving as the gem turns
          float veins = noise(p * 2.6 + uYaw * 2.0) * 0.7 + noise(p * 6.0 - uYaw) * 0.3;
          veins = pow(smoothstep(0.12, 0.5, veins), 1.6);
          float falloff = exp(-dist * 0.55) * smoothstep(0.45, 0.9, dist);
          float bright = veins * falloff * smoothstep(0.25, 0.7, along) * 1.35;
          vec3 col = spectrum(s) * bright;
          gl_FragColor = vec4(col, bright);
        }`,
    });
    const caustic = new THREE.Mesh(new THREE.PlaneGeometry(13, 13), this.causticMat);
    caustic.rotation.x = -Math.PI / 2;
    caustic.position.y = 0.005;
    this.world.add(caustic);
  }

  override render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const lt = f.t;
    const rr = this.ctx.renderer;

    // crystal rotation: slow continuous yaw with a gentle rock — the caustic fan tracks it
    const ease = smoothstep(0, 2, lt);
    const yaw = lt * 0.32 * ease;
    this.gem!.rotation.y = yaw;
    const rock = Math.sin(lt * 0.21);
    this.gem!.rotation.z = rock * 0.08;
    // rocking pivots on the contact edge: the center rises with tilt instead of clipping the table
    this.gem!.position.y = 0.44 + Math.abs(rock) * 0.022;
    this.causticMat!.uniforms.uTime.value = lt;
    this.causticMat!.uniforms.uYaw.value = yaw;

    // camera: low slow arc around the tableau — the fan sweeps past the lens
    const k = smoothstep(0, 30, lt);
    const az = 0.7 + lt * 0.05;
    const rad = 4.4 - k * 0.8;
    this.cam.position.set(Math.sin(az) * rad, 1.35 + Math.sin(lt * 0.09) * 0.2, Math.cos(az) * rad);
    this.tmp.b.set(0.3, 0.35, 0);
    this.cam.up.set(0, 1, 0);
    this.cam.lookAt(this.tmp.b);
    const focusD = this.tmp.a.copy(this.tmp.b).sub(this.cam.position).length();

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
      aperture: 4.0,
      maxRadius: 12,
      samples: 36,
      near: 0.05,
      far: 60,
    }, out);
    rr.resetState();
    return {};
  }

  override dispose() {
    const rr = this.ctx.renderer;
    rr.shadowMap.enabled = (this as any)._prevShadow ?? false;
    this.main?.dispose();
    this.dof.dispose();
    this.world.traverse((o: any) => {
      if (o.isMesh) {
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
