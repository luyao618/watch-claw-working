/**
 * Connection Manager — coordinates Bridge Client and Mock Provider.
 *
 * Tries to connect to the Bridge Server first. If it fails or the Bridge
 * is unavailable, falls back to MockProvider. When Bridge reconnects, it
 * seamlessly switches back.
 */

import { BridgeClient } from './bridgeClient.ts'
import { MockProvider } from './mockProvider.ts'
import { parseSessionLogEvent } from './eventParser.ts'
import { ActionQueue } from './actionQueue.ts'
import type {
  SessionLogEvent,
  CharacterAction,
  ConnectionState,
  TokenUsage,
} from './types.ts'
import { BRIDGE_WS_URL } from '@/utils/constants.ts'

export type ConnectionStatus = 'live' | 'mock' | 'connecting' | 'disconnected'

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

const BRIDGE_TIMEOUT_MS = 5000
const MOCK_SWITCH_DELAY_MS = 2000

export class ConnectionManager {
  private bridgeClient: BridgeClient
  private mockProvider: MockProvider
  private actionQueue: ActionQueue

  private _status: ConnectionStatus = 'disconnected'
  private actionHandlers = new Set<ActionHandler>()
  private statusHandlers = new Set<StatusHandler>()
  private eventLogHandlers = new Set<EventLogHandler>()

  private bridgeTimeoutId: ReturnType<typeof setTimeout> | null = null
  private mockSwitchId: ReturnType<typeof setTimeout> | null = null
  private bridgeUnsub: (() => void) | null = null
  private stateUnsub: (() => void) | null = null
  private reconnectAttempts = 0

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
    this.mockProvider = new MockProvider()
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

    // Try to connect to bridge
    this.bridgeClient.connect()

    // Set a timeout — if bridge doesn't connect in time, switch to mock
    this.bridgeTimeoutId = setTimeout(() => {
      this.bridgeTimeoutId = null
      if (!this.bridgeClient.isConnected) {
        this.switchToMock()
      }
    }, BRIDGE_TIMEOUT_MS)
  }

  disconnect(): void {
    this.clearTimers()
    this.bridgeClient.disconnect()
    this.mockProvider.stop()
    if (this.bridgeUnsub) {
      this.bridgeUnsub()
      this.bridgeUnsub = null
    }
    if (this.stateUnsub) {
      this.stateUnsub()
      this.stateUnsub = null
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
        // Bridge connected! If we were in mock, switch to live.
        this.clearTimers()
        if (this.mockProvider.isRunning) {
          this.mockProvider.stop()
        }
        this.reconnectAttempts = 0
        this.setStatus('live')
        break

      case 'connecting':
        if (this._status === 'disconnected') {
          this.setStatus('connecting')
        }
        break

      case 'reconnecting':
        this.reconnectAttempts++
        // After a few failed attempts, switch to mock if not already
        if (this.reconnectAttempts >= 3 && !this.mockProvider.isRunning) {
          this.switchToMock()
        }
        break

      case 'disconnected':
        // Bridge gave up entirely
        if (!this.mockProvider.isRunning) {
          this.switchToMock()
        }
        break
    }
  }

  private switchToMock(): void {
    if (this.mockProvider.isRunning) return

    // Brief delay before switching to mock
    this.mockSwitchId = setTimeout(
      () => {
        this.mockSwitchId = null
        if (this.bridgeClient.isConnected) return // bridge connected in the meantime

        this.mockProvider.start((event) => {
          this.handleEvent(event)
        })
        this.setStatus('mock')
      },
      this._status === 'connecting' ? 0 : MOCK_SWITCH_DELAY_MS,
    )
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

  private clearTimers(): void {
    if (this.bridgeTimeoutId) {
      clearTimeout(this.bridgeTimeoutId)
      this.bridgeTimeoutId = null
    }
    if (this.mockSwitchId) {
      clearTimeout(this.mockSwitchId)
      this.mockSwitchId = null
    }
  }
}
