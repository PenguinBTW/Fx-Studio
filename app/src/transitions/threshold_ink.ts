import type { TransitionCtx } from '../engine/transition';
import { ThresholdShaderTransition } from './threshold_lib';

export default class ThresholdInk extends ThresholdShaderTransition {
  constructor(ctx: TransitionCtx) { super(ctx, 'ink'); }
}
