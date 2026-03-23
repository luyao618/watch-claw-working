import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MockProvider } from './mockProvider.ts'
import type { SessionLogEvent, MessageEvent } from './types.ts'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('MockProvider', () => {
  describe('lifecycle', () => {
    it('starts and emits session init event immediately', () => {
      const handler = vi.fn()
      const mock = new MockProvider()
      mock.start(handler)

      // Should emit session init right away
      expect(handler).toHaveBeenCalled()
      const firstEvent = handler.mock.calls[0][0] as SessionLogEvent
      expect(firstEvent.type).toBe('session')

      mock.stop()
    })

    it('emits user message shortly after session init', () => {
      const events: SessionLogEvent[] = []
      const mock = new MockProvider()
      mock.start((e) => events.push(e))

      vi.advanceTimersByTime(600)

      expect(events.length).toBeGreaterThanOrEqual(2)
      expect(events[0].type).toBe('session')
      expect(events[1].type).toBe('message')
      const msgEvent = events[1] as MessageEvent
      expect(msgEvent.message.role).toBe('user')

      mock.stop()
    })

    it('stop() clears all timers and emits end turn', () => {
      const events: SessionLogEvent[] = []
      const mock = new MockProvider()
      mock.start((e) => events.push(e))

      vi.advanceTimersByTime(5000)
      mock.stop()

      // Check that the last event is a stop message
      const lastEvent = events[events.length - 1] as MessageEvent
      expect(lastEvent.type).toBe('message')
      expect(lastEvent.message.role).toBe('assistant')
      if (lastEvent.message.role === 'assistant') {
        expect(lastEvent.message.stopReason).toBe('stop')
      }

      // Advance much further — no more events should come
      const countAfterStop = events.length
      vi.advanceTimersByTime(60_000)
      expect(events.length).toBe(countAfterStop)
    })

    it('isRunning reflects state', () => {
      const mock = new MockProvider()
      expect(mock.isRunning).toBe(false)

      mock.start(() => {})
      expect(mock.isRunning).toBe(true)

      mock.stop()
      expect(mock.isRunning).toBe(false)
    })

    it('start() is idempotent when already running', () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()
      const mock = new MockProvider()

      mock.start(handler1)
      mock.start(handler2) // should be ignored

      vi.advanceTimersByTime(600)
      expect(handler1).toHaveBeenCalled()
      expect(handler2).not.toHaveBeenCalled()

      mock.stop()
    })
  })

  describe('event format', () => {
    it('generates events with id, timestamp fields', () => {
      const events: SessionLogEvent[] = []
      const mock = new MockProvider()
      mock.start((e) => events.push(e))

      // Let some events flow
      vi.advanceTimersByTime(20_000)
      mock.stop()

      for (const event of events) {
        expect(event.id).toBeDefined()
        expect(event.id.startsWith('mock-')).toBe(true)
        expect(event.timestamp).toBeDefined()
      }
    })

    it('generates tool call events with lowercase tool names', () => {
      const events: SessionLogEvent[] = []
      const mock = new MockProvider()
      mock.start((e) => events.push(e))

      // Let many events flow
      vi.advanceTimersByTime(60_000)
      mock.stop()

      const toolCallEvents = events.filter((e) => {
        if (e.type !== 'message') return false
        const msg = (e as MessageEvent).message
        if (msg.role !== 'assistant') return false
        if (!Array.isArray(msg.content)) return false
        return msg.content.some((c) => c.type === 'toolCall')
      })

      expect(toolCallEvents.length).toBeGreaterThan(0)

      for (const event of toolCallEvents) {
        const msg = (event as MessageEvent).message
        if (msg.role === 'assistant' && Array.isArray(msg.content)) {
          for (const content of msg.content) {
            if (content.type === 'toolCall') {
              // Tool names should be lowercase
              expect(content.name).toBe(content.name.toLowerCase())
              // Should be one of our known tools
              const knownTools = [
                'write',
                'edit',
                'read',
                'exec',
                'grep',
                'glob',
                'web_search',
                'task',
              ]
              expect(knownTools).toContain(content.name)
            }
          }
        }
      }
    })
  })

  describe('tool distribution', () => {
    it('generates a realistic distribution of tools over many events', () => {
      const toolCounts: Record<string, number> = {}
      const mock = new MockProvider()

      mock.start((e) => {
        if (e.type !== 'message') return
        const msg = (e as MessageEvent).message
        if (msg.role !== 'assistant' || !Array.isArray(msg.content)) return
        for (const c of msg.content) {
          if (c.type === 'toolCall') {
            toolCounts[c.name] = (toolCounts[c.name] || 0) + 1
          }
        }
      })

      // Run for a very long time to get good distribution
      vi.advanceTimersByTime(600_000)
      mock.stop()

      // write and edit should be most common
      const total = Object.values(toolCounts).reduce((a, b) => a + b, 0)
      if (total > 20) {
        const writeEdit = (toolCounts['write'] || 0) + (toolCounts['edit'] || 0)
        // write + edit should be roughly 45% of total (with some variance)
        expect(writeEdit / total).toBeGreaterThan(0.2) // loose check
      }
    })
  })
})
