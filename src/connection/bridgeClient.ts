/**
 * Bridge WebSocket Client
 *
 * Connects to the Bridge Server (Node.js) which watches OpenClaw session logs
 * and pushes new events to the browser via WebSocket.
 *
 * Connection state machine (4 states, no handshaking):
 *   DISCONNECTED → CONNECTING → CONNECTED → (on close) → RECONNECTING
 */

import {
  BRIDGE_WS_URL,
  BRIDGE_RECONNECT_BASE_MS,
  BRIDGE_RECONNECT_MAX_MS,
} from '@/utils/constants.ts'
import type {
  ConnectionState,
  SessionLogEvent,
  BridgeClientOptions,
} from './types.ts'

type EventHandler = (event: SessionLogEvent) => void
type StateHandler = (state: ConnectionState) => void

export class BridgeClient {
  private ws: WebSocket | null = null
  private _state: ConnectionState = 'disconnected'
  private url: string
  private reconnectBaseMs: number
  private reconnectMaxMs: number
  private maxReconnectAttempts: number
  private reconnectAttempts = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null

  private eventHandlers = new Set<EventHandler>()
  private stateHandlers = new Set<StateHandler>()

  constructor(options?: Partial<BridgeClientOptions>) {
    this.url = options?.url ?? BRIDGE_WS_URL
    this.reconnectBaseMs = options?.reconnectBaseMs ?? BRIDGE_RECONNECT_BASE_MS
    this.reconnectMaxMs = options?.reconnectMaxMs ?? BRIDGE_RECONNECT_MAX_MS
    this.maxReconnectAttempts = options?.maxReconnectAttempts ?? Infinity
  }

  // ── Public API ──────────────────────────────────────────────────────────

  get state(): ConnectionState {
    return this._state
  }

  get isConnected(): boolean {
    return this._state === 'connected'
  }

  connect(url?: string): void {
    if (url) this.url = url
    if (
      this._state === 'connecting' ||
      this._state === 'connected' ||
      this._state === 'reconnecting'
    ) {
      return
    }
    this.reconnectAttempts = 0
    this.doConnect()
  }

  disconnect(): void {
    this.clearReconnectTimer()
    if (this.ws) {
      // Remove handlers before closing to avoid triggering onclose → reconnect
      this.ws.onopen = null
      this.ws.onclose = null
      this.ws.onerror = null
      this.ws.onmessage = null
      if (
        this.ws.readyState === WebSocket.CONNECTING ||
        this.ws.readyState === WebSocket.OPEN
      ) {
        this.ws.close()
      }
      this.ws = null
    }
    this.setState('disconnected')
  }

  /**
   * Register a handler for incoming session log events.
   * Returns an unsubscribe function.
   */
  onEvent(handler: EventHandler): () => void {
    this.eventHandlers.add(handler)
    return () => this.eventHandlers.delete(handler)
  }

  /**
   * Register a handler for connection state changes.
   * Returns an unsubscribe function.
   */
  onStateChange(handler: StateHandler): () => void {
    this.stateHandlers.add(handler)
    return () => this.stateHandlers.delete(handler)
  }

  // ── Private ─────────────────────────────────────────────────────────────

  private doConnect(): void {
    this.setState('connecting')

    try {
      this.ws = new WebSocket(this.url)
    } catch {
      this.scheduleReconnect()
      return
    }

    this.ws.onopen = () => {
      this.reconnectAttempts = 0
      this.setState('connected')
    }

    this.ws.onclose = () => {
      this.ws = null
      if (this._state !== 'disconnected') {
        this.scheduleReconnect()
      }
    }

    this.ws.onerror = () => {
      // onerror is always followed by onclose in browser WebSocket API,
      // so reconnection logic is handled in onclose.
    }

    this.ws.onmessage = (evt: MessageEvent) => {
      try {
        const data = JSON.parse(evt.data as string)

        // Skip bridge-internal messages (status, session_switch)
        if (data._bridge) return

        // Emit parsed session log event to all handlers
        for (const handler of this.eventHandlers) {
          try {
            handler(data as SessionLogEvent)
          } catch (e) {
            console.error('[BridgeClient] Event handler error:', e)
          }
        }
      } catch {
        console.warn(
          '[BridgeClient] Received non-JSON message:',
          (evt.data as string).slice(0, 100),
        )
      }
    }
  }

  private scheduleReconnect(): void {
    if (this._state === 'disconnected') return

    this.reconnectAttempts++

    if (this.reconnectAttempts > this.maxReconnectAttempts) {
      this.setState('disconnected')
      return
    }

    this.setState('reconnecting')

    // Exponential backoff: baseMs * 2^(attempt-1), capped at maxMs
    const delay = Math.min(
      this.reconnectBaseMs * Math.pow(2, this.reconnectAttempts - 1),
      this.reconnectMaxMs,
    )

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.doConnect()
    }, delay)
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  private setState(newState: ConnectionState): void {
    if (this._state === newState) return
    this._state = newState
    for (const handler of this.stateHandlers) {
      try {
        handler(newState)
      } catch (e) {
        console.error('[BridgeClient] State handler error:', e)
      }
    }
  }
}
