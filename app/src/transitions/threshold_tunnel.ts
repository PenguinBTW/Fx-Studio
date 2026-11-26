import type { TransitionCtx } from '../engine/transition';
import { ThresholdShaderTransition } from './threshold_lib';

export default class ThresholdTunnel extends ThresholdShaderTransition {
  constructor(ctx: TransitionCtx) { super(ctx, 'tunnel'); }
}
