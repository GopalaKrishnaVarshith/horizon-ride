import type { BikeProfile } from '../config'
import type { BiomeId } from '../types'
import { ROAD_HALF_WIDTH, routeFrame } from './route'

export const FIXED_TIMESTEP = 1 / 120
export const MAX_FRAME_DELTA = 0.25
/** The road is 8.3 m wide; this adds a forgiving, rideable shoulder. */
export const MAX_LATERAL_DISTANCE = ROAD_HALF_WIDTH + 1.25
export const EDGE_GUIDANCE_START = ROAD_HALF_WIDTH - 0.78

export interface RideControlInput {
  /** Normalised throttle pressure from 0 to 1. */
  throttle: number
  /** Normalised brake pressure from 0 to 1. */
  brake: number
  /** Steering input from -1 (left) to 1 (right). */
  steer: number
}

export interface SimulationEnvironment {
  routeHeading: number
  curvature: number
  slope: number
  bank: number
  /** Optional signed road/surface displacement in metres. */
  surfaceBump?: number
}

export interface RideSimulationState {
  /** km/h */
  speed: number
  /** metres along the generated route */
  distance: number
  /** legacy-friendly normalised steer value */
  steer: number
  /** signed metres from road centre */
  lateral: number
  /** absolute route yaw in radians */
  heading: number
  /** bike yaw relative to the road tangent */
  relativeHeading: number
  /** front wheel steering angle in radians */
  steerAngle: number
  /** visual/physical lean in radians, positive to the right */
  lean: number
  pitch: number
  suspension: number
  suspensionVelocity: number
  wheelRotation: number
  offRoadFactor: number
  longitudinalAcceleration: number
}

export interface FixedSimulationFrame {
  state: RideSimulationState
  accumulator: number
  steps: number
}

const NEUTRAL_CONTROLS: RideControlInput = { throttle: 0, brake: 0, steer: 0 }

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value))
}

function damp(current: number, target: number, response: number, delta: number) {
  return target + (current - target) * Math.exp(-response * delta)
}

function smoothstep(edge0: number, edge1: number, value: number) {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1)
  return t * t * (3 - 2 * t)
}

function wrapAngle(value: number) {
  return Math.atan2(Math.sin(value), Math.cos(value))
}

