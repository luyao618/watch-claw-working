import { describe, it, expect, vi } from 'vitest'
import { createEventBus } from './eventBus.ts'

type TestEvents = {
  tick: { dt: number }
  score: { points: number }
}

describe('createEventBus', () => {
  it('calls handler when event is emitted', () => {
    const bus = createEventBus<TestEvents>()
    const handler = vi.fn()
    bus.on('tick', handler)
    bus.emit('tick', { dt: 16 })
    expect(handler).toHaveBeenCalledWith({ dt: 16 })
  })

  it('supports multiple handlers for the same event', () => {
    const bus = createEventBus<TestEvents>()
    const h1 = vi.fn()
    const h2 = vi.fn()
    bus.on('tick', h1)
    bus.on('tick', h2)
    bus.emit('tick', { dt: 8 })
    expect(h1).toHaveBeenCalledOnce()
    expect(h2).toHaveBeenCalledOnce()
  })

  it('does not call handlers for other events', () => {
    const bus = createEventBus<TestEvents>()
    const handler = vi.fn()
    bus.on('tick', handler)
    bus.emit('score', { points: 100 })
    expect(handler).not.toHaveBeenCalled()
  })

  it('unsubscribes via returned function', () => {
    const bus = createEventBus<TestEvents>()
    const handler = vi.fn()
    const unsub = bus.on('tick', handler)
    unsub()
    bus.emit('tick', { dt: 16 })
    expect(handler).not.toHaveBeenCalled()
  })

  it('unsubscribes via off()', () => {
    const bus = createEventBus<TestEvents>()
    const handler = vi.fn()
    bus.on('tick', handler)
    bus.off('tick', handler)
    bus.emit('tick', { dt: 16 })
    expect(handler).not.toHaveBeenCalled()
  })

  it('does not throw when emitting event with no listeners', () => {
    const bus = createEventBus<TestEvents>()
    expect(() => bus.emit('tick', { dt: 16 })).not.toThrow()
  })

  it('does not throw when off-ing a handler that was never registered', () => {
    const bus = createEventBus<TestEvents>()
    const handler = vi.fn()
    expect(() => bus.off('tick', handler)).not.toThrow()
  })

  it('continues calling remaining handlers when one throws', () => {
    const bus = createEventBus<TestEvents>()
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const h1 = vi.fn(() => {
      throw new Error('boom')
    })
    const h2 = vi.fn()
    bus.on('tick', h1)
    bus.on('tick', h2)
    bus.emit('tick', { dt: 16 })
    expect(h1).toHaveBeenCalledOnce()
    expect(h2).toHaveBeenCalledOnce()
    expect(errorSpy).toHaveBeenCalledOnce()
    errorSpy.mockRestore()
  })

  it('is safe when a handler unsubscribes another handler during emit', () => {
    const bus = createEventBus<TestEvents>()
    const h2 = vi.fn()
    const h1 = vi.fn(() => {
      bus.off('tick', h2)
    })
    bus.on('tick', h1)
    bus.on('tick', h2)
    // h2 was in the snapshot at emit time, so it should still fire
    bus.emit('tick', { dt: 16 })
    expect(h1).toHaveBeenCalledOnce()
    expect(h2).toHaveBeenCalledOnce()
  })
})
