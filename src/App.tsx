/**
 * App — Root component that wires Connection and UI together.
 *
 * [T3.1] ConnectionManager → EventBridge → Phaser HouseScene
 * [T4.1] Phaser → React dashboard bridge via gameEventBus
 */

import { useState, useEffect, useRef, useMemo } from 'react'
import { PhaserContainer } from '@/ui/PhaserContainer.tsx'
import type { PhaserContainerHandle } from '@/ui/PhaserContainer.tsx'
import { Dashboard } from '@/ui'
import { ConnectionManager } from '@/connection/connectionManager.ts'
import type { SessionLogEvent } from '@/connection/types.ts'
import type {
  ConnectionStatus,
  SessionInfo,
} from '@/connection/connectionManager.ts'
import { gameEventBus } from '@/game/scenes/HouseScene.ts'

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
  const [showDashboard, setShowDashboard] = useState(true)

  // Character state from Phaser (T4.1)
  const [characterState, setCharacterState] = useState('idle')
  const [currentRoom, setCurrentRoom] = useState<string>('\u2014')
  const [currentEmotion, setCurrentEmotion] = useState<string>('\u2014')
  const [fps, setFps] = useState(0)

  const phaserRef = useRef<PhaserContainerHandle>(null)

  // Create ConnectionManager once (stable reference)
  const cm = useMemo(() => new ConnectionManager(), [])

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
      {/* Phaser Game Area */}
      <PhaserContainer ref={phaserRef} connectionManager={cm} />

      {/* Dashboard */}
      <Dashboard
        connectionStatus={connectionStatus}
        sessionInfo={sessionInfo}
        events={events}
        fps={fps}
        visible={showDashboard}
        characterState={characterState}
        currentRoom={currentRoom}
        currentEmotion={currentEmotion}
      />
    </div>
  )
}

export default App
