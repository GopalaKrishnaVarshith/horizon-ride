function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value))
}

/**
 * Adds a restrained predictive bank to the slower physical lean. This makes a
 * key press immediately readable even when the procedural road is already
 * banked in the opposite direction.
 */
export function presentationLean(physicalLean: number, steer: number) {
  return clamp(physicalLean + clamp(steer, -1, 1) * 0.085, -0.5, 0.5)
}

/** Rear-facing chase/cockpit art needs the inverse Z sign for screen rotation. */
export function bikeScreenRoll(physicalLean: number, steer: number, scale = 1) {
  return -presentationLean(physicalLean, steer) * scale
}

