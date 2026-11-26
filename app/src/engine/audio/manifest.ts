// Mix Manifest DSL & Audio Architecture Types (f(x) Studio v0.8.0)
// Declarative multi-stem soundtrack mixing, spatial sources, bus ducking, and mastering config.

/**
 * Mix bus identifiers for hierarchical signal routing and mastering.
 */
export type MixBus = 'music' | 'sfx' | 'sub' | 'vo' | 'foley_guide' | 'ambient';

export const VALID_MIX_BUSES: readonly MixBus[] = [
  'music',
  'sfx',
  'sub',
  'vo',
  'foley_guide',
  'ambient',
] as const;

/**
 * Mapping of stem name to audio asset file path or relative URL.
 * e.g. { drums: 'stems/drums.wav', bass: 'stems/bass.wav', vocals: 'stems/vocals.wav', other: 'stems/other.wav' }
 */
export type StemsConfig = Record<string, string>;

export interface StemDrumsEdit {
  leadBars?: number;
  lagBars?: number;
  transientLock?: boolean;
}

export interface StemVocalsEdit {
  leadBars?: number;
  lagBars?: number;
  breathGate?: boolean;
}

export interface StemOtherEdit {
  tailSpillover?: {
    spillSec?: number;
    tauSec?: number;
  };
}

export interface StemEditOptions {
  drums?: StemDrumsEdit;
  vocals?: StemVocalsEdit;
  other?: StemOtherEdit;
  [k: string]: any;
}

export interface Excision {
  fromBar: number;
  toBar: number;
  stems?: StemEditOptions;
}

export interface SoundtrackEdits {
  quantize?: 'bars' | 'beats' | 'seconds';
  excise?: Excision[];
}

export interface SoundtrackConfig {
  id: string;
  bus?: MixBus;
  stems: StemsConfig;
  gainDb?: number;
  pan?: number;
  at?: number;
  edits?: SoundtrackEdits;
}

export interface SpatialConfig {
  mode?: 'screen_vector' | 'distance_only' | 'fixed_pan';
  maxPan?: number;
  distanceAttenDb?: number;
  distanceLpfHz?: [number, number];
  occlusionNotchDb?: number;
}

export interface ModulationConfig {
  velocityToGainDb?: [number, number];
  velocityToPitchCents?: [number, number];
}

export interface SpatialSourceConfig {
  id: string;
  file: string;
  bus?: MixBus;
  bindTo: string;
  spatial?: SpatialConfig;
  modulation?: ModulationConfig;
}

export interface VocalSanctuaryConfig {
  centerHz?: number;
  q?: number;
  cutDb?: number;
}

export interface SplitBandDuckConfig {
  cues: string[];
  splitHz?: number;
  attenDb?: number;
  attackMs?: number;
  releaseMs?: number;
}

export interface BusConfig {
  gainDb?: number;
  vocalSanctuary?: VocalSanctuaryConfig;
  splitBandDuck?: SplitBandDuckConfig;
}

export interface MasterConfig {
  lufs?: number;
  truePeak?: number;
  normalize?: boolean;
  limiter?: boolean;
  limiterLookaheadMs?: number;
  /** Optional pre-limiter reconstruction-control low-pass frequency in Hz. */
  reconstructionLowpassHz?: number;
  fadeOut?: { at: number; dur: number };
  /** Optional upward compression that raises room-tone/negative-space floor before loudness normalization. */
  lowLevelLift?: { thresholdDb?: number; ratio?: number; maxLiftDb?: number };
  downwardCompress?: { thresholdDb?: number; ratio?: number };
}

export interface MixStemConfig {
  id: string;
  file: string;
  bus: MixBus;
  at?: number;
  eventId?: string;
  gainDb?: number;
  pan?: number;
  offset?: number;
  onset?: number;
  automation?: Array<{ t: number; gainDb: number }>;
}

export interface MixConfig {
  /** Optional deterministic stem-generation script, resolved relative to this mix file and run before loading stems. */
  build?: string;
  sampleRate?: number;
  stems?: MixStemConfig[];
  soundtracks?: SoundtrackConfig[];
  spatialSources?: SpatialSourceConfig[];
  buses?: Partial<Record<MixBus, BusConfig>>;
  duck?: {
    bus?: MixBus;
    cues: string[];
    amountDb?: number;
    attack?: number;
    release?: number;
    hold?: number;
    splitBand?: boolean;
    splitHz?: number;
  };
  mutes?: any[];
  master?: MasterConfig;
}

export interface MixValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validates a MixConfig structure against audio engine invariants.
 */
