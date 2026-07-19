Original prompt: Rebuild Horizon Ride as a direct, ready-to-play, high-quality endless motorcycle game comparable in visual ambition to slowroads.io, while remaining original and unbranded.

## 2026-07-18 rebuild

- Root-cause review: the first pass used disconnected box road tiles, a flat plane, cuboid bikes, sparse cones, and no horizon composition.
- Approved direction: continuous procedural road/terrain, dense recycled scenery, recognizable original motorcycles and rider, cinematic lighting/post-processing, high-contrast frosted HUD, audio disabled by default.
- Generated and saved an original alpine horizon asset at `public/assets/alpine-horizon.png`.
- Generated and saved original Coast and Desert panorama assets with no third-party game art or branding.
- Added `@react-three/postprocessing` and `postprocessing`.
- Replaced the original scene with dynamic road, shoulder, and terrain ribbons; instanced roadside scenery; a composed motorcycle and rider; cockpit/chase camera rigs; ACES tone mapping; bloom; and vignette.
- Added `render_game_to_text` and deterministic `advanceTime` hooks for the game test loop.

## Verification complete

- Corrected upward mesh winding, foreground coverage, backdrop coverage, solid road edges, biome-specific scenery, terrain shade variation, coasting physics, and cockpit framing from live screenshots.
- Added camera, pause, restart, fullscreen, HUD, touch, sound-panel, URL seed, and local-preference flows. Audio is hard-off by default and does not initialize until explicitly enabled.
- Production build and unit tests pass.
- In-app browser checks passed for Alpine, Coast, Desert, Cockpit, Chase, Wide chase, settings, audio-off state, and mobile portrait at 390 x 844 with no console warnings or errors.
- Held-input game-driver run passed at 160 km/h after 213 metres with lateral steering displacement and no console-error artifact.

## Full production rebuild pass

- Replaced prototype movement with a deterministic 120 Hz motorcycle simulation: speed-dependent steering, lean equilibrium, suspension, pitch, wheel rotation, road assist, braking, grip, and progressive off-road drag.
- Rebuilt the route as a biome-specific road-local system with tangent/right/up frames, curvature-derived banking, authoritative elevation, and real HUD profile samples.
- Added original compressed environment assets for asphalt, meadow, desert ground, and an eight-cell vegetation atlas; converted active panoramas to lightweight WebP.
- Rebuilt the foreground world with correctly framed textured road/terrain, solid edge lines, reflectors, guardrails, atlas vegetation, rocks, water, curved horizon staging, and adaptive high/balanced detail.
- Replaced the shared primitive bike shell with visibly distinct Scooter, Sport Bike, and V-Twin Cruiser assemblies, richer wheels/brakes/forks/fairings/lighting/rider posture, animated suspension and a functional cockpit gauge.
- Added spring camera framing per bike, road look-ahead, restrained speed FOV, reduced-motion behavior, loading/context-loss/WebGL fallbacks, and render error recovery.
- Integrated the semantic production UI, safe URL/persistence helpers, deterministic audio lifecycle, dialog focus management, touch pointer capture, keyboard input hygiene, shareable routes, and local quality/control preferences.
- Production TypeScript/Vite build passes after the first integrated systems pass; live visual/gameplay QA is next.

## 2026-07-18 full-production gameplay foundations

- Replaced the prototype route math with deterministic, biome-specific Coast, Alpine, and Desert identities; a bounded continuous centreline; road-local tangent/right/up frames; curvature, grade and bank; bank-aware lateral sampling; continuous terrain; and one authoritative elevation-profile API for rendering and HUD use.
- Added a pure 120 Hz fixed-timestep motorcycle simulation with speed-dependent bicycle steering, route-relative yaw, forgiving road assist, progressive off-road grip/drag, bike-specific acceleration/braking/coast, lean equilibrium, suspension response, pitch and wheel rotation.
- Expanded Scooter, Sport Bike, and V-Twin Cruiser profiles with distinct physics, camera anchors and audio character while preserving the original compatibility fields.
- Added route, profile and simulation regression coverage. Targeted gameplay tests pass: 3 files, 16 tests.

## 2026-07-18 production UI pass

