/**
 * Wait for Vite dev server to be ready, then launch Electron.
 */
const { execSync, spawn } = require('node:child_process')
const http = require('node:http')

const VITE_URL = 'http://localhost:5173'
const MAX_WAIT_MS = 30000
const POLL_INTERVAL_MS = 500

function checkVite() {
  return new Promise((resolve) => {
    http
      .get(VITE_URL, (res) => {
        resolve(res.statusCode === 200)
      })
      .on('error', () => {
        resolve(false)
      })
  })
}

async function waitForVite() {
  const start = Date.now()
  console.log('[electron] Waiting for Vite dev server...')

  while (Date.now() - start < MAX_WAIT_MS) {
    if (await checkVite()) {
      console.log('[electron] Vite is ready, launching Electron...')
      return true
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
  }

  console.error('[electron] Timed out waiting for Vite')
  return false
}

async function main() {
  const ready = await waitForVite()
  if (!ready) process.exit(1)

  // Launch Electron
  const electronBin = require('electron')
  const electronProcess = spawn(electronBin, ['.'], {
    stdio: 'inherit',
    env: { ...process.env },
  })

  electronProcess.on('exit', (code) => {
    process.exit(code || 0)
  })
}

main()
