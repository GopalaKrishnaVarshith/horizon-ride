import type { BiomeId } from '../types'

/** Distance between rendered route samples, in metres. */
export const SEGMENT_LENGTH = 4
/** Includes a short run behind the rider and more than 500 m ahead. */
export const SEGMENT_COUNT = 168
export const ROAD_HALF_WIDTH = 4.15

export interface Vec3Value {
  x: number
  y: number
  z: number
}

export interface RouteFrame {
  distance: number
  center: Vec3Value
  forward: Vec3Value
  right: Vec3Value
  up: Vec3Value
  heading: number
  slope: number
  curvature: number
  bank: number
}

export interface LocalRouteSample {
  distance: number
  x: number
  y: number
  z: number
  heading: number
  slope: number
  curvature: number
  bank: number
  tangent: Vec3Value
  right: Vec3Value
  up: Vec3Value
}

export interface RouteProfilePoint {
  distance: number
  elevation: number
  grade: number
  curvature: number
  bank: number
}

interface RouteIdentity {
  horizontal: readonly [number, number][]
  vertical: readonly [number, number][]
  bankLimit: number
  terrainAmplitude: number
  terrainRise: number
}

const ROUTE_IDENTITY: Record<BiomeId, RouteIdentity> = {
  // Long sea-cliff sweepers with small, flowing elevation changes.
  coast: {
    horizontal: [[20, 0.0035], [8, 0.0084], [3.2, 0.017]],
    vertical: [[1.9, 0.0032], [0.62, 0.0094], [0.22, 0.021]],
    bankLimit: 0.09,
    terrainAmplitude: 2.4,
    terrainRise: 4.6,
  },
  // Tighter mountain switchbacks and the most pronounced grades.
  alpine: {
    horizontal: [[17, 0.0046], [8.5, 0.0108], [3.4, 0.0205]],
    vertical: [[5.2, 0.0027], [1.55, 0.0078], [0.48, 0.018]],
    bankLimit: 0.13,
    terrainAmplitude: 5.8,
    terrainRise: 13.5,
  },
  // Broad desert arcs, rolling crests and long sight lines.
  desert: {
    horizontal: [[27, 0.0026], [7.5, 0.0063], [2.4, 0.014]],
    vertical: [[2.7, 0.0025], [0.8, 0.0071], [0.28, 0.016]],
    bankLimit: 0.075,
    terrainAmplitude: 3.2,
    terrainRise: 5.4,
  },
}

const DERIVATIVE_STEP = 0.35

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value))
}

function smoothstep(edge0: number, edge1: number, value: number) {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1)
  return t * t * (3 - 2 * t)
}

function normaliseSeed(seed: number) {
  if (!Number.isFinite(seed)) return 1
  return Math.abs(Math.trunc(seed)) % 2_147_483_647
}

function phase(seed: number, layer: number, channel: number) {
  return hash(normaliseSeed(seed) + channel * 1013, layer * 7919 + channel * 97) * Math.PI * 2
}

/** Stable scalar hash used for route and scenery identity. */
export function hash(seed: number, index: number) {
  let value = (normaliseSeed(seed) ^ Math.imul(Math.trunc(index) + 1, 0x9e3779b1)) >>> 0
  value ^= value >>> 16
  value = Math.imul(value, 0x21f0aaad)
  value ^= value >>> 15
  value = Math.imul(value, 0x735a2d97)
  value ^= value >>> 15
  return (value >>> 0) / 0x1_0000_0000
}

/** Bounded world-space road centre on the horizontal axis. */
export function routeX(seed: number, distance: number, biome: BiomeId = 'coast') {
  const safeDistance = Number.isFinite(distance) ? distance : 0
  return ROUTE_IDENTITY[biome].horizontal.reduce(
    (total, [amplitude, frequency], index) =>
      total + Math.sin(safeDistance * frequency + phase(seed, index, 11)) * amplitude,
    0,
  )
}