- Added a props-first semantic UI kit under `src/ui`: cinematic launch flow, game header, normalized terrain telemetry, detailed bike selector, pointer-captured touch controls, focus-trapped settings and pause dialogs, and loading/WebGL fallback screens.
- Replaced text glyph controls with one coherent inline-SVG icon family and added explicit pressed/current states, 44 px minimum targets, safe-area handling, coarse-pointer controls, short-landscape layouts, reduced-motion support, and non-blur fallbacks.
- Rebuilt the overlay visual system around restrained dark frosted surfaces, near-white telemetry, high-contrast dividers, and amber selected states with dark text to match the accepted gameplay/settings concepts while keeping the world visually dominant.
- The UI module entrypoint compiles cleanly in isolation. The full build is temporarily blocked by concurrent engine changes in `Bike.tsx`, `simulation.ts`, and `World.tsx`; no UI TypeScript errors were reported.

## 2026-07-18 systems hardening

- Added fail-closed URL parsing/canonicalization, including valid seed `0`, finite seed bounds, and prototype-key rejection.
- Added versioned local preference migration with clamped values; audio remains off by default while an explicit enabled choice now persists.
- Rebuilt the procedural audio lifecycle around deterministic musical identity, hard mute boundaries, idempotent scheduling, quantized transitions, background-gap recovery, tracked voice cleanup, status reporting, and disposal.
- Added focused URL, persistence, deterministic music, and audio lifecycle tests; the complete suite currently passes 28/28 tests across five files.

## 2026-07-19 production lock

- Reframed Chase cameras closer to the rider and rebuilt the Cockpit presentation with compact glass, mirrors, bars, gloves, tank, visible analog gauge, and a live speed needle.
- Added original high-detail alpha chase renders for Scooter, Sport Bike, and V-Twin Cruiser while preserving the deterministic 3D simulation, lean, suspension, route motion, camera response, and procedural cockpit.
- Added a soft atmospheric horizon blend, final responsive HUD constraints, compact mobile bike switching, functional pause-from-dialog shortcut handling, and semantic Ride settings naming.
- Added a persistent Playwright smoke test covering all six launch selections, representative rides across all three biomes and bikes, keyboard acceleration, cameras, pause/settings, seed `0`, reload recovery, audio-off behavior, and touch-enabled mobile portrait.
- Final verification: 28/28 unit tests pass, browser validation passes, production build passes, and Graphify is refreshed to the current source.

## 2026-07-19 calm handling and auto-ride pass

- Corrected the rear-facing chase-bike lean transform so A banks the whole motorcycle left and D banks it right around the tyre contact patch; cockpit, chase, camera roll, and QA now share one screen-space lean conversion.
- Added a restrained predictive steering bank so input remains immediately readable on a procedural road that is already banked, while physical lean remains smooth and bounded.
- Reworked manual handling for a calmer ride: lower acceleration/top speeds, smaller steering angles, slower response, capped yaw, reduced camera shake/FOV/roll, and softer camera following.
- Added progressive pre-shoulder guidance, outward-steer reduction, outward-velocity damping, speed-aware edge recovery, and a forgiving 5.40 m shoulder bound. Sustained steering can no longer escape the generated road corridor.
- Turned the previous Automatic control preference into a real Auto ride: route-curvature following, gentle lane centering, 49–57 km/h cruise targets, slope compensation, edge-aware slowing, and temporary manual input priority.
- Added an in-game Auto ride status/control, clearer settings choices, the M shortcut, persistence, accessible descriptions, and reliable WASD input immediately after closing the settings dialog.
- Hardened the deterministic browser hooks across React StrictMode and the nested R3F renderer so long-ride checks begin only after the 3D world reports ready.
- Final verification: 37/37 unit tests pass across seven files; TypeScript/Vite production build passes; browser validation passes across all three biomes/bikes, auto cruise, mirrored A/D bank, road containment, pause/settings, and mobile portrait; audio remains off by default.

## 2026-07-19 arrow-control visibility

- Promoted the already-supported arrow-key controls to first-class HUD instructions: W/S or ↑/↓ for speed and A/D or ←/→ for steering.
- Added exact arrow mappings to both Auto ride and Manual settings copy, with amber arrow-key marks and accessible labels in the compact desktop control panel.
- Added a reusable arrow-key choreography for the standard web-game Playwright client plus a local-Chrome adapter for this Windows machine.
- Verification: 37/37 unit tests pass, production build passes, the prescribed game client completed Up/Down/Left/Right input bursts with no console errors, the right-arrow run produced a +2.60 m road-relative displacement, and both generated gameplay screenshots visibly show all four arrow marks.
