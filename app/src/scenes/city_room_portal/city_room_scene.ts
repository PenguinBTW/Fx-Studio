// =============================================================================
// MASTER PROCEDURAL SCENE: "METROPOLIS TO SANCTUARY"
//
// 3,000,000-Point Procedural Continuum (36.0 Seconds // 2,160 Frames @ 60 FPS):
//
// 1. Single Continuous C1 Cinema Trajectory (Zero cuts, zero jumps)
// 2. High-Density Procedural Metropolis (Sprawling avenue, 40+ skyscrapers,
//    illuminated glass skyways, streaming traffic, Art Deco hero skyscraper)
// 3. Direct Point-Preserving Streamline Ingestion (13.0s - 20.8s):
//    City dots group into luminous fluid streamlines that rush past the camera through
//    the window aperture (0, 1.65, 1.95), physically assembling the room bit by bit:
//      - Chunks 0..23 (13.0s - 15.0s): Horizon towers stream in to weave parquet floor
//      - Chunks 24..39 (14.2s - 16.2s): Avenue & traffic stream in to assemble Persian rug
//      - Chunks 40..63 (15.5s - 17.5s): Canyon towers stream in to construct wainscot walls & ceiling
//      - Chunks 64..87 (16.8s - 18.8s): Midground blocks stream in to build library & 1,500+ books
//      - Chunks 88..103 (18.0s - 19.8s): Flanking blocks stream in to carve desk & Chesterfield armchair
//      - Chunks 104..127 (19.2s - 20.8s): Hero skyscraper streams in to form blueprint & instruments
// 4. Window Stream-Away (20.8s - 22.8s):
//    The window casing, brass mullions, and glass peel off into golden ribbons that
//    flow into the room and dissolve, leaving an unobstructed threshold for camera breach.
// 5. Threshold Breach & Wide Sanctuary Reveal (22.8s - 27.0s):
//    Camera crosses the empty threshold, revealing the expansive sanctuary, the full Persian rug,
//    herringbone floor, library wall, and drafting furniture.
// 6. Interior Sanctuary Macro Climax (27.0s - 36.0s):
//    Intimate 3/4 glide framing glowing cyan laser blueprints, incandescent filament,
//    emerald hood, precision brass beam compass, and rising coffee steam motes.
// =============================================================================

import * as THREE from 'three';
import { Scene, Frame, PostOverrides } from '../../engine/scene';
import { W, H } from '../../engine/gl';
import { ease, lerp, prog } from '../../engine/util';

import { createPortalContinuumMaterial } from './portal_shader';
import { PortalContinuumCloud } from './portal_continuum_cloud';

export default class CityRoomScene extends Scene {
  private scene3D!: THREE.Scene;
  private camera3D!: THREE.PerspectiveCamera;

  // 3,000,000-Point Continuum Cloud
  private cloud!: PortalContinuumCloud;
  private mesh!: THREE.Points;
  private mat!: THREE.ShaderMaterial;

  override async init(): Promise<void> {
    this.scene3D = new THREE.Scene();
    this.camera3D = new THREE.PerspectiveCamera(54, W / H, 0.02, 180.0);

    // 1. Create GPU Shader Material & Point Cloud
    this.mat = createPortalContinuumMaterial();
    this.cloud = new PortalContinuumCloud();
    this.mesh = new THREE.Points(this.cloud.geometry, this.mat);
    this.scene3D.add(this.mesh);
  }

  override render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t;
    const { renderer } = this.ctx;

    // Hard clean cut to pure black at exactly 36.0s
    if (t >= 36.0) {
      renderer.setRenderTarget(out);
      renderer.setClearColor(0x050506, 1.0);
      renderer.clear();
      return {
        bloom: 0,
        bloomThreshold: 1.0,
        ca: 0,
        vignette: 0,
        filmGrain: 0,
      };
    }

    // -------------------------------------------------------------------------
    // 1. GPU UNIFORMS UPDATE
    // -------------------------------------------------------------------------
    this.mat.uniforms.t!.value = t;

    // Streamline velocity elongation during quantum ingestion & window peeling
    const stretch = (t >= 13.0 && t <= 23.0)
      ? Math.sin(prog(t, 13.0, 23.0, ease.linear) * Math.PI) * 1.50
      : 0.0;

    this.mat.uniforms.uStretch!.value = stretch;
    this.mat.uniforms.uGlobalAlpha!.value = 1.0;
    this.mat.uniforms.uSizeMultiplier!.value = (t >= 24.0) ? 1.04 : 1.0;
    this.mat.uniforms.uTurbulence!.value = (t >= 13.0 && t <= 23.0) ? 0.70 : 0.20;

    // -------------------------------------------------------------------------
    // 2. CONTINUOUS C1 CINEMA TRAJECTORY (36.0s FLIGHT, ZERO CUTS)
    // -------------------------------------------------------------------------
    const camPos = new THREE.Vector3();
    const camTarget = new THREE.Vector3();
    let fov = 54.0;

