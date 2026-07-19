import { PlayIcon, RestartIcon, SettingsIcon } from './icons'
import { useDialogFocus } from './useDialogFocus'

export interface PauseDialogProps {
  open: boolean
  distance?: number
  onResume: () => void
  onRestart: () => void
  onOpenSettings?: () => void
}

export function PauseDialog({ open, distance = 0, onResume, onRestart, onOpenSettings }: PauseDialogProps) {
  const dialogRef = useDialogFocus<HTMLDivElement>(open, onResume)
  if (!open) return null
  return <div className="dialog-backdrop dialog-backdrop--pause">
    <div ref={dialogRef} className="pause-dialog surface-glass" role="dialog" aria-modal="true" aria-labelledby="pause-title" tabIndex={-1}>
      <span className="dialog-kicker">The road will wait</span>
      <h2 id="pause-title">Ride paused</h2>
      <p>{distance > 0 ? `${(distance / 1000).toFixed(1)} kilometres into this horizon.` : 'Take a breath. Continue whenever you are ready.'}</p>
      <div className="pause-dialog__actions">
        <button type="button" className="primary-action" onClick={onResume} data-autofocus><PlayIcon /> Resume ride</button>
        <button type="button" className="secondary-action" onClick={onRestart}><RestartIcon /> Restart road</button>
        {onOpenSettings ? <button type="button" className="text-action" onClick={onOpenSettings}><SettingsIcon /> Ride settings</button> : null}
      </div>
      <small>Press P to resume</small>
    </div>
  </div>
}
