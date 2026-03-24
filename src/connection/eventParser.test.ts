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
          arguments: { path: '/test/file.ts' },
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
  it.each([
    ['write', 'workshop', 'type', 'focused'],
    ['edit', 'workshop', 'type', 'focused'],
    ['exec', 'workshop', 'type', 'serious'],
    ['read', 'workshop', 'type', 'thinking'],
    ['grep', 'workshop', 'type', 'curious'],
    ['glob', 'workshop', 'type', 'curious'],
    ['web_search', 'workshop', 'type', 'curious'],
    ['memory_search', 'workshop', 'type', 'thinking'],
    ['memory_get', 'workshop', 'type', 'thinking'],
    ['task', 'workshop', 'type', 'thinking'],
    ['todowrite', 'workshop', 'type', 'focused'],
    ['process', 'workshop', 'type', 'serious'],
    ['sessions_spawn', 'workshop', 'type', 'thinking'],
    ['sessions_send', 'workshop', 'type', 'thinking'],
    ['sessions_list', 'workshop', 'type', 'curious'],
    ['sessions_history', 'workshop', 'type', 'curious'],
  ])(
    'maps %s → room=%s, animation=%s, emotion=%s',
    (tool, room, animation, emotion) => {
      const result = mapToolToRoom(tool)
      expect(result.room).toBe(room)
      expect(result.animation).toBe(animation)
      expect(result.emotion).toBe(emotion)
    },
  )

  it('maps unknown tool to default (workshop)', () => {
    const result = mapToolToRoom('unknown_tool_xyz')
    expect(result.room).toBe('workshop')
    expect(result.animation).toBe('type')
    expect(result.emotion).toBe('focused')
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
    it('returns GOTO_ROOM(study) for user message', () => {
      const action = parseSessionLogEvent(makeUserMessage())
      expect(action).toEqual({
        type: 'GOTO_ROOM',
        room: 'study',
        animation: 'type',
        emotion: 'focused',
        speed: 'fast',
      })
    })
  })

  describe('assistant messages with toolCalls', () => {
    it('returns GOTO_ROOM for write tool', () => {
      const action = parseSessionLogEvent(makeAssistantToolCall('write'))
      expect(action).toEqual({
        type: 'GOTO_ROOM',
        room: 'workshop',
        animation: 'type',
        emotion: 'focused',
        speed: 'fast',
      })
    })

    it('returns GOTO_ROOM for read tool', () => {
      const action = parseSessionLogEvent(makeAssistantToolCall('read'))
      expect(action).toEqual({
        type: 'GOTO_ROOM',
        room: 'workshop',
        animation: 'type',
        emotion: 'thinking',
        speed: 'fast',
      })
    })

    it('returns GOTO_ROOM with default for unknown tool', () => {
      const action = parseSessionLogEvent(
        makeAssistantToolCall('some_unknown_tool'),
      )
      expect(action).toEqual({
        type: 'GOTO_ROOM',
        room: 'workshop',
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
      // This shouldn't normally happen, but toolCall takes priority
      const action = parseSessionLogEvent(makeAssistantToolCall('edit', 'stop'))
      expect(action).toEqual({
        type: 'GOTO_ROOM',
        room: 'workshop',
        animation: 'type',
        emotion: 'focused',
        speed: 'fast',
      })
    })
  })

  describe('assistant messages with thinking only', () => {
    it('returns GOTO_ROOM(study, think, thinking)', () => {
      const action = parseSessionLogEvent(makeAssistantThinking())
      expect(action).toEqual({
        type: 'GOTO_ROOM',
        room: 'study',
        animation: 'think',
        emotion: 'thinking',
        speed: 'fast',
      })
    })
  })

  describe('assistant messages with text', () => {
    it('returns GOTO_ROOM(study, type, focused) for text reply', () => {
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
        room: 'study',
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