/** Authoritative road elevation, used by rendering, simulation and the HUD profile. */
export function routeY(seed: number, distance: number, biome: BiomeId) {
  const safeDistance = Number.isFinite(distance) ? distance : 0
  return ROUTE_IDENTITY[biome].vertical.reduce(
    (total, [amplitude, frequency], index) =>
      total + Math.sin(safeDistance * frequency + phase(seed, index, 23)) * amplitude,
    0,
  )
}

function routeDerivatives(seed: number, distance: number, biome: BiomeId) {
  const beforeX = routeX(seed, distance - DERIVATIVE_STEP, biome)
  const centerX = routeX(seed, distance, biome)
  const afterX = routeX(seed, distance + DERIVATIVE_STEP, biome)
  const beforeY = routeY(seed, distance - DERIVATIVE_STEP, biome)
  const afterY = routeY(seed, distance + DERIVATIVE_STEP, biome)
  const inverseSpan = 1 / (DERIVATIVE_STEP * 2)
  const dx = (afterX - beforeX) * inverseSpan
  const dy = (afterY - beforeY) * inverseSpan
  const ddx = (afterX - 2 * centerX + beforeX) / (DERIVATIVE_STEP * DERIVATIVE_STEP)
  const curvature = ddx / Math.pow(1 + dx * dx, 1.5)
  return { dx, dy, curvature }
}

/** Road banking in radians. The value is bounded for a calm, readable ride. */
export function routeBank(seed: number, distance: number, biome: BiomeId = 'coast') {
  const { curvature } = routeDerivatives(seed, distance, biome)
  const identity = ROUTE_IDENTITY[biome]
  return clamp(-curvature * 25, -identity.bankLimit, identity.bankLimit)
}

/** Complete world-space road frame at an exact route distance. */
export function routeFrame(seed: number, distance: number, biome: BiomeId): RouteFrame {
  const safeDistance = Number.isFinite(distance) ? distance : 0
  const { dx, dy, curvature } = routeDerivatives(seed, safeDistance, biome)
  const horizontalLength = Math.hypot(dx, 1)
  const spatialLength = Math.hypot(dx, dy, 1)
  const forward = { x: dx / spatialLength, y: dy / spatialLength, z: -1 / spatialLength }
  const right = { x: 1 / horizontalLength, y: 0, z: dx / horizontalLength }
  const levelUp = {
    x: (-dx * dy) / (horizontalLength * spatialLength),
    y: horizontalLength / spatialLength,
    z: dy / (horizontalLength * spatialLength),
  }
  const bank = routeBank(seed, safeDistance, biome)
  const sinBank = Math.sin(bank)
  const cosBank = Math.cos(bank)
  const bankedRight = {
    x: right.x * cosBank + levelUp.x * sinBank,
    y: levelUp.y * sinBank,
    z: right.z * cosBank + levelUp.z * sinBank,
  }
  const up = {
    x: levelUp.x * cosBank - right.x * sinBank,
    y: levelUp.y * cosBank,
    z: levelUp.z * cosBank - right.z * sinBank,
  }
  return {
    distance: safeDistance,
    center: {
      x: routeX(seed, safeDistance, biome),
      y: routeY(seed, safeDistance, biome),
      z: -safeDistance,
    },
    forward,
    right: bankedRight,
    up,
    heading: Math.atan2(dx, 1),
    slope: Math.atan(dy / horizontalLength),
    curvature,
    bank,
  }
}

/**
 * Sample an exact distance in a rider-local frame. The current road tangent is
 * always aligned with local -Z, which keeps the bike and cameras stable while
 * the world streams around them. Lateral offsets follow the sampled road normal.
 */
