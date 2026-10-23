// =============================================================================
// GPU POINT CLOUD SHADER: "THE THRESHOLD CONTINUUM"
//
// Custom WebGL ShaderMaterial for 3,000,000 architectural continuum dots:
// - Direct Point-Preserving Streamline Ingestion:
//   - When a chunk deconstructs (smoothTau < 0.5): points peel smoothly from their
//     exact city coordinates (cityPos), compressing toward the chunk centroid and
//     funneling along aerodynamic curves through the window aperture (pWin) at z = 1.95m.
//   - Inside the room (smoothTau >= 0.5): points flow smoothly from the window aperture
//     directly into their exact physical architectural resting locations (roomPos).
//   - Zero coordinate explosions, zero lens-cluttering confetti, zero marshmallows!
// - Progressive window deconstruction (20.2s - 22.0s): mullions, casing, and glass bevels
//   peel into molten golden ribbons and evaporate cleanly before threshold breach.
// - Volumetric interior room lighting: warm ambient fill ensures walls, coffered
//   ceiling, bookcase, and chair are richly illuminated and visible, while the
//   Banker's Lamp (2700K tungsten) casts an intense golden direct pool down onto
//   the laser blueprint, brass compass, triangle, and desk.
// - Ultra-refined anti-aliased Gaussian discs: fine needle-thin streamlines during
//   transit (1.0px - 2.0px) and razor-sharp crystalline detail in the room (1.4px - 3.8px).
// =============================================================================

import * as THREE from 'three';
import { W, H } from '../../engine/gl';

