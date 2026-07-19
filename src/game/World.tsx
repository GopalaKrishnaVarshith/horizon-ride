import { useTexture } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useCallback, useEffect, useMemo, useRef, type MutableRefObject } from 'react'
import * as THREE from 'three'
import { biomes, bikes } from '../config'
import type { BikeClass, BiomeId, CameraMode } from '../types'
import { publicAsset } from '../assets'
import type { Controls, Telemetry } from '../Game'
import { createAutoRideControls } from './autoRide'
import { CockpitBike, Motorcycle, type SimulationState } from './Bike'
import { FIXED_TIMESTEP, routeEnvironment, stepVehicle, type RideSimulationState } from './simulation'
import { hash, routeSampleAt, routeY, SEGMENT_COUNT, SEGMENT_LENGTH, terrainHeight } from './route'
import { bikeScreenRoll } from './presentation'

export type RenderQuality = 'balanced' | 'high'

const STREAM_STEP = 4
const START_BEHIND = 12
let activeSimulationAdvance: ((milliseconds: number) => void) | null = null

/** Advances the currently mounted ride without coupling the outer UI to R3F. */
export function advanceWorldTime(milliseconds: number) {
  activeSimulationAdvance?.(milliseconds)
}

function streamOrigin(distance: number) {
  return Math.floor(distance / STREAM_STEP) * STREAM_STEP
}

function createStripGeometry(rows = SEGMENT_COUNT) {
  const geometry = new THREE.BufferGeometry()
  const positions = new Float32Array(rows * 2 * 3)
  const normals = new Float32Array(rows * 2 * 3)
  const uvs = new Float32Array(rows * 2 * 2)
  const indices = new Uint32Array((rows - 1) * 6)
  for (let row = 0; row < rows; row++) {
    uvs.set([0, row * SEGMENT_LENGTH / 7, 1, row * SEGMENT_LENGTH / 7], row * 4)
    if (row < rows - 1) {
      const vertex = row * 2
      const offset = row * 6
      indices.set([vertex, vertex + 1, vertex + 2, vertex + 1, vertex + 3, vertex + 2], offset)
    }
  }
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
  geometry.setIndex(new THREE.BufferAttribute(indices, 1))
  geometry.computeBoundingSphere()
  return geometry
}

function configureTexture(texture: THREE.Texture, width: number) {
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(Math.max(1, Math.abs(width) / 6.5), 1)
  texture.anisotropy = 8
  texture.needsUpdate = true
  return texture
}

interface SurfaceProps {
  state: MutableRefObject<SimulationState>
  seed: number
  biome: BiomeId
  inner: number
  outer: number
  color: string
  texturePath?: string
  terrain?: boolean
  yOffset?: number
  roughness?: number
  metalness?: number
  renderOrder?: number
}

