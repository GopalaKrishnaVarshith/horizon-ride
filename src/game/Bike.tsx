import { RoundedBox, useTexture } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { bikes } from '../config'
import type { BikeClass, CameraMode } from '../types'
import { publicAsset } from '../assets'
import { bikeScreenRoll } from './presentation'

export interface SimulationState {
  speed: number
  distance: number
  steer: number
  lateral: number
  heading: number
  relativeHeading?: number
  yaw?: number
  lean?: number
  pitch?: number
  suspension?: number
  wheelRotation?: number
  offRoad?: boolean
  offRoadFactor?: number
  elapsed?: number
}

type Point = [number, number, number]

const chaseSprites: Record<BikeClass, string> = {
  scooter: publicAsset('bike-scooter-rear.webp'),
  sport: publicAsset('bike-sport-rear.webp'),
  cruiser: publicAsset('bike-cruiser-rear.webp'),
}

function Bar({ from, to, radius = 0.035, color = '#242827', roughness = 0.26 }: { from: Point; to: Point; radius?: number; color?: string; roughness?: number }) {
  const transform = useMemo(() => {
    const start = new THREE.Vector3(...from)
    const end = new THREE.Vector3(...to)
    return {
      midpoint: start.clone().add(end).multiplyScalar(0.5),
      length: start.distanceTo(end),
      quaternion: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.clone().sub(start).normalize()),
    }
  }, [from, to])
  return <mesh position={transform.midpoint} quaternion={transform.quaternion} castShadow>
    <cylinderGeometry args={[radius, radius, transform.length, 12]} />
    <meshStandardMaterial color={color} metalness={0.74} roughness={roughness} />
  </mesh>
}

function Wheel({ z, state, radius = 0.39, width = 0.12, front = false }: { z: number; state: React.MutableRefObject<SimulationState>; radius?: number; width?: number; front?: boolean }) {
  const steering = useRef<THREE.Group>(null)
  const rolling = useRef<THREE.Group>(null)
  const spokes = Array.from({ length: 10 }, (_, index) => index * Math.PI / 5)
  useFrame((_, delta) => {
    const simulation = state?.current
    if (!simulation) return
    if (rolling.current) rolling.current.rotation.x = simulation.wheelRotation ?? -(simulation.distance / radius)
    if (steering.current) {
      const target = front ? simulation.steer * 0.34 : 0
      steering.current.rotation.y = THREE.MathUtils.damp(steering.current.rotation.y, target, 12, delta)
    }
  })
  return <group ref={steering} position={[0, radius, z]}>
    <group ref={rolling}>
      <mesh rotation={[0, Math.PI / 2, 0]} castShadow>
        <torusGeometry args={[radius - 0.07, 0.075, 14, 40]} />
        <meshStandardMaterial color="#080b0b" roughness={0.76} />
      </mesh>
      <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[radius * 0.7, radius * 0.7, width * 0.32, 36]} />
        <meshStandardMaterial color="#363d3b" metalness={0.93} roughness={0.18} />
      </mesh>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[radius * 0.47, radius * 0.47, width * 0.4, 32]} />
        <meshStandardMaterial color="#a9aeaa" metalness={0.92} roughness={0.19} />
      </mesh>
      {spokes.map((angle) => <Bar key={angle} from={[0, Math.sin(angle) * radius * 0.52, Math.cos(angle) * radius * 0.52]} to={[0, 0, 0]} radius={0.012} color="#8d9490" />)}
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.09, 0.09, width + 0.05, 20]} />
        <meshStandardMaterial color="#202725" metalness={0.9} roughness={0.22} />
      </mesh>
    </group>
  </group>
}

