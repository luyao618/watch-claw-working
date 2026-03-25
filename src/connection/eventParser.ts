/**
 * Event Parser — maps session log events to character actions.
 *
 * Room mapping based on tool type and command content:
 *   3F: Balcony (web), Study (read/write/edit), Warehouse (download/install)
 *   2F: Toolbox (exec general), Office (assistant text), Bedroom (idle)
 *   1F: Basement (subagents), Server Room (dev commands), Trash (delete)
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

// Simple tool → room (no argument inspection needed)
const TOOL_ROOM_MAP: Record<string, ToolMapping> = {
  // 3F — Attic
  web_search: { room: 'balcony', animation: 'think', emotion: 'curious' },
  web_fetch: { room: 'balcony', animation: 'think', emotion: 'curious' },
  read: { room: 'study', animation: 'think', emotion: 'curious' },
  write: { room: 'study', animation: 'type', emotion: 'focused' },
  edit: { room: 'study', animation: 'type', emotion: 'focused' },
  grep: { room: 'study', animation: 'think', emotion: 'curious' },
  glob: { room: 'study', animation: 'think', emotion: 'curious' },
  memory_search: { room: 'study', animation: 'think', emotion: 'thinking' },
  memory_get: { room: 'study', animation: 'think', emotion: 'thinking' },
  todowrite: { room: 'study', animation: 'type', emotion: 'focused' },

  // 2F — Main Floor (exec is handled separately with command inspection)
  // cron tools → toolbox
  cron: { room: 'toolbox', animation: 'type', emotion: 'serious' },

  // 1F — Basement (subagent / session management)
  task: { room: 'basement', animation: 'think', emotion: 'thinking' },
  sessions_spawn: { room: 'basement', animation: 'think', emotion: 'thinking' },
  sessions_send: { room: 'basement', animation: 'type', emotion: 'thinking' },
  sessions_list: { room: 'basement', animation: 'think', emotion: 'curious' },
  sessions_history: {
    room: 'basement',
    animation: 'think',
    emotion: 'curious',
  },
  sessions_yield: { room: 'basement', animation: 'think', emotion: 'thinking' },
}

// Default mapping for unknown tools
const DEFAULT_TOOL_MAPPING: ToolMapping = {
  room: 'office',
  animation: 'type',
  emotion: 'focused',
}

// ── exec command classification ──────────────────────────────────────────────

// Patterns for download/install commands → Warehouse (3F)
const DOWNLOAD_PATTERNS = [
  /\bcurl\b/,
  /\bwget\b/,
  /\bpip\s+install\b/,
  /\bnpm\s+install\b/,
  /\bpnpm\s+(add|install)\b/,
  /\byarn\s+add\b/,
  /\bbrew\s+install\b/,
  /\bapt\s+install\b/,
  /\bapt-get\s+install\b/,
]

// Patterns for dev/programming commands → Server Room (1F)
const DEV_PATTERNS = [
  /\bgit\b/,
  /\bpython\b/,
  /\bpython3\b/,
  /\bnode\b/,
  /\bnpm\s+run\b/,
  /\bnpx\b/,
  /\bpnpm\s+run\b/,
  /\bmake\b/,
  /\bcargo\b/,
  /\bgo\s+(build|run|test)\b/,
  /\brustc\b/,
  /\bgcc\b/,
  /\bjava\b/,
  /\bjavac\b/,
  /\bdocker\b/,
  /\btsc\b/,
  /\bvitest\b/,
  /\bjest\b/,
  /\bpytest\b/,
  /\beslint\b/,
  /\bprettier\b/,
]

// Patterns for delete/trash commands → Trash (1F)
const TRASH_PATTERNS = [
  /\btrash\b/,
  /\brm\s/,
  /\brm$/,
  /\bdelete\b/,
  /\bunlink\b/,
]

function classifyExecCommand(command: string): ToolMapping {
  const cmd = command.toLowerCase()

  // Check download/install first
  for (const pattern of DOWNLOAD_PATTERNS) {
    if (pattern.test(cmd)) {
      return { room: 'warehouse', animation: 'type', emotion: 'curious' }
    }
  }

  // Check trash/delete
  for (const pattern of TRASH_PATTERNS) {
    if (pattern.test(cmd)) {
      return { room: 'trash', animation: 'type', emotion: 'serious' }
    }
  }

  // Check dev/programming
  for (const pattern of DEV_PATTERNS) {
    if (pattern.test(cmd)) {
      return { room: 'server_room', animation: 'type', emotion: 'focused' }
    }
  }

  // Default exec → Toolbox (2F, general execution)
  return { room: 'toolbox', animation: 'type', emotion: 'serious' }
}

// ── Throttle for assistant text events ──────────────────────────────────────

const ASSISTANT_TEXT_THROTTLE_MS = 2000

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
 * Map a tool name (with optional arguments) to its room/animation/emotion.
 */
export function mapToolToRoom(
  toolName: string,
  toolArgs?: Record<string, unknown>,
): ToolMapping {
  // Special handling for exec: inspect command content
  if (toolName === 'exec' || toolName === 'process') {
    const command =
      (toolArgs?.command as string) ??
      (toolArgs?.cmd as string) ??
      (toolArgs?.input as string) ??
      ''
    if (command) {
      return classifyExecCommand(command)
    }
    return { room: 'toolbox', animation: 'type', emotion: 'serious' }
  }

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

  // User message → Office (2F, chat/dialogue)
  if (message.role === 'user') {
    return {
      type: 'GOTO_ROOM',
      room: 'office',
      animation: 'type',
      emotion: 'focused',
      speed: 'fast',
    }
  }

  // Assistant message
  if (message.role === 'assistant') {
    const msg = message as AssistantMessage
    const contents = msg.content

    // Check for toolCalls → route to appropriate room
    const toolCalls = contents.filter((c: ContentItem) => c.type === 'toolCall')
    if (toolCalls.length > 0) {
      const firstTool = toolCalls[0]
      if (firstTool.type === 'toolCall') {
        const mapping = mapToolToRoom(firstTool.name, firstTool.arguments)
        return {
          type: 'GOTO_ROOM',
          room: mapping.room,
          animation: mapping.animation,
          emotion: mapping.emotion,
          speed: 'fast',
        }
      }
    }

    // Turn end → go to sleep
    if (msg.stopReason === 'stop') {
      return { type: 'GO_SLEEP' }
    }

    // Thinking only → Office (thinking pose)
    const hasThinking = contents.some((c: ContentItem) => c.type === 'thinking')
    const hasText = contents.some(
      (c: ContentItem) => c.type === 'text' && c.text.trim().length > 0,
    )

    if (hasThinking && !hasText) {
      return {
        type: 'GOTO_ROOM',
        room: 'office',
        animation: 'think',
        emotion: 'thinking',
        speed: 'fast',
      }
    }

    // Assistant text reply → Office (chat)
    if (hasText) {
      if (!assistantThrottle.shouldThrottle()) {
        return {
          type: 'GOTO_ROOM',
          room: 'office',
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
