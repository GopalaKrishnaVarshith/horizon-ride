import { existsSync } from 'node:fs'
import { chromium } from 'playwright'

const baseUrl = process.env.HORIZON_RIDE_URL ?? 'http://127.0.0.1:4174'
const chromeCandidates = [
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
].filter(Boolean)
const executablePath = chromeCandidates.find((candidate) => existsSync(candidate))

const browser = await chromium.launch({
  headless: true,
  executablePath,
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const failures = []
const consoleErrors = []
page.on('pageerror', (error) => consoleErrors.push(error.message))
page.on('console', (message) => {
  if (message.type() === 'error') consoleErrors.push(message.text())
})

function check(condition, message) {
  if (!condition) failures.push(message)
}

async function openRoute(biome, bike, seed = 8128) {
  await page.goto(`${baseUrl}/?seed=${seed}&biome=${biome}&bike=${bike}`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('heading', { name: /Ride the horizon/i }).waitFor()
  await page.getByRole('button', { name: /^Begin ride/ }).click()
  await page.locator('.app[data-started="true"] canvas').waitFor({ state: 'visible', timeout: 15_000 })
  await page.locator('.game-canvas-wrap[data-ready="true"]').waitFor({ state: 'visible', timeout: 30_000 })
  await page.waitForFunction(() => typeof window.render_game_to_text === 'function', null, { timeout: 15_000 })
  const stateText = await page.evaluate(() => window.render_game_to_text())
  const state = JSON.parse(stateText)
  check(state.biome === biome, `Expected biome ${biome}, received ${state.biome}`)
  check(state.bike === bike, `Expected bike ${bike}, received ${state.bike}`)
  check(Number.isFinite(state.rider?.speedKph), `Non-finite speed for ${biome}/${bike}`)
}

try {
  await page.goto(`${baseUrl}/?seed=0&biome=coast&bike=scooter`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('heading', { name: /Ride the horizon/i }).waitFor()
  check(new URL(page.url()).searchParams.get('seed') === '0', 'Shared seed 0 was not preserved')

  for (const biome of ['Coast', 'Alpine', 'Desert']) {
    const choice = page.getByRole('button', { name: new RegExp(`^${biome}`) })
    await choice.click()
    check(await choice.getAttribute('aria-pressed') === 'true', `${biome} selection was not announced`)
  }
  for (const bike of ['Scooter', 'Sport Bike', 'V-Twin Cruiser']) {
    const choice = page.getByRole('button', { name: new RegExp(`^${bike}`) })
    await choice.click()
    check(await choice.getAttribute('aria-pressed') === 'true', `${bike} selection was not announced`)
  }

  const matrix = [
    ['coast', 'scooter'],
    ['alpine', 'sport'],
    ['desert', 'cruiser'],
  ]
  for (const [biome, bike] of matrix) await openRoute(biome, bike)
  console.log('[browser-smoke] route matrix ready')

  const autoBefore = JSON.parse(await page.evaluate(() => window.render_game_to_text()))
  const controlHints = await page.getByRole('complementary', { name: 'Keyboard controls' }).innerText()
  check(['↑', '↓', '←', '→'].every((arrow) => controlHints.includes(arrow)), 'Arrow-key marks are missing from the control HUD')
  check(autoBefore.mode === 'auto-ride' && autoBefore.autoRide === true, 'Auto ride did not start as the selected control mode')
  await page.evaluate(() => window.advanceTime(45_000))
  const autoAfter = JSON.parse(await page.evaluate(() => window.render_game_to_text()))
  check(autoAfter.rider?.speedKph >= 35 && autoAfter.rider?.speedKph <= 70, `Auto cruise left its calm speed band: ${autoAfter.rider?.speedKph}`)
  check(Math.abs(autoAfter.rider?.laneOffset ?? 99) < 2.4, `Auto ride drifted away from the road centre: ${autoAfter.rider?.laneOffset}`)
  console.log('[browser-smoke] auto cruise verified')

  await page.keyboard.down('w')
  await page.waitForTimeout(850)
  await page.keyboard.up('w')
  const moving = JSON.parse(await page.evaluate(() => window.render_game_to_text()))
  check(moving.rider?.speedKph > 0, 'Keyboard acceleration did not move the motorcycle')

  await page.keyboard.press('c')
  await page.getByRole('button', { name: 'Open ride settings', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: /Ride settings/i })
  await dialog.waitFor()
  check(await dialog.getByRole('button', { name: /Cockpit|Chase|Wide chase/ }).count() >= 3, 'Camera controls are missing')
  check(await dialog.getByRole('slider').first().isDisabled(), 'Sound sliders should stay disabled while audio is off')
  await dialog.getByRole('button', { name: /^Manual:/ }).click()
  await dialog.getByRole('button', { name: 'Close settings' }).click()

  await page.keyboard.press('r')
  await page.waitForTimeout(350)
  await page.locator('.game-canvas-wrap[data-ready="true"]').waitFor({ state: 'visible', timeout: 30_000 })
  await page.keyboard.down('d')
  await page.waitForTimeout(80)
  await page.evaluate(() => window.advanceTime(2_500))
  const rightTurn = JSON.parse(await page.evaluate(() => window.render_game_to_text()))
  await page.keyboard.up('d')
  check(rightTurn.rider?.steering > 0, `D did not produce right steering: ${rightTurn.rider?.steering}`)
  check(rightTurn.rider?.screenRollRadians < 0, `D did not visibly bank right: ${rightTurn.rider?.screenRollRadians}`)

  await page.keyboard.press('r')
  await page.waitForTimeout(350)
  await page.locator('.game-canvas-wrap[data-ready="true"]').waitFor({ state: 'visible', timeout: 30_000 })
  await page.keyboard.down('a')
  await page.waitForTimeout(80)
  await page.evaluate(() => window.advanceTime(2_500))
  const leftTurn = JSON.parse(await page.evaluate(() => window.render_game_to_text()))
  await page.keyboard.up('a')
  check(leftTurn.rider?.steering < 0, `A did not produce left steering: ${leftTurn.rider?.steering}`)
  check(leftTurn.rider?.screenRollRadians > 0, `A did not visibly bank left: ${leftTurn.rider?.screenRollRadians}`)
  console.log('[browser-smoke] mirrored steering verified')

  await page.keyboard.press('r')
  await page.waitForTimeout(350)
  await page.locator('.game-canvas-wrap[data-ready="true"]').waitFor({ state: 'visible', timeout: 30_000 })
  await page.keyboard.down('d')
  await page.waitForTimeout(80)
  await page.evaluate(() => window.advanceTime(30_000))
  const edgeHeld = JSON.parse(await page.evaluate(() => window.render_game_to_text()))
  await page.keyboard.up('d')
  check(Math.abs(edgeHeld.rider?.laneOffset ?? 99) <= 5.41, `Road containment failed under held steering: ${edgeHeld.rider?.laneOffset}`)
  console.log('[browser-smoke] road containment verified')

  await page.keyboard.press('m')
  await page.waitForTimeout(80)
  const restoredAuto = JSON.parse(await page.evaluate(() => window.render_game_to_text()))
  check(restoredAuto.mode === 'auto-ride', 'M did not restore auto ride')

  await page.keyboard.press('p')
  const pauseDialog = page.getByRole('dialog', { name: /Ride paused/i })
  await pauseDialog.waitFor()
  await pauseDialog.getByRole('button', { name: /Resume ride/i }).click()
  console.log('[browser-smoke] pause flow verified')

  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
  const mobilePage = await mobileContext.newPage()
  mobilePage.on('pageerror', (error) => consoleErrors.push(error.message))
  mobilePage.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()) })
  await mobilePage.goto(`${baseUrl}/?seed=441&biome=coast&bike=scooter`, { waitUntil: 'domcontentloaded' })
  await mobilePage.getByRole('button', { name: /^Begin ride/ }).click()
  await mobilePage.locator('.app[data-started="true"] canvas').waitFor({ state: 'visible', timeout: 15_000 })
  const touchVisible = await mobilePage.getByRole('button', { name: 'Accelerate' }).isVisible()
  check(touchVisible, 'Touch controls are not visible in mobile portrait')
  check((await mobilePage.getByRole('button', { name: 'Steer left' }).boundingBox())?.width >= 44, 'Touch target is below 44 px')

  await mobilePage.reload({ waitUntil: 'domcontentloaded' })
  check(await mobilePage.getByRole('button', { name: /^Begin ride/ }).isVisible(), 'Reload did not recover the launch state')
  await mobileContext.close()
  console.log('[browser-smoke] mobile flow verified')
} finally {
  await browser.close()
}

const uniqueConsoleErrors = [...new Set(consoleErrors)].filter((message) => !message.includes('favicon'))
if (uniqueConsoleErrors.length) failures.push(`Browser console errors: ${uniqueConsoleErrors.join(' | ')}`)

if (failures.length) {
  console.error(JSON.stringify({ validation: 'failed', failures }, null, 2))
  process.exitCode = 1
} else {
  console.log(JSON.stringify({ validation: 'passed', routes: 3, selections: 6, autoRide: true, mirroredSteering: true, roadContainment: true, mobile: true, audioDefaultOff: true }, null, 2))
}