function Lamp({ position = [0, 1.03, -0.93], scale = 1 }: { position?: Point; scale?: number }) {
  return <group position={position} scale={scale}>
    <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
      <cylinderGeometry args={[0.2, 0.165, 0.18, 28]} />
      <meshStandardMaterial color="#202625" metalness={0.82} roughness={0.21} />
    </mesh>
    <mesh position={[0, 0, -0.095]}>
      <circleGeometry args={[0.15, 28]} />
      <meshStandardMaterial color="#fff2c9" emissive="#ffd690" emissiveIntensity={3.8} toneMapped={false} />
    </mesh>
    <pointLight position={[0, -0.02, -0.2]} intensity={1.9} distance={8} decay={2} color="#ffe3ab" />
  </group>
}

function TailLamp({ position, width = 0.3 }: { position: Point; width?: number }) {
  return <group position={position}>
    <RoundedBox args={[width + 0.08, 0.18, 0.1]} radius={0.055} smoothness={4} castShadow>
      <meshStandardMaterial color="#111514" metalness={0.44} roughness={0.42} />
    </RoundedBox>
    <RoundedBox position={[0, 0, 0.056]} args={[width, 0.11, 0.025]} radius={0.035} smoothness={4}>
      <meshStandardMaterial color="#c91924" emissive="#ff2534" emissiveIntensity={2.5} toneMapped={false} roughness={0.23} />
    </RoundedBox>
    <mesh position={[-width * 0.82, 0, 0.04]}><sphereGeometry args={[0.052, 15, 10]} /><meshStandardMaterial color="#d78939" emissive="#ff9c42" emissiveIntensity={1.1} toneMapped={false} /></mesh>
    <mesh position={[width * 0.82, 0, 0.04]}><sphereGeometry args={[0.052, 15, 10]} /><meshStandardMaterial color="#d78939" emissive="#ff9c42" emissiveIntensity={1.1} toneMapped={false} /></mesh>
  </group>
}

function Mirror({ side, y = 1.38, z = -0.43 }: { side: -1 | 1; y?: number; z?: number }) {
  return <group>
    <Bar from={[side * 0.45, y - 0.1, z]} to={[side * 0.69, y + 0.12, z + 0.02]} radius={0.024} />
    <mesh position={[side * 0.73, y + 0.15, z + 0.03]} rotation={[0.08, side * 0.12, side * -0.08]} scale={[1.28, 0.78, 1]} castShadow>
      <sphereGeometry args={[0.16, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.58]} />
      <meshPhysicalMaterial color="#263735" metalness={0.72} roughness={0.12} clearcoat={1} clearcoatRoughness={0.08} />
    </mesh>
  </group>
}

function Rider({ bike }: { bike: BikeClass }) {
  const sport = bike === 'sport'
  const cruiser = bike === 'cruiser'
  const torsoY = sport ? 1.47 : cruiser ? 1.44 : 1.58
  const torsoZ = sport ? 0.08 : cruiser ? 0.35 : 0.21
  const lean = sport ? 0.48 : cruiser ? -0.06 : 0.12
  const handY = sport ? 1.19 : cruiser ? 1.45 : 1.42
  const handZ = sport ? -0.58 : cruiser ? -0.46 : -0.46
  return <group>
    <mesh position={[0, torsoY, torsoZ]} rotation={[lean, 0, 0]} scale={[1.14, 1, 0.74]} castShadow>
      <capsuleGeometry args={[0.255, 0.43, 10, 20]} />
      <meshStandardMaterial color="#33443e" roughness={0.72} />
    </mesh>
    <Bar from={[-0.29, torsoY + 0.18, torsoZ]} to={[0.29, torsoY + 0.18, torsoZ]} radius={0.105} color="#3d5049" roughness={0.7} />
    <mesh position={[0, sport ? 1.87 : 1.99, sport ? -0.17 : torsoZ - 0.12]} rotation={[sport ? 0.34 : 0.06, 0, 0]} castShadow>
      <sphereGeometry args={[0.245, 30, 22]} />
      <meshPhysicalMaterial color="#0d1211" metalness={0.48} roughness={0.2} clearcoat={0.65} />
    </mesh>
    <mesh position={[0, sport ? 1.86 : 1.99, sport ? -0.38 : torsoZ - 0.35]} rotation={[sport ? 0.25 : 0.05, 0, 0]}>
      <sphereGeometry args={[0.195, 26, 18, 0, Math.PI * 2, 0, Math.PI / 2]} />
      <meshPhysicalMaterial color="#5f8581" metalness={0.35} roughness={0.06} transmission={0.18} transparent opacity={0.72} />
    </mesh>
    <Bar from={[-0.25, torsoY + 0.19, torsoZ - 0.08]} to={[-0.48, handY, handZ]} radius={0.073} color="#2d3b36" roughness={0.62} />
    <Bar from={[0.25, torsoY + 0.19, torsoZ - 0.08]} to={[0.48, handY, handZ]} radius={0.073} color="#2d3b36" roughness={0.62} />
    <mesh position={[-0.5, handY, handZ]}><sphereGeometry args={[0.085, 18, 12]} /><meshStandardMaterial color="#0b0f0e" roughness={0.7} /></mesh>
    <mesh position={[0.5, handY, handZ]}><sphereGeometry args={[0.085, 18, 12]} /><meshStandardMaterial color="#0b0f0e" roughness={0.7} /></mesh>
    <Bar from={[-0.17, torsoY - 0.2, torsoZ + 0.12]} to={[-0.31, cruiser ? 0.67 : 0.73, cruiser ? 0.86 : 0.58]} radius={0.092} color="#1b2221" roughness={0.66} />
    <Bar from={[0.17, torsoY - 0.2, torsoZ + 0.12]} to={[0.31, cruiser ? 0.67 : 0.73, cruiser ? 0.86 : 0.58]} radius={0.092} color="#1b2221" roughness={0.66} />
  </group>
}

