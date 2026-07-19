import { Component, lazy, StrictMode, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ErrorInfo, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import './style.css'
import type { Controls, Telemetry } from './Game'
import { bikes, biomes, presetWidgets } from './config'
import { sampleProfile } from './game/route'
import { loadRidePreferences, saveRidePreferences, type KeyValueStorage } from './systems/preferences'
import { createRideSeed, parseRideRoute, writeRideRoute } from './systems/url'
import type { AudioEngine, AudioEngineStatus, BikeClass, BiomeId, CameraMode, ControlMode, HudPreset, HudWidgetId, QualityMode, RidePreferencesV1 } from './types'
import { BikeSelector, GameHeader, LaunchScreen, LoadingScreen, PauseDialog, SettingsDialog, TelemetryHUD, TouchControls, WebGLFallback, type AudioMixKey } from './ui'

const Game = lazy(() => import('./Game').then((module) => ({ default: module.Game })))

const emptyTelemetry: Telemetry = { speed: 0, distance: 0, heading: 0, lean: 0, offRoad: false }
const emptyControls: Controls = { throttle: false, brake: false, left: false, right: false }

function browserStorage(): KeyValueStorage | undefined {
  try { return window.localStorage } catch { return undefined }
}

function supportsWebGL() {
  try {
    const canvas = document.createElement('canvas')
    return Boolean(canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: false }) || canvas.getContext('webgl'))
  } catch { return false }
}

function initialRoute() {
  return parseRideRoute(location.search, { seed: createRideSeed(), biome: 'alpine', bike: 'sport' })
}

function resolveQuality(mode: QualityMode): 'high' | 'balanced' {
  if (mode !== 'auto') return mode
  const deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8
  const mobile = matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 720
  return deviceMemory <= 4 || mobile ? 'balanced' : 'high'
}

function interactiveTarget(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest('input, button, select, textarea, [contenteditable="true"], [role="dialog"]'))
}

function editingTarget(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest('input, select, textarea, [contenteditable="true"], [role="dialog"]'))
}

function nextCamera(camera: CameraMode): CameraMode {
  return camera === 'cockpit' ? 'chase' : camera === 'chase' ? 'wide' : 'cockpit'
}

class AppErrorBoundary extends Component<{ children: ReactNode }, { error?: string }> {
  state: { error?: string } = {}
  static getDerivedStateFromError(error: Error) { return { error: error.message || 'Unexpected application error' } }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('Horizon Ride application failed', error, info) }
  render() {
    return this.state.error
      ? <WebGLFallback title="Horizon Ride stopped unexpectedly" message={this.state.error} onRetry={() => location.reload()} />
      : this.props.children
  }
}

