/**
 * App — Root component that wires Connection and UI together.
 *
 * End-to-end flow (v1.0):
 *   ConnectionManager → CharacterAction → [EventBridge (T3.1)] → Phaser HouseScene
 */

import { useState, useEffect, useRef } from 'react'
import { PhaserContainer } from '@/ui/PhaserContainer.tsx'
import type { PhaserContainerHandle } from '@/ui/PhaserContainer.tsx'
import { Dashboard } from '@/ui'
import { ConnectionManager } from '@/connection/connectionManager.ts'
import type { SessionLogEvent } from '@/connection/types.ts'
import type {
  ConnectionStatus,
  SessionInfo,
} from '@/connection/connectionManager.ts'

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

  const connectionRef = useRef<ConnectionManager | null>(null)
  const phaserRef = useRef<PhaserContainerHandle>(null)

  // Initialize ConnectionManager
  useEffect(() => {
    const cm = new ConnectionManager()
    connectionRef.current = cm

    // Handle character actions — will be wired to Phaser in T3.1
    cm.onAction((_action) => {
      // TODO (T3.1): dispatch action to Phaser HouseScene via EventBridge
    })

    // Handle connection status changes
    cm.onStatusChange((status) => {
      setConnectionStatus(status)
    })

    // Handle raw events for activity log
    cm.onEventLog((event) => {
      setEvents((prev) => {
        const next = [...prev, event]
        return next.length > 100 ? next.slice(-100) : next
      })
    })

    // Start connection
    cm.connect()

    return () => {
      cm.disconnect()
      connectionRef.current = null
    }
  }, [])

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
      <PhaserContainer ref={phaserRef} />

      {/* Dashboard */}
      <Dashboard
        connectionStatus={connectionStatus}
        sessionInfo={sessionInfo}
        events={events}
        fps={0} // TODO (T4.1): wire Phaser's actual FPS via React bridge
        visible={showDashboard}
      />
    </div>
  )
}

export default App
