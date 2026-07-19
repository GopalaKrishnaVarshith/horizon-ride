# Horizon Ride

Horizon Ride is an original endless motorcycle journey built for the browser with React, TypeScript, React Three Fiber, Three.js, and the Web Audio API.

## Play locally

```powershell
npm.cmd install
npm.cmd run dev -- --host 127.0.0.1 --port 4174
```

Open `http://127.0.0.1:4174/`.

## Controls

- `W` / `Arrow Up`: accelerate
- `S` / `Arrow Down`: brake
- `A` / `D` or arrow keys: steer
- `C`: cycle Cockpit, Chase, and Wide chase cameras
- `P`: pause or resume
- `R`: restart the road
- `F`: fullscreen
- Touch devices: thumb controls appear automatically

Audio remains off until explicitly enabled in Ride settings. Music, ambience, and bike sound are generated locally in the browser; no tracks or samples are streamed.

## Validation

```powershell
npm.cmd test
npm.cmd run test:browser
npm.cmd run build
```

The browser smoke test covers every bike and biome selection, representative Coast/Alpine/Desert rides, keyboard driving, camera/settings/pause flows, shared seed `0`, default-muted audio, reload recovery, and a touch-enabled 390 x 844 portrait session.