function ChaseSprite({ bike }: { bike: BikeClass }) {
  const texture = useTexture(chaseSprites[bike])
  useMemo(() => {
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = 8
    texture.needsUpdate = true
    return texture
  }, [texture])
  const scooter = bike === 'scooter'
  return <group>
    <mesh position={[0, scooter ? 1.58 : 1.6, 0.04]} renderOrder={3} castShadow>
      <planeGeometry args={scooter ? [3.2, 3.2] : [2.13, 3.2]} />
      <meshBasicMaterial map={texture} transparent alphaTest={0.025} toneMapped={false} side={THREE.DoubleSide} />
    </mesh>
  </group>
}

function BikeShadow({ bike }: { bike: BikeClass }) {
  const scale: Point = bike === 'cruiser' ? [0.92, 1.62, 1] : bike === 'scooter' ? [0.74, 1.28, 1] : [0.78, 1.48, 1]
  return <mesh position={[0, 0.035, 0.22]} rotation={[-Math.PI / 2, 0, 0]} scale={scale} renderOrder={1}>
    <circleGeometry args={[0.72, 36]} />
    <meshBasicMaterial color="#050706" transparent opacity={0.3} depthWrite={false} />
  </mesh>
}

function EngineBlock({ cruiser = false }: { cruiser?: boolean }) {
  return <group position={[0, 0.63, 0.12]}>
    <mesh scale={[0.48, 0.43, 0.53]} castShadow>
      <sphereGeometry args={[0.5, 24, 18]} />
      <meshStandardMaterial color="#343b38" metalness={0.78} roughness={0.29} />
    </mesh>
    {cruiser ? <>
      <mesh position={[-0.19, 0.13, 0]} rotation={[0, 0, -0.6]} castShadow><cylinderGeometry args={[0.16, 0.19, 0.46, 18]} /><meshStandardMaterial color="#a4aaa5" metalness={0.9} roughness={0.22} /></mesh>
      <mesh position={[0.19, 0.13, 0]} rotation={[0, 0, 0.6]} castShadow><cylinderGeometry args={[0.16, 0.19, 0.46, 18]} /><meshStandardMaterial color="#a4aaa5" metalness={0.9} roughness={0.22} /></mesh>
    </> : null}
    <mesh position={[0, -0.02, -0.18]}><torusGeometry args={[0.23, 0.035, 10, 26]} /><meshStandardMaterial color="#171c1b" metalness={0.85} roughness={0.23} /></mesh>
  </group>
}