    if (t < 5.5) {
      // Act I-A: Soaring high-altitude dive across skyscraper crowns & blinking beacons
      const u = prog(t, 0.0, 5.5, ease.inOutCubic);
      camPos.set(
        lerp(12.0, 3.5, u),
        lerp(30.0, 15.0, u),
        lerp(70.0, 40.0, u)
      );
      camTarget.set(
        lerp(0.0, 0.0, u),
        lerp(10.0, 5.5, u),
        lerp(18.0, 10.0, u)
      );
      fov = lerp(66.0, 60.0, u);
    } else if (t < 11.5) {
      // Act I-B: Canyon descent passing directly under glass skyways with streaming traffic below
      const u = prog(t, 5.5, 11.5, ease.inOutCubic);
      camPos.set(
        lerp(3.5, 0.4, u) + Math.sin(u * Math.PI) * 1.2,
        lerp(15.0, 4.2, u),
        lerp(40.0, 16.0, u)
      );
      camTarget.set(
        0.0,
        lerp(5.5, 2.0, u),
        lerp(10.0, 3.5, u)
      );
      fov = lerp(60.0, 52.0, u);
    } else if (t < 16.0) {
      // Act II: Decelerating approach framing the hero skyscraper facade and the illuminated window
      const u = prog(t, 11.5, 16.0, ease.inOutCubic);
      camPos.set(
        lerp(0.4, 0.12, u),
        lerp(4.2, 1.80, u),
        lerp(16.0, 8.00, u)
      );
      camTarget.set(0.0, 1.65, 1.95);
      fov = lerp(52.0, 45.0, u);
    } else if (t < 20.2) {
      // Act III-A: Ingestion active! Distant towers clump into streams rushing through the window
      const u = prog(t, 16.0, 20.2, ease.inOutCubic);
      camPos.set(
        lerp(0.12, 0.02, u),
        lerp(1.80, 1.66, u),
        lerp(8.00, 2.75, u)
      );
      camTarget.set(0.0, 1.65, lerp(1.95, 0.70, u));
      fov = lerp(45.0, 42.0, u);
    } else if (t < 22.0) {
      // Act III-B: Window casing, mullions, and glass stream away into golden ribbons!
      const u = prog(t, 20.2, 22.0, ease.inOutCubic);
      camPos.set(
        lerp(0.02, 0.0, u),
        lerp(1.66, 1.65, u),
        lerp(2.75, 2.05, u)
      );
      camTarget.set(0.0, lerp(1.65, 1.30, u), lerp(0.70, -0.10, u));
      fov = lerp(42.0, 46.0, u);
    } else if (t < 26.5) {
      // Act IV: Breaching through the open threshold into the sanctuary
      // Wide perspective revealing the Persian rug, parquet floor, grand library, and drafting desk
      const u = prog(t, 22.0, 26.5, ease.inOutCubic);
      camPos.set(
        lerp(0.0, 0.15, u),
        lerp(1.65, 1.55, u),
        lerp(2.05, 1.15, u)
      );
      camTarget.set(
        lerp(0.0, 0.06, u),
        lerp(1.30, 0.96, u),
        lerp(-0.10, -0.30, u)
      );
      fov = lerp(46.0, 52.0, u);
    } else {
      // Act V: Elegant 3/4 cinematic macro glide across the architect's desk
      // Wide cinematic framing: cyan blueprint, brass compass, triangle, banker's lamp, mug steam, clock, and tufted chair
      const u = prog(t, 26.5, 36.0, ease.outCubic);
      camPos.set(
        lerp(0.15, 0.12, u),
        lerp(1.55, 1.48, u),
        lerp(1.15, 0.85, u)
      );
      camTarget.set(
        lerp(0.06, 0.02, u),
        lerp(0.96, 0.98, u),
        lerp(-0.10, -0.15, u)
      );
      fov = lerp(52.0, 50.0, u);
    }

    this.camera3D.position.copy(camPos);
    this.camera3D.lookAt(camTarget);
    this.camera3D.fov = fov;
    this.camera3D.updateProjectionMatrix();

    // -------------------------------------------------------------------------
    // 3. RENDER 3D SCENE TO TEXTURE (Clean high-art cinematic rendering, zero HUD)
    // -------------------------------------------------------------------------
    renderer.setRenderTarget(out);
    renderer.setClearColor(0x060608, 1.0);
    renderer.clear(true, true, true);
    renderer.render(this.scene3D, this.camera3D);

    // -------------------------------------------------------------------------
    // 4. POST-PROCESSING OVERRIDES (Optical Comfort & Dynamic Bloom)
    // -------------------------------------------------------------------------
    let bloom = 0.15;
    let bloomThresh = 0.86;
    let ca = 0.03;

    // Subtle flare during window dissolution (20.8s - 22.8s)
    if (t >= 20.8 && t <= 22.8) {
      const flare = Math.sin(prog(t, 20.8, 22.8, ease.linear) * Math.PI);
      bloom += flare * 0.05;
      ca += flare * 0.02;
    }

    return {
      bloom,
      bloomThreshold: bloomThresh,
      ca,
      vignette: 0.20,
      filmGrain: 0.012,
    };
  }
}
