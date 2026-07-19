import type { BikeClass, BiomeId } from '../types'

export interface RideRouteIdentity {
  seed: number
  biome: BiomeId
  bike: BikeClass
}

export const MAX_RIDE_SEED = 2_147_483_647
export const DEFAULT_RIDE_ROUTE: Readonly<RideRouteIdentity> = Object.freeze({
  seed: 482_901,
  biome: 'alpine',
  bike: 'sport',
})

const BIOMES = new Set<BiomeId>(['coast', 'alpine', 'desert'])
const BIKES = new Set<BikeClass>(['scooter', 'sport', 'cruiser'])

function searchParamsFrom(input: string | URL | URLSearchParams): URLSearchParams {
  if (input instanceof URLSearchParams) return new URLSearchParams(input)
  if (input instanceof URL) return new URLSearchParams(input.search)
  const trimmed = input.trim()
  if (trimmed.startsWith('?') || (!trimmed.includes('://') && !trimmed.includes('?') && trimmed.includes('='))) {
    return new URLSearchParams(trimmed.startsWith('?') ? trimmed.slice(1) : trimmed)
  }
  try {
    return new URL(trimmed, 'https://horizon-ride.invalid').searchParams
  } catch {
    return new URLSearchParams()
  }
}

export function parseRideSeed(value: string | null | undefined): number | undefined {
  if (value == null || !/^(?:0|[1-9]\d{0,9})$/.test(value)) return undefined
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed >= 0 && parsed <= MAX_RIDE_SEED ? parsed : undefined
}

function safeFallback(fallback: Partial<RideRouteIdentity>): RideRouteIdentity {
  const seed = Number.isSafeInteger(fallback.seed) && Number(fallback.seed) >= 0 && Number(fallback.seed) <= MAX_RIDE_SEED
    ? Number(fallback.seed)
    : DEFAULT_RIDE_ROUTE.seed
  return {
    seed,
    biome: typeof fallback.biome === 'string' && BIOMES.has(fallback.biome) ? fallback.biome : DEFAULT_RIDE_ROUTE.biome,
    bike: typeof fallback.bike === 'string' && BIKES.has(fallback.bike) ? fallback.bike : DEFAULT_RIDE_ROUTE.bike,
  }
}

export function parseRideRoute(
  input: string | URL | URLSearchParams,
  fallback: Partial<RideRouteIdentity> = DEFAULT_RIDE_ROUTE,
): RideRouteIdentity {
  const params = searchParamsFrom(input)
  const safe = safeFallback(fallback)
  const seed = parseRideSeed(params.get('seed'))
  const biome = params.get('biome')
  const bike = params.get('bike')
  return {
    seed: seed ?? safe.seed,
    biome: biome != null && BIOMES.has(biome as BiomeId) ? biome as BiomeId : safe.biome,
    bike: bike != null && BIKES.has(bike as BikeClass) ? bike as BikeClass : safe.bike,
  }
}

export function canonicalRideSearch(route: RideRouteIdentity): string {
  const safe = safeFallback(route)
  const params = new URLSearchParams()
  params.set('seed', String(safe.seed))
  params.set('biome', safe.biome)
  params.set('bike', safe.bike)
  return `?${params.toString()}`
}

export function writeRideRoute(
  current: string | URL,
  route: RideRouteIdentity,
  preserveUnrelatedParameters = false,
): URL {
  const url = current instanceof URL ? new URL(current) : new URL(current, 'https://horizon-ride.invalid')
  if (!preserveUnrelatedParameters) url.search = ''
  const safe = safeFallback(route)
  url.searchParams.set('seed', String(safe.seed))
  url.searchParams.set('biome', safe.biome)
  url.searchParams.set('bike', safe.bike)
  return url
}

export function createRideSeed(random: () => number = Math.random): number {
  const sample = random()
  if (!Number.isFinite(sample)) return DEFAULT_RIDE_ROUTE.seed
  const normalized = Math.min(Math.max(sample, 0), 1 - Number.EPSILON)
  return Math.floor(normalized * (MAX_RIDE_SEED + 1))
}
