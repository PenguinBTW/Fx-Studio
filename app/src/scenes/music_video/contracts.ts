// Strict Spatial & Temporal Transition Contracts for 'No Takebacks' (Forrest Nolan)
// Enforces continuous camera trajectories, velocity vectors, motivated apertures,
// and Brutalist Swiss-Grid Neo-Noir color tokens across Acts 1 through 6.

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export interface CameraStateContract {
  pos: [number, number, number];
  target: [number, number, number];
  velocity: [number, number, number];
  fov: number;
  apertureAnchor: string;
}

export interface ActMetadata {
  id: string;
  name: string;
  lineRange: [number, number];
  sceneStart: number;
  sceneEnd: number;
  nominalCut: number;
  entryContract?: CameraStateContract;
  exitContract?: CameraStateContract;
}

export const COLOR_TOKENS = {
  // Brutalist CAD Drafting & Blueprint (Act 1)
  CAD_BLUEPRINT_PAPER: '#e8ecef',
  CAD_INK_BLACK: '#0a0d12',
  CAD_HAIRLINE_CYAN: '#00e5ff',
  CAD_GRID_LINE: 'rgba(10, 13, 18, 0.12)',

  // Mechanical Tungsten & Speedometer Metals (Act 2)
  TUNGSTEN_STEEL: '#1a1d22',
  BRUSHED_GRAPHITE: '#272a30',
  CHROME_POLISHED: '#f0f4f8',
  BRASS_BEZEL: '#d4a359',
  AMBER_REDLINE: '#f59e0b',
  GAUGE_NEEDLE_RED: '#ef4444',

  // Bank Vault Breach & Currency Vortex (Act 3)
  VAULT_STEEL_DARK: '#111418',
  CURRENCY_GREEN_TINT: '#10b981',
  GOLD_BULLION: '#fbbf24',
  SHATTER_WHITE_GLOW: '#ffffff',

  // Cockpit Mirror & Neon Highway Noir (Act 4)
  COCKPIT_LEATHER: '#14161a',
  MIRROR_SILVER: '#e2e8f0',
  POLICE_RED: '#ef4444',
  POLICE_BLUE: '#3b82f6',
  HIGHWAY_ASPHALT: '#090b0e',
  HEADLIGHT_HALOGEN: '#fef08a',

  // Canyon Bridge Chase & Volumetric Fog (Act 5)
  BRIDGE_RUST_STEEL: '#1e242b',
  VOLUMETRIC_FOG: '#1e293b',
  SEARCHLIGHT_BEAM: '#e0f2fe',
  TAILLIGHT_STREAK: '#dc2626',

  // Barricade Smash & Sunrise Leap (Act 6)
  WOODEN_SPLINTER: '#78350f',
  DAWN_SKY_MAGENTA: '#e11d48',
  DAWN_SUNRISE_AMBER: '#f59e0b',
  VECTOR_DISSOLVE_CYAN: '#22d3ee',
  WHITE_FLASH: '#ffffff',
} as const;