export function routeSampleAt(
  seed: number,
  originDistance: number,
  distance: number,
  biome: BiomeId,
  lateral = 0,
): LocalRouteSample {
  const origin = routeFrame(seed, originDistance, biome)
  const sample = routeFrame(seed, distance, biome)
  const safeLateral = Number.isFinite(lateral) ? lateral : 0
  const worldX = sample.center.x + sample.right.x * safeLateral
  const worldY = sample.center.y + sample.right.y * safeLateral
  const worldZ = sample.center.z + sample.right.z * safeLateral
  const deltaX = worldX - origin.center.x
  const deltaY = worldY - origin.center.y
  const deltaZ = worldZ - origin.center.z
  const localX = deltaX * origin.right.x + deltaY * origin.right.y + deltaZ * origin.right.z
  const localY = deltaX * origin.up.x + deltaY * origin.up.y + deltaZ * origin.up.z
  const localZ = -(deltaX * origin.forward.x + deltaY * origin.forward.y + deltaZ * origin.forward.z)

  const vectorToLocal = (vector: Vec3Value): Vec3Value => ({
    x: vector.x * origin.right.x + vector.y * origin.right.y + vector.z * origin.right.z,
    y: vector.x * origin.up.x + vector.y * origin.up.y + vector.z * origin.up.z,
    z: -(vector.x * origin.forward.x + vector.y * origin.forward.y + vector.z * origin.forward.z),
  })

  return {
    distance: sample.distance,
    x: localX,
    y: localY,
    z: localZ,
    heading: sample.heading - origin.heading,
    slope: sample.slope,
    curvature: sample.curvature,
    bank: sample.bank,
    tangent: vectorToLocal(sample.forward),
    right: vectorToLocal(sample.right),
    up: vectorToLocal(sample.up),
  }
}

/** Compatibility sampler used by the streaming world renderer. */
export function routeSample(seed: number, originDistance: number, index: number, biome: BiomeId) {
  return routeSampleAt(seed, originDistance, originDistance + index * SEGMENT_LENGTH, biome)
}

/** Continuous terrain joined smoothly to the road shoulder. */
export function terrainHeight(seed: number, distance: number, lateral: number, biome: BiomeId) {
  const safeLateral = clamp(Number.isFinite(lateral) ? lateral : 0, -180, 180)
  const road = routeY(seed, distance, biome)
  const shoulderDistance = Math.max(0, Math.abs(safeLateral) - (ROAD_HALF_WIDTH + 1.05))
  const blend = smoothstep(0, 24, shoulderDistance)
  const identity = ROUTE_IDENTITY[biome]
  const seedOffset = phase(seed, 3, 37)
  const rolling =
    Math.sin(distance * 0.012 + safeLateral * 0.051 + seedOffset) * 0.62 +
    Math.sin(distance * 0.0048 - safeLateral * 0.027 + seedOffset * 0.37) * 0.38
  const clampedRise = identity.terrainRise * smoothstep(0, 76, shoulderDistance)
  let biomeShape = rolling * identity.terrainAmplitude + clampedRise

  if (biome === 'coast') {
    // One side falls towards the sea while the inland side forms low bluffs.
    const sideShape = safeLateral < 0 ? -3.8 * smoothstep(7, 64, shoulderDistance) : clampedRise * 0.8
    biomeShape = rolling * identity.terrainAmplitude + sideShape
  } else if (biome === 'desert') {
    biomeShape = rolling * identity.terrainAmplitude + Math.sin(safeLateral * 0.018 + seedOffset) * 1.1 * blend
  }

  return road - 0.28 + biomeShape * blend
}

/** Authoritative upcoming route data for the terrain HUD and look-ahead systems. */
export function sampleProfile(
  seed: number,
  startDistance: number,
  biome: BiomeId,
  count = 48,
  spacing = 8,
): RouteProfilePoint[] {
  const safeCount = clamp(Math.trunc(count), 1, 256)
  const safeSpacing = clamp(Number.isFinite(spacing) ? spacing : 8, 0.5, 64)
  return Array.from({ length: safeCount }, (_, index) => {
    const distance = startDistance + index * safeSpacing
    const frame = routeFrame(seed, distance, biome)
    return {
      distance,
      elevation: frame.center.y,
      grade: Math.tan(frame.slope),
      curvature: frame.curvature,
      bank: frame.bank,
    }
  })
}
