import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { BridgeClient } from './bridgeClient.ts'

// ── WebSocket mock ──────────────────────────────────────────────────────────

class MockWebSocket {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3

  readyState = MockWebSocket.CONNECTING
  onopen: (() => void) | null = null
  onclose: (() => void) | null = null
  onerror: (() => void) | null = null
  onmessage: ((evt: { data: string }) => void) | null = null

  constructor(public url: string) {
    // Store reference for test access
    MockWebSocket._lastInstance = this
  }

  close(): void {
    this.readyState = MockWebSocket.CLOSED
  }

  send(): void {
    // no-op
  }

  // Helpers for tests
  simulateOpen(): void {
    this.readyState = MockWebSocket.OPEN
    this.onopen?.()
  }

  simulateClose(): void {
    this.readyState = MockWebSocket.CLOSED
    this.onclose?.()
  }

  simulateMessage(data: string): void {
    this.onmessage?.({ data })
  }

  simulateError(): void {
    this.onerror?.()
  }

  static _lastInstance: MockWebSocket | null = null
}

// ── Setup ───────────────────────────────────────────────────────────────────

let originalWebSocket: typeof WebSocket

beforeEach(() => {
  vi.useFakeTimers()
  MockWebSocket._lastInstance = null
  originalWebSocket = globalThis.WebSocket
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  globalThis.WebSocket = MockWebSocket as any
})

afterEach(() => {
  vi.useRealTimers()
  globalThis.WebSocket = originalWebSocket
})

