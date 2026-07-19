import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import { CameraIcon, ChevronLeftIcon, ChevronRightIcon } from './icons'

export type RideControl = 'left' | 'right' | 'brake' | 'throttle'

export interface TouchControlsProps {
  held?: Partial<Record<RideControl, boolean>>
  onControlChange: (control: RideControl, pressed: boolean) => void
  onCameraChange?: () => void
}

interface HoldButtonProps {
  control: RideControl
  label: string
  className?: string
  pressed: boolean
  onChange: (control: RideControl, pressed: boolean) => void
  children: ReactNode
}

function HoldButton({ control, label, className = '', pressed, onChange, children }: HoldButtonProps) {
  const press = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    onChange(control, true)
  }
  const release = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    onChange(control, false)
  }
  return <button
    type="button"
    className={`touch-control ${className}`}
    data-held={pressed}
    aria-label={label}
    aria-pressed={pressed}
    onPointerDown={press}
    onPointerUp={release}
    onPointerCancel={release}
    onLostPointerCapture={() => onChange(control, false)}
    onContextMenu={(event) => event.preventDefault()}
  >{children}</button>
}

export function TouchControls({ held = {}, onControlChange, onCameraChange }: TouchControlsProps) {
  return <div className="touch-controls" aria-label="Touch ride controls">
    <div className="touch-controls__steer">
      <HoldButton control="left" label="Steer left" pressed={Boolean(held.left)} onChange={onControlChange}><ChevronLeftIcon /></HoldButton>
      <HoldButton control="right" label="Steer right" pressed={Boolean(held.right)} onChange={onControlChange}><ChevronRightIcon /></HoldButton>
    </div>
    {onCameraChange ? <button type="button" className="touch-control touch-control--camera" aria-label="Change camera" onClick={onCameraChange}><CameraIcon /></button> : null}
    <div className="touch-controls__pedals">
      <HoldButton control="brake" label="Brake" className="touch-control--brake" pressed={Boolean(held.brake)} onChange={onControlChange}><span>Brake</span><small>Hold</small></HoldButton>
      <HoldButton control="throttle" label="Accelerate" className="touch-control--throttle" pressed={Boolean(held.throttle)} onChange={onControlChange}><span>Ride</span><small>Hold</small></HoldButton>
    </div>
  </div>
}
