/**
 * Lightweight typed pub/sub event bus.
 *
 * Usage:
 * ```ts
 * type Events = {
 *   tick: { dt: number }
 *   score: { points: number }
 * }
 * const bus = createEventBus<Events>()
 * const unsub = bus.on('tick', (payload) => console.log(payload.dt))
 * bus.emit('tick', { dt: 16 })
 * unsub()  // or bus.off('tick', handler)
 * ```
 */

type Handler<T> = (payload: T) => void

export interface EventBus<EventMap extends Record<string, unknown>> {
  /** Subscribe to an event. Returns an unsubscribe function. */
  on<K extends keyof EventMap>(
    event: K,
    handler: Handler<EventMap[K]>,
  ): () => void

  /** Unsubscribe a specific handler from an event. */
  off<K extends keyof EventMap>(event: K, handler: Handler<EventMap[K]>): void

  /** Emit an event to all subscribed handlers. */
  emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): void
}

export function createEventBus<
  EventMap extends Record<string, unknown>,
>(): EventBus<EventMap> {
  const listeners = new Map<
    keyof EventMap,
    Set<Handler<EventMap[keyof EventMap]>>
  >()

  function on<K extends keyof EventMap>(
    event: K,
    handler: Handler<EventMap[K]>,
  ): () => void {
    if (!listeners.has(event)) {
      listeners.set(event, new Set())
    }
    const set = listeners.get(event)!
    set.add(handler as Handler<EventMap[keyof EventMap]>)
    return () => off(event, handler)
  }

  function off<K extends keyof EventMap>(
    event: K,
    handler: Handler<EventMap[K]>,
  ): void {
    const set = listeners.get(event)
    if (set) {
      set.delete(handler as Handler<EventMap[keyof EventMap]>)
      if (set.size === 0) {
        listeners.delete(event)
      }
    }
  }

  function emit<K extends keyof EventMap>(
    event: K,
    payload: EventMap[K],
  ): void {
    const set = listeners.get(event)
    if (set) {
      for (const handler of [...set]) {
        try {
          handler(payload)
        } catch (e) {
          console.error(`EventBus error on "${String(event)}":`, e)
        }
      }
    }
  }

  return { on, off, emit }
}
