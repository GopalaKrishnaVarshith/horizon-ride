import type { ReactNode } from 'react'
import type { AudioSettingsV1, CameraMode, ControlMode, HudPreset, HudWidgetId, QualityMode } from '../types'
import { AutoControlIcon, CameraIcon, CloseIcon, CompassIcon, ControlsIcon, KeyboardIcon, RestartIcon, SoundIcon, SpeedIcon, TerrainIcon, TouchIcon } from './icons'
import { useDialogFocus } from './useDialogFocus'

export type { ControlMode, QualityMode } from '../types'
export type AudioMixKey = Exclude<keyof AudioSettingsV1, 'enabled'>

export interface SettingsDialogProps {
  open: boolean
  camera: CameraMode
  hudPreset: HudPreset
  widgets: Record<HudWidgetId, boolean>
  audio: AudioSettingsV1
  controlMode?: ControlMode
  quality?: QualityMode
  audioUnavailable?: boolean
  reducedMotion?: boolean
  seed?: number
  linkCopied?: boolean
  onClose: () => void
  onCameraChange: (camera: CameraMode) => void
  onHudPresetChange: (preset: HudPreset) => void
  onWidgetChange: (widget: HudWidgetId, visible: boolean) => void
  onAudioEnabledChange: (enabled: boolean) => void | Promise<void>
  onAudioMixChange: (key: AudioMixKey, value: number) => void
  onControlModeChange?: (mode: ControlMode) => void
  onQualityChange?: (quality: QualityMode) => void
  onReducedMotionChange?: (reduced: boolean) => void
  onRegenerateRoute?: () => void
  onCopyLink?: () => void
}

function SectionHeading({ icon, title, description }: { icon: ReactNode; title: string; description?: string }) {
  return <div className="settings-section__heading"><span>{icon}</span><div><h3>{title}</h3>{description ? <p>{description}</p> : null}</div></div>
}

function SwitchRow({ label, detail, checked, disabled, onChange, icon }: { label: string; detail?: string; checked: boolean; disabled?: boolean; onChange: (value: boolean) => void; icon?: ReactNode }) {
  return <label className="setting-row setting-row--switch" data-disabled={disabled}>
    <span className="setting-row__label">{icon}<span><strong>{label}</strong>{detail ? <small>{detail}</small> : null}</span></span>
    <input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={(event) => onChange(event.currentTarget.checked)} />
    <span className="switch-track" aria-hidden="true"><span /></span>
  </label>
}

function RangeRow({ label, value, onChange, disabled }: { label: string; value: number; onChange: (value: number) => void; disabled?: boolean }) {
  const percent = Math.round(value * 100)
  return <label className="setting-range" data-disabled={disabled}>
    <span><strong>{label}</strong><output>{percent}%</output></span>
    <input type="range" min="0" max="1" step="0.01" value={value} disabled={disabled} aria-label={`${label} volume`} onChange={(event) => onChange(Number(event.currentTarget.value))} />
  </label>
}

function Segment<T extends string>({ label, value, values, labels, onChange }: { label: string; value: T; values: readonly T[]; labels: Record<T, string>; onChange: (value: T) => void }) {
  return <fieldset className="segmented-control">
    <legend className="sr-only">{label}</legend>
    {values.map((item) => <button type="button" key={item} data-selected={item === value} aria-pressed={item === value} onClick={() => onChange(item)}>{labels[item]}</button>)}
  </fieldset>
}

const widgetMeta: Record<HudWidgetId, { label: string; detail: string; icon: ReactNode }> = {
  speed: { label: 'Speed', detail: 'Current riding speed', icon: <SpeedIcon /> },
  compass: { label: 'Compass', detail: 'Heading and direction', icon: <CompassIcon /> },
  terrain: { label: 'Terrain profile', detail: 'Elevation of the road ahead', icon: <TerrainIcon /> },
  hints: { label: 'Control hints', detail: 'Keyboard reminders', icon: <KeyboardIcon /> },
  bike: { label: 'Bike selector', detail: 'Switch machines while riding', icon: <ControlsIcon /> },
}

const mixLabels: Record<AudioMixKey, string> = {
  master: 'Master',
  music: 'Music',
  ambience: 'Ride ambience',
  bike: 'Bike sound',
  variation: 'Calm variation',
}

