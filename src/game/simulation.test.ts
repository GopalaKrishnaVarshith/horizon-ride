import { describe, expect, it } from 'vitest'
import { bikes } from '../config'
import {
  EDGE_GUIDANCE_START,
  FIXED_TIMESTEP,
  MAX_LATERAL_DISTANCE,
  advanceFixedSimulation,
  createSimulationFrame,
  createSimulationState,
  normaliseRideControls,
  routeEnvironment,
  stepSimulation,
} from './simulation'

const FLAT = { routeHeading: 0, curvature: 0, slope: 0, bank: 0 }

describe('motorcycle simulation', () => {
  it('normalises noisy keyboard, touch, and analogue input', () => {
    expect(normaliseRideControls({ throttle: 9, brake: -2, steer: Number.POSITIVE_INFINITY })).toEqual({
      throttle: 1,
      brake: 0,
      steer: 0,
    })
  })

  it('accelerates, brakes, coasts and never reverses', () => {
    const initial = createSimulationState({ speed: 25 })
    const accelerating = stepSimulation(initial, { throttle: 1 }, bikes.sport, FLAT, 1 / 60)
    const braking = stepSimulation(accelerating, { brake: 1 }, bikes.sport, FLAT, 1 / 60)
    const coasting = stepSimulation(accelerating, {}, bikes.sport, FLAT, 1 / 60)
    expect(accelerating.speed).toBeGreaterThan(initial.speed)
    expect(braking.speed).toBeLessThan(accelerating.speed)
    expect(coasting.speed).toBeLessThan(accelerating.speed)

    let stopped = createSimulationState({ speed: 0.02 })
    for (let index = 0; index < 400; index += 1) stopped = stepSimulation(stopped, { brake: 1 }, bikes.scooter, FLAT)
    expect(stopped.speed).toBe(0)
    expect(stopped.distance).toBeGreaterThanOrEqual(initial.distance)
  })

  it('uses bicycle yaw, speed-dependent steering and a stable lean equilibrium', () => {
    let lowSpeed = createSimulationState({ speed: 22 })
    let highSpeed = createSimulationState({ speed: 150 })
    for (let index = 0; index < 120; index += 1) {
      lowSpeed = stepSimulation(lowSpeed, { steer: 1 }, bikes.sport, FLAT)
      highSpeed = stepSimulation(highSpeed, { steer: 1 }, bikes.sport, FLAT)
    }
    expect(lowSpeed.steerAngle).toBeGreaterThan(highSpeed.steerAngle)
    expect(lowSpeed.lateral).toBeGreaterThan(0)
    expect(highSpeed.lean).toBeGreaterThan(0)
    expect(Math.abs(highSpeed.lean)).toBeLessThanOrEqual(bikes.sport.leanLimit)
  })

  it('leans into the commanded turn and agrees with the road bank convention', () => {
    let right = createSimulationState({ speed: 72 })
    let left = createSimulationState({ speed: 72 })
    for (let index = 0; index < 180; index += 1) {
      right = stepSimulation(right, { steer: 0.55 }, bikes.sport, FLAT)
      left = stepSimulation(left, { steer: -0.55 }, bikes.sport, FLAT)
    }
    expect(right.lateral).toBeGreaterThan(0)
    expect(left.lateral).toBeLessThan(0)
    expect(right.lean).toBeGreaterThan(0)
    expect(left.lean).toBeLessThan(0)
    expect(Math.abs(right.lean)).toBeCloseTo(Math.abs(left.lean), 5)

    let rightBank = createSimulationState({ speed: 65 })
    for (let index = 0; index < 180; index += 1) {
      rightBank = stepSimulation(rightBank, {}, bikes.cruiser, {
        routeHeading: 0,
        curvature: 0.003,
        slope: 0,
        // routeFrame uses negative Three.js roll for a right-hand bank.
        bank: -0.075,
      })
    }
    expect(rightBank.lean).toBeGreaterThan(0)
    expect(Math.abs(rightBank.lean)).toBeLessThanOrEqual(bikes.cruiser.leanLimit)
  })

  it('smoothly counters persistent outward steering before the road edge', () => {
    let state = createSimulationState({ speed: 82, lateral: EDGE_GUIDANCE_START + 0.08, relativeHeading: 0.05 })
    for (let index = 0; index < 960; index += 1) {
      state = stepSimulation(state, { throttle: 0.45, steer: 1 }, bikes.scooter, FLAT)
    }
    expect(state.lateral).toBeLessThanOrEqual(MAX_LATERAL_DISTANCE)
    expect(Math.abs(state.relativeHeading)).toBeLessThan(0.02)
    expect(Math.abs(state.steerAngle)).toBeLessThan(0.05)

    const atEdge = state.lateral
    for (let index = 0; index < 240; index += 1) state = stepSimulation(state, { throttle: 0.35 }, bikes.scooter, FLAT)
    expect(state.lateral).toBeLessThan(atEdge - 0.25)
    expect(state.offRoadFactor).toBeLessThan(0.4)
  })

  it('keeps held keyboard steering and acceleration calm at road speed', () => {
    let heldTurn = createSimulationState({ speed: 90 })
    for (let index = 0; index < 120; index += 1) heldTurn = stepSimulation(heldTurn, { steer: 1 }, bikes.sport, FLAT)
    expect(Math.abs(heldTurn.relativeHeading)).toBeLessThan(0.5)
    expect(Math.abs(heldTurn.lateral)).toBeLessThan(MAX_LATERAL_DISTANCE)
    expect(Math.abs(heldTurn.lean)).toBeLessThan(bikes.sport.leanLimit)

    let shortTap = createSimulationState({ speed: 72 })
    for (let index = 0; index < 18; index += 1) shortTap = stepSimulation(shortTap, { steer: 1 }, bikes.sport, FLAT)
    for (let index = 0; index < 120; index += 1) shortTap = stepSimulation(shortTap, {}, bikes.sport, FLAT)
    expect(Math.abs(shortTap.relativeHeading)).toBeLessThan(0.16)
    expect(Math.abs(shortTap.lean)).toBeLessThan(0.12)

    let accelerating = createSimulationState({ speed: 32 })
    for (let index = 0; index < 360; index += 1) accelerating = stepSimulation(accelerating, { throttle: 1 }, bikes.sport, FLAT)
    expect(accelerating.speed).toBeGreaterThan(55)
    expect(accelerating.speed).toBeLessThan(85)
  })

  it('adds progressive off-road drag and bounded road assist', () => {
    const onRoad = createSimulationState({ speed: 80, lateral: 0 })
    const offRoad = createSimulationState({ speed: 80, lateral: 7.5, relativeHeading: 0.1 })
    const nextOnRoad = stepSimulation(onRoad, {}, bikes.cruiser, FLAT, 1 / 60)
    let nextOffRoad = stepSimulation(offRoad, {}, bikes.cruiser, FLAT, 1 / 60)
    expect(nextOffRoad.offRoadFactor).toBeGreaterThan(0.5)
    expect(nextOffRoad.speed).toBeLessThan(nextOnRoad.speed)

    for (let index = 0; index < 2_000; index += 1) nextOffRoad = stepSimulation(nextOffRoad, {}, bikes.cruiser, FLAT)
    expect(Math.abs(nextOffRoad.lateral)).toBeLessThanOrEqual(MAX_LATERAL_DISTANCE)
    expect(Object.values(nextOffRoad).every(Number.isFinite)).toBe(true)
  })

  it('advances deterministically at a fixed timestep independent of render cadence', () => {
    const run = (cadence: number[]) => {
      let frame = createSimulationFrame({ speed: 40 })
      for (const delta of cadence) {
        frame = advanceFixedSimulation(
          frame,
          { throttle: 0.7, steer: 0.16 },
          bikes.scooter,
          (state) => routeEnvironment(482901, 'coast', state),
          delta,
        )
      }
      return frame.state
    }
    const atSixty = run(Array.from({ length: 120 }, () => 1 / 60))
    const atThirty = run(Array.from({ length: 60 }, () => 1 / 30))
    expect(atSixty.distance).toBeCloseTo(atThirty.distance, 8)
    expect(atSixty.speed).toBeCloseTo(atThirty.speed, 8)
    expect(atSixty.lateral).toBeCloseTo(atThirty.lateral, 8)
  })

  it('keeps suspension and wheel rotation finite during a long seeded ride', () => {
    let frame = createSimulationFrame({ speed: 55 })
    for (let index = 0; index < 8_000; index += 1) {
      frame = advanceFixedSimulation(
        frame,
        { throttle: 0.45, steer: Math.sin(index * FIXED_TIMESTEP) * 0.3 },
        bikes.cruiser,
        (state) => routeEnvironment(77, 'alpine', state),
        FIXED_TIMESTEP,
      )
    }
    expect(Object.values(frame.state).every(Number.isFinite)).toBe(true)
    expect(Math.abs(frame.state.suspension)).toBeLessThanOrEqual(bikes.cruiser.suspensionTravel)
    expect(frame.state.speed).toBeLessThanOrEqual(bikes.cruiser.maxSpeed)
  })
})