export const TRANSITION_CONTRACTS = {
  // Transition T1: Act 1 (Vault Blueprint) -> Act 2 (Speedometer) at t = 18.81s (Bar 11.0)
  // Crash-zoom into the vault dial spindle, geometry morphing into outer brass bezel of speedometer.
  T1: {
    t: 18.81,
    pos: [0.0, 0.0, 2.2] as [number, number, number],
    target: [0.0, 0.0, 0.0] as [number, number, number],
    velocity: [0.0, 0.0, -14.0] as [number, number, number],
    fov: 45.0,
    apertureAnchor: 'vault_spindle_to_speedometer_bezel',
  },

  // Transition T2: Act 2 (Speedometer) -> Act 3 (Cash Breach) at t = 33.55s (Bar 19.0)
  // Needle pegs 100 MPH; glass crystal shatters into 24 Voronoi shards on the bass drop.
  T2: {
    t: 33.55,
    pos: [0.0, 0.8, 2.4] as [number, number, number],
    target: [0.0, 0.5, 0.0] as [number, number, number],
    velocity: [0.0, -0.4, -22.0] as [number, number, number],
    fov: 50.0,
    apertureAnchor: 'speedometer_shatter_vortex',
  },

  // Transition T3: Act 3 (Cash Breach) -> Act 4 (Cockpit Highway) at t = 50.46s (Bar 28.0)
  // Camera tilts up along driver's forearm gripping steering wheel to frame chrome fuzzy dice.
  T3: {
    t: 50.46,
    pos: [-0.08, 0.56, 0.18] as [number, number, number],
    target: [0.0, 0.58, -0.38] as [number, number, number],
    velocity: [0.0, 0.1, -1.5] as [number, number, number],
    fov: 44.0,
    apertureAnchor: 'forearm_tilt_to_rearview_dice',
  },

  // Transition T4: Act 4 (Cockpit Highway) -> Act 5 (Bridge Chase) at t = 67.13s (Bar 37.0)
  // Reverse pull-out between bucket seats through rear glass into trailing exterior chase cam.
  T4: {
    t: 67.13,
    pos: [0.0, 2.2, 7.5] as [number, number, number],
    target: [0.0, 1.0, -15.0] as [number, number, number],
    velocity: [0.0, 1.2, 18.0] as [number, number, number],
    fov: 55.0,
    apertureAnchor: 'cockpit_rear_window_pullout',
  },

  // Transition T5: Act 5 (Bridge Chase) -> Act 6 (Sunrise Leap) at t = 97.11s (Bar 53.0)
  // Speedster smashes police barricade on full-band drop; 2-frame splinter occluding wipe to side tracking cam.
  T5: {
    t: 97.11,
    pos: [-8.0, 2.0, 0.0] as [number, number, number],
    target: [0.0, 1.5, 0.0] as [number, number, number],
    velocity: [0.0, 0.0, -38.0] as [number, number, number],
    fov: 48.0,
    apertureAnchor: 'barricade_splinter_wipe',
  },
} as const;

export const ACTS: Record<string, ActMetadata> = {
  act1_vault_blueprint: {
    id: 'act1_vault_blueprint',
    name: 'The Heist Blueprints & Trigger',
    lineRange: [0, 3],
    sceneStart: 0.0,
    sceneEnd: 19.31,
    nominalCut: 18.81,
    exitContract: TRANSITION_CONTRACTS.T1,
  },
  act2_speedometer: {
    id: 'act2_speedometer',
    name: 'The Engine Dyno Redline & Speedometer',
    lineRange: [4, 7],
    sceneStart: 18.31,
    sceneEnd: 34.05,
    nominalCut: 33.55,
    entryContract: TRANSITION_CONTRACTS.T1,
    exitContract: TRANSITION_CONTRACTS.T2,
  },
  act3_cash_breach: {
    id: 'act3_cash_breach',
    name: 'The Bank Vault Breach & Cash Vortex',
    lineRange: [8, 15],
    sceneStart: 33.05,
    sceneEnd: 50.96,
    nominalCut: 50.46,
    entryContract: TRANSITION_CONTRACTS.T2,
    exitContract: TRANSITION_CONTRACTS.T3,
  },
  act4_cockpit_highway: {
    id: 'act4_cockpit_highway',
    name: 'The Cockpit Mirror & Neon Highway',
    lineRange: [16, 19],
    sceneStart: 49.96,
    sceneEnd: 67.63,
    nominalCut: 67.13,
    entryContract: TRANSITION_CONTRACTS.T3,
    exitContract: TRANSITION_CONTRACTS.T4,
  },
  act5_bridge_chase: {
    id: 'act5_bridge_chase',
    name: 'The Canyon Bridge Chase',
    lineRange: [20, 29],
    sceneStart: 66.63,
    sceneEnd: 97.61,
    nominalCut: 97.11,
    entryContract: TRANSITION_CONTRACTS.T4,
    exitContract: TRANSITION_CONTRACTS.T5,
  },
  act6_sunrise_leap: {
    id: 'act6_sunrise_leap',
    name: 'The Barricade Smash & Sunrise Leap',
    lineRange: [30, 33],
    sceneStart: 96.61,
    sceneEnd: 125.0,
    nominalCut: 125.0,
    entryContract: TRANSITION_CONTRACTS.T5,
  },
};