function SportAssembly({ color, state }: { color: string; state: React.MutableRefObject<SimulationState> }) {
  return <>
    <Wheel z={-0.86} state={state} radius={0.4} width={0.13} front />
    <Wheel z={0.82} state={state} radius={0.4} width={0.14} />
    <Bar from={[-0.18, 0.52, -0.78]} to={[-0.18, 1.08, -0.42]} radius={0.045} color="#a8afaa" />
    <Bar from={[0.18, 0.52, -0.78]} to={[0.18, 1.08, -0.42]} radius={0.045} color="#a8afaa" />
    <Bar from={[0, 0.52, 0.73]} to={[0, 0.86, -0.17]} radius={0.065} />
    <RoundedBox position={[0, 0.93, -0.23]} rotation={[0.05, 0, 0]} args={[0.58, 0.58, 1.28]} radius={0.16} smoothness={5} castShadow><meshPhysicalMaterial color={color} metalness={0.56} roughness={0.24} clearcoat={0.72} /></RoundedBox>
    <RoundedBox position={[-0.29, 0.72, -0.22]} rotation={[0.08, 0, -0.13]} args={[0.17, 0.52, 1.19]} radius={0.07} smoothness={4} castShadow><meshStandardMaterial color={color} metalness={0.56} roughness={0.26} /></RoundedBox>
    <RoundedBox position={[0.29, 0.72, -0.22]} rotation={[0.08, 0, 0.13]} args={[0.17, 0.52, 1.19]} radius={0.07} smoothness={4} castShadow><meshStandardMaterial color={color} metalness={0.56} roughness={0.26} /></RoundedBox>
    <mesh position={[0, 1.22, -0.55]} rotation={[-0.18, 0, 0]}><sphereGeometry args={[0.38, 28, 18, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshPhysicalMaterial color="#617a78" transmission={0.35} transparent opacity={0.44} metalness={0.15} roughness={0.08} /></mesh>
    <RoundedBox position={[0, 0.91, 0.56]} args={[0.51, 0.18, 0.72]} radius={0.09} smoothness={4} castShadow><meshStandardMaterial color="#101514" roughness={0.72} /></RoundedBox>
    <RoundedBox position={[0, 0.67, 0.91]} rotation={[0.16, 0, 0]} args={[0.34, 0.13, 0.61]} radius={0.065} smoothness={4} castShadow><meshStandardMaterial color={color} metalness={0.52} roughness={0.29} /></RoundedBox>
    <TailLamp position={[0, 0.79, 1.18]} width={0.26} />
    <EngineBlock />
    <Bar from={[0.31, 0.53, 0.12]} to={[0.43, 0.43, 1.13]} radius={0.058} color="#9da49f" />
    <Bar from={[-0.31, 0.53, 0.12]} to={[-0.43, 0.43, 1.13]} radius={0.058} color="#9da49f" />
    <mesh position={[0.43, 0.43, 1.16]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.074, 0.058, 0.08, 18]} /><meshStandardMaterial color="#171c1b" metalness={0.84} roughness={0.2} /></mesh>
    <mesh position={[-0.43, 0.43, 1.16]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.074, 0.058, 0.08, 18]} /><meshStandardMaterial color="#171c1b" metalness={0.84} roughness={0.2} /></mesh>
    <Lamp position={[0, 0.98, -0.96]} scale={0.82} />
    <Mirror side={-1} y={1.26} z={-0.49} /><Mirror side={1} y={1.26} z={-0.49} />
  </>
}

