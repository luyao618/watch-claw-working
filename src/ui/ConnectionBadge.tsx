/**
 * ConnectionBadge — displays the current connection status.
 */

import type { ConnectionStatus } from '@/connection/connectionManager.ts'

interface ConnectionBadgeProps {
  status: ConnectionStatus
}

const STATUS_CONFIG: Record<
  ConnectionStatus,
  { color: string; label: string; pulse: boolean }
> = {
  live: { color: '#22c55e', label: 'Live', pulse: false },
  connecting: { color: '#3b82f6', label: 'Connecting...', pulse: true },
  disconnected: { color: '#ef4444', label: 'Disconnected', pulse: false },
}

export default function ConnectionBadge({ status }: ConnectionBadgeProps) {
  const config = STATUS_CONFIG[status]

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '4px 10px',
        borderRadius: '12px',
        backgroundColor: '#2a2a4a',
        fontSize: '11px',
        fontFamily: 'monospace',
        color: '#e0e0e0',
      }}
    >
      <span
        style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: config.color,
          display: 'inline-block',
          animation: config.pulse ? 'pulse 1.5s ease-in-out infinite' : 'none',
        }}
      />
      <span>{config.label}</span>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  )
}