function SurfaceStrip({ state, seed, biome, inner, outer, color, texturePath, terrain = false, yOffset = 0, roughness = 0.9, metalness = 0, renderOrder = 0 }: SurfaceProps) {
  const sourceTexture = useTexture(texturePath ?? publicAsset('road-asphalt.webp'))
  const texture = useMemo(() => configureTexture(sourceTexture.clone(), outer - inner), [sourceTexture, inner, outer])
  const geometry = useMemo(createStripGeometry, [])
  const mesh = useRef<THREE.Mesh>(null)
  const lastOrigin = useRef(Number.NaN)

  useEffect(() => () => { geometry.dispose(); texture.dispose() }, [geometry, texture])
  useEffect(() => { lastOrigin.current = Number.NaN }, [seed, biome, inner, outer, terrain])

  useFrame(() => {
    const currentDistance = state.current.distance
    const origin = streamOrigin(currentDistance)
    const current = routeSampleAt(seed, origin, currentDistance, biome)
    if (mesh.current) mesh.current.position.set(-current.x, -current.y, -current.z)
    if (origin === lastOrigin.current) return
    lastOrigin.current = origin
    const positions = geometry.getAttribute('position') as THREE.BufferAttribute
    const normals = geometry.getAttribute('normal') as THREE.BufferAttribute
    for (let row = 0; row < SEGMENT_COUNT; row++) {
      const distance = origin + (row - START_BEHIND) * SEGMENT_LENGTH
      for (let side = 0; side < 2; side++) {
        const lateral = side === 0 ? inner : outer
        const sample = routeSampleAt(seed, origin, distance, biome, lateral)
        const groundDelta = terrain ? terrainHeight(seed, distance, lateral, biome) - routeY(seed, distance, biome) : 0
        const index = row * 2 + side
        positions.setXYZ(index, sample.x, sample.y + groundDelta + yOffset, sample.z)
        normals.setXYZ(index, sample.up.x, sample.up.y, sample.up.z)
      }
    }
    positions.needsUpdate = true
    normals.needsUpdate = true
    geometry.computeBoundingSphere()
  })

  return <mesh ref={mesh} geometry={geometry} receiveShadow renderOrder={renderOrder} frustumCulled={false}>
    <meshStandardMaterial map={texturePath ? texture : undefined} color={color} roughness={roughness} metalness={metalness} side={THREE.FrontSide} polygonOffset={renderOrder > 0} polygonOffsetFactor={-renderOrder} />
  </mesh>
}

function VerticalRail({ state, seed, biome, lateral }: { state: MutableRefObject<SimulationState>; seed: number; biome: BiomeId; lateral: number }) {
  const geometry = useMemo(createStripGeometry, [])
  const mesh = useRef<THREE.Mesh>(null)
  const lastOrigin = useRef(Number.NaN)
  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => { lastOrigin.current = Number.NaN }, [seed, biome, lateral])
  useFrame(() => {
    const currentDistance = state.current.distance
    const origin = streamOrigin(currentDistance)
    const current = routeSampleAt(seed, origin, currentDistance, biome)
    if (mesh.current) mesh.current.position.set(-current.x, -current.y, -current.z)
    if (lastOrigin.current === origin) return
    lastOrigin.current = origin
    const positions = geometry.getAttribute('position') as THREE.BufferAttribute
    const normals = geometry.getAttribute('normal') as THREE.BufferAttribute
    for (let row = 0; row < SEGMENT_COUNT; row++) {
      const distance = origin + (row - START_BEHIND) * SEGMENT_LENGTH
      const sample = routeSampleAt(seed, origin, distance, biome, lateral)
      positions.setXYZ(row * 2, sample.x, sample.y + 0.58, sample.z)
      positions.setXYZ(row * 2 + 1, sample.x, sample.y + 0.88, sample.z)
      normals.setXYZ(row * 2, sample.right.x * Math.sign(lateral), 0, sample.right.z * Math.sign(lateral))
      normals.setXYZ(row * 2 + 1, sample.right.x * Math.sign(lateral), 0, sample.right.z * Math.sign(lateral))
    }
    positions.needsUpdate = true
    normals.needsUpdate = true
    geometry.computeBoundingSphere()
  })
  return <mesh ref={mesh} geometry={geometry} castShadow receiveShadow frustumCulled={false}>
    <meshStandardMaterial color="#b6bbb6" metalness={0.84} roughness={0.28} side={THREE.DoubleSide} />
  </mesh>
}

