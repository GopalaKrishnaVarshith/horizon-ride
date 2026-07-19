import { sanitizeAudioSettings } from './systems/preferences'
import { bikes } from './config'
import {
  createMusicIdentity,
  createSeededRandom,
  hashMusicSeed,
  midiToHz,
  nextQuantizedBoundary,
  type MusicIdentity,
} from './systems/music'
import type {
  AudioEngine,
  AudioEnginePhase,
  AudioEngineStatus,
  AudioSettingsV1,
  RideAudioState,
} from './types'

interface Voice {
  source: AudioScheduledSourceNode
  gain: GainNode
}

export interface AudioEngineOptions {
  contextFactory?: () => AudioContext | undefined
  schedulerIntervalMs?: number
  scheduleAheadSeconds?: number
}

const SILENCE = 0.0001

function defaultContextFactory(): AudioContext | undefined {
  if (typeof window === 'undefined') return undefined
  const AudioContextConstructor = window.AudioContext
    ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioContextConstructor) return undefined
  return new AudioContextConstructor({ latencyHint: 'interactive' })
}

function safeMessage(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 180) : 'Audio engine failure'
}

export class HorizonAudioEngine implements AudioEngine {
  private readonly contextFactory: () => AudioContext | undefined
  private readonly schedulerIntervalMs: number
  private readonly scheduleAheadSeconds: number
  private ctx?: AudioContext
  private master?: GainNode
  private music?: GainNode
  private ambience?: GainNode
  private bikeNode?: GainNode
  private limiter?: DynamicsCompressorNode
  private state?: RideAudioState
  private settings: AudioSettingsV1
  private scheduler?: ReturnType<typeof globalThis.setInterval>
  private voices = new Set<Voice>()
  private identity?: MusicIdentity
  private pendingIdentity?: MusicIdentity
  private transitionAt?: number
  private phase: AudioEnginePhase = 'locked'
  private rideRequested = false
  private explicitlyPaused = false
  private disposed = false
  private step = 0
  private nextNoteTime = 0
  private lastSchedulerTime = 0
  private error?: string

  constructor(settings: AudioSettingsV1, options: AudioEngineOptions = {}) {
    this.settings = sanitizeAudioSettings(settings)
    this.contextFactory = options.contextFactory ?? defaultContextFactory
    this.schedulerIntervalMs = Math.max(40, options.schedulerIntervalMs ?? 100)
    this.scheduleAheadSeconds = Math.min(1, Math.max(0.12, options.scheduleAheadSeconds ?? 0.35))
  }

  async unlock(): Promise<boolean> {
    if (this.disposed) return false
    try {
      if (!this.ctx) {
        this.ctx = this.contextFactory()
        if (!this.ctx) {
          this.phase = 'unavailable'
          return false
        }
        this.createGraph(this.ctx)
      }
      if (this.ctx.state === 'suspended') await this.ctx.resume()
      if (this.ctx.state !== 'running') {
        this.phase = 'unavailable'
        return false
      }
      this.phase = 'ready'
      this.error = undefined
      this.applyMix(0.04)
      if (this.rideRequested && !this.explicitlyPaused && this.settings.enabled) this.startScheduler()
      return true
    } catch (error) {
      this.fail(error)
      return false
    }
  }

  startRide(state: RideAudioState): void {
    if (this.disposed) return
    this.state = { ...state, speed: Math.max(0, Number.isFinite(state.speed) ? state.speed : 0) }
    this.rideRequested = true
    this.explicitlyPaused = state.paused
    this.setIdentity(this.state)
    if (state.paused) {
      this.pause()
      return
    }
    if (this.ctx && this.settings.enabled) this.startScheduler()
  }

  pause(): void {
    if (this.disposed) return
    this.explicitlyPaused = true
    this.clearScheduler()
    if (this.rideRequested) this.phase = 'paused'
    this.rampGain(this.master, 0, 0.08)
  }

  resume(): void {
    if (this.disposed) return
    this.explicitlyPaused = false
    if (!this.rideRequested) {
      this.phase = this.ctx ? 'ready' : 'locked'
      return
    }
    if (!this.ctx || !this.settings.enabled) return
    void this.resumeContextAndScheduler()
  }

  stopRide(): void {
    if (this.disposed) return
    this.rideRequested = false
    this.explicitlyPaused = false
    this.clearScheduler()
    this.rampGain(this.master, 0, 0.08)
    this.releaseVoices(0.1)
    this.phase = this.ctx ? 'stopped' : 'locked'
    this.step = 0
    this.nextNoteTime = 0
    this.pendingIdentity = undefined
    this.transitionAt = undefined
  }

