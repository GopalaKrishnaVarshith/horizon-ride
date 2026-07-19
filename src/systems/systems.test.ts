import { describe, expect, it } from 'vitest'
import { createMusicIdentity, createSeededRandom, getBiomeInstrumentation, nextQuantizedBoundary } from './music'
import { loadRidePreferences, parseRidePreferences, saveRidePreferences, type KeyValueStorage } from './preferences'
import { canonicalRideSearch, createRideSeed, parseRideRoute, writeRideRoute } from './url'

describe('ride URL state', () => {
  it('preserves seed zero and canonicalizes the supported route keys', () => {
    const route = parseRideRoute('?seed=0&biome=coast&bike=scooter')
    expect(route).toEqual({ seed: 0, biome: 'coast', bike: 'scooter' })
    expect(canonicalRideSearch(route)).toBe('?seed=0&biome=coast&bike=scooter')
  })

  it('rejects non-finite, prototype, exponent and oversized values', () => {
    const fallback = { seed: 91, biome: 'desert' as const, bike: 'cruiser' as const }
    expect(parseRideRoute('?seed=Infinity&biome=__proto__&bike=constructor', fallback)).toEqual(fallback)
    expect(parseRideRoute('?seed=1e3&biome=alpine&bike=sport', fallback).seed).toBe(91)
    expect(parseRideRoute('?seed=99999999999', fallback).seed).toBe(91)
  })

  it('writes a stable replay URL without retaining unrelated query data by default', () => {
    const url = writeRideRoute('https://ride.test/play?debug=true#view', { seed: 8, biome: 'alpine', bike: 'sport' })
    expect(url.toString()).toBe('https://ride.test/play?seed=8&biome=alpine&bike=sport#view')
    expect(createRideSeed(() => Number.POSITIVE_INFINITY)).toBe(482_901)
    expect(createRideSeed(() => 0)).toBe(0)
    expect(parseRideRoute('/play?seed=4&biome=desert&bike=cruiser')).toEqual({ seed: 4, biome: 'desert', bike: 'cruiser' })
  })
})

describe('ride preferences migration', () => {
  it('keeps explicit audio consent and clamps every volume', () => {
    const preferences = parseRidePreferences({
      version: 1,
      camera: 'cockpit',
      hudPreset: 'minimal',
      widgets: { speed: false, terrain: true, __proto__: { bike: false } },
      audio: { enabled: true, master: 3, music: -2, ambience: Number.NaN, bike: 0.4, variation: 0.8 },
    })
    expect(preferences.audio.enabled).toBe(true)
    expect(preferences.audio.master).toBe(1)
    expect(preferences.audio.music).toBe(0)
    expect(preferences.audio.ambience).toBeGreaterThan(0)
    expect(preferences.widgets.speed).toBe(false)
    expect(preferences.widgets.bike).toBe(true)
  })

  it('migrates the legacy shape and defaults audio off when consent is absent', () => {
    expect(parseRidePreferences({ cameraMode: 'wide', hud: 'immersive', audioEnabled: true }).audio.enabled).toBe(true)
    expect(parseRidePreferences({ sound: { master: 0.3 }, audioEnabled: true }).audio.enabled).toBe(true)
    expect(parseRidePreferences({ version: 1, camera: 'chase', audio: { master: 0.2 } }).audio.enabled).toBe(false)
    expect(parseRidePreferences({ version: 99, camera: 'cockpit', audio: { enabled: true } }).audio.enabled).toBe(false)
  })

  it('loads legacy keys and saves only normalized current data', () => {
    const values = new Map<string, string>([['horizon-ride-prefs', JSON.stringify({ cameraMode: 'wide', audioEnabled: true })]])
    const storage: KeyValueStorage = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    }
    const loaded = loadRidePreferences(storage)
    expect(loaded.camera).toBe('wide')
    expect(loaded.audio.enabled).toBe(true)
    const saved = saveRidePreferences(storage, { ...loaded, audio: { ...loaded.audio, master: 20 } })
    expect(saved.audio.master).toBe(1)
    expect(JSON.parse(values.get('horizon-ride:preferences:v2') ?? '{}').version).toBe(1)
  })

  it('keeps gameplay-safe defaults when browser storage is blocked', () => {
    const blocked: KeyValueStorage = {
      getItem: () => { throw new Error('blocked') },
      setItem: () => { throw new Error('blocked') },
    }
    expect(loadRidePreferences(blocked).audio.enabled).toBe(false)
    expect(() => saveRidePreferences(blocked, { version: 1, audio: { enabled: true } })).not.toThrow()
  })
})

describe('deterministic music identity', () => {
  it('repeats a route identity while giving biomes distinct instrumentation', () => {
    const first = createMusicIdentity({ seed: 721_381, biome: 'coast' })
    expect(createMusicIdentity({ seed: 721_381, biome: 'coast' })).toEqual(first)
    expect(first.bpm).toBeGreaterThanOrEqual(70)
    expect(first.bpm).toBeLessThanOrEqual(82)
    expect(createMusicIdentity({ seed: 721_381, biome: 'desert' }).seed).not.toBe(first.seed)
    expect(getBiomeInstrumentation('alpine')).not.toEqual(getBiomeInstrumentation('desert'))
  })

  it('uses a reproducible PRNG and stable quantized boundaries', () => {
    const a = createSeededRandom(22)
    const b = createSeededRandom(22)
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
    expect(nextQuantizedBoundary(1, 60, 1)).toBe(2)
    expect(nextQuantizedBoundary(1.01, 60, 0.5)).toBe(1.5)
  })
})
