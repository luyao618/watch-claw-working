/**
 * App — Root component that wires Connection, Engine, and UI together.
 *
 * End-to-end flow:
 *   ConnectionManager → CharacterAction → Character FSM → GameLoop → Renderer → Canvas
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { CanvasView, Dashboard, ZoomControls } from '@/ui'
import { ConnectionManager } from '@/connection/connectionManager.ts'
import type { SessionLogEvent } from '@/connection/types.ts'
import type {
  ConnectionStatus,
  SessionInfo,
} from '@/connection/connectionManager.ts'
import {
  createInitialCharacterState,
  createInitialCameraState,
  createInitialConnectionInfo,
  createInitialDebugState,
  TileType,
} from '@/engine/gameState.ts'
import type { GameState, WorldState } from '@/engine/gameState.ts'
import { queueAction } from '@/engine/character.ts'
import {
  FLOOR_LAYOUT,
  MAP_COLS,
  MAP_ROWS,
  ROOMS,
  ALL_FURNITURE,
  buildWalkabilityGrid,
  preloadAllSprites,
} from '@/world'

// ── Build World State ───────────────────────────────────────────────────────

function buildWorldState(): WorldState {
  const tiles = FLOOR_LAYOUT
  const walkabilityGrid = buildWalkabilityGrid(tiles, ALL_FURNITURE)

  // Extract wall positions for 3D rendering
  const walls: WorldState['walls'] = []
  for (let row = 0; row < tiles.length; row++) {
    for (let col = 0; col < tiles[row].length; col++) {
      if (tiles[row][col] === TileType.WALL) {
        // Determine wall type
        const wallType = col < MAP_COLS / 2 ? 'front' : 'side'
        walls.push({ col, row, wallType })
      }
    }
  }

  return {
    width: MAP_COLS,
    height: MAP_ROWS,
    tiles,
    walkabilityGrid,
    rooms: ROOMS,
    furniture: ALL_FURNITURE,
    walls,
  }
}

// ── App Component ───────────────────────────────────────────────────────────

function App() {
  // Game state (stable reference — mutated imperatively by engine)
  const gameState = useMemo<GameState>(() => {
    const world = buildWorldState()
    return {
      character: createInitialCharacterState(),
      world,
      camera: createInitialCameraState(),
      connection: createInitialConnectionInfo(),
      debug: createInitialDebugState(),
    }
  }, [])

  // React state for UI updates (throttled)
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>('connecting')
  const [sessionInfo, setSessionInfo] = useState<SessionInfo>({
    model: null,
    provider: null,
    sessionId: null,
    totalTokens: 0,
    totalCost: 0,
  })
  const [events, setEvents] = useState<SessionLogEvent[]>([])
  const [fps, setFps] = useState(0)
  const [showDashboard, setShowDashboard] = useState(true)
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 })

  const connectionRef = useRef<ConnectionManager | null>(null)

  // Preload sprite assets
  useEffect(() => {
    preloadAllSprites()
  }, [])

  // Initialize ConnectionManager
  useEffect(() => {
    const cm = new ConnectionManager()
    connectionRef.current = cm

    // Handle character actions
    cm.onAction((action) => {
      queueAction(gameState.character, action)
    })

    // Handle connection status changes
    cm.onStatusChange((status) => {
      setConnectionStatus(status)
      gameState.connection.status = status
    })

    // Handle raw events for activity log
    cm.onEventLog((event) => {
      setEvents((prev) => {
        const next = [...prev, event]
        return next.length > 100 ? next.slice(-100) : next
      })
      gameState.connection.lastEventTime = Date.now()
    })

    // Start connection
    cm.connect()

    return () => {
      cm.disconnect()
      connectionRef.current = null
    }
  }, [gameState])

  // Update session info periodically
  useEffect(() => {
    const id = setInterval(() => {
      if (connectionRef.current) {
        setSessionInfo(connectionRef.current.session)
      }
    }, 500)
    return () => clearInterval(id)
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Don't handle if typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return

      switch (e.key.toLowerCase()) {
        case 'd':
          setShowDashboard((prev) => !prev)
          gameState.debug.showDashboard = !gameState.debug.showDashboard
          break
        case 'g':
          gameState.debug.showGrid = !gameState.debug.showGrid
          break
        case 'f':
          gameState.debug.showFps = !gameState.debug.showFps
          break
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [gameState])

  // Track canvas size for zoom controls
  const canvasContainerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = canvasContainerRef.current
    if (!el) return

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setCanvasSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        })
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const handleFpsUpdate = useCallback((newFps: number) => {
    setFps(newFps)
  }, [])

  return (
    <div
      id="app"
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'row',
        overflow: 'hidden',
      }}
    >
      {/* Canvas Area */}
      <div
        ref={canvasContainerRef}
        style={{ flex: 1, position: 'relative', overflow: 'hidden' }}
      >
        <CanvasView gameState={gameState} onFpsUpdate={handleFpsUpdate} />
        <ZoomControls
          camera={gameState.camera}
          mapCols={MAP_COLS}
          mapRows={MAP_ROWS}
          canvasWidth={canvasSize.width}
          canvasHeight={canvasSize.height}
        />
      </div>

      {/* Dashboard */}
      <Dashboard
        connectionStatus={connectionStatus}
        sessionInfo={sessionInfo}
        character={gameState.character}
        events={events}
        fps={fps}
        visible={showDashboard}
      />
    </div>
  )
}

export default App
