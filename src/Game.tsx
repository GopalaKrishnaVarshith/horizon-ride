import { Html } from '@react-three/drei'
import { Canvas, useThree } from '@react-three/fiber'
import { Bloom, EffectComposer, SMAA, Vignette } from '@react-three/postprocessing'
import { Component, Suspense, useEffect, useRef, useState, type ErrorInfo, type ReactNode } from 'react'
import * as THREE from 'three'
import { createInitialSimulation } from './game/simulation'
import { bikeScreenRoll } from './game/presentation'
import type { SimulationState } from './game/Bike'
import { advanceWorldTime, World, type RenderQuality } from './game/World'
import type { BikeClass, BiomeId, CameraMode } from './types'

export interface Controls { throttle: boolean; brake: boolean; left: boolean; right: boolean }
export interface Telemetry { speed: number; distance: number; heading: number; lean: number; offRoad: boolean }

declare global {
  interface Window {
    render_game_to_text?: () => string
    advanceTime?: (milliseconds: number) => void
  }
}

export function supportsWebGL() {
  try {
    const canvas = document.createElement('canvas')
    return Boolean(canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: false }) || canvas.getContext('webgl'))
  } catch {
    return false
  }
}

class SceneErrorBoundary extends Component<{ children: ReactNode; onError: (error: Error) => void }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Horizon Ride renderer failed', error, info)
    this.props.onError(error)
  }
  render() { return this.state.failed ? null : this.props.children }
}

function CanvasLoading() {
  return <Html center className="canvas-loader"><span className="canvas-loader__ring" /><span>Building the road</span></Html>
}

function RendererLifecycle({ onReady, onContextLost }: { onReady: () => void; onContextLost: (lost: boolean) => void }) {
  const { gl } = useThree()
  useEffect(() => {
    const canvas = gl.domElement
    const lost = (event: Event) => { event.preventDefault(); onContextLost(true) }
    const restored = () => onContextLost(false)
    canvas.addEventListener('webglcontextlost', lost)
    canvas.addEventListener('webglcontextrestored', restored)
    onReady()
    return () => {
      canvas.removeEventListener('webglcontextlost', lost)
      canvas.removeEventListener('webglcontextrestored', restored)
    }
  }, [gl, onReady, onContextLost])
  return null
}

export interface GameProps {
  biome: BiomeId
  bike: BikeClass
  camera: CameraMode
  controls: Controls
  paused: boolean
  seed: number
  quality?: RenderQuality
  reducedMotion?: boolean
  autoRide?: boolean
  onTelemetry: (value: Telemetry) => void
  onRendererError?: (message: string) => void
  onReady?: () => void
}

export function Game({ quality = 'high', reducedMotion = false, autoRide = false, onRendererError, onReady, ...props }: GameProps) {
  const state = useRef<SimulationState>(createInitialSimulation({ speed: 24 }))
  const latest = useRef({ ...props, quality, reducedMotion, autoRide })
  const [contextLost, setContextLost] = useState(false)
  const [ready, setReady] = useState(false)
  latest.current = { ...props, quality, reducedMotion, autoRide }

  useEffect(() => {
    const renderGameToText = () => JSON.stringify({
      coordinateSystem: 'road-relative: +x right, +z behind rider; distance increases forward',
      mode: latest.current.paused ? 'paused' : latest.current.autoRide ? 'auto-ride' : 'manual-ride',
      biome: latest.current.biome,
      bike: latest.current.bike,
      camera: latest.current.camera,
      quality: latest.current.quality,
      rider: {
        speedKph: Math.round(state.current.speed),
        distanceMetres: Math.round(state.current.distance),
        laneOffset: Number(state.current.lateral.toFixed(2)),
        steering: Number(state.current.steer.toFixed(2)),
        leanRadians: Number((state.current.lean ?? 0).toFixed(3)),
        screenRollRadians: Number(bikeScreenRoll(state.current.lean ?? 0, state.current.steer).toFixed(3)),
        offRoad: (state.current.offRoadFactor ?? 0) > 0.35,
      },
      controls: latest.current.controls,
      autoRide: latest.current.autoRide,
    })
    const advanceGameTime = (milliseconds: number) => advanceWorldTime(milliseconds)
    window.render_game_to_text = renderGameToText
    window.advanceTime = advanceGameTime
    return () => {
      if (window.render_game_to_text === renderGameToText) delete window.render_game_to_text
      if (window.advanceTime === advanceGameTime) delete window.advanceTime
    }
  }, [])

  const rendererReady = () => {
    setReady(true)
    onReady?.()
  }
  const rendererError = (error: Error) => onRendererError?.(error.message || 'The 3D renderer stopped unexpectedly.')

  return <div className="game-canvas-wrap" data-ready={ready} data-context-lost={contextLost}>
    {!ready ? <div className="canvas-loading-overlay" role="status"><span className="canvas-loader__ring" /> Preparing your road</div> : null}
    {contextLost ? <div className="canvas-loading-overlay canvas-loading-overlay--error" role="alert">Graphics context lost. Waiting for the browser to restore it…</div> : null}
    <SceneErrorBoundary onError={rendererError}>
      <Canvas
        aria-label={`Horizon Ride ${props.biome} road, ${props.bike}, ${props.camera} camera`}
        role="img"
        shadows={{ type: THREE.PCFSoftShadowMap }}
        camera={{ fov: 61, near: 0.07, far: 720, position: [0, 3.5, 8.6] }}
        dpr={quality === 'high' ? [1, 1.55] : [1, 1.25]}
        gl={{
          antialias: quality === 'high',
          powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.08,
          outputColorSpace: THREE.SRGBColorSpace,
        }}
        fallback={<div className="canvas-loading-overlay canvas-loading-overlay--error">WebGL is not available in this browser.</div>}
      >
        <Suspense fallback={<CanvasLoading />}>
          <World state={state} quality={quality} reducedMotion={reducedMotion} autoRide={autoRide} {...props} />
          <RendererLifecycle onReady={rendererReady} onContextLost={setContextLost} />
        </Suspense>
        {quality === 'high' ? <EffectComposer multisampling={4}>
          <Bloom intensity={0.16} luminanceThreshold={0.88} luminanceSmoothing={0.42} mipmapBlur />
          <Vignette eskil={false} offset={0.15} darkness={0.28} />
          <SMAA />
        </EffectComposer> : null}
      </Canvas>
    </SceneErrorBoundary>
  </div>
}