function RoadFurniture({ state, seed, biome, quality }: { state: MutableRefObject<SimulationState>; seed: number; biome: BiomeId; quality: RenderQuality }) {
  const dashCount = quality === 'high' ? 58 : 46
  const postCount = quality === 'high' ? 104 : 78
  const dashes = useRef<THREE.InstancedMesh>(null)
  const posts = useRef<THREE.InstancedMesh>(null)
  const reflectors = useRef<THREE.InstancedMesh>(null)
  const group = useRef<THREE.Group>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const lastOrigin = useRef(Number.NaN)

  useFrame(() => {
    const currentDistance = state.current.distance
    const origin = streamOrigin(currentDistance)
    const current = routeSampleAt(seed, origin, currentDistance, biome)
    if (group.current) group.current.position.set(-current.x, -current.y, -current.z)
    if (!dashes.current || !posts.current || !reflectors.current || lastOrigin.current === origin) return
    lastOrigin.current = origin
    const firstDash = Math.floor((origin - 30) / 12)
    for (let index = 0; index < dashCount; index++) {
      const distance = (firstDash + index) * 12
      const sample = routeSampleAt(seed, origin, distance, biome)
      dummy.position.set(sample.x, sample.y + 0.055, sample.z)
      dummy.rotation.set(sample.slope, sample.heading, sample.bank)
      dummy.scale.set(0.12, 0.025, 2.35)
      dummy.updateMatrix(); dashes.current.setMatrixAt(index, dummy.matrix)
    }
    const firstPost = Math.floor((origin - 30) / 8)
    for (let index = 0; index < postCount; index++) {
      const distance = (firstPost + index) * 8
      const side = index % 2 ? 1 : -1
      const sample = routeSampleAt(seed, origin, distance, biome, side * 5.28)
      dummy.position.set(sample.x, sample.y + 0.42, sample.z)
      dummy.rotation.set(sample.slope, sample.heading, sample.bank)
      dummy.scale.set(0.09, 0.42, 0.09)
      dummy.updateMatrix(); posts.current.setMatrixAt(index, dummy.matrix)
      dummy.position.set(sample.x, sample.y + 0.11, sample.z)
      dummy.scale.set(0.1, 0.045, 0.18)
      dummy.updateMatrix(); reflectors.current.setMatrixAt(index, dummy.matrix)
    }
    dashes.current.instanceMatrix.needsUpdate = true
    posts.current.instanceMatrix.needsUpdate = true
    reflectors.current.instanceMatrix.needsUpdate = true
  })

  return <group ref={group}>
    <instancedMesh ref={dashes} args={[undefined, undefined, dashCount]} castShadow frustumCulled={false}><boxGeometry /><meshStandardMaterial color="#f5e6b7" roughness={0.52} /></instancedMesh>
    <instancedMesh ref={posts} args={[undefined, undefined, postCount]} castShadow frustumCulled={false}><boxGeometry /><meshStandardMaterial color="#d0d2cb" metalness={0.3} roughness={0.56} /></instancedMesh>
    <instancedMesh ref={reflectors} args={[undefined, undefined, postCount]} frustumCulled={false}><boxGeometry /><meshStandardMaterial color="#ffd37b" emissive="#d29a42" emissiveIntensity={1.1} toneMapped={false} /></instancedMesh>
  </group>
}