function ScooterAssembly({ color, state }: { color: string; state: React.MutableRefObject<SimulationState> }) {
  return <>
    <Wheel z={-0.73} state={state} radius={0.32} width={0.11} front />
    <Wheel z={0.72} state={state} radius={0.32} width={0.12} />
    <Bar from={[0, 0.39, -0.67]} to={[0, 1.14, -0.45]} radius={0.06} color="#afb5b0" />
    <Bar from={[0, 0.38, 0.63]} to={[0, 0.69, 0.2]} radius={0.07} />
    <RoundedBox position={[0, 0.73, -0.42]} rotation={[-0.05, 0, 0]} args={[0.58, 0.94, 0.46]} radius={0.19} smoothness={5} castShadow><meshPhysicalMaterial color={color} metalness={0.38} roughness={0.31} clearcoat={0.6} /></RoundedBox>
    <RoundedBox position={[0, 0.48, 0.23]} args={[0.57, 0.25, 0.82]} radius={0.12} smoothness={4} castShadow><meshStandardMaterial color={color} metalness={0.4} roughness={0.3} /></RoundedBox>
    <RoundedBox position={[0, 0.91, 0.46]} args={[0.53, 0.19, 0.72]} radius={0.1} smoothness={4} castShadow><meshStandardMaterial color="#151a19" roughness={0.75} /></RoundedBox>
    <RoundedBox position={[0, 0.68, 0.68]} args={[0.57, 0.48, 0.42]} radius={0.16} smoothness={5} castShadow><meshStandardMaterial color={color} metalness={0.38} roughness={0.31} /></RoundedBox>
    <RoundedBox position={[0, 0.51, 0.88]} args={[0.4, 0.15, 0.5]} radius={0.075} smoothness={4} castShadow><meshStandardMaterial color={color} metalness={0.38} roughness={0.34} /></RoundedBox>
    <TailLamp position={[0, 0.72, 0.94]} width={0.27} />
    <Bar from={[0.26, 0.43, 0.22]} to={[0.34, 0.35, 0.98]} radius={0.052} color="#9aa19c" />
    <mesh position={[0, 1.26, -0.55]} rotation={[-0.12, 0, 0]}><planeGeometry args={[0.57, 0.44]} /><meshPhysicalMaterial color="#9fb8b5" transmission={0.5} transparent opacity={0.32} roughness={0.08} /></mesh>
    <Bar from={[-0.5, 1.36, -0.43]} to={[0.5, 1.36, -0.43]} radius={0.035} />
    <Lamp position={[0, 1.03, -0.69]} scale={0.82} />
    <Mirror side={-1} y={1.44} z={-0.42} /><Mirror side={1} y={1.44} z={-0.42} />
  </>
}

function CruiserAssembly({ color, state }: { color: string; state: React.MutableRefObject<SimulationState> }) {
  return <>
    <Wheel z={-1.04} state={state} radius={0.43} width={0.12} front />
    <Wheel z={0.97} state={state} radius={0.46} width={0.18} />
    <Bar from={[-0.16, 0.56, -0.96]} to={[-0.16, 1.08, -0.47]} radius={0.055} color="#a9b0ab" />
    <Bar from={[0.16, 0.56, -0.96]} to={[0.16, 1.08, -0.47]} radius={0.055} color="#a9b0ab" />
    <Bar from={[0, 0.5, 0.9]} to={[0, 0.8, -0.12]} radius={0.075} />
    <mesh position={[0, 0.92, -0.15]} scale={[0.68, 0.62, 0.97]} castShadow><sphereGeometry args={[0.5, 32, 22]} /><meshPhysicalMaterial color={color} metalness={0.62} roughness={0.22} clearcoat={0.75} /></mesh>
    <RoundedBox position={[0, 0.77, 0.61]} args={[0.58, 0.2, 0.88]} radius={0.1} smoothness={4} castShadow><meshStandardMaterial color="#101413" roughness={0.74} /></RoundedBox>
    <RoundedBox position={[0, 0.66, 0.95]} args={[0.54, 0.31, 0.4]} radius={0.13} smoothness={4} castShadow><meshStandardMaterial color={color} metalness={0.55} roughness={0.28} /></RoundedBox>
    <mesh position={[0, 0.55, 1.04]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 1.26, 1]} castShadow><torusGeometry args={[0.37, 0.055, 12, 30, Math.PI]} /><meshStandardMaterial color={color} metalness={0.55} roughness={0.3} /></mesh>
    <TailLamp position={[0, 0.75, 1.19]} width={0.31} />
    <EngineBlock cruiser />
    <Bar from={[0.31, 0.55, 0.03]} to={[0.46, 0.35, 1.27]} radius={0.064} color="#b5bbb6" />
    <Bar from={[0.24, 0.47, 0.06]} to={[0.36, 0.27, 1.22]} radius={0.051} color="#818985" />
    <mesh position={[0.46, 0.35, 1.3]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.088, 0.068, 0.11, 20]} /><meshStandardMaterial color="#151a19" metalness={0.87} roughness={0.18} /></mesh>
    <Bar from={[-0.62, 1.43, -0.43]} to={[0.62, 1.43, -0.43]} radius={0.04} />
    <Bar from={[-0.45, 1.13, -0.45]} to={[-0.62, 1.43, -0.43]} radius={0.035} />
    <Bar from={[0.45, 1.13, -0.45]} to={[0.62, 1.43, -0.43]} radius={0.035} />
    <Lamp position={[0, 1.08, -0.92]} />
    <Mirror side={-1} y={1.53} z={-0.43} /><Mirror side={1} y={1.53} z={-0.43} />
  </>
}

