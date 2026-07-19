import type { BiomeId, RideAudioState } from '../types'

export interface BiomeInstrumentation {
  keyWave: OscillatorType
  padWave: OscillatorType
  keyCutoff: number
  textureCutoff: number
  percussionDensity: number
  stereoWidth: number
}

export interface MusicIdentity {
  seed: number
  bpm: number
  rootMidi: number
  progression: readonly number[]
  instrumentation: BiomeInstrumentation
}

const PROGRESSIONS: ReadonlyArray<readonly number[]> = [
  [0, 5, 3, 4],
  [0, 3, 5, 4],
  [0, 4, 5, 3],
  [0, 5, 4, 3],
]

const INSTRUMENTATION: Record<BiomeId, BiomeInstrumentation> = {
  coast: { keyWave: 'triangle', padWave: 'sine', keyCutoff: 1_050, textureCutoff: 820, percussionDensity: 0.42, stereoWidth: 0.9 },
  alpine: { keyWave: 'sine', padWave: 'triangle', keyCutoff: 840, textureCutoff: 610, percussionDensity: 0.27, stereoWidth: 1 },
  desert: { keyWave: 'triangle', padWave: 'sine', keyCutoff: 720, textureCutoff: 480, percussionDensity: 0.52, stereoWidth: 0.72 },
}

export function hashMusicSeed(seed: number, salt = 0): number {
  let value = (Number.isFinite(seed) ? Math.trunc(seed) : 0) ^ Math.imul(salt + 1, 0x9e3779b1)
  value = Math.imul(value ^ value >>> 16, 0x21f0aaad)
  value = Math.imul(value ^ value >>> 15, 0x735a2d97)
  return (value ^ value >>> 15) >>> 0
}

export function createSeededRandom(seed: number): () => number {
  let state = hashMusicSeed(seed)
  return () => {
    state += 0x6d2b79f5
    let value = state
    value = Math.imul(value ^ value >>> 15, value | 1)
    value ^= value + Math.imul(value ^ value >>> 7, value | 61)
    return ((value ^ value >>> 14) >>> 0) / 4_294_967_296
  }
}

export function midiToHz(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12)
}

export function getBiomeInstrumentation(biome: BiomeId): BiomeInstrumentation {
  return { ...INSTRUMENTATION[biome] }
}

export function createMusicIdentity(state: Pick<RideAudioState, 'seed' | 'biome'>): MusicIdentity {
  const biomeSalt = state.biome === 'coast' ? 11 : state.biome === 'alpine' ? 23 : 37
  const musicSeed = hashMusicSeed(state.seed, biomeSalt)
  const rootOffset = state.biome === 'desert' ? 5 : state.biome === 'alpine' ? 2 : 0
  return {
    seed: musicSeed,
    bpm: 70 + musicSeed % 13,
    rootMidi: 45 + rootOffset + musicSeed % 3,
    progression: [...PROGRESSIONS[musicSeed % PROGRESSIONS.length]],
    instrumentation: getBiomeInstrumentation(state.biome),
  }
}

export function nextQuantizedBoundary(now: number, bpm: number, subdivisionBeats = 0.5, origin = 0): number {
  if (!Number.isFinite(now) || !Number.isFinite(bpm) || bpm <= 0 || subdivisionBeats <= 0) return Math.max(0, now || 0)
  const interval = 60 / bpm * subdivisionBeats
  const elapsed = Math.max(0, now - origin)
  return origin + (Math.floor(elapsed / interval) + 1) * interval
}