function Road({ state, seed, biome, quality }: { state: MutableRefObject<SimulationState>; seed: number; biome: BiomeId; quality: RenderQuality }) {
  const groundTexture = biome === 'desert' ? publicAsset('ground-desert.webp') : publicAsset('ground-meadow.webp')
  const groundTint = biome === 'desert' ? '#c29a70' : biome === 'coast' ? '#77977c' : '#82937b'
  const railBothSides = biome === 'alpine'
  const terrainBands: Array<[number, number]> = quality === 'high'
    ? [[-120, -58], [-58, -28], [-28, -13], [-13, -5.35], [5.35, 13], [13, 28], [28, 58], [58, 120]]
    : [[-120, -34], [-34, -5.35], [5.35, 34], [34, 120]]
  return <>
    {terrainBands.map(([inner, outer]) => <SurfaceStrip key={`${inner}:${outer}`} state={state} seed={seed} biome={biome} inner={inner} outer={outer} color={groundTint} texturePath={groundTexture} terrain />)}
    <SurfaceStrip state={state} seed={seed} biome={biome} inner={-5.4} outer={-4.15} color={biome === 'desert' ? '#987550' : '#52614f'} texturePath={groundTexture} terrain yOffset={0.01} />
    <SurfaceStrip state={state} seed={seed} biome={biome} inner={4.15} outer={5.4} color={biome === 'desert' ? '#987550' : '#52614f'} texturePath={groundTexture} terrain yOffset={0.01} />
    <SurfaceStrip state={state} seed={seed} biome={biome} inner={-4.15} outer={4.15} color={biomes[biome].road} texturePath={publicAsset('road-asphalt.webp')} roughness={0.76} yOffset={0.025} />
    <SurfaceStrip state={state} seed={seed} biome={biome} inner={-3.98} outer={-3.84} color="#eee9d8" yOffset={0.055} roughness={0.55} renderOrder={2} />
    <SurfaceStrip state={state} seed={seed} biome={biome} inner={3.84} outer={3.98} color="#eee9d8" yOffset={0.055} roughness={0.55} renderOrder={2} />
    {biome !== 'desert' ? <VerticalRail state={state} seed={seed} biome={biome} lateral={-5.15} /> : null}
    {railBothSides ? <VerticalRail state={state} seed={seed} biome={biome} lateral={5.15} /> : null}
    <RoadFurniture state={state} seed={seed} biome={biome} quality={quality} />
  </>
}