export function validateMix(config: MixConfig): MixValidationResult {
  const errors: string[] = [];

  if (!config || typeof config !== 'object') {
    return { valid: false, errors: ['MixConfig must be a non-null object.'] };
  }

  if (config.sampleRate !== undefined) {
    if (typeof config.sampleRate !== 'number' || config.sampleRate <= 0 || !Number.isFinite(config.sampleRate)) {
      errors.push(`sampleRate must be a positive finite number, got: ${config.sampleRate}`);
    }
  }

  if (config.soundtracks !== undefined) {
    if (!Array.isArray(config.soundtracks)) {
      errors.push('soundtracks must be an array.');
    } else {
      config.soundtracks.forEach((st, idx) => {
        if (!st || typeof st !== 'object') {
          errors.push(`soundtracks[${idx}] must be a valid SoundtrackConfig object.`);
          return;
        }
        if (typeof st.id !== 'string' || st.id.trim().length === 0) {
          errors.push(`soundtracks[${idx}].id must be a non-empty string.`);
        }
        if (st.bus !== undefined && !VALID_MIX_BUSES.includes(st.bus)) {
          errors.push(`soundtracks[${idx}].bus "${st.bus}" is invalid. Expected one of: ${VALID_MIX_BUSES.join(', ')}.`);
        }
        if (!st.stems || typeof st.stems !== 'object' || Object.keys(st.stems).length === 0) {
          errors.push(`soundtracks[${idx}].stems must be a non-empty Record<string, string>.`);
        } else {
          for (const [stemName, stemPath] of Object.entries(st.stems)) {
            if (typeof stemPath !== 'string' || stemPath.trim().length === 0) {
              errors.push(`soundtracks[${idx}].stems["${stemName}"] must be a non-empty string path.`);
            }
          }
        }
        if (st.gainDb !== undefined && (typeof st.gainDb !== 'number' || !Number.isFinite(st.gainDb))) {
          errors.push(`soundtracks[${idx}].gainDb must be a finite number.`);
        }
        if (st.pan !== undefined && (typeof st.pan !== 'number' || st.pan < -1 || st.pan > 1)) {
          errors.push(`soundtracks[${idx}].pan must be a number between -1.0 and 1.0.`);
        }
        if (st.edits?.excise !== undefined) {
          if (!Array.isArray(st.edits.excise)) {
            errors.push(`soundtracks[${idx}].edits.excise must be an array of Excision objects.`);
          } else {
            st.edits.excise.forEach((ex, exIdx) => {
              if (typeof ex.fromBar !== 'number' || ex.fromBar < 0 || !Number.isFinite(ex.fromBar)) {
                errors.push(`soundtracks[${idx}].edits.excise[${exIdx}].fromBar must be a non-negative finite number.`);
              }
              if (typeof ex.toBar !== 'number' || ex.toBar < 0 || !Number.isFinite(ex.toBar)) {
                errors.push(`soundtracks[${idx}].edits.excise[${exIdx}].toBar must be a non-negative finite number.`);
              }
              if (typeof ex.fromBar === 'number' && typeof ex.toBar === 'number' && ex.toBar < ex.fromBar) {
                errors.push(`soundtracks[${idx}].edits.excise[${exIdx}].toBar (${ex.toBar}) cannot be less than fromBar (${ex.fromBar}).`);
              }
            });
          }
        }
      });
    }
  }

  if (config.spatialSources !== undefined) {
    if (!Array.isArray(config.spatialSources)) {
      errors.push('spatialSources must be an array.');
    } else {
      config.spatialSources.forEach((sp, idx) => {
        if (!sp || typeof sp !== 'object') {
          errors.push(`spatialSources[${idx}] must be a valid SpatialSourceConfig object.`);
          return;
        }
        if (typeof sp.id !== 'string' || sp.id.trim().length === 0) {
          errors.push(`spatialSources[${idx}].id must be a non-empty string.`);
        }
        if (typeof sp.file !== 'string' || sp.file.trim().length === 0) {
          errors.push(`spatialSources[${idx}].file must be a non-empty string.`);
        }
        if (typeof sp.bindTo !== 'string' || sp.bindTo.trim().length === 0) {
          errors.push(`spatialSources[${idx}].bindTo must be a non-empty string referencing a node.`);
        }
        if (sp.bus !== undefined && !VALID_MIX_BUSES.includes(sp.bus)) {
          errors.push(`spatialSources[${idx}].bus "${sp.bus}" is invalid. Expected one of: ${VALID_MIX_BUSES.join(', ')}.`);
        }
      });
    }
  }

  if (config.buses !== undefined) {
    if (typeof config.buses !== 'object') {
      errors.push('buses must be an object mapping MixBus names to BusConfig.');
    } else {
      for (const [busKey, busVal] of Object.entries(config.buses)) {
        if (!VALID_MIX_BUSES.includes(busKey as MixBus)) {
          errors.push(`buses["${busKey}"] is not a valid MixBus name.`);
        }
        if (busVal?.splitBandDuck !== undefined) {
          if (!Array.isArray(busVal.splitBandDuck.cues)) {
            errors.push(`buses["${busKey}"].splitBandDuck.cues must be an array of string cue IDs.`);
          }
        }
      }
    }
  }

  if (config.master !== undefined) {
    if (typeof config.master !== 'object') {
      errors.push('master must be an object.');
    } else {
      if (config.master.lufs !== undefined && (typeof config.master.lufs !== 'number' || !Number.isFinite(config.master.lufs))) {
        errors.push('master.lufs must be a finite number.');
      }
      if (config.master.truePeak !== undefined && (typeof config.master.truePeak !== 'number' || !Number.isFinite(config.master.truePeak))) {
        errors.push('master.truePeak must be a finite number.');
      }
      if (config.master.limiterLookaheadMs !== undefined && (typeof config.master.limiterLookaheadMs !== 'number' || config.master.limiterLookaheadMs < 0)) {
        errors.push('master.limiterLookaheadMs must be a non-negative number.');
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * TypeScript DSL helper for defining and validating a MixConfig.
 */
export function defineMix(config: MixConfig): MixConfig {
  const result = validateMix(config);
  if (!result.valid) {
    throw new Error(`[defineMix] Invalid MixConfig:\n  - ${result.errors.join('\n  - ')}`);
  }
  return config;
}
