import { describe, it, expect, beforeEach } from 'vitest'
import {
  parseSessionLogEvent,
  mapToolToRoom,
  resetAssistantThrottle,
} from './eventParser.ts'
import type { SessionLogEvent } from './types.ts'

beforeEach(() => {
  resetAssistantThrottle()
})

// ── Helper factories ────────────────────────────────────────────────────────

function makeSessionEvent(): SessionLogEvent {
  return {
    type: 'session',
    id: 'test-1',
    parentId: null,
    timestamp: new Date().toISOString(),
    version: 3,
    cwd: '/test/project',
  }
}

function makeUserMessage(text = 'hello'): SessionLogEvent {
  return {
    type: 'message',
    id: 'test-2',
    parentId: null,
    timestamp: new Date().toISOString(),
    message: { role: 'user', content: text },
  }
}

function makeAssistantToolCall(
  toolName: string,
  toolArgs: Record<string, unknown> = {},
  stopReason: 'toolUse' | 'stop' = 'toolUse',
): SessionLogEvent {
  return {
    type: 'message',
    id: 'test-3',
    parentId: null,
    timestamp: new Date().toISOString(),
    message: {
      role: 'assistant',
      content: [
        { type: 'thinking', thinking: 'Let me use ' + toolName },
        {
          type: 'toolCall',
          id: 'tc-1',
          name: toolName,
          arguments: { path: '/test/file.ts', ...toolArgs },
        },
      ],
      provider: 'github-copilot',
      model: 'claude-opus-4.6',
      stopReason,
      usage: {
        input: 100,
        output: 50,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 150,
        cost: {
          input: 0.01,
          output: 0.005,
          cacheRead: 0,
          cacheWrite: 0,
          total: 0.015,
        },
      },
    },
  }
}

function makeAssistantText(
  text: string,
  stopReason: 'toolUse' | 'stop' = 'stop',
): SessionLogEvent {
  return {
    type: 'message',
    id: 'test-4',
    parentId: null,
    timestamp: new Date().toISOString(),
    message: {
      role: 'assistant',
      content: [{ type: 'text', text }],
      provider: 'github-copilot',
      model: 'claude-opus-4.6',
      stopReason,
    },
  }
}

function makeAssistantThinking(): SessionLogEvent {
  return {
    type: 'message',
    id: 'test-5',
    parentId: null,
    timestamp: new Date().toISOString(),
    message: {
      role: 'assistant',
      content: [{ type: 'thinking', thinking: 'Analyzing the codebase...' }],
      provider: 'github-copilot',
      model: 'claude-opus-4.6',
      stopReason: 'toolUse',
    },
  }
}

function makeToolResult(toolName = 'write'): SessionLogEvent {
  return {
    type: 'message',
    id: 'test-6',
    parentId: 'test-3',
    timestamp: new Date().toISOString(),
    message: {
      role: 'toolResult',
      toolCallId: 'tc-1',
      toolName,
      content: [{ type: 'text', text: 'Tool completed successfully' }],
      details: { status: 'completed', exitCode: 0, durationMs: 150 },
      isError: false,
    },
  }
}