export function SettingsDialog({ open, camera, hudPreset, widgets, audio, controlMode = 'auto', quality = 'auto', audioUnavailable = false, reducedMotion = false, seed, linkCopied = false, onClose, onCameraChange, onHudPresetChange, onWidgetChange, onAudioEnabledChange, onAudioMixChange, onControlModeChange, onQualityChange, onReducedMotionChange, onRegenerateRoute, onCopyLink }: SettingsDialogProps) {
  const dialogRef = useDialogFocus<HTMLElement>(open, onClose)
  if (!open) return null

  return <div className="dialog-backdrop dialog-backdrop--settings" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section ref={dialogRef} className="settings-dialog surface-glass" role="dialog" aria-modal="true" aria-labelledby="ride-settings-title" tabIndex={-1}>
      <header className="dialog-header">
        <div><span className="dialog-kicker">Preferences</span><h2 id="ride-settings-title">Ride settings</h2></div>
        <button type="button" className="icon-button icon-button--bare" onClick={onClose} aria-label="Close settings" data-autofocus><CloseIcon /></button>
      </header>

      <div className="settings-dialog__scroll">
        <section className="settings-section">
          <SectionHeading icon={<CameraIcon />} title="View" description="Frame the road your way." />
          <Segment label="Camera" value={camera} values={['cockpit', 'chase', 'wide']} labels={{ cockpit: 'Cockpit', chase: 'Chase', wide: 'Wide chase' }} onChange={onCameraChange} />
          {onQualityChange ? <label className="setting-select"><span><strong>Scene quality</strong><small>Balances detail and frame rate</small></span><select value={quality} onChange={(event) => onQualityChange(event.currentTarget.value as QualityMode)}><option value="auto">Automatic</option><option value="high">High detail</option><option value="balanced">Balanced</option></select></label> : null}
          {onReducedMotionChange ? <SwitchRow label="Reduced camera motion" detail="Softens lean, shake and field-of-view motion" checked={reducedMotion} onChange={onReducedMotionChange} /> : null}
          {seed !== undefined && (onRegenerateRoute || onCopyLink) ? <div className="route-tools">
            <div><span>Ride seed</span><strong>{seed}</strong></div>
            {onCopyLink ? <button type="button" className="secondary-action" onClick={onCopyLink}>{linkCopied ? 'Link copied' : 'Copy ride link'}</button> : null}
            {onRegenerateRoute ? <button type="button" className="secondary-action" onClick={onRegenerateRoute}><RestartIcon /> New road</button> : null}
          </div> : null}
          <p className="shortcut-strip"><kbd>C</kbd> camera <kbd>M</kbd> auto ride <kbd>P</kbd> pause <kbd>R</kbd> restart <kbd>F</kbd> fullscreen</p>
        </section>

        <section className="settings-section">
          <SectionHeading icon={<TerrainIcon />} title="HUD" description="Keep only what helps the journey." />
          <Segment label="HUD preset" value={hudPreset} values={['minimal', 'journey', 'immersive']} labels={{ minimal: 'Minimal', journey: 'Journey', immersive: 'Immersive' }} onChange={onHudPresetChange} />
          <div className="setting-list">
            {(Object.keys(widgetMeta) as HudWidgetId[]).map((id) => <SwitchRow key={id} {...widgetMeta[id]} checked={widgets[id]} onChange={(visible) => onWidgetChange(id, visible)} />)}
          </div>
        </section>

        <section className="settings-section">
          <SectionHeading icon={<ControlsIcon />} title="Controls" description="Choose a hands-free calm cruise or ride manually." />
          {onControlModeChange ? <div className="control-mode-grid">
            {(['auto', 'keyboard', 'touch'] as ControlMode[]).map((mode) => {
              const meta = {
                auto: { label: 'Auto ride', detail: 'Steers and cruises', icon: <AutoControlIcon /> },
                keyboard: { label: 'Manual', detail: 'WASD + arrow keys', icon: <KeyboardIcon /> },
                touch: { label: 'Touch', detail: 'On-screen controls', icon: <TouchIcon /> },
              }[mode]
              return <button type="button" key={mode} data-selected={controlMode === mode} aria-pressed={controlMode === mode} aria-label={`${meta.label}: ${meta.detail}`} onClick={() => onControlModeChange(mode)}>{meta.icon}<span>{meta.label}<small>{meta.detail}</small></span></button>
            })}
          </div> : <p className="settings-note">Use W / S to accelerate and brake, A / D to steer. Touch controls appear automatically on compatible screens.</p>}
          {controlMode === 'auto' ? <p className="settings-note settings-note--active">Auto ride follows the road at a relaxed pace. W / ↑, S / ↓, A / ← and D / → temporarily take priority.</p> : null}
          {controlMode === 'keyboard' ? <p className="settings-note settings-note--active">W or ↑ accelerate · S or ↓ brake · A or ← steer left · D or → steer right.</p> : null}
        </section>

        <section className="settings-section">
          <SectionHeading icon={<SoundIcon />} title="Sound" description="Generated locally for this road." />
          <SwitchRow label="Audio engine" detail={audioUnavailable ? 'Audio is unavailable in this browser' : audio.enabled ? 'Procedural lo-fi and ride sound enabled' : 'Off until you choose to enable it'} checked={audio.enabled && !audioUnavailable} disabled={audioUnavailable} onChange={(enabled) => void onAudioEnabledChange(enabled)} />
          <div className="sound-mixer" aria-disabled={!audio.enabled || audioUnavailable}>
            {(Object.keys(mixLabels) as AudioMixKey[]).map((key) => <RangeRow key={key} label={mixLabels[key]} value={audio[key]} disabled={!audio.enabled || audioUnavailable} onChange={(value) => onAudioMixChange(key, value)} />)}
          </div>
          <p className="settings-note">Original synthesis only. No streaming, external tracks, vocals, or song samples.</p>
        </section>
      </div>
    </section>
  </div>
}
