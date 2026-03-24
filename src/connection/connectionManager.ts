/**
 * Connection Manager — coordinates Bridge Client connection.
 *
 * Connects to the Bridge Server. If it fails, keeps retrying
 * with exponential backoff. Never generates fake data.
 */

import { BridgeClient } from './bridgeClient.ts'
import { parseSessionLogEvent } from './eventParser.ts'
import { ActionQueue } from './actionQueue.ts'
import type {
  SessionLogEvent,
  CharacterAction,
  ConnectionState,
  TokenUsage,
} from './types.ts'
import { BRIDGE_WS_URL } from '@/utils/constants.ts'

export type ConnectionStatus = 'live' | 'connecting' | 'disconnected'

export interface SessionInfo {
  model: string | null
  provider: string | null
  sessionId: string | null
  totalTokens: number
  totalCost: number
}

type ActionHandler = (action: CharacterAction) => void
type StatusHandler = (status: ConnectionStatus) => void
type EventLogHandler = (event: SessionLogEvent) => void

export class ConnectionManager {
  private bridgeClient: BridgeClient
  private actionQueue: ActionQueue

  private _status: ConnectionStatus = 'disconnected'
  private actionHandlers = new Set<ActionHandler>()
  private statusHandlers = new Set<StatusHandler>()
  private eventLogHandlers = new Set<EventLogHandler>()

  private bridgeUnsub: (() => void) | null = null
  private stateUnsub: (() => void) | null = null
  private sessionSwitchUnsub: (() => void) | null = null

  private sessionInfo: SessionInfo = {
    model: null,
    provider: null,
    sessionId: null,
    totalTokens: 0,
    totalCost: 0,
  }

  // Track last usage for dashboard
  private lastUsage: TokenUsage | null = null

  constructor(url?: string) {
    this.bridgeClient = new BridgeClient({ url: url ?? BRIDGE_WS_URL })
    this.actionQueue = new ActionQueue()
  }

  // ── Public API ──────────────────────────────────────────────────────────

  get status(): ConnectionStatus {
    return this._status
  }

  get session(): SessionInfo {
    return { ...this.sessionInfo }
  }

  get usage(): TokenUsage | null {
    return this.lastUsage
  }

  get queue(): ActionQueue {
    return this.actionQueue
  }

  connect(): void {
    this.setStatus('connecting')

    // Subscribe to bridge events
    this.bridgeUnsub = this.bridgeClient.onEvent((event) => {
      this.handleEvent(event)
    })

    // Subscribe to bridge state changes
    this.stateUnsub = this.bridgeClient.onStateChange((state) => {
      this.handleBridgeStateChange(state)
    })

    // Subscribe to session switch events
    this.sessionSwitchUnsub = this.bridgeClient.onSessionSwitch(() => {
      this.handleSessionSwitch()
    })

    // Try to connect to bridge
    this.bridgeClient.connect()
  }

  disconnect(): void {
    this.bridgeClient.disconnect()
    if (this.bridgeUnsub) {
      this.bridgeUnsub()
      this.bridgeUnsub = null
    }
    if (this.stateUnsub) {
      this.stateUnsub()
      this.stateUnsub = null
    }
    if (this.sessionSwitchUnsub) {
      this.sessionSwitchUnsub()
      this.sessionSwitchUnsub = null
    }
    this.setStatus('disconnected')
  }

  /**
   * Register a handler for CharacterActions produced by event parsing.
   */
  onAction(handler: ActionHandler): () => void {
    this.actionHandlers.add(handler)
    return () => this.actionHandlers.delete(handler)
  }

  /**
   * Register a handler for connection status changes.
   */
  onStatusChange(handler: StatusHandler): () => void {
    this.statusHandlers.add(handler)
    return () => this.statusHandlers.delete(handler)
  }

  /**
   * Register a handler for all raw events (for activity log display).
   */
  onEventLog(handler: EventLogHandler): () => void {
    this.eventLogHandlers.add(handler)
    return () => this.eventLogHandlers.delete(handler)
  }

  // ── Private ─────────────────────────────────────────────────────────────

  private handleEvent(event: SessionLogEvent): void {
    // Notify event log handlers
    for (const handler of this.eventLogHandlers) {
      try {
        handler(event)
      } catch (e) {
        console.error('[ConnectionManager] Event log handler error:', e)
      }
    }

    // Extract session info
    this.extractSessionInfo(event)

    // Parse event into character action
    const action = parseSessionLogEvent(event)
    if (action) {
      this.dispatchAction(action)
    }
  }

  private extractSessionInfo(event: SessionLogEvent): void {
    if (event.type === 'session') {
      this.sessionInfo.sessionId = event.id
    }

    if (event.type === 'model_change') {
      this.sessionInfo.model = event.modelId
      this.sessionInfo.provider = event.provider
    }

    if (event.type === 'message' && event.message.role === 'assistant') {
      const msg = event.message
      if (msg.usage) {
        this.lastUsage = msg.usage
        this.sessionInfo.totalTokens += msg.usage.totalTokens
        this.sessionInfo.totalCost += msg.usage.cost.total
      }
      if (msg.model) {
        this.sessionInfo.model = msg.model
      }
      if (msg.provider) {
        this.sessionInfo.provider = msg.provider
      }
    }
  }

  private dispatchAction(action: CharacterAction): void {
    for (const handler of this.actionHandlers) {
      try {
        handler(action)
      } catch (e) {
        console.error('[ConnectionManager] Action handler error:', e)
      }
    }
  }

  private handleBridgeStateChange(state: ConnectionState): void {
    switch (state) {
      case 'connected':
        console.log('[ConnectionManager] Bridge connected (live mode)')
        this.setStatus('live')
        break

      case 'connecting':
        if (this._status !== 'live') {
          this.setStatus('connecting')
        }
        break

      case 'reconnecting':
        // Stay in connecting status while reconnecting
        if (this._status === 'live') {
          this.setStatus('connecting')
        }
        break

      case 'disconnected':
        this.setStatus('disconnected')
        break
    }
  }

  /**
   * Handle session switch — reset character to bedroom/sleeping.
   */
  private handleSessionSwitch(): void {
    console.log(
      '[ConnectionManager] Session switch detected — resetting character',
    )
    this.dispatchAction({ type: 'RESET' })
  }

  private setStatus(status: ConnectionStatus): void {
    if (this._status === status) return
    this._status = status

    for (const handler of this.statusHandlers) {
      try {
        handler(status)
      } catch (e) {
        console.error('[ConnectionManager] Status handler error:', e)
      }
    }
  }
}
