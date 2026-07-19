import type { BikeClass, BiomeId } from '../types'
import { BikeIcon, BiomeIcon, ArrowRightIcon, CheckIcon, HorizonMarkIcon } from './icons'

const biomeCopy: Record<BiomeId, { label: string; detail: string }> = {
  coast: { label: 'Coast', detail: 'Salt air and ocean light' },
  alpine: { label: 'Alpine', detail: 'Pines, passes and cool valleys' },
  desert: { label: 'Desert', detail: 'Warm stone and open sky' },
}

const bikeCopy: Record<BikeClass, { label: string; detail: string }> = {
  scooter: { label: 'Scooter', detail: 'Easy and agile' },
  sport: { label: 'Sport Bike', detail: 'Quick and precise' },
  cruiser: { label: 'V-Twin Cruiser', detail: 'Low and unhurried' },
}

export interface LaunchScreenProps {
  biome: BiomeId
  bike: BikeClass
  seed?: number
  audioEnabled?: boolean
  onBiomeChange: (biome: BiomeId) => void
  onBikeChange: (bike: BikeClass) => void
  onStart: () => void | Promise<void>
  onOpenSettings?: () => void
}

export function LaunchScreen({ biome, bike, seed, audioEnabled = false, onBiomeChange, onBikeChange, onStart, onOpenSettings }: LaunchScreenProps) {
  return <section className="launch-screen" aria-labelledby="launch-title">
    <div className="launch-screen__veil" />
    <div className="launch-card surface-glass">
      <div className="launch-card__eyebrow"><HorizonMarkIcon /> Scenic rides, endlessly generated</div>
      <h1 id="launch-title">Ride the<br /><em>horizon.</em></h1>
      <p className="launch-card__intro">A quiet road, a responsive machine, and no destination asking you to hurry.</p>

      <fieldset className="launch-picker launch-picker--biome">
        <legend>Choose your world</legend>
        <div className="launch-picker__grid">
          {(Object.keys(biomeCopy) as BiomeId[]).map((id) => <button
            type="button"
            key={id}
            className="launch-choice"
            data-selected={biome === id}
            aria-pressed={biome === id}
            onClick={() => onBiomeChange(id)}
          >
            <BiomeIcon biome={id} className="launch-choice__icon" />
            <span><strong>{biomeCopy[id].label}</strong><small>{biomeCopy[id].detail}</small></span>
            {biome === id ? <CheckIcon className="choice-check" /> : null}
          </button>)}
        </div>
      </fieldset>

      <fieldset className="launch-picker launch-picker--bike">
        <legend>Choose your ride</legend>
        <div className="launch-picker__grid">
          {(Object.keys(bikeCopy) as BikeClass[]).map((id) => <button
            type="button"
            key={id}
            className="launch-choice launch-choice--bike"
            data-selected={bike === id}
            aria-pressed={bike === id}
            onClick={() => onBikeChange(id)}
          >
            <BikeIcon bike={id} className="launch-choice__bike" />
            <span><strong>{bikeCopy[id].label}</strong><small>{bikeCopy[id].detail}</small></span>
            {bike === id ? <CheckIcon className="choice-check" /> : null}
          </button>)}
        </div>
      </fieldset>

      <div className="launch-card__footer">
        <button type="button" className="primary-action" onClick={() => void onStart()}>
          Begin ride <ArrowRightIcon />
        </button>
        <p><span className="status-dot" data-on={audioEnabled} /> Audio {audioEnabled ? 'ready' : 'off by default'}{seed !== undefined ? <span aria-label={`Ride seed ${seed}`}> · Seed {seed}</span> : null}</p>
        {onOpenSettings ? <button type="button" className="text-action" onClick={onOpenSettings}>Adjust ride settings</button> : null}
      </div>
    </div>
  </section>
}
