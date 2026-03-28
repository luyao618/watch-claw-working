/**
 * App — Root component that wires Connection and UI together.
 *
 * [T3.1] ConnectionManager → EventBridge → Phaser HouseScene
 * [T4.1] Phaser → React dashboard bridge via gameEventBus
 * [PWA]  Responsive layout + ServerConfig for mobile
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { PhaserContainer } from '@/ui/PhaserContainer.tsx'
import type { PhaserContainerHandle } from '@/ui/PhaserContainer.tsx'
import { Dashboard } from '@/ui'
import ModeSelector from '@/ui/ModeSelector.tsx'
import type { AppMode } from '@/ui/ModeSelector.tsx'
import ServerConfig from '@/ui/ServerConfig.tsx'
import { getSavedBridgeUrl } from '@/utils/bridgeUrl.ts'
import { ConnectionManager } from '@/connection/connectionManager.ts'
import type { SessionLogEvent } from '@/connection/types.ts'
import type {
  ConnectionStatus,
  SessionInfo,
} from '@/connection/connectionManager.ts'
import { gameEventBus } from '@/game/scenes/HouseScene.ts'

// ── Mobile detection ─────────────────────────────────────────────────────────

const MOBILE_BREAKPOINT = '(max-width: 768px)'

function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(
    () => window.matchMedia(MOBILE_BREAKPOINT).matches,
  )

  useEffect(() => {
    const mql = window.matchMedia(MOBILE_BREAKPOINT)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  return isMobile
}

// ── App Component ───────────────────────────────────────────────────────────

function App() {
  // React state for UI updates
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
  const [showDashboard, setShowDashboard] = useState(
    () => !window.matchMedia(MOBILE_BREAKPOINT).matches,
  )
  const [appMode, setAppMode] = useState<AppMode>('monitor')
  const [showServerConfig, setShowServerConfig] = useState(false)

  // Character state from Phaser (T4.1)
  const [characterState, setCharacterState] = useState('idle')
  const [currentRoom, setCurrentRoom] = useState<string>('\u2014')
  const [currentEmotion, setCurrentEmotion] = useState<string>('\u2014')
  const [fps, setFps] = useState(0)

  const phaserRef = useRef<PhaserContainerHandle>(null)
  const isMobile = useIsMobile()

  // Create ConnectionManager — recreated when URL changes
  const [bridgeUrl, setBridgeUrl] = useState(getSavedBridgeUrl)
  const cm = useMemo(() => new ConnectionManager(bridgeUrl), [bridgeUrl])

  // Initialize ConnectionManager subscriptions and connect
  useEffect(() => {
    // Handle connection status changes
    const unsubStatus = cm.onStatusChange((status) => {
      setConnectionStatus(status)
    })

    // Handle raw events for activity log
    const unsubLog = cm.onEventLog((event) => {
      setEvents((prev) => {
        const next = [...prev, event]
        return next.length > 100 ? next.slice(-100) : next
      })
    })

    // Start connection
    cm.connect()

    return () => {
      unsubStatus()
      unsubLog()
      cm.disconnect()
    }
  }, [cm])

  // Subscribe to Phaser character state changes (T4.1)
  useEffect(() => {
    const unsub = gameEventBus.on('character-state-change', (data) => {
      setCharacterState(data.state)
      setCurrentRoom(data.room ?? '\u2014')
      setCurrentEmotion(data.emotion ?? '\u2014')
    })
    return unsub
  }, [])

  // Update session info and FPS periodically
  useEffect(() => {
    const id = setInterval(() => {
      setSessionInfo(cm.session)
      // Get FPS from Phaser game
      const game = phaserRef.current?.getGame()
      if (game) {
        setFps(Math.round(game.loop.actualFps))
      }
    }, 500)
    return () => clearInterval(id)
  }, [cm])

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
          break
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // Handle URL change from ServerConfig panel
  const handleUrlChange = useCallback((url: string) => {
    setBridgeUrl(url)
    setShowServerConfig(false)
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
        position: 'relative',
      }}
    >
      {/* Left column: mode selector bar + Phaser game */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Mode selector bar — sits above the game canvas */}
        <div
          style={{
            flexShrink: 0,
            backgroundColor: '#12121f',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <ModeSelector
            currentMode={appMode}
            onModeChange={setAppMode}
            isMobile={isMobile}
          />

          {/* Mobile toolbar buttons */}
          {isMobile && (
            <div
              style={{
                display: 'flex',
                gap: '4px',
                padding: '3px 6px',
              }}
            >
              {/* Settings / Server Config button */}
              <button
                onClick={() => setShowServerConfig(true)}
                style={{
                  width: '44px',
                  height: '44px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: 'monospace',
                  fontSize: '16px',
                  backgroundColor: 'rgba(30, 30, 50, 0.5)',
                  color: '#707088',
                  border: '1px solid rgba(50, 50, 70, 0.4)',
                  borderRadius: '0px',
                  cursor: 'pointer',
                }}
                aria-label="Server settings"
              >
                S
              </button>
              {/* Dashboard toggle button */}
              <button
                onClick={() => setShowDashboard((prev) => !prev)}
                style={{
                  width: '44px',
                  height: '44px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: 'monospace',
                  fontSize: '16px',
                  backgroundColor: showDashboard
                    ? 'rgba(60, 120, 200, 0.5)'
                    : 'rgba(30, 30, 50, 0.5)',
                  color: showDashboard ? '#b0c8e8' : '#707088',
                  border: '1px solid',
                  borderColor: showDashboard
                    ? 'rgba(90, 150, 220, 0.5)'
                    : 'rgba(50, 50, 70, 0.4)',
                  borderRadius: '0px',
                  cursor: 'pointer',
                }}
                aria-label="Toggle dashboard"
              >
                D
              </button>
            </div>
          )}
        </div>
        {/* Phaser Game Area */}
        <div style={{ flex: 1, minHeight: 0 }}>
          <PhaserContainer ref={phaserRef} connectionManager={cm} />
        </div>
      </div>

      {/* Dashboard — overlay on mobile, side panel on desktop */}
      <Dashboard
        connectionStatus={connectionStatus}
        sessionInfo={sessionInfo}
        events={events}
        fps={fps}
        visible={showDashboard}
        characterState={characterState}
        currentRoom={currentRoom}
        currentEmotion={currentEmotion}
        isMobile={isMobile}
        onClose={() => setShowDashboard(false)}
        onOpenServerConfig={() => setShowServerConfig(true)}
      />

      {/* Server Config overlay */}
      {showServerConfig && (
        <ServerConfig
          isConnected={connectionStatus === 'live'}
          onUrlChange={handleUrlChange}
          onClose={() => setShowServerConfig(false)}
        />
      )}
    </div>
  )
}

export default App
