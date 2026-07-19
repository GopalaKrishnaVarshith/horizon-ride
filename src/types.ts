export type BiomeId = 'coast' | 'alpine' | 'desert'
export type BikeClass = 'scooter' | 'sport' | 'cruiser'
export type CameraMode = 'cockpit' | 'chase' | 'wide'
export type HudPreset = 'minimal' | 'journey' | 'immersive'
export type HudWidgetId = 'speed' | 'compass' | 'terrain' | 'hints' | 'bike'
export type ControlMode = 'auto' | 'keyboard' | 'touch'
export type QualityMode = 'auto' | 'high' | 'balanced'

export interface RideSession { seed: number; biome: BiomeId; bike: BikeClass; speed: number; distance: number; heading: number; paused: boolean }
export interface AudioSettingsV1 { enabled: boolean; master: number; music: number; ambience: number; bike: number; variation: number }
export interface RidePreferencesV1 { version: 1; camera: CameraMode; hudPreset: HudPreset; widgets: Record<HudWidgetId, boolean>; audio: AudioSettingsV1; controlMode: ControlMode; quality: QualityMode; reducedMotion: boolean }
export interface RideAudioState { biome: BiomeId; bike: BikeClass; camera: CameraMode; speed: number; paused: boolean; seed: number }
export type AudioEnginePhase = 'locked' | 'ready' | 'running' | 'paused' | 'stopped' | 'unavailable' | 'error' | 'disposed'
export interface AudioEngineStatus {
  phase: AudioEnginePhase
  enabled: boolean
  unlocked: boolean
  rideRequested: boolean
  activeVoices: number
  contextState: AudioContextState | 'locked' | 'unavailable' | 'disposed'
  error?: string
}
export interface AudioEngine {
  unlock(): Promise<boolean>
  startRide(state: RideAudioState): void
  pause(): void
  resume(): void
  stopRide(): void
  setRideState(state: RideAudioState): void
  setMix(settings: AudioSettingsV1): void
  getStatus(): AudioEngineStatus
  dispose(): Promise<void>
}
