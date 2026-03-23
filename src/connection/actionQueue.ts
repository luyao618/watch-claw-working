/**
 * Action Queue — buffers CharacterActions when they arrive faster than the
 * character can process them (e.g. during walking).
 *
 * Features:
 * - Priority-based ordering (high > medium > low)
 * - Maximum size with eviction of lowest-priority items
 * - Deduplication of same-room GOTO_ROOM actions
 */

import type { CharacterAction } from './types.ts'

export type ActionPriority = 'high' | 'medium' | 'low'

interface PrioritizedAction {
  action: CharacterAction
  priority: ActionPriority
  timestamp: number
}

const PRIORITY_ORDER: Record<ActionPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
}

export class ActionQueue {
  private queue: PrioritizedAction[] = []
  private readonly maxSize: number

  constructor(maxSize = 3) {
    this.maxSize = maxSize
  }

  push(action: CharacterAction, priority: ActionPriority = 'medium'): void {
    const entry: PrioritizedAction = {
      action,
      priority,
      timestamp: Date.now(),
    }

    if (this.queue.length >= this.maxSize) {
      // Find the lowest-priority (or oldest same-priority) item
      const lowestIdx = this.findLowestPriorityIndex()
      if (
        PRIORITY_ORDER[priority] <=
        PRIORITY_ORDER[this.queue[lowestIdx].priority]
      ) {
        this.queue.splice(lowestIdx, 1)
      } else {
        // New action is lower priority than everything in queue, drop it
        return
      }
    }

    // Dedup: if the latest queued action targets the same room, replace it
    const lastIdx = this.queue.length - 1
    const last = lastIdx >= 0 ? this.queue[lastIdx].action : null
    if (
      last &&
      last.type === 'GOTO_ROOM' &&
      action.type === 'GOTO_ROOM' &&
      last.room === action.room
    ) {
      this.queue[lastIdx] = entry
    } else {
      this.queue.push(entry)
    }

    // Sort by priority (ascending = higher first), then by timestamp (oldest first)
    this.queue.sort((a, b) => {
      const priorityDiff =
        PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
      return priorityDiff !== 0 ? priorityDiff : a.timestamp - b.timestamp
    })
  }

  pop(): CharacterAction | undefined {
    const entry = this.queue.shift()
    return entry?.action
  }

  peek(): CharacterAction | undefined {
    return this.queue[0]?.action
  }

  get isEmpty(): boolean {
    return this.queue.length === 0
  }

  get size(): number {
    return this.queue.length
  }

  clear(): void {
    this.queue = []
  }

  private findLowestPriorityIndex(): number {
    let lowestIdx = 0
    for (let i = 1; i < this.queue.length; i++) {
      if (
        PRIORITY_ORDER[this.queue[i].priority] >
        PRIORITY_ORDER[this.queue[lowestIdx].priority]
      ) {
        lowestIdx = i
      } else if (
        PRIORITY_ORDER[this.queue[i].priority] ===
          PRIORITY_ORDER[this.queue[lowestIdx].priority] &&
        this.queue[i].timestamp < this.queue[lowestIdx].timestamp
      ) {
        lowestIdx = i // same priority, older = lower value
      }
    }
    return lowestIdx
  }
}
