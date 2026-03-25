/**
 * Electron Main Process
 *
 * Creates the application window and manages the Bridge Server lifecycle.
 * Written as CommonJS for Electron compatibility.
 */

const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  nativeImage,
  shell,
  ipcMain,
} = require('electron')
const { fork } = require('node:child_process')
const { resolve, join } = require('node:path')
const { existsSync } = require('node:fs')

// ── Configuration ────────────────────────────────────────────────────────────

const isDev = !app.isPackaged
const VITE_DEV_URL = 'http://localhost:5173'
const DEFAULT_WIDTH = 800
const DEFAULT_HEIGHT = 600

// ── State ────────────────────────────────────────────────────────────────────

let mainWindow = null
let tray = null
let bridgeProcess = null
let isQuitting = false

// ── Window Management ────────────────────────────────────────────────────────

function createWindow() {
  mainWindow = new BrowserWindow({
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
    minWidth: 800,
    minHeight: 600,
    title: 'Watch Claw',
    backgroundColor: '#1a1a2e',
    webPreferences: {
      preload: resolve(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  })

  // Load the app
  if (isDev) {
    mainWindow.loadURL(VITE_DEV_URL)
  } else {
    const indexPath = join(__dirname, '..', 'dist', 'index.html')
    mainWindow.loadFile(indexPath)
  }

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  // Handle close — hide to tray instead of quitting
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault()
      mainWindow.hide()
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
}

// ── Tray ─────────────────────────────────────────────────────────────────────

function createTray() {
  // Use a 16x16 icon or empty
  const icon = nativeImage.createEmpty()
  tray = new Tray(icon)

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Watch Claw',
      click: () => {
        if (mainWindow) {
          mainWindow.show()
          mainWindow.focus()
        } else {
          createWindow()
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Always on Top',
      type: 'checkbox',
      checked: false,
      click: (menuItem) => {
        if (mainWindow) mainWindow.setAlwaysOnTop(menuItem.checked)
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true
        app.quit()
      },
    },
  ])

  tray.setToolTip('Watch Claw')
  tray.setContextMenu(contextMenu)

  tray.on('click', () => {
    if (mainWindow && mainWindow.isVisible()) {
      mainWindow.hide()
    } else if (mainWindow) {
      mainWindow.show()
      mainWindow.focus()
    }
  })
}

// ── Bridge Server ────────────────────────────────────────────────────────────

function startBridgeServer() {
  const projectRoot = resolve(__dirname, '..')

  if (isDev) {
    // Dev mode: use tsx to run TypeScript directly
    const bridgeScript = resolve(projectRoot, 'bridge', 'server.ts')
    const tsxBin = resolve(projectRoot, 'node_modules', '.bin', 'tsx')

    if (!existsSync(tsxBin)) {
      console.warn('[electron] tsx not found, Bridge Server not started')
      return
    }

    try {
      bridgeProcess = fork(bridgeScript, [], {
        execPath: tsxBin,
        stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
        cwd: projectRoot,
      })
    } catch (e) {
      console.error('[electron] Failed to start Bridge Server:', e)
      return
    }
  } else {
    // Production: bridge/server.js should be pre-compiled
    const bridgeScript = resolve(projectRoot, 'bridge', 'server.js')
    if (!existsSync(bridgeScript)) {
      console.warn('[electron] Compiled bridge/server.js not found, trying .ts with tsx')
      // Fallback: try tsx anyway (for portable builds that include node_modules)
      const tsxBin = resolve(projectRoot, 'node_modules', '.bin', 'tsx')
      const tsScript = resolve(projectRoot, 'bridge', 'server.ts')
      if (existsSync(tsxBin) && existsSync(tsScript)) {
        bridgeProcess = fork(tsScript, [], {
          execPath: tsxBin,
          stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
          cwd: projectRoot,
        })
      } else {
        console.error('[electron] Cannot start Bridge Server in production')
        return
      }
    } else {
      bridgeProcess = fork(bridgeScript, [], {
        stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
        cwd: projectRoot,
      })
    }
  }

  if (bridgeProcess) {

    bridgeProcess.stdout.on('data', (data) => {
      process.stdout.write(`[bridge] ${data}`)
    })

    bridgeProcess.stderr.on('data', (data) => {
      process.stderr.write(`[bridge] ${data}`)
    })

    bridgeProcess.on('exit', (code) => {
      console.log(`[electron] Bridge Server exited with code ${code}`)
      bridgeProcess = null
    })

    console.log('[electron] Bridge Server started')
  }
}

function stopBridgeServer() {
  if (bridgeProcess) {
    bridgeProcess.kill('SIGTERM')
    bridgeProcess = null
    console.log('[electron] Bridge Server stopped')
  }
}

// ── IPC Handlers ─────────────────────────────────────────────────────────────

ipcMain.on('set-always-on-top', (_event, value) => {
  if (mainWindow) mainWindow.setAlwaysOnTop(value)
})

ipcMain.on('close-window', () => {
  if (mainWindow) mainWindow.hide()
})

// ── App Lifecycle ────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  startBridgeServer()
  createWindow()
  createTray()

  app.on('activate', () => {
    if (mainWindow) {
      mainWindow.show()
      mainWindow.focus()
    } else {
      createWindow()
    }
  })
})

app.on('before-quit', () => {
  isQuitting = true
  stopBridgeServer()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
