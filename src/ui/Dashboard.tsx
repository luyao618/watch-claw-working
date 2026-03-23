/**
 * Dashboard — side panel showing connection status, agent state, token usage, and activity log.
 */

import { useState, useEffect, useRef } from 'react'
import ConnectionBadge from './ConnectionBadge.tsx'
import type {
  ConnectionStatus,
  SessionInfo,
} from '@/connection/connectionManager.ts'
import type {
  SessionLogEvent,
  MessageEvent as MsgEvent,
} from '@/connection/types.ts'
import type { CharacterState } from '@/engine/gameState.ts'

interface DashboardProps {
  connectionStatus: ConnectionStatus
  sessionInfo: SessionInfo
  character: CharacterState
  events: SessionLogEvent[]
  fps: number
  visible: boolean
}

// ── Helper to format event for log ──────────────────────────────────────────

function formatEvent(event: SessionLogEvent): string {
  const time = new Date(event.timestamp).toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

  if (event.type === 'session') return `${time}  [session] started`
  if (event.type === 'model_change') return `${time}  [model] ${event.modelId}`

  if (event.type === 'message') {
    const msg = (event as MsgEvent).message
    if (msg.role === 'user') {
      const text =
        typeof msg.content === 'string' ? msg.content.slice(0, 30) : '[message]'
      return `${time}  [user] ${text}`
    }
    if (msg.role === 'assistant') {
      if (Array.isArray(msg.content)) {
        const toolCall = msg.content.find((c) => c.type === 'toolCall')
        if (toolCall && toolCall.type === 'toolCall') {
          return `${time}  ${toolCall.name}`
        }
        const hasThinking = msg.content.some((c) => c.type === 'thinking')
        if (hasThinking) return `${time}  [thinking]`
      }
      if (msg.stopReason === 'stop') return `${time}  [done]`
      return `${time}  [assistant]`
    }
    if (msg.role === 'toolResult') {
      return `${time}  [result] ${msg.toolName}`
    }
  }

  return `${time}  [${event.type}]`
}

// ── State Label ─────────────────────────────────────────────────────────────

function getStateLabel(state: string): string {
  const labels: Record<string, string> = {
    idle: 'Idle',
    walking: 'Walking',
    typing: 'Working',
    sitting: 'Reading',
    sleeping: 'Sleeping',
    thinking: 'Thinking',
    celebrating: 'Celebrating!',
  }
  return labels[state] ?? state
}

function getStateColor(state: string): string {
  const colors: Record<string, string> = {
    idle: '#6b7280',
    walking: '#3b82f6',
    typing: '#22c55e',
    sitting: '#a855f7',
    sleeping: '#6b7280',
    thinking: '#f59e0b',
    celebrating: '#ef4444',
  }
  return colors[state] ?? '#888'
}

// ── Component ───────────────────────────────────────────────────────────────

export default function Dashboard({
  connectionStatus,
  sessionInfo,
  character,
  events,
  fps,
  visible,
}: DashboardProps) {
  const logRef = useRef<HTMLDivElement>(null)
  const [, forceUpdate] = useState(0)

  // Auto-scroll log
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [events.length])

  // Force periodic re-render for live data
  useEffect(() => {
    const intervalId = setInterval(() => {
      forceUpdate((n) => n + 1)
    }, 250)
    return () => clearInterval(intervalId)
  }, [])

  if (!visible) return null

  const recentEvents = events.slice(-30)

  return (
    <div
      style={{
        width: '280px',
        height: '100%',
        backgroundColor: '#1e1e3a',
        borderLeft: '1px solid #3a3a5a',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#c0c0d0',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '10px 12px',
          borderBottom: '1px solid #3a3a5a',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span style={{ fontWeight: 'bold', fontSize: '12px' }}>Dashboard</span>
        <ConnectionBadge status={connectionStatus} />
      </div>

      {/* Agent Status */}
      <Section title="Agent Status">
        <Row label="State">
          <span style={{ color: getStateColor(character.state) }}>
            {getStateLabel(character.state)}
          </span>
        </Row>
        <Row label="Room">{character.currentRoom}</Row>
        <Row label="Emotion">{character.emotion}</Row>
        <Row label="Animation">{character.currentAnimation}</Row>
        <Row label="FPS">{fps}</Row>
      </Section>

      {/* Session Info */}
      <Section title="Session">
        <Row label="Model">{sessionInfo.model ?? '—'}</Row>
        <Row label="Provider">{sessionInfo.provider ?? '—'}</Row>
        <Row label="Session">{sessionInfo.sessionId?.slice(0, 8) ?? '—'}</Row>
      </Section>

      {/* Token Usage */}
      <Section title="Token Usage">
        <Row label="Total Tokens">
          {sessionInfo.totalTokens.toLocaleString()}
        </Row>
        <Row label="Total Cost">${sessionInfo.totalCost.toFixed(4)}</Row>
        <div
          style={{
            marginTop: '4px',
            height: '4px',
            backgroundColor: '#2a2a4a',
            borderRadius: '2px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${Math.min(100, (sessionInfo.totalTokens / 100000) * 100)}%`,
              backgroundColor: '#4a9eff',
              borderRadius: '2px',
              transition: 'width 0.3s',
            }}
          />
        </div>
      </Section>

      {/* Activity Log */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
        }}
      >
        <div
          style={{
            padding: '8px 12px 4px',
            fontSize: '10px',
            color: '#888',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}
        >
          Activity Log
        </div>
        <div
          ref={logRef}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '0 12px 8px',
            fontSize: '10px',
            lineHeight: '1.6',
          }}
        >
          {recentEvents.map((event, i) => (
            <div
              key={`${event.id}-${i}`}
              style={{ color: '#9090a0', whiteSpace: 'nowrap' }}
            >
              {formatEvent(event)}
            </div>
          ))}
          {recentEvents.length === 0 && (
            <div style={{ color: '#555', fontStyle: 'italic' }}>
              No events yet...
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────────

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div
      style={{
        padding: '8px 12px',
        borderBottom: '1px solid #2a2a4a',
      }}
    >
      <div
        style={{
          fontSize: '10px',
          color: '#888',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          marginBottom: '6px',
        }}
      >
        {title}
      </div>
      {children}
    </div>
  )
}

function Row({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '1px 0',
      }}
    >
      <span style={{ color: '#777' }}>{label}</span>
      <span>{children}</span>
    </div>
  )
}
