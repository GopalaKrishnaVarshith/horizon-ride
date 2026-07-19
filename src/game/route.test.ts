import { describe, expect, it } from 'vitest'
import type { BiomeId } from '../types'
import {
  ROAD_HALF_WIDTH,
  routeBank,
  routeFrame,
  routeSampleAt,
  routeX,
  routeY,
  sampleProfile,
  terrainHeight,
} from './route'

const BIOMES: BiomeId[] = ['coast', 'alpine', 'desert']

function dot(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) {
  return a.x * b.x + a.y * b.y + a.z * b.z
}

function length(vector: { x: number; y: number; z: number }) {
  return Math.sqrt(dot(vector, vector))
}

describe('seeded route generation', () => {
  it('is deterministic and gives different seeds their own identity', () => {
    const first = sampleProfile(482901, 125, 'alpine', 32, 7)
    expect(sampleProfile(482901, 125, 'alpine', 32, 7)).toEqual(first)
    expect(sampleProfile(482902, 125, 'alpine', 32, 7)).not.toEqual(first)
  })

  it('stays finite and within intentional world bounds across long rides', () => {
    for (const biome of BIOMES) {
      for (let distance = 0; distance <= 100_000; distance += 397) {
        const frame = routeFrame(7_912_443, distance, biome)
        const values = [
          frame.center.x,
          frame.center.y,
          frame.center.z,
          frame.heading,
          frame.slope,
          frame.curvature,
          frame.bank,
        ]
        expect(values.every(Number.isFinite)).toBe(true)
        expect(Math.abs(frame.center.x)).toBeLessThan(40)
        expect(Math.abs(frame.center.y)).toBeLessThan(8.5)
        expect(Math.abs(frame.bank)).toBeLessThanOrEqual(0.131)
      }
    }
  })

  it('produces a continuous road without position or bank jumps', () => {
    for (const biome of BIOMES) {
      for (let distance = 0; distance < 4_000; distance += 31.7) {
        const nextDistance = distance + 0.1
        expect(Math.abs(routeX(18_223, nextDistance, biome) - routeX(18_223, distance, biome))).toBeLessThan(0.08)
        expect(Math.abs(routeY(18_223, nextDistance, biome) - routeY(18_223, distance, biome))).toBeLessThan(0.03)
        expect(Math.abs(routeBank(18_223, nextDistance, biome) - routeBank(18_223, distance, biome))).toBeLessThan(0.01)
      }
    }
  })

  it('returns an orthonormal road-local tangent frame', () => {
    const frame = routeFrame(482901, 873.25, 'alpine')
    expect(length(frame.forward)).toBeCloseTo(1, 6)
    expect(length(frame.right)).toBeCloseTo(1, 6)
    expect(length(frame.up)).toBeCloseTo(1, 6)
    expect(dot(frame.forward, frame.right)).toBeCloseTo(0, 6)
    expect(dot(frame.forward, frame.up)).toBeCloseTo(0, 6)
    expect(dot(frame.right, frame.up)).toBeCloseTo(0, 6)

    const origin = routeSampleAt(482901, 873.25, 873.25, 'alpine')
    expect(origin.x).toBeCloseTo(0, 7)
    expect(origin.y).toBeCloseTo(0, 7)
    expect(origin.z).toBeCloseTo(0, 7)
    expect(origin.tangent.z).toBeCloseTo(-1, 6)
  })

  it('uses the same authoritative elevation for the HUD profile and road', () => {
    const profile = sampleProfile(1229, 360, 'coast', 24, 11)
    for (const point of profile) {
      expect(point.elevation).toBeCloseTo(routeY(1229, point.distance, 'coast'), 9)
      expect(Number.isFinite(point.grade)).toBe(true)
      expect(Number.isFinite(point.curvature)).toBe(true)
    }
  })

  it('joins roadside terrain continuously and gives every biome a distinct shape', () => {
    const distance = 712.4
    const atShoulder = terrainHeight(9841, distance, ROAD_HALF_WIDTH + 1.05, 'coast')
    const justOutside = terrainHeight(9841, distance, ROAD_HALF_WIDTH + 1.06, 'coast')
    expect(Math.abs(atShoulder - justOutside)).toBeLessThan(0.01)

    const identities = BIOMES.map((biome) => [
      routeX(9841, distance, biome),
      routeY(9841, distance, biome),
      terrainHeight(9841, distance, 42, biome),
    ])
    expect(new Set(identities.map((identity) => identity.join(':'))).size).toBe(3)
  })
})
