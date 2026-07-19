import type { BikeClass } from '../types'
import { BikeIcon, CheckIcon } from './icons'

const bikeLabels: Record<BikeClass, string> = {
  scooter: 'Scooter',
  sport: 'Sport Bike',
  cruiser: 'V-Twin Cruiser',
}

export interface BikeSelectorProps {
  bike: BikeClass
  onChange: (bike: BikeClass) => void
  disabled?: boolean
}

export function BikeSelector({ bike, onChange, disabled = false }: BikeSelectorProps) {
  return <div className="bike-selector surface-glass" role="radiogroup" aria-label="Choose motorcycle">
    {(Object.keys(bikeLabels) as BikeClass[]).map((id) => <button
      type="button"
      key={id}
      className="bike-selector__choice"
      data-selected={bike === id}
      role="radio"
      aria-checked={bike === id}
      aria-label={`Ride ${bikeLabels[id]}`}
      disabled={disabled}
      onClick={() => onChange(id)}
    >
      <BikeIcon bike={id} />
      <span>{bikeLabels[id]}</span>
      {bike === id ? <CheckIcon className="choice-check" /> : null}
    </button>)}
  </div>
}
