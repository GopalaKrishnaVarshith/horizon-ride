import type { SVGProps } from 'react'
import type { BikeClass, BiomeId } from '../types'

export type IconProps = SVGProps<SVGSVGElement> & { title?: string }

const iconA11y = (title?: string) => title
  ? { role: 'img' as const, 'aria-label': title }
  : { 'aria-hidden': true as const }

function Icon({ title, children, viewBox = '0 0 24 24', ...props }: IconProps) {
  return <svg viewBox={viewBox} fill="none" xmlns="http://www.w3.org/2000/svg" {...iconA11y(title)} {...props}>
    {children}
  </svg>
}

const stroke = { stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

export function HorizonMarkIcon(props: IconProps) {
  return <Icon viewBox="0 0 42 18" {...props}>
    <path d="M2 12.5c5.4-5.6 10.5-5.6 15.3 0 5-6.7 10.6-6.7 16.7 0 2.2-2.5 4.2-3.7 6-3.6" {...stroke} />
    <path d="M6 16h30" {...stroke} opacity=".45" />
  </Icon>
}

export function PauseIcon(props: IconProps) {
  return <Icon {...props}><path d="M8.25 5.5v13M15.75 5.5v13" {...stroke} strokeWidth="2.2" /></Icon>
}

export function PlayIcon(props: IconProps) {
  return <Icon {...props}><path d="m8.5 5.8 9.2 6.2-9.2 6.2V5.8Z" {...stroke} fill="currentColor" fillOpacity=".12" /></Icon>
}

export function SettingsIcon(props: IconProps) {
  return <Icon {...props}>
    <circle cx="12" cy="12" r="3.1" {...stroke} />
    <path d="M12 3.6v2M12 18.4v2M20.4 12h-2M5.6 12h-2M17.95 6.05l-1.42 1.42M7.47 16.53l-1.42 1.42M17.95 17.95l-1.42-1.42M7.47 7.47 6.05 6.05" {...stroke} />
  </Icon>
}

export function CloseIcon(props: IconProps) {
  return <Icon {...props}><path d="m6.5 6.5 11 11m0-11-11 11" {...stroke} /></Icon>
}

export function ArrowRightIcon(props: IconProps) {
  return <Icon {...props}><path d="M4.5 12h14M14 7.5l4.5 4.5-4.5 4.5" {...stroke} /></Icon>
}

export function ChevronLeftIcon(props: IconProps) {
  return <Icon {...props}><path d="m14.5 6-6 6 6 6" {...stroke} strokeWidth="2" /></Icon>
}

export function ChevronRightIcon(props: IconProps) {
  return <Icon {...props}><path d="m9.5 6 6 6-6 6" {...stroke} strokeWidth="2" /></Icon>
}

export function SpeedIcon(props: IconProps) {
  return <Icon {...props}>
    <path d="M5.15 18.2a8 8 0 1 1 13.7 0" {...stroke} />
    <path d="m12 12 4.1-3.2M7.3 15.8h9.4" {...stroke} />
    <circle cx="12" cy="12" r="1.25" fill="currentColor" />
  </Icon>
}

export function CompassIcon(props: IconProps) {
  return <Icon {...props}>
    <circle cx="12" cy="12" r="8.6" {...stroke} />
    <path d="m14.75 8.3-1.45 5-4.05 2.4 1.45-5 4.05-2.4Z" {...stroke} fill="currentColor" fillOpacity=".12" />
  </Icon>
}

export function TerrainIcon(props: IconProps) {
  return <Icon {...props}><path d="m3.5 17.5 4.1-5 3.1 2.7 4.3-7 5.5 9.3h-17Z" {...stroke} /></Icon>
}

export function ControlsIcon(props: IconProps) {
  return <Icon {...props}>
    <rect x="3.5" y="7" width="17" height="10" rx="4" {...stroke} />
    <path d="M8 10v4M6 12h4M15.5 11h.01M18 13h.01" {...stroke} strokeWidth="2" />
  </Icon>
}

export function CameraIcon(props: IconProps) {
  return <Icon {...props}><path d="M4 8.2h3l1.4-2h7.2l1.4 2h3v10H4v-10Z" {...stroke} /><circle cx="12" cy="13" r="3.2" {...stroke} /></Icon>
}

export function SoundIcon(props: IconProps) {
  return <Icon {...props}><path d="M4 10h3l4-3.5v11L7 14H4v-4ZM15 9.2a4 4 0 0 1 0 5.6M17.7 6.7a7.5 7.5 0 0 1 0 10.6" {...stroke} /></Icon>
}

export function SoundOffIcon(props: IconProps) {
  return <Icon {...props}><path d="M4 10h3l4-3.5v11L7 14H4v-4ZM15.5 10l4 4m0-4-4 4" {...stroke} /></Icon>
}

export function RestartIcon(props: IconProps) {
  return <Icon {...props}><path d="M6.2 8.2H3.6V5.6M4 8a8.3 8.3 0 1 1-.15 7.7" {...stroke} /></Icon>
}

export function KeyboardIcon(props: IconProps) {
  return <Icon {...props}>
    <rect x="2.8" y="6.2" width="18.4" height="11.6" rx="2" {...stroke} />
    <path d="M6 10h.01M9 10h.01M12 10h.01M15 10h.01M18 10h.01M6 13h.01M9 13h.01M12 13h.01M15 13h.01M18 13h.01M7.5 15.5h9" {...stroke} strokeWidth="1.9" />
  </Icon>
}

export function TouchIcon(props: IconProps) {
  return <Icon {...props}>
    <path d="M9.2 11.5V6.2a1.5 1.5 0 0 1 3 0v4.3-1.2a1.5 1.5 0 0 1 3 0v1-0.3a1.5 1.5 0 0 1 3 0v4.2c0 4-2.8 6.2-6.2 6.2-2.3 0-3.9-1.2-5.3-3.1l-2.1-2.8a1.55 1.55 0 0 1 2.4-2l2.2 2.2v-3.2Z" {...stroke} />
  </Icon>
}

export function AutoControlIcon(props: IconProps) {
  return <Icon {...props}><path d="M4.5 7.2h15v9.6h-15V7.2ZM8 19.5h8M12 16.8v2.7" {...stroke} /><path d="m9.5 10 2.5 2.5 2.5-2.5" {...stroke} /></Icon>
}

export function BikeIcon({ bike, ...props }: IconProps & { bike: BikeClass }) {
  if (bike === 'scooter') return <Icon viewBox="0 0 52 28" {...props}>
    <circle cx="12" cy="21" r="5" {...stroke} /><circle cx="40" cy="21" r="5" {...stroke} />
    <path d="M12 21h13l5-10h6l4 10M22 21l-2-10h9M19 11l-4-3M32 7h5M26 15h8" {...stroke} />
  </Icon>
  if (bike === 'cruiser') return <Icon viewBox="0 0 52 28" {...props}>
    <circle cx="11" cy="21" r="5" {...stroke} /><circle cx="41" cy="21" r="5" {...stroke} />
    <path d="M11 21h10l7-8 8 8h5M21 21h15l-6-8M25 11h9l3-5M36 6h5M19 13l-4-4" {...stroke} />
    <path d="M24 15h8l3 6" {...stroke} strokeWidth="2.2" />
  </Icon>
  return <Icon viewBox="0 0 52 28" {...props}>
    <circle cx="11" cy="21" r="5" {...stroke} /><circle cx="41" cy="21" r="5" {...stroke} />
    <path d="M11 21h10l6-10h8l6 10M21 21h15l-9-10M25 9h13l4 4M18 12l6-3" {...stroke} />
    <path d="M24 13h12l-3 6H21l3-6Z" {...stroke} fill="currentColor" fillOpacity=".1" />
  </Icon>
}

export function BiomeIcon({ biome, ...props }: IconProps & { biome: BiomeId }) {
  if (biome === 'coast') return <Icon {...props}>
    <path d="M3 15.2c2.7-2 5.2-2 7.7 0s5 2 7.6 0c1-.7 1.9-1.1 2.7-1.3M5 10.8c2-1.4 3.8-1.4 5.6 0 1.9 1.4 3.8 1.4 5.7 0" {...stroke} />
    <circle cx="17.5" cy="6.5" r="2.5" {...stroke} />
  </Icon>
  if (biome === 'desert') return <Icon {...props}>
    <path d="M3 17c3.5-4.1 6.8-5.7 9.8-4.7 2.5.8 5.2.3 8.2-1.6M15.5 8V4.5M12.7 6.2h2.8M18.2 8V5.5M18.2 6.8h2" {...stroke} />
  </Icon>
  return <Icon {...props}><path d="m3 18 5.5-9 3.2 4.2L15.5 6 21 18H3Z" {...stroke} /><path d="m7.3 11 1.2 1 1.2-1.4M14 9l1.5 1 1.5-1.5" {...stroke} /></Icon>
}

export function CheckIcon(props: IconProps) {
  return <Icon {...props}><path d="m5.5 12.5 4 4 9-9" {...stroke} strokeWidth="2" /></Icon>
}
