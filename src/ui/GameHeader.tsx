import { HorizonMarkIcon, PauseIcon, PlayIcon, SettingsIcon, SoundIcon, SoundOffIcon } from './icons'

export interface GameHeaderProps {
  paused: boolean
  audioEnabled?: boolean
  onPauseToggle: () => void
  onOpenSettings: () => void
  onAudioToggle?: () => void
  onBrandClick?: () => void
}

export function Brand({ onClick }: { onClick?: () => void }) {
  const content = <><HorizonMarkIcon className="brand-lockup__mark" /><span>Horizon<br />Ride</span></>
  return onClick
    ? <button type="button" className="brand-lockup" onClick={onClick} aria-label="Open Horizon Ride settings">{content}</button>
    : <div className="brand-lockup" aria-label="Horizon Ride">{content}</div>
}

export function GameHeader({ paused, audioEnabled = false, onPauseToggle, onOpenSettings, onAudioToggle, onBrandClick }: GameHeaderProps) {
  return <header className="game-header">
    <Brand onClick={onBrandClick ?? onOpenSettings} />
    <div className="game-header__actions">
      {onAudioToggle ? <button type="button" className="icon-button" data-active={audioEnabled} onClick={onAudioToggle} aria-label={audioEnabled ? 'Turn off audio' : 'Turn on audio'}>
        {audioEnabled ? <SoundIcon /> : <SoundOffIcon />}
      </button> : null}
      <button type="button" className="icon-button" onClick={onPauseToggle} aria-label={paused ? 'Resume ride' : 'Pause ride'}>
        {paused ? <PlayIcon /> : <PauseIcon />}
      </button>
      <button type="button" className="icon-button" onClick={onOpenSettings} aria-label="Open ride settings">
        <SettingsIcon />
      </button>
    </div>
  </header>
}