function Scenery({ state, seed, biome, quality }: { state: MutableRefObject<SimulationState>; seed: number; biome: BiomeId; quality: RenderQuality }) {
  const atlasSource = useTexture(publicAsset('vegetation-atlas.webp'))
  const perCell = quality === 'high' ? 14 : 9
  const atlasTextures = useMemo(() => Array.from({ length: 8 }, (_, index) => {
    const texture = atlasSource.clone()
    texture.colorSpace = THREE.SRGBColorSpace
    texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping
    texture.repeat.set(0.25, 0.5)
    texture.offset.set((index % 4) * 0.25, index < 4 ? 0.5 : 0)
    texture.needsUpdate = true
    return texture
  }), [atlasSource])
  const clusters = useRef<Array<THREE.InstancedMesh | null>>([])
  const rocks = useRef<THREE.InstancedMesh>(null)
  const group = useRef<THREE.Group>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const rockColor = useMemo(() => new THREE.Color(), [])
  const lastOrigin = useRef(Number.NaN)
  useEffect(() => () => atlasTextures.forEach((texture) => texture.dispose()), [atlasTextures])

  useFrame(() => {
    const currentDistance = state.current.distance
    const origin = streamOrigin(currentDistance)
    const current = routeSampleAt(seed, origin, currentDistance, biome)
    if (group.current) group.current.position.set(-current.x, -current.y, -current.z)
    if (lastOrigin.current === origin || !rocks.current || clusters.current.some((item) => !item)) return
    lastOrigin.current = origin
    const first = Math.floor((origin - 26) / 9)
    for (let cell = 0; cell < 8; cell++) {
      const mesh = clusters.current[cell]!
      const allowedCells = biome === 'coast' ? [0, 1, 2, 3] : biome === 'alpine' ? [2, 3, 4, 5] : [6, 7]
      for (let index = 0; index < perCell; index++) {
        const id = first + index * 8 + cell
        const spacing = (SEGMENT_COUNT * SEGMENT_LENGTH + 30) / perCell
        const distance = origin - 26 + index * spacing + cell * (spacing / 8) + hash(seed, id * 17) * 4
        const side = hash(seed, id * 5) > 0.5 ? 1 : -1
        const closeToRoad = hash(seed, id * 41) > 0.38
        const lateral = side * (closeToRoad ? 6.6 + hash(seed, id * 11) * 15 : 21 + hash(seed, id * 11) * (biome === 'desert' ? 44 : 30))
        const sample = routeSampleAt(seed, origin, distance, biome, lateral)
        const groundDelta = terrainHeight(seed, distance, lateral, biome) - routeY(seed, distance, biome)
        const height = cell === 4 || cell === 5 ? 3.8 + hash(seed, id * 23) * 3.8 : 1.5 + hash(seed, id * 23) * 2.7
        const anchorCorrection = cell >= 4 ? height * 0.18 : height * 0.08
        dummy.position.set(sample.x, sample.y + groundDelta + height * 0.5 - anchorCorrection, sample.z)
        dummy.rotation.set(0, (hash(seed, id * 31) - 0.5) * 0.34, 0)
        const visibleScale = allowedCells.includes(cell) ? 1 : 0
        dummy.scale.set(height * 0.76 * (0.84 + hash(seed, id * 37) * 0.32) * visibleScale, height * visibleScale, visibleScale)
        dummy.updateMatrix(); mesh.setMatrixAt(index, dummy.matrix)
      }
      mesh.instanceMatrix.needsUpdate = true
    }
    const rockCount = quality === 'high' ? 74 : 48
    for (let index = 0; index < rockCount; index++) {
      const id = first + index * 2
      const distance = id * 7.2
      const side = hash(seed, id * 19) > 0.5 ? 1 : -1
      const lateral = side * (6.3 + hash(seed, id * 29) * 52)
      const sample = routeSampleAt(seed, origin, distance, biome, lateral)
      const groundDelta = terrainHeight(seed, distance, lateral, biome) - routeY(seed, distance, biome)
      const size = 0.24 + hash(seed, id * 43) * 0.74
      dummy.position.set(sample.x, sample.y + groundDelta + size * 0.24, sample.z)
      dummy.rotation.set(hash(seed, id) * 0.35, hash(seed, id * 47) * Math.PI, hash(seed, id * 53) * 0.2)
      dummy.scale.set(size * 1.28, size * 0.68, size)
      dummy.updateMatrix(); rocks.current.setMatrixAt(index, dummy.matrix)
      rockColor.set(biome === 'desert' ? '#a97b53' : hash(seed, id * 59) > 0.5 ? '#69736e' : '#515b57')
      rocks.current.setColorAt(index, rockColor)
    }
    rocks.current.instanceMatrix.needsUpdate = true
    if (rocks.current.instanceColor) rocks.current.instanceColor.needsUpdate = true
  })

  const rockCount = quality === 'high' ? 74 : 48
  return <group ref={group}>
    {atlasTextures.map((texture, index) => <instancedMesh key={index} ref={(mesh) => { clusters.current[index] = mesh }} args={[undefined, undefined, perCell]} frustumCulled={false}>
      <planeGeometry args={[1, 1]} />
      <meshStandardMaterial map={texture} transparent alphaTest={0.32} side={THREE.DoubleSide} roughness={0.95} depthWrite />
    </instancedMesh>)}
    <instancedMesh ref={rocks} args={[undefined, undefined, rockCount]} castShadow receiveShadow frustumCulled={false}>
      <icosahedronGeometry args={[1, 2]} />
      <meshStandardMaterial color={biome === 'desert' ? '#9a714c' : biome === 'coast' ? '#626c66' : '#59635e'} roughness={0.96} />
    </instancedMesh>
  </group>
}

function DistantWorld({ biome }: { biome: BiomeId }) {
  const texture = useTexture(publicAsset(`${biome}-horizon.webp`))
  useEffect(() => {
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = 4
    texture.needsUpdate = true
  }, [texture])
  return <group renderOrder={-20}>
    <mesh position={[0, 118, 0]}>
      <cylinderGeometry args={[390, 390, 360, 72, 1, true, Math.PI - 1.48, 2.96]} />
      <meshBasicMaterial map={texture} side={THREE.BackSide} fog={false} toneMapped={false} depthWrite={false} />
    </mesh>
    {biome === 'coast' ? <mesh position={[-105, -2.7, -220]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[240, 620, 1, 1]} />
      <meshPhysicalMaterial color="#557f83" roughness={0.18} metalness={0.32} clearcoat={0.65} clearcoatRoughness={0.2} />
    </mesh> : null}
  </group>
}