  setRideState(state: RideAudioState): void {
    if (this.disposed) return
    const previous = this.state
    this.state = { ...state, speed: Math.max(0, Number.isFinite(state.speed) ? state.speed : 0) }
    if (!previous || previous.seed !== state.seed || previous.biome !== state.biome) this.queueIdentityTransition(this.state)
    this.applyBusMix(0.2)
    if (state.paused) this.pause()
    else if (this.explicitlyPaused) this.resume()
  }

  setMix(settings: AudioSettingsV1): void {
    if (this.disposed) return
    const wasEnabled = this.settings.enabled
    this.settings = sanitizeAudioSettings(settings, this.settings)
    if (!this.settings.enabled) {
      this.clearScheduler()
      this.rampGain(this.master, 0, 0.04)
      this.releaseVoices(0.06)
      if (this.ctx) this.phase = this.rideRequested ? 'stopped' : 'ready'
      return
    }
    this.applyMix(wasEnabled ? 0.12 : 0.25)
    if (!wasEnabled && this.rideRequested && !this.explicitlyPaused && this.ctx) this.startScheduler()
  }

  getStatus(): AudioEngineStatus {
    return {
      phase: this.phase,
      enabled: this.settings.enabled,
      unlocked: Boolean(this.ctx && this.ctx.state !== 'closed'),
      rideRequested: this.rideRequested,
      activeVoices: this.voices.size,
      contextState: this.disposed ? 'disposed' : this.ctx?.state ?? (this.phase === 'unavailable' ? 'unavailable' : 'locked'),
      ...(this.error ? { error: this.error } : {}),
    }
  }

  async dispose(): Promise<void> {
    if (this.disposed) return
    this.stopRide()
    this.disposed = true
    this.phase = 'disposed'
    const context = this.ctx
    this.ctx = undefined
    for (const node of [this.music, this.ambience, this.bikeNode, this.master, this.limiter]) {
      try { node?.disconnect() } catch { /* already disconnected */ }
    }
    this.music = undefined
    this.ambience = undefined
    this.bikeNode = undefined
    this.master = undefined
    this.limiter = undefined
    if (context && context.state !== 'closed') {
      try { await context.close() } catch { /* context may be browser-owned */ }
    }
  }

  private createGraph(context: AudioContext): void {
    this.master = context.createGain()
    this.music = context.createGain()
    this.ambience = context.createGain()
    this.bikeNode = context.createGain()
    this.limiter = context.createDynamicsCompressor()
    this.master.gain.value = 0
    this.music.gain.value = 0
    this.ambience.gain.value = 0
    this.bikeNode.gain.value = 0
    this.limiter.threshold.value = -16
    this.limiter.knee.value = 9
    this.limiter.ratio.value = 8
    this.limiter.attack.value = 0.004
    this.limiter.release.value = 0.22
    this.music.connect(this.master)
    this.ambience.connect(this.master)
    this.bikeNode.connect(this.master)
    this.master.connect(this.limiter)
    this.limiter.connect(context.destination)
  }

  private async resumeContextAndScheduler(): Promise<void> {
    try {
      if (this.ctx?.state === 'suspended') await this.ctx.resume()
      if (this.ctx?.state === 'running') {
        this.applyMix(0.18)
        this.startScheduler()
      }
    } catch (error) {
      this.fail(error)
    }
  }

  private startScheduler(): void {
    if (!this.ctx || this.ctx.state !== 'running' || !this.state || !this.settings.enabled || this.explicitlyPaused || this.disposed) return
    if (this.scheduler !== undefined) {
      this.phase = 'running'
      return
    }
    this.phase = 'running'
    this.applyMix(0.18)
    this.rebaseSchedule()
    this.schedule()
    this.scheduler = globalThis.setInterval(() => this.schedule(), this.schedulerIntervalMs)
  }

  private clearScheduler(): void {
    if (this.scheduler !== undefined) globalThis.clearInterval(this.scheduler)
    this.scheduler = undefined
  }

  private rebaseSchedule(): void {
    if (!this.ctx || !this.identity) return
    const now = this.ctx.currentTime
    this.nextNoteTime = nextQuantizedBoundary(now + 0.025, this.identity.bpm, 0.25, now)
    this.lastSchedulerTime = now
  }