function CockpitMirror({ side, handleY }: { side: -1 | 1; handleY: number }) {
  return <group>
    <Bar from={[side * 0.48, handleY + 0.02, -0.35]} to={[side * 0.66, handleY + 0.18, -0.42]} radius={0.018} color="#555d59" />
    <group position={[side * 0.7, handleY + 0.21, -0.43]} rotation={[0.03, side * -0.12, side * 0.08]} scale={[1.42, 0.74, 1]}>
      <mesh position={[0, 0, -0.008]}><circleGeometry args={[0.118, 32]} /><meshStandardMaterial color="#080c0b" metalness={0.78} roughness={0.2} side={THREE.DoubleSide} /></mesh>
      <mesh position={[0, 0, 0.004]}><circleGeometry args={[0.096, 32]} /><meshPhysicalMaterial color="#1b302f" metalness={0.66} roughness={0.09} clearcoat={1} clearcoatRoughness={0.05} side={THREE.DoubleSide} /></mesh>
    </group>
  </group>
}

function Cockpit({ bike, state }: { bike: BikeClass; state: React.MutableRefObject<SimulationState> }) {
  const root = useRef<THREE.Group>(null)
  const needle = useRef<THREE.Group>(null)
  useFrame((_, delta) => {
    const simulation = state?.current
    if (!simulation) return
    if (root.current) {
      root.current.rotation.z = THREE.MathUtils.damp(root.current.rotation.z, bikeScreenRoll(simulation.lean ?? 0, simulation.steer, 0.38), 7, delta)
      root.current.position.y = THREE.MathUtils.damp(root.current.position.y, (simulation.suspension ?? 0) * 0.4, 9, delta)
    }
    if (needle.current) needle.current.rotation.z = THREE.MathUtils.damp(needle.current.rotation.z, 2.18 - (simulation.speed / Math.max(1, bikes[bike].maxSpeed)) * 4.36, 5, delta)
  })
  const color = bikes[bike].color
  const sport = bike === 'sport'
  const scooter = bike === 'scooter'
  const handleY = sport ? 0.57 : scooter ? 0.63 : 0.68
  const handleWidth = sport ? 0.62 : scooter ? 0.67 : 0.76
  const screenWidth = sport ? 0.68 : scooter ? 0.75 : 0.5
  const screenHeight = sport ? 0.27 : scooter ? 0.39 : 0.18
  return <group ref={root} position={[0, 0.03, 0]}>
    <RoundedBox position={[0, scooter ? 0.86 : 0.8, -0.75]} rotation={[-0.19, 0, 0]} args={[screenWidth, screenHeight, 0.018]} radius={Math.min(0.11, screenHeight * 0.33)} smoothness={5}>
      <meshPhysicalMaterial color="#9db8b4" transmission={0.5} transparent opacity={scooter ? 0.14 : 0.1} depthWrite={false} roughness={0.08} metalness={0.06} clearcoat={1} side={THREE.DoubleSide} />
    </RoundedBox>
    <Bar from={[-screenWidth * 0.36, 0.68, -0.61]} to={[-screenWidth * 0.45, scooter ? 0.75 : 0.7, -0.74]} radius={0.014} color="#59625e" />
    <Bar from={[screenWidth * 0.36, 0.68, -0.61]} to={[screenWidth * 0.45, scooter ? 0.75 : 0.7, -0.74]} radius={0.014} color="#59625e" />
    <Bar from={[-handleWidth, handleY, -0.34]} to={[handleWidth, handleY, -0.34]} radius={0.031} color="#59615d" />
    <Bar from={[-handleWidth * 0.55, handleY, -0.34]} to={[-handleWidth * 0.82, handleY + 0.01, -0.33]} radius={0.054} color="#0b0f0e" roughness={0.72} />
    <Bar from={[handleWidth * 0.55, handleY, -0.34]} to={[handleWidth * 0.82, handleY + 0.01, -0.33]} radius={0.054} color="#0b0f0e" roughness={0.72} />
    <Bar from={[-0.19, 0.39, -0.33]} to={[-0.29, handleY, -0.34]} radius={0.026} color="#7e8782" />
    <Bar from={[0.19, 0.39, -0.33]} to={[0.29, handleY, -0.34]} radius={0.026} color="#7e8782" />
    <CockpitMirror side={-1} handleY={handleY} /><CockpitMirror side={1} handleY={handleY} />
    <Bar from={[-handleWidth * 0.73, handleY + 0.02, -0.32]} to={[-handleWidth * 0.93, handleY - 0.035, -0.37]} radius={0.012} color="#b3bab6" />
    <Bar from={[handleWidth * 0.73, handleY + 0.02, -0.32]} to={[handleWidth * 0.93, handleY - 0.035, -0.37]} radius={0.012} color="#b3bab6" />
    <RoundedBox position={[0, 0.65, -0.5]} rotation={[-0.26, 0, 0]} args={[sport ? 0.48 : 0.53, 0.28, 0.09]} radius={0.075} smoothness={4}>
      <meshStandardMaterial color="#131a18" metalness={0.48} roughness={0.22} />
    </RoundedBox>
    <mesh position={[0, 0.665, -0.438]} rotation={[-0.26, 0, 0]}>
      <circleGeometry args={[0.108, 32]} />
      <meshStandardMaterial color="#071311" emissive="#1f5148" emissiveIntensity={0.55} roughness={0.22} />
    </mesh>
    <mesh position={[0, 0.665, -0.43]} rotation={[-0.26, 0, 0]}><torusGeometry args={[0.093, 0.006, 8, 30]} /><meshStandardMaterial color="#899690" emissive="#789c91" emissiveIntensity={0.4} /></mesh>
    <group ref={needle} position={[0, 0.665, -0.421]} rotation={[0, 0, 2.18]}>
      <mesh position={[0, 0.048, 0]}><boxGeometry args={[0.011, 0.096, 0.01]} /><meshBasicMaterial color="#efb45f" toneMapped={false} /></mesh>
      <mesh><circleGeometry args={[0.014, 14]} /><meshBasicMaterial color="#c8cec9" /></mesh>
    </group>
    <mesh position={[-0.105, 0.55, -0.428]}><circleGeometry args={[0.014, 14]} /><meshBasicMaterial color="#72d6ad" toneMapped={false} /></mesh>
    <mesh position={[0.105, 0.55, -0.428]}><circleGeometry args={[0.014, 14]} /><meshBasicMaterial color="#e1a65b" toneMapped={false} /></mesh>
    <mesh position={[0, 0.08, 0.15]} scale={[scooter ? 0.74 : 0.86, scooter ? 0.3 : 0.42, scooter ? 0.9 : 1.16]} castShadow><sphereGeometry args={[0.5, 32, 22]} /><meshPhysicalMaterial color={color} metalness={0.58} roughness={0.25} clearcoat={0.72} clearcoatRoughness={0.18} /></mesh>
    {!scooter ? <>
      <mesh position={[0, 0.19, 0.09]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.085, 0.018, 10, 28]} /><meshStandardMaterial color="#aeb6b1" metalness={0.88} roughness={0.19} /></mesh>
      <mesh position={[0, 0.19, 0.09]} rotation={[Math.PI / 2, 0, 0]}><circleGeometry args={[0.067, 24]} /><meshStandardMaterial color="#2a302e" metalness={0.68} roughness={0.25} /></mesh>
    </> : null}
    <Bar from={[-0.67, -0.07, 0.2]} to={[-handleWidth * 0.76, handleY - 0.01, -0.32]} radius={0.078} color="#252d2b" roughness={0.72} />
    <Bar from={[0.67, -0.07, 0.2]} to={[handleWidth * 0.76, handleY - 0.01, -0.32]} radius={0.078} color="#252d2b" roughness={0.72} />
    <mesh position={[-handleWidth * 0.77, handleY, -0.32]} rotation={[0, 0, -0.18]} scale={[1.22, 0.82, 1]}><sphereGeometry args={[0.095, 20, 14]} /><meshStandardMaterial color="#070a09" roughness={0.82} /></mesh>
    <mesh position={[handleWidth * 0.77, handleY, -0.32]} rotation={[0, 0, 0.18]} scale={[1.22, 0.82, 1]}><sphereGeometry args={[0.095, 20, 14]} /><meshStandardMaterial color="#070a09" roughness={0.82} /></mesh>
  </group>
}