function AtmosphericHaze({ biome }: { biome: BiomeId }) {
  const uniforms = useMemo(() => ({
    hazeColor: { value: new THREE.Color(biomes[biome].fog) },
    hazeOpacity: { value: biome === 'coast' ? 0.3 : biome === 'alpine' ? 0.2 : 0.16 },
  }), [biome])
  return <mesh position={[0, 28, -245]} renderOrder={-8}>
    <planeGeometry args={[920, 260]} />
    <shaderMaterial
      uniforms={uniforms}
      transparent
      depthWrite={false}
      toneMapped={false}
      vertexShader={`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`}
      fragmentShader={`uniform vec3 hazeColor; uniform float hazeOpacity; varying vec2 vUv; void main(){ float band = pow(max(0.0, sin(3.14159265 * vUv.y)), 1.7); gl_FragColor = vec4(hazeColor, band * hazeOpacity); }`}
    />
  </mesh>
}

interface SimulationRigProps {
  state: MutableRefObject<SimulationState>
  controls: Controls
  paused: boolean
  bike: BikeClass
  camera: CameraMode
  seed: number
  biome: BiomeId
  reducedMotion: boolean
  autoRide: boolean
  onTelemetry: (value: Telemetry) => void
}

function SimulationAndCamera({ state, controls, paused, bike, camera, seed, biome, reducedMotion, autoRide, onTelemetry }: SimulationRigProps) {
  const accumulator = useRef(0)
  const lastReport = useRef(0)
  const manualUntil = useRef(0)
  const cameraPosition = useMemo(() => new THREE.Vector3(), [])
  const cameraTarget = useMemo(() => new THREE.Vector3(), [])

  const simulate = useCallback((elapsed: number) => {
    if (paused) return
    accumulator.current = Math.min(accumulator.current + Math.min(elapsed, 0.2), 0.25)
    while (accumulator.current >= FIXED_TIMESTEP) {
      const current = state.current as RideSimulationState
      const profile = bikes[bike]
      const environment = routeEnvironment(seed, biome, current)
      const manualSteer = (controls.right ? 1 : 0) - (controls.left ? 1 : 0)
      const assisted = autoRide ? createAutoRideControls({ state: current, profile, environment, biome, bike }) : null
      const next = stepVehicle(current, {
        throttle: controls.throttle || controls.brake ? (controls.throttle ? 1 : 0) : assisted?.throttle ?? 0,
        brake: controls.throttle || controls.brake ? (controls.brake ? 1 : 0) : assisted?.brake ?? 0,
        steer: manualSteer !== 0 ? manualSteer : assisted?.steer ?? 0,
      }, profile, environment, FIXED_TIMESTEP)
      Object.assign(state.current, next)
      accumulator.current -= FIXED_TIMESTEP
    }
  }, [paused, state, controls, bike, seed, biome, autoRide])

  const advanceTime = useCallback((milliseconds: number) => {
    manualUntil.current = performance.now() + 160
    const steps = Math.max(1, Math.ceil(Math.min(10_000, Math.max(0, milliseconds)) / (FIXED_TIMESTEP * 1000)))
    for (let step = 0; step < steps; step++) simulate(FIXED_TIMESTEP)
    const simulation = state.current
    onTelemetry({ speed: simulation.speed, distance: simulation.distance, heading: simulation.heading, lean: simulation.lean ?? 0, offRoad: (simulation.offRoadFactor ?? 0) > 0.35 })
  }, [simulate, state, onTelemetry])

  // The outer UI and nested R3F renderer share this module, so the current
  // fixed-step driver survives StrictMode root lifecycles without a stale ref.
  activeSimulationAdvance = advanceTime

  useFrame(({ camera: threeCamera, clock }, delta) => {
    if (performance.now() >= manualUntil.current) simulate(delta)
    const simulation = state.current
    const profile = bikes[bike]
    const anchor = profile.camera[camera]
    const speedRatio = simulation.speed / profile.maxSpeed
    const motionScale = reducedMotion ? 0 : 1
    const shake = paused ? 0 : (Math.sin(clock.elapsedTime * 13) + Math.sin(clock.elapsedTime * 23) * 0.3) * speedRatio * 0.006 * motionScale
    cameraPosition.set(
      simulation.lateral + anchor[0] - simulation.steer * (camera === 'wide' ? 0.7 : 0.35),
      anchor[1] + shake + (simulation.suspension ?? 0) * 0.35,
      anchor[2],
    )
    const response = reducedMotion ? 8 : camera === 'cockpit' ? 9 : 4.4
    threeCamera.position.lerp(cameraPosition, 1 - Math.exp(-delta * response))
    const lookDistance = profile.camera.lookAhead[camera] + simulation.speed * 0.055
    const ahead = routeSampleAt(seed, simulation.distance, simulation.distance + lookDistance, biome, simulation.lateral * 0.2)
    cameraTarget.set(ahead.x, ahead.y + (camera === 'cockpit' ? 1.05 : 1.2), ahead.z)
    threeCamera.lookAt(cameraTarget)
    if (!reducedMotion && camera !== 'cockpit') threeCamera.rotateZ(bikeScreenRoll(simulation.lean ?? 0, simulation.steer, 0.045))
    if (threeCamera instanceof THREE.PerspectiveCamera) {
      const baseFov = camera === 'wide' ? 56 : camera === 'cockpit' ? 65 : 61
      const targetFov = baseFov + speedRatio * (reducedMotion ? 1 : 3.5)
      threeCamera.fov = THREE.MathUtils.damp(threeCamera.fov, targetFov, 2.4, delta)
      threeCamera.updateProjectionMatrix()
    }
    if (clock.elapsedTime - lastReport.current > 0.1) {
      onTelemetry({ speed: simulation.speed, distance: simulation.distance, heading: simulation.heading, lean: simulation.lean ?? 0, offRoad: (simulation.offRoadFactor ?? 0) > 0.35 })
      lastReport.current = clock.elapsedTime
    }
  })
  return null
}