  private schedule(): void {
    const context = this.ctx
    if (!context || context.state !== 'running' || !this.identity || !this.state || !this.settings.enabled || this.explicitlyPaused) return
    const now = context.currentTime
    if (this.nextNoteTime < now - 0.2 || now - this.lastSchedulerTime > 1.25) this.rebaseSchedule()
    this.lastSchedulerTime = now
    let guard = 0
    while (this.nextNoteTime < now + this.scheduleAheadSeconds && guard < 12) {
      this.applyPendingIdentity(this.nextNoteTime)
      this.scheduleStep(this.nextNoteTime)
      this.nextNoteTime += 60 / this.identity.bpm / 2
      this.step += 1
      guard += 1
    }
  }

  private setIdentity(state: RideAudioState): void {
    const next = createMusicIdentity(state)
    if (!this.identity || this.identity.seed !== next.seed) {
      this.identity = next
      this.step = 0
      this.pendingIdentity = undefined
      this.transitionAt = undefined
    }
  }

  private queueIdentityTransition(state: RideAudioState): void {
    const next = createMusicIdentity(state)
    if (!this.identity) {
      this.identity = next
      return
    }
    if (this.identity.seed === next.seed || !this.ctx) return
    this.pendingIdentity = next
    this.transitionAt = nextQuantizedBoundary(this.ctx.currentTime + 0.05, this.identity.bpm, 4)
    const transitionAt = this.transitionAt
    const target = this.music?.gain
    if (target) {
      target.cancelScheduledValues(this.ctx.currentTime)
      target.setValueAtTime(Math.max(SILENCE, target.value), this.ctx.currentTime)
      target.linearRampToValueAtTime(SILENCE, transitionAt)
      target.linearRampToValueAtTime(this.musicLevel(), transitionAt + 0.7)
    }
  }

  private applyPendingIdentity(at: number): void {
    if (!this.pendingIdentity || this.transitionAt === undefined || at < this.transitionAt) return
    this.identity = this.pendingIdentity
    this.pendingIdentity = undefined
    this.transitionAt = undefined
    this.step = 0
  }

  private scheduleStep(at: number): void {
    const identity = this.identity
    const state = this.state
    if (!identity || !state || !this.music || !this.ambience || !this.bikeNode) return
    const halfBeat = 60 / identity.bpm / 2
    const bikeProfile = bikes[state.bike]
    const chordOffset = identity.progression[Math.floor(this.step / 8) % identity.progression.length]
    const root = identity.rootMidi + chordOffset
    const speedEnergy = Math.min(1, state.speed / 150)
    const cutoff = identity.instrumentation.keyCutoff * (0.86 + speedEnergy * 0.32)
    const minorThird = state.biome === 'coast' ? 4 : 3

    if (this.step % 8 === 0) {
      for (const interval of [0, minorThird, 7]) {
        this.playTone(this.music, midiToHz(root + 12 + interval), at, halfBeat * 6.7, 0.026, identity.instrumentation.keyWave, cutoff)
      }
      this.playTone(this.music, midiToHz(root - 12), at, halfBeat * 3.2, 0.038, 'sine', 250)
    }
    if (this.step % 8 === 4 && this.settings.variation > 0.24) {
      this.playTone(this.music, midiToHz(root + 19), at, halfBeat * 1.8, 0.012 + this.settings.variation * 0.008, 'sine', cutoff * 1.25)
    }
    if (this.step % 4 === 0) this.playTone(this.music, 64, at, 0.07, 0.018, 'sine', 160)
    if (this.step % 8 === 6 && identity.instrumentation.percussionDensity + this.settings.variation * 0.2 > 0.46) {
      this.playNoise(this.music, at, 0.055, 0.008, 1_400, this.step)
    }
    if (this.step % 32 === 0) {
      this.playNoise(this.ambience, at, halfBeat * 15, 0.012, identity.instrumentation.textureCutoff, this.step + 1_001)
    }
    const engineRatio = Math.min(1, state.speed / bikeProfile.maxSpeed)
    const engineFrequency = bikeProfile.audio.idleHz + (bikeProfile.audio.redlineHz - bikeProfile.audio.idleHz) * engineRatio
    this.playTone(this.bikeNode, engineFrequency, at, halfBeat * 1.85, 0.009 + bikeProfile.audio.engineGain * 0.005, 'sawtooth', 145 + engineRatio * 120)
  }

