import type { HudWidgetId } from '../types'
import { CompassIcon, SpeedIcon, TerrainIcon } from './icons'

export interface TelemetryHUDProps {
  speed: number
  heading: number
  distance: number
  terrainProfile: readonly number[]
  widgets: Record<HudWidgetId, boolean>
  biomeLabel?: string
}

function compassPoint(heading: number) {
  const normalized = ((heading % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)
  const index = Math.round(normalized / (Math.PI / 4)) % 8
  return ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][index]
}

function profilePoints(profile: readonly number[], width = 184, height = 38) {
  if (!profile.length) return `0,${height / 2} ${width},${height / 2}`
  const min = Math.min(...profile)
  const max = Math.max(...profile)
  const range = Math.max(max - min, 0.18)
  return profile.map((value, index) => {
    const x = profile.length === 1 ? 0 : index / (profile.length - 1) * width
    const y = height - 4 - ((value - min) / range) * (height - 8)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
}

export function ControlHints() {
  return <aside className="control-hints surface-glass" aria-label="Keyboard controls">
    <div><span className="control-hint-keys"><kbd>W</kbd><kbd>S</kbd><i>or</i><kbd aria-label="Up arrow">↑</kbd><kbd aria-label="Down arrow">↓</kbd></span><span>Speed</span></div>
    <div><span className="control-hint-keys"><kbd>A</kbd><kbd>D</kbd><i>or</i><kbd aria-label="Left arrow">←</kbd><kbd aria-label="Right arrow">→</kbd></span><span>Steer</span></div>
    <div><span className="control-hint-keys"><kbd>C</kbd></span><span>Camera</span></div>
    <div><span className="control-hint-keys"><kbd>M</kbd></span><span>Auto</span></div>
    <div><span className="control-hint-keys"><kbd>P</kbd></span><span>Pause</span></div>
  </aside>
}

export function TelemetryHUD({ speed, heading, distance, terrainProfile, widgets, biomeLabel }: TelemetryHUDProps) {
  const direction = compassPoint(heading)
  const showTelemetry = widgets.speed || widgets.compass || widgets.terrain
  return <>
    {showTelemetry ? <section className="telemetry-hud surface-glass" aria-label="Ride telemetry">
      {widgets.speed ? <div className="telemetry-hud__speed">
        <SpeedIcon aria-hidden="true" />
        <strong>{Math.max(0, Math.round(speed)).toString().padStart(2, '0')}</strong>
        <span>km/h</span>
      </div> : null}
      {widgets.compass ? <div className="telemetry-hud__compass">
        <CompassIcon aria-hidden="true" />
        <strong>{direction}</strong>
        <span>{biomeLabel ?? 'Open road'}</span>
      </div> : null}
      {widgets.terrain ? <div className="telemetry-hud__terrain">
        <div><TerrainIcon aria-hidden="true" /><span>Road ahead</span></div>
        <svg viewBox="0 0 184 38" preserveAspectRatio="none" role="img" aria-label="Upcoming road elevation profile">
          <defs><linearGradient id="terrain-fill" x1="0" y1="0" x2="0" y2="1"><stop stopColor="currentColor" stopOpacity=".3" /><stop offset="1" stopColor="currentColor" stopOpacity="0" /></linearGradient></defs>
          <polygon points={`0,38 ${profilePoints(terrainProfile)} 184,38`} fill="url(#terrain-fill)" />
          <polyline points={profilePoints(terrainProfile)} />
        </svg>
      </div> : null}
      {widgets.terrain ? <div className="telemetry-hud__distance"><span>Journey</span><strong>{(Math.max(0, distance) / 1000).toFixed(1)} km</strong></div> : null}
    </section> : null}
    {widgets.hints ? <ControlHints /> : null}
  </>
}