export interface WorldProps {
  state: MutableRefObject<SimulationState>
  controls: Controls
  paused: boolean
  bike: BikeClass
  camera: CameraMode
  seed: number
  biome: BiomeId
  quality?: RenderQuality
  reducedMotion?: boolean
  autoRide?: boolean
  onTelemetry: (value: Telemetry) => void
}

export function World(props: WorldProps) {
  const { state, seed, biome, bike, camera, quality = 'high', reducedMotion = false, autoRide = false } = props
  const config = biomes[biome]
  const shadowSize = quality === 'high' ? 2048 : 1024
  return <>
    <color attach="background" args={[config.sky]} />
    <fog attach="fog" args={[config.fog, 72, 455]} />
    <hemisphereLight args={[config.sky, config.ground, 1.5]} />
    <directionalLight position={[-34, 48, 22]} color={biome === 'alpine' ? '#fff0d2' : '#ffe0a2'} intensity={3.3} castShadow shadow-mapSize={[shadowSize, shadowSize]} shadow-camera-left={-62} shadow-camera-right={62} shadow-camera-top={62} shadow-camera-bottom={-62} shadow-camera-near={1} shadow-camera-far={140} />
    <DistantWorld biome={biome} />
    <AtmosphericHaze biome={biome} />
    <Road state={state} seed={seed} biome={biome} quality={quality} />
    <Scenery state={state} seed={seed} biome={biome} quality={quality} />
    <Motorcycle bike={bike} camera={camera} state={state} />
    <CockpitBike camera={camera} bike={bike} state={state} />
    <SimulationAndCamera {...props} reducedMotion={reducedMotion} autoRide={autoRide} />
  </>
}
