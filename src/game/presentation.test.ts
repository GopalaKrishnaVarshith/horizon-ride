import { describe, expect, it } from 'vitest'
import { bikeScreenRoll, presentationLean } from './presentation'

describe('motorcycle presentation lean', () => {
  it('makes right steering bank right on a rear-facing screen plane', () => {
    expect(presentationLean(-0.02, 1)).toBeGreaterThan(0)
    expect(bikeScreenRoll(-0.02, 1)).toBeLessThan(0)
  })

  it('makes left steering bank left even against a small road bank', () => {
    expect(presentationLean(0.02, -1)).toBeLessThan(0)
    expect(bikeScreenRoll(0.02, -1)).toBeGreaterThan(0)
  })

  it('keeps all presentation banking calm and bounded', () => {
    expect(Math.abs(presentationLean(5, 1))).toBeLessThanOrEqual(0.5)
    expect(Math.abs(presentationLean(-5, -1))).toBeLessThanOrEqual(0.5)
  })
})

