import { defaultPreferences } from '../config'
import type { AudioSettingsV1, CameraMode, ControlMode, HudPreset, HudWidgetId, QualityMode, RidePreferencesV1 } from '../types'

export const PREFERENCE_STORAGE_KEY = 'horizon-ride:preferences:v2'
export const LEGACY_PREFERENCE_KEYS = ['horizon-ride:preferences:v1', 'horizon-ride-prefs'] as const

export interface KeyValueStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem?(key: string): void
}

const CAMERAS = new Set<CameraMode>(['cockpit', 'chase', 'wide'])
const HUD_PRESETS = new Set<HudPreset>(['minimal', 'journey', 'immersive'])
const CONTROL_MODES = new Set<ControlMode>(['auto', 'keyboard', 'touch'])
const QUALITY_MODES = new Set<QualityMode>(['auto', 'high', 'balanced'])
const WIDGETS: HudWidgetId[] = ['speed', 'compass', 'terrain', 'hints', 'bike']

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function own(value: Record<string, unknown>, key: string): unknown {
  return Object.prototype.hasOwnProperty.call(value, key) ? value[key] : undefined
}

export function clampUnit(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(1, Math.max(0, value))
    : fallback
}

export function sanitizeAudioSettings(value: unknown, fallback: AudioSettingsV1 = defaultPreferences.audio): AudioSettingsV1 {
  const source = isRecord(value) ? value : {}
  return {
    enabled: typeof own(source, 'enabled') === 'boolean' ? own(source, 'enabled') as boolean : false,
    master: clampUnit(own(source, 'master'), fallback.master),
    music: clampUnit(own(source, 'music'), fallback.music),
    ambience: clampUnit(own(source, 'ambience'), fallback.ambience),
    bike: clampUnit(own(source, 'bike'), fallback.bike),
    variation: clampUnit(own(source, 'variation'), fallback.variation),
  }
}

function defaultsCopy(): RidePreferencesV1 {
  return {
    version: 1,
    camera: defaultPreferences.camera,
    hudPreset: defaultPreferences.hudPreset,
    widgets: { ...defaultPreferences.widgets },
    audio: { ...defaultPreferences.audio, enabled: false },
    controlMode: defaultPreferences.controlMode,
    quality: defaultPreferences.quality,
    reducedMotion: defaultPreferences.reducedMotion,
  }
}

function parseUnknownJson(value: unknown): unknown {
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value) as unknown
  } catch {
    return undefined
  }
}

/** Migrate known local schemas into the public V1 preference contract. */
export function parseRidePreferences(value: unknown): RidePreferencesV1 {
  const defaults = defaultsCopy()
  const raw = parseUnknownJson(value)
  if (!isRecord(raw)) return defaults

  const version = own(raw, 'version')
  if (version !== undefined && version !== 0 && version !== 1) return defaults

  const legacy = version === undefined || version === 0
  const cameraCandidate = own(raw, legacy ? 'cameraMode' : 'camera') ?? own(raw, 'camera')
  const presetCandidate = own(raw, legacy ? 'hud' : 'hudPreset') ?? own(raw, 'hudPreset')
  const widgetValue = own(raw, 'widgets')
  const widgetSource = isRecord(widgetValue) ? widgetValue : {}
  const widgets = { ...defaults.widgets }
  for (const widget of WIDGETS) {
    const candidate = own(widgetSource, widget)
    if (typeof candidate === 'boolean') widgets[widget] = candidate
  }

  const rawAudio = own(raw, 'audio') ?? own(raw, 'sound')
  const audio = sanitizeAudioSettings(rawAudio, defaults.audio)
  const legacyEnabled = own(raw, 'audioEnabled')
  if (typeof legacyEnabled === 'boolean' && (!isRecord(rawAudio) || own(rawAudio, 'enabled') === undefined)) audio.enabled = legacyEnabled
  const controlMode = own(raw, 'controlMode')
  const quality = own(raw, 'quality')
  const reducedMotion = own(raw, 'reducedMotion')

  return {
    version: 1,
    camera: typeof cameraCandidate === 'string' && CAMERAS.has(cameraCandidate as CameraMode)
      ? cameraCandidate as CameraMode
      : defaults.camera,
    hudPreset: typeof presetCandidate === 'string' && HUD_PRESETS.has(presetCandidate as HudPreset)
      ? presetCandidate as HudPreset
      : defaults.hudPreset,
    widgets,
    audio,
    controlMode: typeof controlMode === 'string' && CONTROL_MODES.has(controlMode as ControlMode) ? controlMode as ControlMode : defaults.controlMode,
    quality: typeof quality === 'string' && QUALITY_MODES.has(quality as QualityMode) ? quality as QualityMode : defaults.quality,
    reducedMotion: typeof reducedMotion === 'boolean' ? reducedMotion : defaults.reducedMotion,
  }
}

export function loadRidePreferences(storage?: KeyValueStorage): RidePreferencesV1 {
  if (!storage) return defaultsCopy()
  try {
    const current = storage.getItem(PREFERENCE_STORAGE_KEY)
    if (current != null) return parseRidePreferences(current)
    for (const key of LEGACY_PREFERENCE_KEYS) {
      const legacy = storage.getItem(key)
      if (legacy != null) return parseRidePreferences(legacy)
    }
  } catch {
    // Private browsing and locked-down embeds may reject local storage access.
  }
  return defaultsCopy()
}

export function saveRidePreferences(storage: KeyValueStorage | undefined, value: unknown): RidePreferencesV1 {
  const normalized = parseRidePreferences(value)
  if (!storage) return normalized
  try {
    storage.setItem(PREFERENCE_STORAGE_KEY, JSON.stringify(normalized))
  } catch {
    // Persistence is optional; gameplay remains available.
  }
  return normalized
}