export function createPortalContinuumMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      t: { value: 0 },
      uGlobalAlpha: { value: 1.0 },
      uResolution: { value: new THREE.Vector2(W, H) },
      uSizeMultiplier: { value: 1.0 },
      uTurbulence: { value: 0.20 },
      uStretch: { value: 0.0 },
    },
    vertexShader: /* glsl */ `
      uniform float t;
      uniform float uSizeMultiplier;
      uniform vec2 uResolution;
      uniform float uTurbulence;
      uniform float uStretch;

      // Dual-State Attributes
      attribute vec3 aRoomPos;      // Destination position in the room
      attribute vec3 aCityCol;      // Color in the city
      attribute vec3 aRoomCol;      // Color in the room
      attribute vec4 aParams;       // x: chunkStart, y: stage [0..5, 9=window], z: conduitAngle [0..2pi], w: baseSize
      attribute vec4 aChunkData;    // xyz: cityChunkCentroid, w: distFromCenter (window)
      attribute vec3 aRoomCentroid; // xyz: roomChunkCentroid
      attribute vec3 aStreamAxis;   // Tangential helical swirl axis
      attribute float aPhase;       // Shimmer phase

      varying vec3 vColor;
      varying float vPhase;
      varying float vIntensity;
      varying float vAlpha;

      // Window aperture center at z = 1.95
      const vec3 WINDOW_CENTER = vec3(0.0, 1.65, 1.95);
      const vec3 LAMP_POS = vec3(0.65, 1.25, -0.10);

      // Fast analytic curl turbulence
      vec3 curlTurbulence(vec3 p, float time) {
        float s1 = sin(p.y * 3.2 + time * 1.5 + p.z * 2.1);
        float c1 = cos(p.x * 2.8 + time * 1.3 + p.y * 1.6);
        float s2 = sin(p.z * 3.5 + time * 1.4 + p.x * 2.2);
        return vec3(s1, c1, s2) * 0.5;
      }

      void main() {
        vPhase = aPhase;

        vec3 cityPos = position;
        vec3 roomPos = aRoomPos;
        float chunkStart = aParams.x;
        float stage = aParams.y;
        float conduitAngle = aParams.z;
        float baseSize = aParams.w;
        vec3 cityCentroid = aChunkData.xyz;
        vec3 roomCentroid = aRoomCentroid;

        vec3 curPos;
        vec3 curCol;
        float intensity = 1.0;
        float ptAlpha = 1.0;
        vec3 vel = vec3(0.0);
        float transitFactor = 0.0;

        // =====================================================================
        // CASE 1: THE HERO WINDOW & EMBRASURE (stage == 9.0) (100,000 Points)
        // =====================================================================
        if (stage > 8.5) {
          float distCenter = aChunkData.w; // Distance from window center
          float winStart = 20.2 + distCenter * 0.14 + (aPhase - 0.5) * 0.06;
          float winDuration = 1.6;

          if (t < winStart) {
            // Solid architectural window embedded in deep stone embrasure
            curPos = cityPos;
            curCol = aCityCol;
            intensity = 1.0;
            ptAlpha = (aParams.w < 1.4) ? 0.40 : 1.0; // Glass bevels are subtle reflection, frame is solid
          } else if (t >= winStart + winDuration) {
            // Window has completely streamed away and vanished into the room!
            curPos = vec3(0.0, -9999.0, 0.0);
            curCol = vec3(0.0);
            intensity = 0.0;
            ptAlpha = 0.0;
          } else {
            // Progressive peel: mullions and glass peel into molten golden ribbons flowing into room!
            float tauW = (t - winStart) / winDuration;
            float smoothW = tauW * tauW;

            float swirlTheta = conduitAngle * 2.0 + tauW * 8.0 + aPhase * 6.28;
            float ribbonR = sin(tauW * 3.14159) * 0.18;
            vec3 peelOffset = vec3(
              cos(swirlTheta) * ribbonR,
              sin(swirlTheta) * ribbonR,
              -smoothW * 3.2
            );

            curPos = cityPos + peelOffset;

            // Radiant golden ember stream that evaporates cleanly
            vec3 goldEmber = vec3(1.35, 1.05, 0.55);
            curCol = mix(aCityCol, goldEmber, tauW);
            float fade = (1.0 - tauW) * (1.0 - tauW);
            intensity = 1.0 + fade * 0.5;
            ptAlpha = fade * 0.85;
            vel = vec3(0.0, 0.0, -14.0);
          }
        }
        // =====================================================================
        // CASE 2: CITY-TO-ROOM DIRECT STREAMLINE INGESTION (128 Chunks)
        // =====================================================================
        else {
          float tStart = chunkStart;
          float tDuration = 1.35; // Fluid 1.35s transit
          float tEnd = tStart + tDuration;

          if (t < tStart) {
            // Solid Metropolis State
            curPos = cityPos;
            curCol = aCityCol;
            intensity = 1.0;
            ptAlpha = 1.0;

            // Height-based atmospheric lighting in the city
            if (curPos.y < -2.0) {
              curCol = mix(curCol, vec3(1.10, 0.90, 0.65), 0.15); // Street warm bounce
            } else if (curPos.y > 28.0) {
              curCol = mix(curCol, vec3(0.85, 0.95, 1.10), 0.12); // Sky fill
            }
          } else if (t >= tEnd) {
            // Settled Room Sanctuary State (resting geometry)
            curPos = roomPos;
            curCol = aRoomCol;
            intensity = 1.0;
            ptAlpha = 1.0;

            // Organic micro-motion for coffee steam (strictly stage == 4.5)
            if (stage > 4.4 && stage < 4.6) {
              float steamTime = mod(t * 0.65 + aPhase * 2.2, 2.0);
              float uSteam = steamTime / 2.0; // [0..1]
              curPos.y += uSteam * 0.20;
              curPos.x += sin(uSteam * 4.5 + aPhase * 6.28) * (0.005 + uSteam * 0.020);
              curPos.z += cos(uSteam * 3.8 + aPhase * 6.28) * (0.005 + uSteam * 0.020);
              float sFade = sin(uSteam * 3.14159) * (1.0 - uSteam * 0.55);
              curCol = vec3(0.92, 0.90, 0.86);
              intensity = 0.75;
              ptAlpha = sFade * 0.35; // Delicate, transparent wispy steam!
            } else {
              // Volumetric interior room lighting:
              // 1. Warm ambient fill
              vec3 roomAmbient = vec3(0.68, 0.58, 0.48);

              // 2. Focused direct lighting from the Banker's Lamp
              float lampDist = length(curPos - LAMP_POS);
              float lampAtten = 1.0 / (1.0 + lampDist * lampDist * 2.5);
              vec3 lampDirect = vec3(1.45, 1.18, 0.75) * lampAtten * 0.90;

              // Laser blueprint lines have self-emissive brilliance
              if (stage > 2.9 && stage < 3.1 && curCol.g > 0.80) {
                intensity = 1.45;
                curCol = curCol * 1.30;
              } else {
                curCol = curCol * (roomAmbient + lampDirect);
              }
            }
          } else {
            // ACTIVE COHERENT DIRECT STREAMLINE INGESTION!
            float tau = (t - tStart) / tDuration; // [0..1]
            float smoothTau = smoothstep(0.0, 1.0, tau);
            transitFactor = sin(smoothTau * 3.14159);

            // Window aperture conduit position
            float k = conduitAngle * (96.0 / 6.2831853);
            float kx = mod(k, 12.0) / 11.0 * 2.0 - 1.0; // [-1..1]
            float ky = floor(k / 12.0) / 7.0 * 2.0 - 1.0; // [-1..1]
            vec3 pWin = WINDOW_CENTER + vec3(kx * 0.50, ky * 0.35, -0.05);

            // Clumping: Points pull in toward their chunk centroid before shooting into stream
            float clumpFactor = sin(smoothTau * 3.14159);
            vec3 clumpCity = mix(cityPos, cityCentroid, clumpFactor * 0.50);
            vec3 clumpRoom = mix(roomPos, roomCentroid, clumpFactor * 0.35);

            // Pre-window waypoint routing (funnel from the flanks and above, avoiding camera path!)
            float flankSide = (cityCentroid.x < 0.0) ? -1.0 : 1.0;
            vec3 pPre = vec3(
              pWin.x + flankSide * 2.8 + aStreamAxis.x * 0.3,
              max(pWin.y + 2.4, cityPos.y * 0.30 + 3.2),
              pWin.z + 3.6
            );

            // Post-window room dispersal waypoint
            vec3 pPost = vec3(
              roomPos.x * 0.45 + kx * 0.15,
              roomPos.y * 0.50 + 1.15,
              roomPos.z * 0.50 + 0.95
            );

            // Direct Point-Preserving Spline Trajectory:
            // Point peels directly from city, passes through pWin, and settles at roomPos!
            vec3 cSpline;
            if (smoothTau < 0.5) {
              float u1 = smoothTau * 2.0;
              cSpline = (1.0 - u1) * (1.0 - u1) * clumpCity +
                        2.0 * (1.0 - u1) * u1 * pPre +
                        u1 * u1 * pWin;
              vel = normalize(pWin - cSpline) * 22.0;
            } else {
              float u2 = (smoothTau - 0.5) * 2.0;
              cSpline = (1.0 - u2) * (1.0 - u2) * pWin +
                        2.0 * (1.0 - u2) * u2 * pPost +
                        u2 * u2 * clumpRoom;
              vel = normalize(clumpRoom - cSpline) * 22.0;
            }

            // Helical streamline swirl that smoothly vanishes at start and end
            float ribbonR = transitFactor * 0.030;
            float swirlTheta = conduitAngle * 2.0 + smoothTau * 16.0 + aPhase * 6.28;
            vec3 ribbonSwirl = vec3(cos(swirlTheta), sin(swirlTheta), sin(swirlTheta * 2.0) * 0.5) * ribbonR;

            curPos = cSpline + ribbonSwirl;

            // Streamline colors: radiant golden streamers with cyan accents
            vec3 goldStreamer = vec3(1.25, 0.98, 0.50);
            vec3 cyanAccent = vec3(0.20, 0.94, 1.10);
            float isCyan = step(0.70, sin(conduitAngle * 4.0));
            vec3 streamCol = mix(goldStreamer, cyanAccent, isCyan);

            vec3 midCol = mix(aCityCol, streamCol, smoothstep(0.0, 0.15, smoothTau));
            curCol = mix(midCol, aRoomCol, smoothstep(0.85, 1.0, smoothTau));
            intensity = 1.0 + transitFactor * 0.25;
            ptAlpha = 0.95 + transitFactor * 0.05;
          }
        }

        // Micro-turbulence for subtle organic dispersion
        if (uTurbulence > 0.01) {
          curPos += curlTurbulence(curPos * 1.5, t * 1.1 + aPhase * 6.28) * (0.002 * uTurbulence);
        }

        // Streamline elongation along velocity vector during transit
        if (uStretch > 0.01 && length(vel) > 0.01) {
          curPos += normalize(vel) * min(length(vel) * 0.020, 0.16) * uStretch;
        }

        vec4 mvPos = modelViewMatrix * vec4(curPos, 1.0);
        float dist = max(0.01, -mvPos.z);

        // Near-Camera Lens Clearance:
        // Gracefully fades out any particle that passes within 0.90m of the camera lens
        if (dist < 0.90) {
          ptAlpha *= smoothstep(0.20, 0.90, dist);
        }

        // Point size calibration:
        // In transit: fine needle streams (1.0px - 2.0px) preventing confetti clutter!
        // In city: solid masonry coverage (1.8px - 5.5px)
        // In room: crystalline micro-precision (1.4px - 3.8px)
        float tauStage = clamp((t - chunkStart) / 1.5, 0.0, 1.0);
        float realmMultiplier = mix(0.014, 0.0055, smoothstep(0.15, 0.85, tauStage));
        float curBaseSize = (stage > 8.5) ? aParams.w * 1.2 : mix(3.5, aParams.w, smoothstep(0.15, 0.85, tauStage));

        float streamScale = mix(1.0, 0.50, transitFactor);
        float ptSize = curBaseSize * streamScale * (uResolution.y / dist) * realmMultiplier * uSizeMultiplier;

        // Subtle organic phase breathing per particle
        ptSize *= (0.97 + 0.03 * sin(t * 4.0 + aPhase * 6.28318));

        // Strict clamp preventing giant confetti snowballs
        float maxClamp = (transitFactor > 0.05) ? 2.0 : ((t >= 23.0) ? 3.8 : 5.5);
        gl_PointSize = clamp(ptSize, 1.2, maxClamp);
        gl_Position = projectionMatrix * mvPos;

        vIntensity = intensity;
        vAlpha = ptAlpha;
        vColor = curCol;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float t;
      uniform float uGlobalAlpha;

      varying vec3 vColor;
      varying float vPhase;
      varying float vIntensity;
      varying float vAlpha;

      void main() {
        // Disc coordinates in [-0.5, 0.5]
        vec2 uv = gl_PointCoord - vec2(0.5);
        float r2 = dot(uv, uv);

        if (r2 > 0.25) discard;

        // Smooth circular anti-aliased edge falloff
        float distCenter = sqrt(r2) * 2.0;
        float disc = smoothstep(1.0, 0.70, distCenter);
        float core = exp(-r2 * 22.0) * 0.45;

        // Per-point quantum shimmer
        float shimmer = 0.96 + 0.04 * sin(t * 5.0 + vPhase * 12.566);

        // Full un-premultiplied vibrant color (hardware blendFunc multiplies by alpha)
        vec3 finalCol = vColor * (1.0 + core) * vIntensity * shimmer;

        float alpha = disc * vAlpha * uGlobalAlpha;
        if (alpha < 0.06) discard;

        gl_FragColor = vec4(finalCol, alpha);
      }
    `,
    transparent: true,
    depthTest: true,
    depthWrite: true,
    blending: THREE.NormalBlending,
  });
}