export function Motorcycle({ bike, camera, state }: { bike: BikeClass; camera: CameraMode; state: React.MutableRefObject<SimulationState> }) {
  const root = useRef<THREE.Group>(null)
  const leanPivot = useRef<THREE.Group>(null)
  useFrame(({ clock }, delta) => {
    if (!root.current) return
    const simulation = state?.current
    if (!simulation) return
    // The rider looks at the rear-facing plane from +Z, so a physical right
    // lean needs a negative Z rotation on screen. Pivot at tyre contact so the
    // motorcycle and rider bank together instead of swaying around their waist.
    const physicalLean = THREE.MathUtils.clamp(simulation.lean ?? 0, -0.56, 0.56)
    if (leanPivot.current) leanPivot.current.rotation.z = THREE.MathUtils.damp(leanPivot.current.rotation.z, bikeScreenRoll(physicalLean, simulation.steer), 7.2, delta)
    root.current.rotation.x = THREE.MathUtils.damp(root.current.rotation.x, (simulation.pitch ?? 0) * 0.48, 6, delta)
    root.current.rotation.y = THREE.MathUtils.damp(root.current.rotation.y, -(simulation.relativeHeading ?? 0) * 0.22, 5.5, delta)
    root.current.position.x = THREE.MathUtils.damp(root.current.position.x, simulation.lateral, 12, delta)
    root.current.position.y = THREE.MathUtils.damp(root.current.position.y, 0.03 + (simulation.suspension ?? 0) + Math.sin(clock.elapsedTime * 16) * Math.min(0.006, simulation.speed * 0.00004), 10, delta)
  })
  return <group ref={root} position={[0, 0.03, 2.15]} visible={camera !== 'cockpit'}>
    <BikeShadow bike={bike} />
    <group ref={leanPivot}><ChaseSprite bike={bike} /></group>
  </group>
}

export function CockpitBike({ camera, bike, state }: { camera: CameraMode; bike: BikeClass; state: React.MutableRefObject<SimulationState> }) {
  return <group position={[0, -0.12, -0.08]} scale={0.98} visible={camera === 'cockpit'}><Cockpit bike={bike} state={state} /></group>
}
