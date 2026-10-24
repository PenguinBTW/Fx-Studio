// =============================================================================
// CHROMATIC PALETTE: "THE THRESHOLD: CITY TO ROOM PORTAL"
//
// Dual-World Palette:
// - Exterior: Electric LiDAR Metropolis (Ash, Warm Amber, Cyan, Ruby Traffic, Laser Neon)
// - Interior: Warm Atmospheric Sanctuary (Oak Wood, Banker's Emerald, 2700K Incandescent Filament,
//             Cognac Leather, Monstera Green, Blueprint Laser)
// =============================================================================

import * as THREE from 'three';

export const HEX = {
  void: '#030304',

  // Exterior City Tokens
  skylineAsh: '#8E8B84',
  concreteDark: '#54514C',
  windowWarm: '#FFDE9E',
  windowCyan: '#00F0FF',
  windowAmber: '#FF9500',
  windowLavender: '#B088FF',
  trafficHeadlight: '#FFFBE8',
  trafficTaillight: '#FF1E10',
  beaconRed: '#FF0033',
  neonMagenta: '#FF0077',
  neonLime: '#39FF14',
  waterTowerWood: '#7C4A2D',

  // The Hero Window
  windowFrameDark: '#1E2024',
  windowFrameBrass: '#D4AF37',
  glassReflection: '#7DF9FF',

  // Interior Room Tokens
  floorParquet: '#8C5A32',
  floorParquetDark: '#5E3B1C',
  rugNavy: '#162238',
  rugCrimson: '#8B1E2B',
  rugCream: '#EDE6D6',
  rugGold: '#D4A017',
  deskOak: '#C28B52',
  deskOakDark: '#6E4522',
  deskMetalArm: '#8E9AA8',
  blueprintPaper: '#0C2C52',
  blueprintGrid: '#1A4D80',
  blueprintLaser: '#00F0FF',
  blueprintLaserBright: '#7DF9FF',
  lampEmerald: '#009E60',
  lampEmeraldDark: '#005A36',
  lampGlow: '#FFF2B2',
  lampFilament: '#FFFBE8',
  mugCeramic: '#F0ECE1',
  coffeeSteam: '#E8E4DA',
  bookSpineBurgundy: '#7A1C28',
  bookSpineNavy: '#162847',
  bookSpineForest: '#1A4321',
  bookSpineOchre: '#C68626',
  bookSpineCognac: '#8A421D',
  bookPagesBone: '#F7F4EB',
  chairLeatherCognac: '#9A4D1A',
  chairLeatherCrease: '#522409',
  chairBentwood: '#5C381E',
  monsteraLeaf: '#10B981',
  monsteraLeafDark: '#047857',
  monsteraStem: '#064E3B',
  globeOcean: '#1E3A5F',
  globeLand: '#8DA36F',
  globeBrass: '#D4AF37',
  clockFace: '#F8F6F0',
  clockHands: '#1A1816',
  vinylBlack: '#18181A',
  vinylLabelGold: '#F59E0B',
  streetAsphalt: '#222120',
  streetCurb: '#726E65',
  limestoneWarm: '#D2C2A6',
  limestoneShadow: '#8C7D68',
  bronzeDark: '#68502A',
  wallWainscot: '#4E2F1A',
  wallPlaster: '#3E3A36',
  vacuumTubeOrange: '#FF8833',
  ambientDustMote: '#FFE0A3',
  woodMahogany: '#38180C',
  brassPolished: '#F0C850',
  leatherOxblood: '#6B1B14',
  leatherShadow: '#280A06',
  lampWarmAmbient: '#FFE4A0',
  blueprintPaperDeep: '#07182C',
  streetLightGlow: '#FFC850',
} as const;

export const LIN = Object.fromEntries(
  Object.entries(HEX).map(([k, hex]) => [k, new THREE.Color(hex)])
) as Record<keyof typeof HEX, THREE.Color>;
