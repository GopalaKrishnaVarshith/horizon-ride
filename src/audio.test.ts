import { afterEach, describe, expect, it, vi } from 'vitest'
import { HorizonAudioEngine } from './audio'
import type { AudioSettingsV1, RideAudioState } from './types'

class FakeAudioParam {
  value = 0
  setValueAtTime(value: number) { this.value = value; return this }
  linearRampToValueAtTime(value: number) { this.value = value; return this }
  exponentialRampToValueAtTime(value: number) { this.value = value; return this }
  cancelScheduledValues() { return this }
}

class FakeNode {
  connected = true
  connect<T>(target: T): T { return target }
  disconnect() { this.connected = false }
}

class FakeGain extends FakeNode { gain = new FakeAudioParam() }
class FakeFilter extends FakeNode { type: BiquadFilterType = 'lowpass'; frequency = new FakeAudioParam() }
class FakeCompressor extends FakeNode {
  threshold = new FakeAudioParam(); knee = new FakeAudioParam(); ratio = new FakeAudioParam()
  attack = new FakeAudioParam(); release = new FakeAudioParam()
}

class FakeSource extends FakeNode {
  stopped = false
  private ended: Array<() => void> = []
  addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
    if (type === 'ended') this.ended.push(typeof listener === 'function' ? listener as () => void : () => listener.handleEvent(new Event('ended')))
  }
  start() {}
  stop() { this.stopped = true }
  finish() { for (const listener of this.ended.splice(0)) listener() }
}

class FakeOscillator extends FakeSource {
  type: OscillatorType = 'sine'
  frequency = new FakeAudioParam()
}

class FakeBufferSource extends FakeSource { buffer: AudioBuffer | null = null }

class FakeContext {
  state: AudioContextState = 'running'
  currentTime = 0
  sampleRate = 100
  destination = new FakeNode()
  masterGains: FakeGain[] = []
  sources: FakeSource[] = []
  createGain() { const gain = new FakeGain(); this.masterGains.push(gain); return gain as unknown as GainNode }
  createDynamicsCompressor() { return new FakeCompressor() as unknown as DynamicsCompressorNode }
  createOscillator() { const source = new FakeOscillator(); this.sources.push(source); return source as unknown as OscillatorNode }
  createBiquadFilter() { return new FakeFilter() as unknown as BiquadFilterNode }
  createBufferSource() { const source = new FakeBufferSource(); this.sources.push(source); return source as unknown as AudioBufferSourceNode }
  createBuffer(_channels: number, frames: number) {
    const data = new Float32Array(frames)
    return { getChannelData: () => data } as unknown as AudioBuffer
  }
  async resume() { this.state = 'running' }
  async close() { this.state = 'closed' }
}

const enabled: AudioSettingsV1 = { enabled: true, master: 0.6, music: 0.5, ambience: 0.4, bike: 0.3, variation: 0.5 }
const state: RideAudioState = { biome: 'alpine', bike: 'sport', camera: 'chase', speed: 40, paused: false, seed: 17 }

afterEach(() => vi.useRealTimers())

describe('HorizonAudioEngine lifecycle', () => {
  it('keeps disabled audio at a hard mute boundary until explicit enablement', async () => {
    vi.useFakeTimers()
    const context = new FakeContext()
    const engine = new HorizonAudioEngine({ ...enabled, enabled: false }, { contextFactory: () => context as unknown as AudioContext })
    expect(await engine.unlock()).toBe(true)
    engine.startRide(state)
    expect(context.sources).toHaveLength(0)
    expect(engine.getStatus().enabled).toBe(false)

    engine.setMix(enabled)
    expect(context.sources.length).toBeGreaterThan(0)
    engine.setMix({ ...enabled, enabled: false })
    expect(engine.getStatus().phase).toBe('stopped')
    expect(context.masterGains[0].gain.value).toBe(0)
    engine.setRideState({ ...state, speed: 90 })
    expect(context.masterGains[0].gain.value).toBe(0)
    await engine.dispose()
  })

  it('starts idempotently, rebases after a background gap, and cleans every voice', async () => {
    vi.useFakeTimers()
    const context = new FakeContext()
    const engine = new HorizonAudioEngine(enabled, { contextFactory: () => context as unknown as AudioContext, schedulerIntervalMs: 50 })
    await engine.unlock()
    engine.startRide(state)
    const initialSources = context.sources.length
    expect(initialSources).toBeGreaterThan(0)
    engine.startRide(state)
    expect(context.sources).toHaveLength(initialSources)

    context.currentTime = 30
    vi.advanceTimersByTime(60)
    expect(context.sources.length).toBeLessThan(initialSources + 20)
    expect(engine.getStatus().phase).toBe('running')

    engine.stopRide()
    expect(context.sources.every((source) => source.stopped)).toBe(true)
    for (const source of context.sources) source.finish()
    expect(engine.getStatus().activeVoices).toBe(0)
    await engine.dispose()
    expect(engine.getStatus().phase).toBe('disposed')
    expect(context.state).toBe('closed')
  })

  it('fails gracefully when Web Audio is unavailable', async () => {
    const engine = new HorizonAudioEngine(enabled, { contextFactory: () => undefined })
    expect(await engine.unlock()).toBe(false)
    expect(engine.getStatus().phase).toBe('unavailable')
    engine.startRide(state)
    expect(engine.getStatus().activeVoices).toBe(0)
  })
})
