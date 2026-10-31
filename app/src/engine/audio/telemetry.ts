// Visual to Audio Spatial Telemetry Bridge (f(x) Studio v0.8.0)
// Zero-DSP lightweight module running in browser, WebGL, and Chrome headless CLI environments.
// Captures 60 Hz visual coordinates, spatial NDC projection, velocities, and emits NDJSON streams.

/**
 * Single spatial audio source telemetry state for a frame.
 */
export interface AudioTelemetryPoint {
  sourceId: string;
  pos?: [number, number, number];
  screenPos?: [number, number]; // NDC coordinates [-1, 1]
  pan?: number;                 // Spatial stereo pan, clamped to [-0.65, +0.65] by default
  distance?: number;            // Distance from camera in world/view units
  velocity?: number;            // Magnitude of velocity (units / sec)
  zone?: string;                // Spatial acoustic zone/reverb region identifier
  occluded?: boolean;           // Whether ray to camera is physically blocked
  data?: Record<string, any>;   // Custom arbitrary visual / physical telemetry payloads
}

/**
 * Complete snapshot of all active audio emitter sources at visual frame index `frame` (time `t`).
 */
export interface TelemetryFrame {
  frame: number;
  t: number;
  sources: Record<string, AudioTelemetryPoint>;
}

/**
 * Projects a 3D world position into screen-space NDC and computes stereo panning & distance
 * without requiring a runtime Three.js dependency (pure 4x4 matrix vector arithmetic).
 * Compatible with Three.js column-major Float32Array / Array matrices (camera.matrixWorldInverse.elements).
 *
 * @param worldPos 3D world space coordinate [x, y, z]
 * @param cameraMatrixWorldInverse View matrix (16-element array, column-major)
 * @param cameraProjectionMatrix Projection matrix (16-element array, column-major)
 * @param maxPan Maximum stereo pan range boundary (default 0.65 for natural cinematic speaker/headphone field)
 */
export function projectWorldToScreenPan(
  worldPos: [number, number, number],
  cameraMatrixWorldInverse: number[] | Float32Array,
  cameraProjectionMatrix: number[] | Float32Array,
  maxPan: number = 0.65
): { pan: number; distance: number; ndc: [number, number] } {
  const x = worldPos[0];
  const y = worldPos[1];
  const z = worldPos[2];

  const mV = cameraMatrixWorldInverse;
  const mP = cameraProjectionMatrix;

  // 1. Transform World to View Space: V_view = MatrixWorldInverse * V_world
  const vx = mV[0] * x + mV[4] * y + mV[8] * z + mV[12];
  const vy = mV[1] * x + mV[5] * y + mV[9] * z + mV[13];
  const vz = mV[2] * x + mV[6] * y + mV[10] * z + mV[14];
  const vw = mV[3] * x + mV[7] * y + mV[11] * z + mV[15];

  const invW = vw !== 0 && vw !== 1 ? 1.0 / vw : 1.0;
  const viewX = vx * invW;
  const viewY = vy * invW;
  const viewZ = vz * invW;

  // Euclidean distance from camera origin (0, 0, 0 in view space)
  const distance = Math.sqrt(viewX * viewX + viewY * viewY + viewZ * viewZ);

  // 2. Transform View to Clip Space: V_clip = ProjectionMatrix * V_view
  const cx = mP[0] * viewX + mP[4] * viewY + mP[8] * viewZ + mP[12];
  const cy = mP[1] * viewX + mP[5] * viewY + mP[9] * viewZ + mP[13];
  const cw = mP[3] * viewX + mP[7] * viewY + mP[11] * viewZ + mP[15];

  // 3. Perspective divide to NDC [-1, 1]
  let ndcX = 0;
  let ndcY = 0;

  if (Math.abs(cw) > 1e-7) {
    ndcX = cx / cw;
    ndcY = cy / cw;
  }

  // 4. Compute and clamp spatial stereo pan
  // Scale NDC X coordinate to [-maxPan, +maxPan] and clamp within bounds
  const rawPan = ndcX * maxPan;
  const clampedPan = Math.max(-maxPan, Math.min(maxPan, rawPan));

  return {
    pan: clampedPan,
    distance,
    ndc: [ndcX, ndcY],
  };
}

/**
 * Scene-side telemetry emitter collecting 3D object positions and visual cues per frame.
 */
export class AudioTelemetryEmitter {
  private currentPoints: Record<string, AudioTelemetryPoint> = {};
  private capturedFrames: TelemetryFrame[] = [];

  /**
   * Emit or update telemetry for a source within the active frame.
   */
  public emit(sourceId: string, point: Partial<AudioTelemetryPoint>): void {
    const existing = this.currentPoints[sourceId] || { sourceId };
    this.currentPoints[sourceId] = {
      ...existing,
      ...point,
      sourceId,
    };
  }

  /**
   * Finalize and record the current frame's telemetry snapshot, then reset the active frame accumulator.
   */
  public captureFrame(frameIndex: number, timeSec: number): TelemetryFrame {
    const frame: TelemetryFrame = {
      frame: frameIndex,
      t: timeSec,
      sources: { ...this.currentPoints },
    };

    this.capturedFrames.push(frame);
    this.clearFrame();
    return frame;
  }

  /**
   * Clear staged points for the current in-progress frame without touching captured history.
   */
  public clearFrame(): void {
    this.currentPoints = {};
  }

  /**
   * Serialize a single telemetry frame to 1 line of JSON (NDJSON format).
   */
  public toNDJSON(frame: TelemetryFrame): string {
    return JSON.stringify(frame);
  }

  /**
   * Dump all historical captured frames.
   */
  public dumpFrames(): TelemetryFrame[] {
    return this.capturedFrames;
  }

  /**
   * Dump all historical captured frames as a complete multi-line NDJSON string.
   */
  public toFullNDJSON(): string {
    if (this.capturedFrames.length === 0) return '';
    return this.capturedFrames.map((f) => this.toNDJSON(f)).join('\n') + '\n';
  }

  /**
   * Reset all captured frames and active point buffers.
   */
  public clearAll(): void {
    this.currentPoints = {};
    this.capturedFrames = [];
  }
}

/**
 * Parse an NDJSON stream (newline-delimited JSON) into an array of TelemetryFrame objects.
 */
export function parseTelemetryStream(ndjsonContent: string): TelemetryFrame[] {
  if (!ndjsonContent || !ndjsonContent.trim()) {
    return [];
  }

  const lines = ndjsonContent.split(/\r?\n/);
  const frames: TelemetryFrame[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    try {
      const parsed = JSON.parse(line) as TelemetryFrame;
      if (typeof parsed.frame === 'number' && typeof parsed.t === 'number' && parsed.sources) {
        frames.push(parsed);
      }
    } catch (err) {
      console.warn(`[AudioTelemetry] Failed to parse NDJSON line ${i + 1}: ${line}`, err);
    }
  }

  return frames;
}
