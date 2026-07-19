import { chromium as playwrightChromium } from '../node_modules/playwright/index.mjs'

const executablePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'

export const chromium = {
  launch(options = {}) {
    return playwrightChromium.launch({ ...options, executablePath })
  },
}
