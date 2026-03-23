import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ActionQueue } from './actionQueue.ts'
import type { CharacterAction } from './types.ts'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('ActionQueue', () => {
  describe('basic operations', () => {
    it('starts empty', () => {
      const q = new ActionQueue()
      expect(q.isEmpty).toBe(true)
      expect(q.size).toBe(0)
      expect(q.pop()).toBeUndefined()
    })

    it('pushes and pops actions FIFO', () => {
      const q = new ActionQueue()
      const a1: CharacterAction = { type: 'WAKE_UP' }
      const a2: CharacterAction = { type: 'GO_SLEEP' }

      q.push(a1)
      q.push(a2)

      expect(q.size).toBe(2)
      expect(q.pop()).toEqual(a1)
      expect(q.pop()).toEqual(a2)
      expect(q.isEmpty).toBe(true)
    })

    it('peek returns next without removing', () => {
      const q = new ActionQueue()
      const a1: CharacterAction = { type: 'WAKE_UP' }
      q.push(a1)
      expect(q.peek()).toEqual(a1)
      expect(q.size).toBe(1)
    })

    it('clear empties the queue', () => {
      const q = new ActionQueue()
      q.push({ type: 'WAKE_UP' })
      q.push({ type: 'GO_SLEEP' })
      q.clear()
      expect(q.isEmpty).toBe(true)
    })
  })

  describe('max size enforcement', () => {
    it('evicts lowest priority when full', () => {
      const q = new ActionQueue(2)

      q.push({ type: 'WAKE_UP' }, 'low')
      vi.advanceTimersByTime(1)
      q.push({ type: 'GO_SLEEP' }, 'medium')
      vi.advanceTimersByTime(1)

      // Queue is full. Push high-priority — should evict the low.
      q.push({ type: 'CELEBRATE' }, 'high')

      expect(q.size).toBe(2)
      const first = q.pop()!
      expect(first.type).toBe('CELEBRATE') // high priority first
      const second = q.pop()!
      expect(second.type).toBe('GO_SLEEP') // medium kept
    })

    it('drops new action if it has lower priority than all items', () => {
      const q = new ActionQueue(2)

      q.push({ type: 'WAKE_UP' }, 'high')
      vi.advanceTimersByTime(1)
      q.push({ type: 'GO_SLEEP' }, 'high')
      vi.advanceTimersByTime(1)

      // Try to add low priority — should be dropped
      q.push({ type: 'CELEBRATE' }, 'low')

      expect(q.size).toBe(2)
      expect(q.pop()!.type).toBe('WAKE_UP')
      expect(q.pop()!.type).toBe('GO_SLEEP')
    })
  })

  describe('deduplication', () => {
    it('replaces same-room GOTO_ROOM at end of queue', () => {
      const q = new ActionQueue()

      const goto1: CharacterAction = {
        type: 'GOTO_ROOM',
        room: 'office',
        animation: 'type',
        emotion: 'focused',
      }
      const goto2: CharacterAction = {
        type: 'GOTO_ROOM',
        room: 'office',
        animation: 'sit',
        emotion: 'thinking',
      }

      q.push(goto1)
      q.push(goto2)

      // Should have replaced, not added
      expect(q.size).toBe(1)
      const result = q.pop()!
      expect(result.type).toBe('GOTO_ROOM')
      if (result.type === 'GOTO_ROOM') {
        expect(result.animation).toBe('sit') // updated to latest
      }
    })

    it('does not dedup different rooms', () => {
      const q = new ActionQueue()

      q.push({
        type: 'GOTO_ROOM',
        room: 'office',
        animation: 'type',
        emotion: 'focused',
      })
      q.push({
        type: 'GOTO_ROOM',
        room: 'living-room',
        animation: 'sit',
        emotion: 'curious',
      })

      expect(q.size).toBe(2)
    })

    it('does not dedup non-GOTO_ROOM actions', () => {
      const q = new ActionQueue()
      q.push({ type: 'WAKE_UP' })
      q.push({ type: 'WAKE_UP' })
      expect(q.size).toBe(2)
    })
  })

  describe('priority ordering', () => {
    it('pops high priority before medium before low', () => {
      const q = new ActionQueue()

      vi.setSystemTime(1000)
      q.push({ type: 'CELEBRATE' }, 'low')
      vi.setSystemTime(2000)
      q.push({ type: 'WAKE_UP' }, 'high')
      vi.setSystemTime(3000)
      q.push({ type: 'GO_SLEEP' }, 'medium')

      expect(q.pop()!.type).toBe('WAKE_UP') // high
      expect(q.pop()!.type).toBe('GO_SLEEP') // medium
      expect(q.pop()!.type).toBe('CELEBRATE') // low
    })

    it('within same priority, orders by timestamp (oldest first)', () => {
      const q = new ActionQueue()

      vi.setSystemTime(1000)
      q.push({ type: 'WAKE_UP' }, 'medium')
      vi.setSystemTime(2000)
      q.push({ type: 'GO_SLEEP' }, 'medium')
      vi.setSystemTime(3000)
      q.push({ type: 'CELEBRATE' }, 'medium')

      expect(q.pop()!.type).toBe('WAKE_UP')
      expect(q.pop()!.type).toBe('GO_SLEEP')
      expect(q.pop()!.type).toBe('CELEBRATE')
    })
  })
})