function App() {
  const [route] = useState(initialRoute)
  const [seed, setSeed] = useState(route.seed)
  const [biome, setBiome] = useState<BiomeId>(route.biome)
  const [bike, setBike] = useState<BikeClass>(route.bike)
  const [prefs, setPrefs] = useState<RidePreferencesV1>(() => loadRidePreferences(browserStorage()))
  const [started, setStarted] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [paused, setPaused] = useState(false)
  const [rideRevision, setRideRevision] = useState(0)
  const [telemetry, setTelemetry] = useState<Telemetry>(emptyTelemetry)
  const [controls, setControls] = useState<Controls>(emptyControls)
  const [audioStatus, setAudioStatus] = useState<AudioEngineStatus | null>(null)
  const [rendererError, setRendererError] = useState<string | null>(null)
  const [webglAvailable, setWebglAvailable] = useState(() => supportsWebGL())
  const [linkCopied, setLinkCopied] = useState(false)
  const [osReducedMotion, setOsReducedMotion] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches)
  const audio = useRef<AudioEngine | null>(null)
  const pausedBeforeSettings = useRef(false)
  const copyReset = useRef<number | undefined>(undefined)

  const widgets = prefs.widgets
  const camera = prefs.camera
  const reducedMotion = prefs.reducedMotion || osReducedMotion
  const renderQuality = useMemo(() => resolveQuality(prefs.quality), [prefs.quality])
  const terrainProfile = useMemo(
    () => sampleProfile(seed, telemetry.distance, biome, 28, 11).map((point) => point.elevation),
    [seed, telemetry.distance, biome],
  )

  const updatePrefs = useCallback((patch: Partial<RidePreferencesV1>) => {
    setPrefs((current) => ({ ...current, ...patch }))
  }, [])

  const clearControls = useCallback(() => setControls(emptyControls), [])
  const setControlMode = useCallback((controlMode: ControlMode) => {
    clearControls()
    updatePrefs({ controlMode })
  }, [clearControls, updatePrefs])
  const toggleAutoRide = useCallback(() => {
    setControlMode(prefs.controlMode === 'auto' ? 'keyboard' : 'auto')
  }, [prefs.controlMode, setControlMode])

  const openSettings = useCallback(() => {
    pausedBeforeSettings.current = paused
    if (started) setPaused(true)
    clearControls()
    setSettingsOpen(true)
  }, [paused, started, clearControls])

  const closeSettings = useCallback(() => {
    setSettingsOpen(false)
    if (started && !pausedBeforeSettings.current) setPaused(false)
  }, [started])

  const restartRide = useCallback(() => {
    clearControls()
    setRideRevision((value) => value + 1)
    setTelemetry(emptyTelemetry)
    setPaused(false)
    if (prefs.audio.enabled && audio.current) {
      audio.current.stopRide()
      audio.current.startRide({ biome, bike, camera, speed: 24, paused: false, seed })
      setAudioStatus(audio.current.getStatus())
    }
  }, [clearControls, prefs.audio.enabled, biome, bike, camera, seed])

  const ensureAudio = useCallback(async (settings = prefs.audio) => {
    if (!audio.current) {
      const { HorizonAudioEngine } = await import('./audio')
      audio.current = new HorizonAudioEngine(settings)
    }
    audio.current.setMix(settings)
    const ready = await audio.current.unlock()
    setAudioStatus(audio.current.getStatus())
    return ready
  }, [prefs.audio])

  const setAudioEnabled = useCallback(async (enabled: boolean) => {
    const nextAudio = { ...prefs.audio, enabled }
    updatePrefs({ audio: nextAudio })
    if (!enabled) {
      audio.current?.setMix(nextAudio)
      audio.current?.stopRide()
      if (audio.current) setAudioStatus(audio.current.getStatus())
      return
    }
    const ready = await ensureAudio(nextAudio)
    if (ready && started && audio.current) {
      audio.current.startRide({ biome, bike, camera, speed: telemetry.speed, paused, seed })
      setAudioStatus(audio.current.getStatus())
    }
  }, [prefs.audio, updatePrefs, ensureAudio, started, biome, bike, camera, telemetry.speed, paused, seed])

  const start = useCallback(async () => {
    clearControls()
    setPaused(false)
    setSettingsOpen(false)
    setStarted(true)
    if (!prefs.audio.enabled) return
    const ready = await ensureAudio(prefs.audio)
    if (ready && audio.current) {
      audio.current.startRide({ biome, bike, camera, speed: 24, paused: false, seed })
      setAudioStatus(audio.current.getStatus())
    }
  }, [clearControls, prefs.audio, ensureAudio, biome, bike, camera, seed])

  const cycleCamera = useCallback(() => updatePrefs({ camera: nextCamera(camera) }), [updatePrefs, camera])

  const togglePause = useCallback(() => {
    if (!started || settingsOpen) return
    clearControls()
    setPaused((value) => !value)
  }, [started, settingsOpen, clearControls])

  const regenerateRoute = useCallback(() => {
    setSeed(createRideSeed())
    clearControls()
    setRideRevision((value) => value + 1)
    setTelemetry(emptyTelemetry)
    if (started) setPaused(true)
  }, [clearControls, started])

  const copyRideLink = useCallback(async () => {
    const url = writeRideRoute(location.href, { seed, biome, bike })
    try {
      await navigator.clipboard.writeText(url.toString())
      setLinkCopied(true)
      if (copyReset.current !== undefined) clearTimeout(copyReset.current)
      copyReset.current = window.setTimeout(() => setLinkCopied(false), 1800)
    } catch {
      setLinkCopied(false)
    }
  }, [seed, biome, bike])

  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)')
    const change = () => setOsReducedMotion(media.matches)
    media.addEventListener('change', change)
    return () => media.removeEventListener('change', change)
  }, [])

  useEffect(() => {
    saveRidePreferences(browserStorage(), prefs)
    audio.current?.setMix(prefs.audio)
    if (audio.current) setAudioStatus(audio.current.getStatus())
  }, [prefs])

  useEffect(() => {
    try {
      const canonical = writeRideRoute(location.href, { seed, biome, bike })
      history.replaceState(null, '', `${canonical.pathname}${canonical.search}${canonical.hash}`)
    } catch { /* embedded browsers may restrict history mutation */ }
  }, [seed, biome, bike])

  useEffect(() => {
    if (!started || !audio.current) return
    audio.current.setRideState({ biome, bike, camera, speed: telemetry.speed, paused: paused || settingsOpen, seed })
    setAudioStatus(audio.current.getStatus())
  }, [started, biome, bike, camera, telemetry.speed, paused, settingsOpen, seed])

  useEffect(() => {
    const setControl = (key: string, down: boolean) => {
      setControls((current) => ({
        ...current,
        throttle: ['w', 'arrowup'].includes(key) ? down : current.throttle,
        brake: ['s', 'arrowdown'].includes(key) ? down : current.brake,
        left: ['a', 'arrowleft'].includes(key) ? down : current.left,
        right: ['d', 'arrowright'].includes(key) ? down : current.right,
      }))
    }
    const keyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()
      if (key === 'escape' && settingsOpen) { event.preventDefault(); closeSettings(); return }
      if (!event.repeat && key === 'p' && started && !settingsOpen) {
        event.preventDefault()
        togglePause()
        return
      }
      if (!event.repeat && key === 'm' && started && !settingsOpen) {
        event.preventDefault()
        toggleAutoRide()
        return
      }
      const rideKeys = ['w', 's', 'a', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright']
      if (editingTarget(event.target) || (interactiveTarget(event.target) && !rideKeys.includes(key)) || !started || settingsOpen) return
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) event.preventDefault()
      if (!event.repeat && key === 'r') { restartRide(); return }
      if (!event.repeat && key === 'c') { cycleCamera(); return }
      if (!event.repeat && key === 'f') {
        const operation = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()
        void operation.catch(() => undefined)
        return
      }
      if (!paused) setControl(key, true)
    }
    const keyUp = (event: KeyboardEvent) => setControl(event.key.toLowerCase(), false)
    const loseFocus = () => clearControls()
    const visibility = () => {
      if (document.hidden) { clearControls(); if (started) setPaused(true) }
    }
    addEventListener('keydown', keyDown)
    addEventListener('keyup', keyUp)
    addEventListener('blur', loseFocus)
    document.addEventListener('visibilitychange', visibility)
    return () => {
      removeEventListener('keydown', keyDown)
      removeEventListener('keyup', keyUp)
      removeEventListener('blur', loseFocus)
      document.removeEventListener('visibilitychange', visibility)
    }
  }, [started, settingsOpen, paused, closeSettings, togglePause, restartRide, cycleCamera, toggleAutoRide, clearControls])

  useEffect(() => {
    if (paused || settingsOpen || !started) clearControls()
  }, [paused, settingsOpen, started, clearControls])

  useEffect(() => () => {
    if (copyReset.current !== undefined) clearTimeout(copyReset.current)
    if (audio.current) void audio.current.dispose()
    delete window.render_game_to_text
  }, [])

  const choosePreset = (hudPreset: HudPreset) => updatePrefs({ hudPreset, widgets: { ...presetWidgets[hudPreset] } })
  const setWidget = (widget: HudWidgetId, visible: boolean) => updatePrefs({ widgets: { ...widgets, [widget]: visible } })
  const setAudioMix = (key: AudioMixKey, value: number) => updatePrefs({ audio: { ...prefs.audio, [key]: value } })
  const touchControl = (name: keyof Controls, value: boolean) => {
    if (paused || settingsOpen || !started) return
    setControls((current) => ({ ...current, [name]: value }))
  }
  const overlayOpen = settingsOpen || (paused && started)
  const audioUnavailable = audioStatus?.phase === 'unavailable' || audioStatus?.phase === 'error'

  return <main className={`app biome-${biome}`} data-started={started} data-paused={paused} data-control-mode={prefs.controlMode} data-quality={renderQuality}>
    <div className="canvas" aria-hidden={overlayOpen || undefined}>
      {webglAvailable && !rendererError ? <Suspense fallback={<LoadingScreen label="Preparing the 3D road" />}><Game
        key={`${rideRevision}-${seed}`}
        biome={biome}
        bike={bike}
        camera={camera}
        controls={controls}
        paused={paused || settingsOpen || !started}
        seed={seed}
        quality={renderQuality}
        reducedMotion={reducedMotion}
        autoRide={prefs.controlMode === 'auto'}
        onTelemetry={setTelemetry}
        onRendererError={setRendererError}
      /></Suspense> : <WebGLFallback
        title={rendererError ? 'The ride renderer stopped' : undefined}
        message={rendererError ?? undefined}
        onRetry={() => { setRendererError(null); setWebglAvailable(supportsWebGL()); setRideRevision((value) => value + 1) }}
      />}
    </div>

    <div className="game-ui" inert={overlayOpen ? true : undefined} aria-hidden={overlayOpen || undefined}>
      {started ? <>
        <GameHeader
          paused={paused}
          audioEnabled={prefs.audio.enabled && !audioUnavailable}
          onPauseToggle={togglePause}
          onOpenSettings={openSettings}
          onAudioToggle={() => void setAudioEnabled(!prefs.audio.enabled)}
        />
        <TelemetryHUD speed={telemetry.speed} heading={telemetry.heading} distance={telemetry.distance} terrainProfile={terrainProfile} widgets={widgets} biomeLabel={biomes[biome].label} />
        {prefs.controlMode === 'auto' ? <button type="button" className="auto-ride-status surface-glass" onClick={() => setControlMode('keyboard')} aria-label="Auto ride is on. Switch to manual riding"><span aria-hidden="true" /> Auto ride <small>calm cruise</small></button> : null}
        {widgets.bike ? <BikeSelector bike={bike} onChange={(value) => { clearControls(); setBike(value) }} disabled={paused} /> : null}
        <TouchControls held={controls} onControlChange={touchControl} onCameraChange={cycleCamera} />
        {telemetry.offRoad ? <div className="ride-assist-note" role="status">Ease back toward the road</div> : null}
      </> : <LaunchScreen biome={biome} bike={bike} seed={seed} audioEnabled={prefs.audio.enabled} onBiomeChange={setBiome} onBikeChange={setBike} onStart={start} onOpenSettings={openSettings} />}
    </div>

    <PauseDialog open={paused && started && !settingsOpen} distance={telemetry.distance} onResume={() => setPaused(false)} onRestart={restartRide} onOpenSettings={openSettings} />
    <SettingsDialog
      open={settingsOpen}
      camera={camera}
      hudPreset={prefs.hudPreset}
      widgets={widgets}
      audio={prefs.audio}
      controlMode={prefs.controlMode}
      quality={prefs.quality}
      reducedMotion={prefs.reducedMotion}
      seed={seed}
      linkCopied={linkCopied}
      audioUnavailable={audioUnavailable}
      onClose={closeSettings}
      onCameraChange={(value) => updatePrefs({ camera: value })}
      onHudPresetChange={choosePreset}
      onWidgetChange={setWidget}
      onAudioEnabledChange={setAudioEnabled}
      onAudioMixChange={setAudioMix}
      onControlModeChange={setControlMode}
      onQualityChange={(quality: QualityMode) => updatePrefs({ quality })}
      onReducedMotionChange={(value) => updatePrefs({ reducedMotion: value })}
      onRegenerateRoute={regenerateRoute}
      onCopyLink={() => void copyRideLink()}
    />
    <div className="sr-only" aria-live="polite">{started ? `${Math.round(telemetry.speed)} kilometres per hour${paused ? ', ride paused' : ''}` : 'Choose a world and motorcycle, then begin the ride'}</div>
  </main>
}

declare global { interface Window { __horizonRideRoot?: Root } }
const rootElement = document.getElementById('root')!
const root = window.__horizonRideRoot ?? createRoot(rootElement)
window.__horizonRideRoot = root
root.render(<StrictMode><AppErrorBoundary><App /></AppErrorBoundary></StrictMode>)
