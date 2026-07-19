import { describe, expect, it } from 'vitest'
import { bikes, elevation, presetWidgets } from './config'
import { routeY } from './game/route'

describe('procedural ride configuration', () => {
  it('repeats the same terrain profile for a seed', () => {
    expect(elevation(721381, 144)).toBe(elevation(721381, 144))
    expect(elevation(721381, 144)).not.toBe(elevation(721382, 144))
  })

  it('keeps the Journey HUD fully informative', () => {
    expect(Object.values(presetWidgets.journey).every(Boolean)).toBe(true)
    expect(presetWidgets.minimal.terrain).toBe(false)
  })

  it('uses route elevation as the single terrain-profile authority', () => {
    expect(elevation(721381, 144, 'alpine')).toBe(routeY(721381, 144, 'alpine'))
  })

  it('gives every bike a distinct, internally safe handling profile', () => {
    expect(new Set(Object.values(bikes).map((bike) => bike.maxSpeed)).size).toBe(3)
    expect(bikes.sport.acceleration).toBeGreaterThan(bikes.scooter.acceleration)
    expect(bikes.scooter.maxSteerAngle).toBeGreaterThan(bikes.cruiser.maxSteerAngle)
    expect(bikes.cruiser.wheelbase).toBeGreaterThan(bikes.sport.wheelbase)
    for (const bike of Object.values(bikes)) {
      expect(bike.maxSpeed).toBeGreaterThan(0)
      expect(bike.wheelbase).toBeGreaterThan(1)
      expect(bike.wheelRadius).toBeGreaterThan(0.25)
      expect(bike.highSpeedSteerFactor).toBeGreaterThan(0)
      expect(bike.highSpeedSteerFactor).toBeLessThan(1)
      expect(Object.values(bike.camera).flatMap((value) => typeof value === 'object' ? Object.values(value) : value).length).toBeGreaterThan(0)
    }
  })
})
