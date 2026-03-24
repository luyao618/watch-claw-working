/**
 * Event Parser — maps session log events to character actions.
 *
 * Parses incoming SessionLogEvent objects (from Bridge Server) and returns
 * CharacterAction objects that drive the character FSM.
 */

import type {
  SessionLogEvent,
  CharacterAction,
  RoomId,
  AnimationId,
  EmotionId,
  ContentItem,
  AssistantMessage,
} from './types.ts'

// ── Tool → Room Mapping ─────────────────────────────────────────────────────

interface ToolMapping {
  room: RoomId
  animation: AnimationId
  emotion: EmotionId
}

const TOOL_ROOM_MAP: Record<string, ToolMapping> = {
  // All tool executions → Workshop (doing work)
  write: { room: 'workshop', animation: 'type', emotion: 'focused' },
  edit: { room: 'workshop', animation: 'type', emotion: 'focused' },
  exec: { room: 'workshop', animation: 'type', emotion: 'serious' },
  read: { room: 'workshop', animation: 'type', emotion: 'thinking' },
  grep: { room: 'workshop', animation: 'type', emotion: 'curious' },
  glob: { room: 'workshop', animation: 'type', emotion: 'curious' },
  web_search: { room: 'workshop', animation: 'type', emotion: 'curious' },
  memory_search: { room: 'workshop', animation: 'type', emotion: 'thinking' },
  memory_get: { room: 'workshop', animation: 'type', emotion: 'thinking' },
  process: { room: 'workshop', animation: 'type', emotion: 'serious' },
  task: { room: 'workshop', animation: 'type', emotion: 'thinking' },
  todowrite: { room: 'workshop', animation: 'type', emotion: 'focused' },
  sessions_spawn: { room: 'workshop', animation: 'type', emotion: 'thinking' },
  sessions_send: { room: 'workshop', animation: 'type', emotion: 'thinking' },
  sessions_list: { room: 'workshop', animation: 'type', emotion: 'curious' },
  sessions_history: { room: 'workshop', animation: 'type', emotion: 'curious' },
}

// Default mapping for unknown tools
const DEFAULT_TOOL_MAPPING: ToolMapping = {
  room: 'workshop',
  animation: 'type',
  emotion: 'focused',
}

// ── Throttle for assistant text events ──────────────────────────────────────

const ASSISTANT_TEXT_THROTTLE_MS = 2000

/**
 * Encapsulates throttle state to avoid module-level mutable variables.
 * Provides deterministic behavior in tests — each EventParser instance
 * (or a call to reset()) starts with a clean slate.
 */
class AssistantThrottle {
  private lastTime = 0

  shouldThrottle(): boolean {
    const now = Date.now()
    if (now - this.lastTime < ASSISTANT_TEXT_THROTTLE_MS) {
      return true
    }
    this.lastTime = now
    return false
  }

  reset(): void {
    this.lastTime = 0
  }
}

const assistantThrottle = new AssistantThrottle()

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Map a tool name to its room/animation/emotion mapping.
 */
export function mapToolToRoom(toolName: string): ToolMapping {
  return TOOL_ROOM_MAP[toolName] ?? DEFAULT_TOOL_MAPPING
}

/**
 * Parse a session log event into a CharacterAction (or null if no action needed).
 */
export function parseSessionLogEvent(
  event: SessionLogEvent,
): CharacterAction | null {
  // Session initialization → character wakes up
  if (event.type === 'session') {
    return { type: 'WAKE_UP' }
  }

  // Only process message-type events
  if (event.type !== 'message') return null

  const { message } = event

  // User message → fast run to computer (study)
  if (message.role === 'user') {
    return {
      type: 'GOTO_ROOM',
      room: 'study',
      animation: 'type',
      emotion: 'focused',
      speed: 'fast',
    }
  }

  // Assistant message
  if (message.role === 'assistant') {
    const msg = message as AssistantMessage
    const contents = msg.content

    // Check for toolCalls → fast run to appropriate room
    const toolCalls = contents.filter((c: ContentItem) => c.type === 'toolCall')
    if (toolCalls.length > 0) {
      // Use first toolCall to determine target
      const firstTool = toolCalls[0]
      if (firstTool.type === 'toolCall') {
        const mapping = mapToolToRoom(firstTool.name)
        return {
          type: 'GOTO_ROOM',
          room: mapping.room,
          animation: mapping.animation,
          emotion: mapping.emotion,
          speed: 'fast',
        }
      }
    }

    // Turn end → go to sleep (slow, with delay handled in character FSM)
    if (msg.stopReason === 'stop') {
      return { type: 'GO_SLEEP' }
    }

    // Check for thinking vs text content
    const hasThinking = contents.some((c: ContentItem) => c.type === 'thinking')
    const hasText = contents.some(
      (c: ContentItem) => c.type === 'text' && c.text.trim().length > 0,
    )

    if (hasThinking && !hasText) {
      return {
        type: 'GOTO_ROOM',
        room: 'study',
        animation: 'think',
        emotion: 'thinking',
        speed: 'fast',
      }
    }

    if (hasText) {
      if (!assistantThrottle.shouldThrottle()) {
        return {
          type: 'GOTO_ROOM',
          room: 'study',
          animation: 'type',
          emotion: 'focused',
          speed: 'fast',
        }
      }
      return null
    }
  }

  // toolResult → no direct character action
  if (message.role === 'toolResult') {
    return null
  }

  return null
}

/**
 * Reset the assistant text throttle (for testing).
 */
export function resetAssistantThrottle(): void {
  assistantThrottle.reset()
}
