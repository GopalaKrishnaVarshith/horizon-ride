import type { BikeProfile } from '../config'
import type { BikeClass, BiomeId } from '../types'
import type { RideControlInput, RideSimulationState, SimulationEnvironment } from './simulation'

export interface AutoRideContext {
  state: RideSimulationState
  profile: BikeProfile
  environment: SimulationEnvironment
  biome: BiomeId
  bike: BikeClass
}

const BIOME_CRUISE_SPEED: Record<BiomeId, number> = {
  coast: 53,
  alpine: 49,
  desert: 51,
}

const BIKE_CRUISE_OFFSET: Record<BikeClass, number> = {
  scooter: -2,
  sport: 4,
  cruiser: 0,
} as const

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value))
}

/**
 * A deliberately gentle lane-keeping controller. It follows route curvature,
 * looks after heading error, and only then recentres the bike. This avoids the
 * twitchy left/right corrections that make an assisted ride feel robotic.
 */
export function createAutoRideControls({ state, profile, environment, biome, bike }: AutoRideContext): RideControlInput {
  const edgePressure = clamp((Math.abs(state.lateral) - 1.6) / 2.25, 0, 1)
  const targetSpeed = (BIOME_CRUISE_SPEED[biome] + BIKE_CRUISE_OFFSET[bike]) * (1 - edgePressure * 0.24)
  const speedError = targetSpeed - state.speed

  const targetRatio = clamp(targetSpeed / profile.maxSpeed, 0, 1)
  const engineCurve = Math.max(0.08, 1 - Math.pow(targetRatio, 1.45))
  const steadyDrag = profile.coastDrag * 0.28 + profile.aerodynamicDrag * targetSpeed * targetSpeed
  const steadyThrottle = steadyDrag / Math.max(0.1, profile.acceleration * engineCurve)
  const uphillHelp = clamp(environment.slope * 0.95, 0, 0.15)
  const throttle = speedError > -0.8
    ? clamp(steadyThrottle + uphillHelp + Math.max(0, speedError) * 0.032, 0, 0.68)
    : 0
  const brake = speedError < -2
    ? clamp((-speedError - 2) * 0.038, 0, 0.34)
    : 0

  const speedMetresPerSecond = Math.max(3.2, state.speed / 3.6)
  const desiredRelativeHeading = clamp(-state.lateral * 0.075, -0.24, 0.24)
  const headingError = desiredRelativeHeading - state.relativeHeading
  const routeYawRate = environment.curvature * speedMetresPerSecond
  const desiredYawRate = routeYawRate + headingError * 1.55
  const desiredSteerAngle = Math.atan(desiredYawRate * profile.wheelbase / speedMetresPerSecond)
  const speedRatio = clamp(state.speed / profile.maxSpeed, 0, 1)
  const highSpeedSteer = 1 - Math.pow(speedRatio, 1.15) * (1 - profile.highSpeedSteerFactor)
  const availableSteerAngle = Math.max(0.04, profile.maxSteerAngle * highSpeedSteer)
  const steer = clamp(desiredSteerAngle / availableSteerAngle, -0.72, 0.72)

  return { throttle, brake, steer }
}
