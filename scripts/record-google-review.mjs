import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const TARGET_URL = process.env.RECORD_URL || 'https://spineviewer.saltytail.dev/'
const OUTPUT_DIR = path.resolve('artifacts/google-review')
const VIEWPORT = { width: 1280, height: 720 }
const RECORD_SECONDS = Number(process.env.RECORD_SECONDS || 60)
const LOCALE = 'en-US'

await mkdir(OUTPUT_DIR, { recursive: true })

const browser = await chromium.launch({
  headless: false,
  channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
  args: [
    '--disable-blink-features=AutomationControlled',
    `--lang=${LOCALE}`,
  ],
})

const context = await browser.newContext({
  viewport: VIEWPORT,
  locale: LOCALE,
  timezoneId: 'Asia/Taipei',
  extraHTTPHeaders: {
    'Accept-Language': 'en-US,en;q=0.9',
  },
  recordVideo: {
    dir: OUTPUT_DIR,
    size: VIEWPORT,
  },
})

const page = await context.newPage()

try {
  console.log(`Opening ${TARGET_URL}`)
  await page.goto(TARGET_URL, { waitUntil: 'networkidle' })

  console.log('Recording started. The browser locale is forced to en-US.')
  console.log('If the Google consent screen still appears in Chinese, use the language selector at the lower-left of the consent screen and choose English.')
  await page.waitForTimeout(3_000)

  const driveButton = page.getByRole('button', { name: /drive/i }).first()
  await driveButton.click()

  console.log(`You now have ${RECORD_SECONDS} seconds to complete Google sign-in, OAuth consent, Drive browsing, file selection, and preview loading.`)
  await page.waitForTimeout(RECORD_SECONDS * 1000)
} finally {
  await context.close()
  await browser.close()
}

console.log(`Recording saved under: ${OUTPUT_DIR}`)
console.log('Playwright writes .webm files. Convert to .mp4 only if Google upload rejects WebM.')
