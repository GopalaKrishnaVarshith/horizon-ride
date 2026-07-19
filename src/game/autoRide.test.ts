import { describe, expect, it } from 'vitest'
import { bikes } from '../config'
import { createAutoRideControls } from './autoRide'
import { createSimulationState, routeEnvironment, stepSimulation } from './simulation'

describe('calm auto ride', () => {
  it('cruises at a relaxed speed without racing acceleration', () => {
    const state = createSimulationState({ speed: 28 })
    const environment = routeEnvironment(482901, 'coast', state)
    const controls = createAutoRideControls({ state, profile: bikes.sport, environment, biome: 'coast', bike: 'sport' })
    expect(controls.throttle).toBeGreaterThan(0)
    expect(controls.throttle).toBeLessThanOrEqual(0.68)
    expect(controls.brake).toBe(0)
  })

  it('steers back toward the centre from either shoulder', () => {
    for (const lateral of [-3.5, 3.5]) {
      const state = createSimulationState({ speed: 50, lateral, relativeHeading: 0 })
      const environment = routeEnvironment(77, 'alpine', state)
      const controls = createAutoRideControls({ state, profile: bikes.cruiser, environment, biome: 'alpine', bike: 'cruiser' })
      expect(Math.sign(controls.steer)).toBe(-Math.sign(lateral))
    }
  })

  it('holds a long seeded route near the road centre', () => {
    let state = createSimulationState({ speed: 24, lateral: 2.7, relativeHeading: 0.08 })
    for (let step = 0; step < 18_000; step += 1) {
      const environment = routeEnvironment(8128, 'alpine', state)
      const controls = createAutoRideControls({ state, profile: bikes.sport, environment, biome: 'alpine', bike: 'sport' })
      state = stepSimulation(state, controls, bikes.sport, environment)
    }
    expect(state.speed).toBeGreaterThan(35)
    expect(state.speed).toBeLessThan(70)
    expect(Math.abs(state.lateral)).toBeLessThan(1.35)
  })
})