  private playTone(target: AudioNode, frequency: number, at: number, duration: number, amplitude: number, shape: OscillatorType, cutoff: number): void {
    const context = this.ctx
    if (!context) return
    try {
      const oscillator = context.createOscillator()
      const filter = context.createBiquadFilter()
      const gain = context.createGain()
      oscillator.type = shape
      oscillator.frequency.setValueAtTime(frequency, at)
      filter.type = 'lowpass'
      filter.frequency.setValueAtTime(cutoff, at)
      gain.gain.setValueAtTime(SILENCE, at)
      gain.gain.exponentialRampToValueAtTime(Math.max(SILENCE, amplitude), at + 0.025)
      gain.gain.exponentialRampToValueAtTime(SILENCE, at + Math.max(0.05, duration))
      oscillator.connect(filter)
      filter.connect(gain)
      gain.connect(target)
      this.trackVoice(oscillator, gain)
      oscillator.start(at)
      oscillator.stop(at + duration + 0.06)
    } catch (error) {
      this.fail(error)
    }
  }

  private playNoise(target: AudioNode, at: number, duration: number, amplitude: number, cutoff: number, salt: number): void {
    const context = this.ctx
    const identity = this.identity
    if (!context || !identity) return
    try {
      const frameCount = Math.max(1, Math.floor(context.sampleRate * duration))
      const buffer = context.createBuffer(1, frameCount, context.sampleRate)
      const data = buffer.getChannelData(0)
      const random = createSeededRandom(hashMusicSeed(identity.seed, salt))
      for (let index = 0; index < data.length; index += 1) data[index] = random() * 2 - 1
      const source = context.createBufferSource()
      const filter = context.createBiquadFilter()
      const gain = context.createGain()
      source.buffer = buffer
      filter.type = 'lowpass'
      filter.frequency.setValueAtTime(cutoff, at)
      gain.gain.setValueAtTime(Math.max(SILENCE, amplitude), at)
      gain.gain.linearRampToValueAtTime(SILENCE, at + duration)
      source.connect(filter)
      filter.connect(gain)
      gain.connect(target)
      this.trackVoice(source, gain)
      source.start(at)
      source.stop(at + duration + 0.03)
    } catch (error) {
      this.fail(error)
    }
  }

  private trackVoice(source: AudioScheduledSourceNode, gain: GainNode): void {
    const voice = { source, gain }
    this.voices.add(voice)
    source.addEventListener('ended', () => {
      this.voices.delete(voice)
      try { source.disconnect() } catch { /* already disconnected */ }
      try { gain.disconnect() } catch { /* already disconnected */ }
    }, { once: true })
  }

  private releaseVoices(fadeSeconds: number): void {
    const now = this.ctx?.currentTime ?? 0
    for (const voice of this.voices) {
      try {
        voice.gain.gain.cancelScheduledValues(now)
        voice.gain.gain.setValueAtTime(Math.max(SILENCE, voice.gain.gain.value), now)
        voice.gain.gain.linearRampToValueAtTime(SILENCE, now + fadeSeconds)
        voice.source.stop(now + fadeSeconds + 0.02)
      } catch {
        this.voices.delete(voice)
      }
    }
  }

  private musicLevel(): number {
    return this.settings.music * 0.42
  }

  private applyMix(seconds: number): void {
    this.rampGain(this.master, this.settings.enabled && !this.explicitlyPaused ? this.settings.master * 0.88 : 0, seconds)
    this.applyBusMix(seconds)
  }

  private applyBusMix(seconds: number): void {
    const speedEnergy = Math.min(1, (this.state?.speed ?? 0) / 150)
    const cockpit = this.state?.camera === 'cockpit'
    const audioProfile = this.state ? bikes[this.state.bike].audio : bikes.sport.audio
    this.rampGain(this.music, this.musicLevel(), seconds)
    this.rampGain(this.ambience, this.settings.ambience * audioProfile.windGain * (cockpit ? 0.32 : 0.54) * (0.75 + speedEnergy * 0.25), seconds)
    this.rampGain(this.bikeNode, this.settings.bike * audioProfile.engineGain * (cockpit ? 0.32 : 0.22) * (0.35 + speedEnergy * 0.65), seconds)
  }

  private rampGain(node: GainNode | undefined, value: number, seconds: number): void {
    if (!node || !this.ctx) return
    const now = this.ctx.currentTime
    const safeValue = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0
    node.gain.cancelScheduledValues(now)
    node.gain.setValueAtTime(Math.max(0, node.gain.value), now)
    node.gain.linearRampToValueAtTime(safeValue, now + Math.max(0.001, seconds))
  }

  private fail(error: unknown): void {
    this.error = safeMessage(error)
    this.phase = 'error'
    this.clearScheduler()
    this.rampGain(this.master, 0, 0.03)
  }
}
