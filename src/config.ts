import type { BikeClass, BiomeId, CameraMode, HudPreset, HudWidgetId, RidePreferencesV1 } from './types'
import { routeY } from './game/route'

export interface BikeCameraAnchors {
  cockpit: readonly [number, number, number]
  chase: readonly [number, number, number]
  wide: readonly [number, number, number]
  lookAhead: Record<CameraMode, number>
}

export interface BikeAudioProfile {
  idleHz: number
  redlineHz: number
  engineGain: number
  intakeGain: number
  exhaustGain: number
  windGain: number
}

export interface BikeProfile {
  label: string
  subtitle: string
  color: string
  /** Zero-speed acceleration in km/h per second; preserved for compatibility. */
  acceleration: number
  /** Speed cap in km/h; preserved for compatibility. */
  maxSpeed: number
  /** Relative response used by legacy presentation code; preserved for compatibility. */
  steer: number
  wheelbase: number
  wheelRadius: number
  maxSteerAngle: number
  highSpeedSteerFactor: number
  steerRate: number
  brakeDeceleration: number
  coastDrag: number
  aerodynamicDrag: number
  offroadDrag: number
  offroadGrip: number
  roadAssist: number
  leanLimit: number
  leanResponse: number
  suspensionTravel: number
  suspensionFrequency: number
  suspensionDamping: number
  camera: BikeCameraAnchors
  audio: BikeAudioProfile
}

export const bikes: Record<BikeClass, BikeProfile> = {
  scooter: {
    label: 'Scooter',
    subtitle: 'Light, upright and easygoing',
    acceleration: 10.5,
    maxSpeed: 86,
    steer: 0.92,
    color: '#d7ded3',
    wheelbase: 1.35,
    wheelRadius: 0.31,
    maxSteerAngle: 0.14,
    highSpeedSteerFactor: 0.38,
    steerRate: 3.4,
    brakeDeceleration: 28,
    coastDrag: 0.72,
    aerodynamicDrag: 0.00018,
    offroadDrag: 24,
    offroadGrip: 0.58,
    roadAssist: 1.7,
    leanLimit: 0.36,
    leanResponse: 4.8,
    suspensionTravel: 0.12,
    suspensionFrequency: 8.2,
    suspensionDamping: 0.83,
    camera: {
      cockpit: [0, 1.48, 2.16],
      chase: [0, 2.78, 6.55],
      wide: [0, 5.05, 13.2],
      lookAhead: { cockpit: 31, chase: 40, wide: 52 },
    },
    audio: { idleHz: 58, redlineHz: 164, engineGain: 0.68, intakeGain: 0.52, exhaustGain: 0.35, windGain: 0.64 },
  },
  sport: {
    label: 'Sport Bike',
    subtitle: 'Precise, eager and planted',
    acceleration: 17,
    maxSpeed: 148,
    steer: 1.02,
    color: '#872f2b',
    wheelbase: 1.43,
    wheelRadius: 0.335,
    maxSteerAngle: 0.125,
    highSpeedSteerFactor: 0.3,
    steerRate: 3.8,
    brakeDeceleration: 36,
    coastDrag: 0.58,
    aerodynamicDrag: 0.00013,
    offroadDrag: 29,
    offroadGrip: 0.48,
    roadAssist: 1.45,
    leanLimit: 0.46,
    leanResponse: 5.4,
    suspensionTravel: 0.09,
    suspensionFrequency: 10.4,
    suspensionDamping: 0.89,
    camera: {
      cockpit: [0, 1.42, 2.24],
      chase: [0, 2.84, 6.65],
      wide: [0, 5.2, 13.8],
      lookAhead: { cockpit: 38, chase: 48, wide: 62 },
    },
    audio: { idleHz: 72, redlineHz: 248, engineGain: 0.72, intakeGain: 0.67, exhaustGain: 0.42, windGain: 0.82 },
  },
  cruiser: {
    label: 'V-Twin Cruiser',
    subtitle: 'Unhurried torque and long comfort',
    acceleration: 12.5,
    maxSpeed: 122,
    steer: 0.78,
    color: '#6b5d4f',
    wheelbase: 1.71,
    wheelRadius: 0.355,
    maxSteerAngle: 0.13,
    highSpeedSteerFactor: 0.34,
    steerRate: 3,
    brakeDeceleration: 30,
    coastDrag: 0.62,
    aerodynamicDrag: 0.00012,
    offroadDrag: 27,
    offroadGrip: 0.52,
    roadAssist: 1.6,
    leanLimit: 0.38,
    leanResponse: 4.4,
    suspensionTravel: 0.115,
    suspensionFrequency: 7.1,
    suspensionDamping: 0.79,
    camera: {
      cockpit: [0, 1.44, 2.38],
      chase: [0, 2.72, 6.95],
      wide: [0, 4.9, 14.3],
      lookAhead: { cockpit: 34, chase: 44, wide: 57 },
    },
    audio: { idleHz: 43, redlineHz: 126, engineGain: 0.78, intakeGain: 0.4, exhaustGain: 0.73, windGain: 0.68 },
  },
}

export const biomes: Record<BiomeId, { label: string; sky: string; ground: string; road: string; fog: string }> = {
  coast: { label: 'Coast', sky: '#eab778', ground: '#35634f', road: '#2b302d', fog: '#a58b6d' },
  alpine: { label: 'Alpine', sky: '#9fc0cf', ground: '#315c47', road: '#303837', fog: '#71817f' },
  desert: { label: 'Desert', sky: '#dea876', ground: '#aa7044', road: '#423b34', fog: '#b88968' },
}

export const presetWidgets: Record<HudPreset, Record<HudWidgetId, boolean>> = {
  minimal: { speed: true, compass: false, terrain: false, hints: false, bike: false },
  journey: { speed: true, compass: true, terrain: true, hints: true, bike: true },
  immersive: { speed: true, compass: true, terrain: false, hints: false, bike: false },
}

export const defaultPreferences: RidePreferencesV1 = {
  version: 1,
  camera: 'chase',
  hudPreset: 'journey',
  widgets: { ...presetWidgets.journey },
  audio: { enabled: false, master: 0.58, music: 0.54, ambience: 0.35, bike: 0.26, variation: 0.55 },
  controlMode: 'auto',
  quality: 'auto',
  reducedMotion: false,
}

/** Compatibility helper now backed by the same route elevation used in-world. */
export const elevation = (seed: number, distance: number, biome: BiomeId = 'coast') => routeY(seed, distance, biome)