function getLastWS(): MockWebSocket {
  return MockWebSocket._lastInstance!
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('BridgeClient', () => {
  describe('connection lifecycle', () => {
    it('starts in disconnected state', () => {
      const client = new BridgeClient({ url: 'ws://test' })
      expect(client.state).toBe('disconnected')
      expect(client.isConnected).toBe(false)
    })

    it('transitions to connecting then connected on successful open', () => {
      const client = new BridgeClient({ url: 'ws://test' })
      const states: string[] = []
      client.onStateChange((s) => states.push(s))

      client.connect()
      expect(client.state).toBe('connecting')

      getLastWS().simulateOpen()
      expect(client.state).toBe('connected')
      expect(client.isConnected).toBe(true)
      expect(states).toEqual(['connecting', 'connected'])
    })

    it('transitions to disconnected on disconnect()', () => {
      const client = new BridgeClient({ url: 'ws://test' })
      client.connect()
      getLastWS().simulateOpen()

      client.disconnect()
      expect(client.state).toBe('disconnected')
      expect(client.isConnected).toBe(false)
    })

    it('does not reconnect after disconnect()', () => {
      const client = new BridgeClient({ url: 'ws://test' })
      client.connect()
      getLastWS().simulateOpen()

      client.disconnect()

      // Advance timers — no reconnect should happen
      vi.advanceTimersByTime(60_000)
      expect(client.state).toBe('disconnected')
    })
  })

  describe('reconnection', () => {
    it('schedules reconnect on connection close', () => {
      const client = new BridgeClient({
        url: 'ws://test',
        reconnectBaseMs: 1000,
      })
      client.connect()
      getLastWS().simulateOpen()

      getLastWS().simulateClose()
      expect(client.state).toBe('reconnecting')
    })

    it('uses exponential backoff', () => {
      const client = new BridgeClient({
        url: 'ws://test',
        reconnectBaseMs: 1000,
        reconnectMaxMs: 30000,
      })
      client.connect()
      // Fail immediately
      getLastWS().simulateClose()
      expect(client.state).toBe('reconnecting')

      // First retry after 1s
      vi.advanceTimersByTime(999)
      expect(MockWebSocket._lastInstance?.readyState).toBe(MockWebSocket.CLOSED)
      vi.advanceTimersByTime(1)
      // Now connecting again
      expect(client.state).toBe('connecting')

      // Fail again
      getLastWS().simulateClose()

      // Second retry after 2s
      vi.advanceTimersByTime(1999)
      expect(client.state).toBe('reconnecting')
      vi.advanceTimersByTime(1)
      expect(client.state).toBe('connecting')
    })

    it('caps backoff at reconnectMaxMs', () => {
      const client = new BridgeClient({
        url: 'ws://test',
        reconnectBaseMs: 1000,
        reconnectMaxMs: 5000,
      })
      client.connect()

      // Fail many times to exceed the max
      for (let i = 0; i < 10; i++) {
        getLastWS().simulateClose()
        // Max delay should be 5s
        vi.advanceTimersByTime(5001)
      }

      // Should still be trying to reconnect (not disconnected)
      expect(
        client.state === 'connecting' || client.state === 'reconnecting',
      ).toBe(true)
    })

    it('stops reconnecting after maxReconnectAttempts', () => {
      const client = new BridgeClient({
        url: 'ws://test',
        reconnectBaseMs: 100,
        maxReconnectAttempts: 3,
      })
      client.connect()

      // Fail 3 times
      for (let i = 0; i < 3; i++) {
        getLastWS().simulateClose()
        vi.advanceTimersByTime(10000)
      }

      // 4th failure should give up
      getLastWS().simulateClose()
      expect(client.state).toBe('disconnected')
    })

    it('resets reconnect attempts on successful connection', () => {
      const client = new BridgeClient({
        url: 'ws://test',
        reconnectBaseMs: 100,
        maxReconnectAttempts: 5,
      })
      client.connect()

      // Fail twice
      getLastWS().simulateClose()
      vi.advanceTimersByTime(200)
      getLastWS().simulateClose()
      vi.advanceTimersByTime(400)

      // Succeed
      getLastWS().simulateOpen()
      expect(client.state).toBe('connected')

      // Fail again — should reset counter
      getLastWS().simulateClose()
      vi.advanceTimersByTime(200)
      getLastWS().simulateOpen()
      expect(client.state).toBe('connected')
    })
  })

  describe('event handling', () => {
    it('delivers parsed SessionLogEvents to handlers', () => {
      const client = new BridgeClient({ url: 'ws://test' })
      const handler = vi.fn()
      client.onEvent(handler)

      client.connect()
      getLastWS().simulateOpen()

      const event = {
        type: 'message',
        id: 'test-1',
        timestamp: '2026-03-22T10:00:00Z',
        message: { role: 'user', content: 'hello' },
      }
      getLastWS().simulateMessage(JSON.stringify(event))

      expect(handler).toHaveBeenCalledWith(event)
    })

    it('skips bridge-internal messages', () => {
      const client = new BridgeClient({ url: 'ws://test' })
      const handler = vi.fn()
      client.onEvent(handler)

      client.connect()
      getLastWS().simulateOpen()

      getLastWS().simulateMessage(
        JSON.stringify({ _bridge: true, type: 'status', watching: null }),
      )

      expect(handler).not.toHaveBeenCalled()
    })

    it('unsubscribes via returned function', () => {
      const client = new BridgeClient({ url: 'ws://test' })
      const handler = vi.fn()
      const unsub = client.onEvent(handler)
      unsub()

      client.connect()
      getLastWS().simulateOpen()

      getLastWS().simulateMessage(
        JSON.stringify({
          type: 'session',
          id: '1',
          timestamp: '',
          version: 3,
          cwd: '/',
        }),
      )

      expect(handler).not.toHaveBeenCalled()
    })

    it('handles malformed JSON gracefully', () => {
      const client = new BridgeClient({ url: 'ws://test' })
      const handler = vi.fn()
      client.onEvent(handler)
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      client.connect()
      getLastWS().simulateOpen()

      getLastWS().simulateMessage('not valid json {{{')

      expect(handler).not.toHaveBeenCalled()
      expect(warnSpy).toHaveBeenCalled()
      warnSpy.mockRestore()
    })

    it('continues delivering events if one handler throws', () => {
      const client = new BridgeClient({ url: 'ws://test' })
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const h1 = vi.fn(() => {
        throw new Error('oops')
      })
      const h2 = vi.fn()
      client.onEvent(h1)
      client.onEvent(h2)

      client.connect()
      getLastWS().simulateOpen()

      getLastWS().simulateMessage(
        JSON.stringify({
          type: 'session',
          id: '1',
          timestamp: '',
          version: 3,
          cwd: '/',
        }),
      )

      expect(h1).toHaveBeenCalledOnce()
      expect(h2).toHaveBeenCalledOnce()
      errorSpy.mockRestore()
    })
  })

  describe('state change callbacks', () => {
    it('notifies state change handlers', () => {
      const client = new BridgeClient({ url: 'ws://test' })
      const handler = vi.fn()
      client.onStateChange(handler)

      client.connect()
      expect(handler).toHaveBeenLastCalledWith('connecting')

      getLastWS().simulateOpen()
      expect(handler).toHaveBeenLastCalledWith('connected')
    })

    it('unsubscribes state change handler via returned function', () => {
      const client = new BridgeClient({ url: 'ws://test' })
      const handler = vi.fn()
      const unsub = client.onStateChange(handler)
      unsub()

      client.connect()
      expect(handler).not.toHaveBeenCalled()
    })
  })

  describe('disconnect cleanup', () => {
    it('clears reconnect timers on disconnect', () => {
      const client = new BridgeClient({
        url: 'ws://test',
        reconnectBaseMs: 1000,
      })
      client.connect()
      getLastWS().simulateClose() // triggers reconnect timer

      client.disconnect()
      expect(client.state).toBe('disconnected')

      // Advance past when reconnect would fire
      vi.advanceTimersByTime(5000)
      expect(client.state).toBe('disconnected')
    })

    it('does not start new connection if already connecting', () => {
      const client = new BridgeClient({ url: 'ws://test' })
      client.connect()
      const firstWS = getLastWS()
      client.connect() // second call should be no-op
      expect(getLastWS()).toBe(firstWS)
    })
  })
})