function makeModelChange(): SessionLogEvent {
  return {
    type: 'model_change',
    id: 'test-7',
    parentId: null,
    timestamp: new Date().toISOString(),
    provider: 'github-copilot',
    modelId: 'claude-opus-4.6',
  }
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('mapToolToRoom', () => {
  describe('3F — Attic rooms', () => {
    it.each([
      ['web_search', 'balcony'],
      ['web_fetch', 'balcony'],
    ])('maps %s → %s (Balcony)', (tool, room) => {
      expect(mapToolToRoom(tool).room).toBe(room)
    })

    it.each([
      ['read', 'study'],
      ['write', 'study'],
      ['edit', 'study'],
      ['grep', 'study'],
      ['glob', 'study'],
      ['memory_search', 'study'],
      ['memory_get', 'study'],
      ['todowrite', 'study'],
    ])('maps %s → %s (Study)', (tool, room) => {
      expect(mapToolToRoom(tool).room).toBe(room)
    })

    it('maps exec with download command → warehouse', () => {
      expect(
        mapToolToRoom('exec', { command: 'curl https://example.com' }).room,
      ).toBe('warehouse')
      expect(
        mapToolToRoom('exec', { command: 'pip install requests' }).room,
      ).toBe('warehouse')
      expect(
        mapToolToRoom('exec', { command: 'npm install phaser' }).room,
      ).toBe('warehouse')
      expect(mapToolToRoom('exec', { command: 'brew install jq' }).room).toBe(
        'warehouse',
      )
    })
  })

  describe('2F — Main Floor rooms', () => {
    it('maps generic exec → toolbox', () => {
      expect(mapToolToRoom('exec', { command: 'ls -la' }).room).toBe('toolbox')
      expect(mapToolToRoom('exec', { command: 'echo hello' }).room).toBe(
        'toolbox',
      )
    })

    it('maps unknown tool → office (default)', () => {
      expect(mapToolToRoom('unknown_tool_xyz').room).toBe('office')
    })
  })

  describe('1F — Basement rooms', () => {
    it.each([
      ['sessions_spawn', 'basement'],
      ['sessions_send', 'basement'],
      ['sessions_list', 'basement'],
      ['sessions_history', 'basement'],
      ['sessions_yield', 'basement'],
      ['task', 'basement'],
    ])('maps %s → %s (Basement)', (tool, room) => {
      expect(mapToolToRoom(tool).room).toBe(room)
    })

    it('maps exec with dev command → server_room', () => {
      expect(mapToolToRoom('exec', { command: 'git status' }).room).toBe(
        'server_room',
      )
      expect(mapToolToRoom('exec', { command: 'python3 main.py' }).room).toBe(
        'server_room',
      )
      expect(mapToolToRoom('exec', { command: 'npm run build' }).room).toBe(
        'server_room',
      )
      expect(mapToolToRoom('exec', { command: 'cargo test' }).room).toBe(
        'server_room',
      )
    })

    it('maps exec with delete command → trash', () => {
      expect(mapToolToRoom('exec', { command: 'rm -rf dist/' }).room).toBe(
        'trash',
      )
      expect(
        mapToolToRoom('exec', { command: 'trash old-file.txt' }).room,
      ).toBe('trash')
    })
  })
})

describe('parseSessionLogEvent', () => {
  describe('session events', () => {
    it('returns WAKE_UP for session init', () => {
      const action = parseSessionLogEvent(makeSessionEvent())
      expect(action).toEqual({ type: 'WAKE_UP' })
    })
  })

  describe('user messages', () => {
    it('returns GOTO_ROOM(office) for user message', () => {
      const action = parseSessionLogEvent(makeUserMessage())
      expect(action).toEqual({
        type: 'GOTO_ROOM',
        room: 'office',
        animation: 'type',
        emotion: 'focused',
        speed: 'fast',
      })
    })
  })

  describe('assistant messages with toolCalls', () => {
    it('returns GOTO_ROOM for write tool → study', () => {
      const action = parseSessionLogEvent(makeAssistantToolCall('write'))
      expect(action).toEqual({
        type: 'GOTO_ROOM',
        room: 'study',
        animation: 'type',
        emotion: 'focused',
        speed: 'fast',
      })
    })

    it('returns GOTO_ROOM for read tool → study', () => {
      const action = parseSessionLogEvent(makeAssistantToolCall('read'))
      expect(action).toEqual({
        type: 'GOTO_ROOM',
        room: 'study',
        animation: 'think',
        emotion: 'curious',
        speed: 'fast',
      })
    })

    it('routes exec with git command → server_room', () => {
      const action = parseSessionLogEvent(
        makeAssistantToolCall('exec', { command: 'git diff HEAD' }),
      )
      expect(action).toEqual({
        type: 'GOTO_ROOM',
        room: 'server_room',
        animation: 'type',
        emotion: 'focused',
        speed: 'fast',
      })
    })

    it('routes exec with rm command → trash', () => {
      const action = parseSessionLogEvent(
        makeAssistantToolCall('exec', { command: 'rm -rf node_modules' }),
      )
      expect(action).toEqual({
        type: 'GOTO_ROOM',
        room: 'trash',
        animation: 'type',
        emotion: 'serious',
        speed: 'fast',
      })
    })

    it('returns GOTO_ROOM with default for unknown tool → office', () => {
      const action = parseSessionLogEvent(
        makeAssistantToolCall('some_unknown_tool'),
      )
      expect(action).toEqual({
        type: 'GOTO_ROOM',
        room: 'office',
        animation: 'type',
        emotion: 'focused',
        speed: 'fast',
      })
    })
  })

  describe('assistant messages with stopReason', () => {
    it('returns GO_SLEEP for stopReason=stop (no toolCalls)', () => {
      const action = parseSessionLogEvent(makeAssistantText('All done!'))
      expect(action).toEqual({ type: 'GO_SLEEP' })
    })

    it('returns GOTO_ROOM when toolCall present even if stopReason=stop', () => {
      const action = parseSessionLogEvent(
        makeAssistantToolCall('edit', {}, 'stop'),
      )
      expect(action).toEqual({
        type: 'GOTO_ROOM',
        room: 'study',
        animation: 'type',
        emotion: 'focused',
        speed: 'fast',
      })
    })
  })

  describe('assistant messages with thinking only', () => {
    it('returns GOTO_ROOM(office, think, thinking)', () => {
      const action = parseSessionLogEvent(makeAssistantThinking())
      expect(action).toEqual({
        type: 'GOTO_ROOM',
        room: 'office',
        animation: 'think',
        emotion: 'thinking',
        speed: 'fast',
      })
    })
  })

  describe('assistant messages with text', () => {
    it('returns GOTO_ROOM(office, type, focused) for text reply', () => {
      const event: SessionLogEvent = {
        type: 'message',
        id: 'test',
        parentId: null,
        timestamp: new Date().toISOString(),
        message: {
          role: 'assistant',
          content: [{ type: 'text', text: 'Here is the answer' }],
          stopReason: 'toolUse',
        },
      }
      const action = parseSessionLogEvent(event)
      expect(action).toEqual({
        type: 'GOTO_ROOM',
        room: 'office',
        animation: 'type',
        emotion: 'focused',
        speed: 'fast',
      })
    })
  })

  describe('toolResult messages', () => {
    it('returns null for toolResult', () => {
      const action = parseSessionLogEvent(makeToolResult())
      expect(action).toBeNull()
    })
  })

  describe('other event types', () => {
    it('returns null for model_change', () => {
      const action = parseSessionLogEvent(makeModelChange())
      expect(action).toBeNull()
    })

    it('returns null for thinking_level_change', () => {
      const event: SessionLogEvent = {
        type: 'thinking_level_change',
        id: 'test',
        parentId: null,
        timestamp: new Date().toISOString(),
        thinkingLevel: 'high',
      }
      const action = parseSessionLogEvent(event)
      expect(action).toBeNull()
    })
  })
})
