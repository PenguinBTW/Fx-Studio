// k-rate to a-rate Parameter Smoothing Engine (f(x) Studio v0.8.0)
// Bridges 60 Hz visual telemetry / keyframe updates to 48 kHz sample-accurate DSP audio buffers.
// Employs a 1-pole recursive lowpass IIR filter for artifact-free, de-zipped parameter transitions.

export const DEFAULT_SAMPLE_RATE = 48000;

/** Default time constant tau for spatial panning: 8 ms (fast response without clicks) */
export const DEFAULT_PAN_TAU = 0.008;

/** Default time constant tau for linear gain/volume changes: 10 ms (zipper-noise free) */
export const DEFAULT_GAIN_TAU = 0.010;

/** Default time constant tau for biquad/lowpass filter cutoff frequency: 15 ms */
export const DEFAULT_CUTOFF_TAU = 0.015;

/**
 * 1-pole Recursive Lowpass Parameter Smoother:
 * y[n] = y[n-1] + alpha * (target - y[n-1])
 * where alpha = 1 - exp(-1 / (sampleRate * tau))
 */
export class ParameterSmoother {
  private current: number;
  private target: number;
  private tau: number;
  private sampleRate: number;
  private alpha: number = 1.0;

  constructor(
    initialValue: number = 0,
    tau: number = DEFAULT_GAIN_TAU,
    sampleRate: number = DEFAULT_SAMPLE_RATE
  ) {
    this.current = initialValue;
    this.target = initialValue;
    this.tau = tau;
    this.sampleRate = sampleRate;
    this.updateAlpha();
  }

  private updateAlpha(): void {
    if (this.tau <= 0 || this.sampleRate <= 0) {
      this.alpha = 1.0;
    } else {
      this.alpha = 1.0 - Math.exp(-1.0 / (this.sampleRate * this.tau));
      // Clamp alpha between 0 and 1 for numerical stability
      if (this.alpha < 0) this.alpha = 0;
      if (this.alpha > 1) this.alpha = 1;
    }
  }

  /**
   * Set a new target value to smoothly interpolate towards.
   */
  public setTarget(target: number): void {
    this.target = target;
  }

  /**
   * Advance one sample and compute smoothed output value y[n].
   */
  public next(): number {
    this.current += this.alpha * (this.target - this.current);
    // Snap to exact target if difference is negligible to prevent denormals/subnormals
    if (Math.abs(this.target - this.current) < 1e-7) {
      this.current = this.target;
    }
    return this.current;
  }

  /**
   * Process a contiguous buffer of audio samples.
   * If target is supplied, updates the target before filling the buffer.
   *
   * @param outBuffer Destination Float32Array to fill with smoothed parameter values
   * @param target Optional new target value for this buffer chunk
   * @param frameCount Number of samples to render (defaults to outBuffer.length)
   */
  public processBuffer(
    outBuffer: Float32Array,
    target?: number,
    frameCount: number = outBuffer.length
  ): void {
    if (target !== undefined) {
      this.target = target;
    }

    const count = Math.min(frameCount, outBuffer.length);
    for (let i = 0; i < count; i++) {
      outBuffer[i] = this.next();
    }
  }

  /**
   * Reset current value and target immediately without smoothing transition.
   */
  public reset(initialValue: number): void {
    this.current = initialValue;
    this.target = initialValue;
  }

  /**
   * Get current smoothed output value.
   */
  public getValue(): number {
    return this.current;
  }

  /**
   * Get current target value.
   */
  public getTarget(): number {
    return this.target;
  }

  /**
   * Update the time constant tau (in seconds).
   */
  public setTau(tau: number): void {
    this.tau = tau;
    this.updateAlpha();
  }

  /**
   * Get the current time constant tau (in seconds).
   */
  public getTau(): number {
    return this.tau;
  }

  /**
   * Update the audio processing sample rate.
   */
  public setSampleRate(sampleRate: number): void {
    this.sampleRate = sampleRate;
    this.updateAlpha();
  }

  /**
   * Get the current sample rate.
   */
  public getSampleRate(): number {
    return this.sampleRate;
  }

  /**
   * Check if the smoother has converged to within tolerance of the target.
   */
  public isSettled(tolerance: number = 1e-4): boolean {
    return Math.abs(this.target - this.current) <= tolerance;
  }
}

/**
 * Factory for creating Pan smoothers (-1 to 1 range, default tau = 8ms).
 */
export function createPanSmoother(
  initialPan: number = 0,
  sampleRate: number = DEFAULT_SAMPLE_RATE
): ParameterSmoother {
  return new ParameterSmoother(initialPan, DEFAULT_PAN_TAU, sampleRate);
}

/**
 * Factory for creating Gain smoothers (linear amplitude, default tau = 10ms).
 */
export function createGainSmoother(
  initialGain: number = 1.0,
  sampleRate: number = DEFAULT_SAMPLE_RATE
): ParameterSmoother {
  return new ParameterSmoother(initialGain, DEFAULT_GAIN_TAU, sampleRate);
}

/**
 * Factory for creating Filter Cutoff smoothers (Hz, default tau = 15ms).
 */
export function createCutoffSmoother(
  initialCutoffHz: number = 20000,
  sampleRate: number = DEFAULT_SAMPLE_RATE
): ParameterSmoother {
  return new ParameterSmoother(initialCutoffHz, DEFAULT_CUTOFF_TAU, sampleRate);
}