function finite(value: number | null | undefined, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

export function normaliseRideControls(input: Partial<RideControlInput> = NEUTRAL_CONTROLS): RideControlInput {
  return {
    throttle: clamp(finite(input.throttle), 0, 1),
    brake: clamp(finite(input.brake), 0, 1),
    steer: clamp(finite(input.steer), -1, 1),
  }
}

export function createSimulationState(initial: Partial<RideSimulationState> = {}): RideSimulationState {
  return {
    speed: clamp(finite(initial.speed, 32), 0, 400),
    distance: Math.max(0, finite(initial.distance)),
    steer: clamp(finite(initial.steer), -1, 1),
    lateral: clamp(finite(initial.lateral), -MAX_LATERAL_DISTANCE, MAX_LATERAL_DISTANCE),
    heading: wrapAngle(finite(initial.heading)),
    relativeHeading: clamp(finite(initial.relativeHeading), -0.9, 0.9),
    steerAngle: clamp(finite(initial.steerAngle), -0.8, 0.8),
    lean: clamp(finite(initial.lean), -1, 1),
    pitch: clamp(finite(initial.pitch), -0.35, 0.35),
    suspension: finite(initial.suspension),
    suspensionVelocity: finite(initial.suspensionVelocity),
    wheelRotation: wrapAngle(finite(initial.wheelRotation)),
    offRoadFactor: clamp(finite(initial.offRoadFactor), 0, 1),
    longitudinalAcceleration: finite(initial.longitudinalAcceleration),
  }
}

/** Builds the exact route conditions consumed by one deterministic physics step. */
export function routeEnvironment(seed: number, biome: BiomeId, state: RideSimulationState): SimulationEnvironment {
  const frame = routeFrame(seed, state.distance, biome)
  return {
    routeHeading: frame.heading,
    curvature: frame.curvature,
    slope: frame.slope,
    bank: frame.bank,
  }
}

/**
 * Advance exactly one physics step. The function is pure: it does not mutate the
 * provided state, input, bike profile, or environment.
 */
export function stepSimulation(
  current: RideSimulationState,
  rawControls: Partial<RideControlInput>,
  profile: BikeProfile,
  rawEnvironment: SimulationEnvironment,
  delta = FIXED_TIMESTEP,
): RideSimulationState {
  const controls = normaliseRideControls(rawControls)
  const dt = clamp(finite(delta, FIXED_TIMESTEP), 1 / 1000, 1 / 20)
  const environment: SimulationEnvironment = {
    routeHeading: finite(rawEnvironment.routeHeading),
    curvature: clamp(finite(rawEnvironment.curvature), -0.04, 0.04),
    slope: clamp(finite(rawEnvironment.slope), -0.25, 0.25),
    bank: clamp(finite(rawEnvironment.bank), -0.22, 0.22),
    surfaceBump: clamp(finite(rawEnvironment.surfaceBump), -profile.suspensionTravel, profile.suspensionTravel),
  }
  const state = createSimulationState(current)
  const previousSpeed = state.speed
  const speedRatio = clamp(state.speed / profile.maxSpeed, 0, 1)
  const speedMetresPerSecond = state.speed / 3.6
  const absoluteLateral = Math.abs(state.lateral)
  const roadSide = Math.sign(state.lateral) || 1
  const edgeGuidance = smoothstep(EDGE_GUIDANCE_START, MAX_LATERAL_DISTANCE - 0.18, absoluteLateral)
  const offRoadFactor = smoothstep(ROAD_HALF_WIDTH - 0.04, MAX_LATERAL_DISTANCE, absoluteLateral)
  const surfaceGrip = 1 - offRoadFactor * (1 - profile.offroadGrip)

  const highSpeedSteer = 1 - Math.pow(speedRatio, 1.15) * (1 - profile.highSpeedSteerFactor)
  const maximumSteerAngle = profile.maxSteerAngle * highSpeedSteer * surfaceGrip
  // Keyboard steering is binary, so shape low analogue input and progressively
  // take authority away only when the rider is actively steering off the edge.
  const shapedSteer = Math.sign(controls.steer) * Math.pow(Math.abs(controls.steer), 1.28)
  const outwardIntent = Math.max(0, shapedSteer * roadSide)
  const edgeCounterSteer = roadSide * edgeGuidance * (0.42 + outwardIntent * 0.78)
  const guidedSteer = clamp(shapedSteer - edgeCounterSteer, -1, 1)
  const targetSteerAngle = guidedSteer * maximumSteerAngle
  const steerAngle = damp(state.steerAngle, targetSteerAngle, profile.steerRate, dt)
  const steer = damp(state.steer, guidedSteer, profile.steerRate * 0.72, dt)

  const engineCurve = Math.max(0.08, 1 - Math.pow(speedRatio, 1.45))
  const engineAcceleration = controls.throttle * profile.acceleration * engineCurve
  const braking = controls.brake * profile.brakeDeceleration * (0.72 + speedRatio * 0.28)
  const coast = profile.coastDrag * (controls.throttle > 0.02 ? 0.28 : 1)
  const aerodynamic = profile.aerodynamicDrag * state.speed * state.speed
  const offroadLoss = profile.offroadDrag * offRoadFactor * (0.22 + speedRatio * 0.78)
  const gradeLoss = Math.sin(environment.slope) * 9.81 * 3.6
  const accelerationKphPerSecond = engineAcceleration - braking - coast - aerodynamic - offroadLoss - gradeLoss
  const speed = clamp(state.speed + accelerationKphPerSecond * dt, 0, profile.maxSpeed)
  const averageSpeedMetresPerSecond = (state.speed + speed) / 7.2

  // Bicycle model: wheel angle and wheelbase produce yaw. The route's own yaw
  // is removed so the stored heading remains relative to its moving tangent.
  const rawYawRate = averageSpeedMetresPerSecond / profile.wheelbase * Math.tan(steerAngle) * surfaceGrip
  // A calm scenic ride needs a plausible turn envelope, especially with held
  // keyboard input. This is still faster at low speed and stable near the cap.
  const maximumYawRate = 0.78 - speedRatio * 0.36
  const yawRate = clamp(rawYawRate, -maximumYawRate, maximumYawRate)
  const routeYawRate = environment.curvature * averageSpeedMetresPerSecond
  let relativeHeading = state.relativeHeading + (yawRate - routeYawRate) * dt

  // Gentle, input-sensitive road assist makes keyboard and touch steering
  // forgiving without erasing rider intent or snapping to the centreline.
  const assistAuthority = profile.roadAssist * (1 - Math.abs(controls.steer) * 0.7)
  const centreHeading = clamp(-state.lateral * 0.032, -0.22, 0.22)
  const edgeHeading = -roadSide * (0.07 + edgeGuidance * 0.2)
  const guidanceHeading = centreHeading + (edgeHeading - centreHeading) * edgeGuidance
  const edgeAuthority = edgeGuidance * (4.8 + speedRatio * 2.6)
  relativeHeading = damp(relativeHeading, guidanceHeading, assistAuthority + edgeAuthority, dt)
  relativeHeading = clamp(relativeHeading, -0.58, 0.58)

  const forwardProgress = Math.max(0, averageSpeedMetresPerSecond * Math.cos(relativeHeading) * dt)
  const distance = Math.max(state.distance, state.distance + forwardProgress)
  const lateralVelocity = averageSpeedMetresPerSecond * Math.sin(relativeHeading)
  const movingOutward = lateralVelocity * roadSide > 0
  const outwardVelocityScale = movingOutward ? 1 - edgeGuidance * (0.82 + speedRatio * 0.12) : 1
  let lateral = state.lateral + lateralVelocity * outwardVelocityScale * dt
  if (Math.abs(lateral) > MAX_LATERAL_DISTANCE) {
    lateral = clamp(lateral, -MAX_LATERAL_DISTANCE, MAX_LATERAL_DISTANCE)
    // Last-resort soft shoulder containment. By this point outward velocity has
    // already been reduced smoothly, so the correction is not a visible snap.
    if (relativeHeading * roadSide > 0) relativeHeading = -roadSide * Math.min(0.035, Math.abs(relativeHeading) * 0.18)
  }

  const lateralAcceleration = averageSpeedMetresPerSecond * yawRate
  const equilibriumLean = clamp(
    // routeFrame bank uses Three.js roll sign (negative is a right-hand bank),
    // while simulation lean is positive-to-the-right for rendering clarity.
    Math.atan2(lateralAcceleration, 9.81) - environment.bank,
    -profile.leanLimit,
    profile.leanLimit,
  )
  const lean = damp(state.lean, equilibriumLean, profile.leanResponse, dt)

  const roadTexture =
    Math.sin(distance * 2.7) * 0.0026 +
    Math.sin(distance * 8.1 + 0.7) * 0.0011 +
    Math.sin(distance * 0.73) * 0.009 * offRoadFactor
  const suspensionTarget = clamp(
    (environment.surfaceBump ?? 0) + roadTexture,
    -profile.suspensionTravel,
    profile.suspensionTravel,
  )
  const angularFrequency = profile.suspensionFrequency
  const suspensionAcceleration =
    (suspensionTarget - state.suspension) * angularFrequency * angularFrequency -
    2 * profile.suspensionDamping * angularFrequency * state.suspensionVelocity
  const suspensionVelocity = state.suspensionVelocity + suspensionAcceleration * dt
  const suspension = clamp(
    state.suspension + suspensionVelocity * dt,
    -profile.suspensionTravel,
    profile.suspensionTravel,
  )

  const pitchTarget = clamp(-accelerationKphPerSecond * 0.0026 - suspensionVelocity * 0.045, -0.14, 0.14)
  const pitch = damp(state.pitch, pitchTarget, 6.2, dt)
  const wheelRotation = wrapAngle(state.wheelRotation + averageSpeedMetresPerSecond / profile.wheelRadius * dt)

  return {
    speed,
    distance,
    steer,
    lateral,
    heading: wrapAngle(environment.routeHeading + relativeHeading),
    relativeHeading,
    steerAngle,
    lean,
    pitch,
    suspension,
    suspensionVelocity,
    wheelRotation,
    offRoadFactor,
    longitudinalAcceleration: (speed - previousSpeed) / dt,
  }
}

export function createSimulationFrame(initial: Partial<RideSimulationState> = {}): FixedSimulationFrame {
  return { state: createSimulationState(initial), accumulator: 0, steps: 0 }
}

/**
 * Deterministic fixed-timestep driver. Rendering may provide variable frame
 * deltas; gameplay always advances in 1/120 s increments. Route conditions may
 * be supplied directly or sampled afresh per step through a callback.
 */
export function advanceFixedSimulation(
  frame: FixedSimulationFrame,
  controls: Partial<RideControlInput>,
  profile: BikeProfile,
  environment: SimulationEnvironment | ((state: RideSimulationState) => SimulationEnvironment),
  elapsedSeconds: number,
): FixedSimulationFrame {
  let state = createSimulationState(frame.state)
  let accumulator = clamp(finite(frame.accumulator), 0, MAX_FRAME_DELTA)
  accumulator += clamp(finite(elapsedSeconds), 0, MAX_FRAME_DELTA)
  let steps = 0

  while (accumulator + Number.EPSILON >= FIXED_TIMESTEP && steps < 30) {
    const currentEnvironment = typeof environment === 'function' ? environment(state) : environment
    state = stepSimulation(state, controls, profile, currentEnvironment, FIXED_TIMESTEP)
    accumulator -= FIXED_TIMESTEP
    steps += 1
  }

  return {
    state,
    accumulator: clamp(accumulator, 0, FIXED_TIMESTEP),
    steps,
  }
}

/** Readable integration aliases used by the render loop. */
export const createInitialSimulation = createSimulationState
export const stepVehicle = stepSimulation
