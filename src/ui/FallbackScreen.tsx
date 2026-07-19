import { HorizonMarkIcon, RestartIcon } from './icons'

export function LoadingScreen({ label = 'Building the road ahead' }: { label?: string }) {
  return <div className="game-fallback game-fallback--loading" role="status" aria-live="polite">
    <HorizonMarkIcon />
    <div className="loading-line" aria-hidden="true"><span /></div>
    <p>{label}</p>
  </div>
}

export interface WebGLFallbackProps {
  title?: string
  message?: string
  onRetry?: () => void
}

export function WebGLFallback({ title = 'The road could not open', message = 'Horizon Ride needs WebGL hardware acceleration. Enable it in your browser settings, then try again.', onRetry }: WebGLFallbackProps) {
  return <section className="game-fallback game-fallback--error" role="alert" aria-labelledby="webgl-fallback-title">
    <div className="surface-glass">
      <HorizonMarkIcon />
      <span className="dialog-kicker">Rendering unavailable</span>
      <h1 id="webgl-fallback-title">{title}</h1>
      <p>{message}</p>
      {onRetry ? <button type="button" className="primary-action" onClick={onRetry}><RestartIcon /> Try again</button> : null}
    </div>
  </section>
}
