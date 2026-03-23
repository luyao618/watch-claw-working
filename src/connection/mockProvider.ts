/**
 * Mock Data Provider — generates realistic OpenClaw session log events
 * for development and demo purposes.
 *
 * Produces SessionLogEvent objects in the same format as real session logs.
 */

import type { SessionLogEvent } from './types.ts'
import { generateId } from '@/utils/helpers.ts'

// ── Helpers ─────────────────────────────────────────────────────────────────

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function weightedRandom(items: string[], weights: number[]): string {
  const total = weights.reduce((a, b) => a + b, 0)
  let r = Math.random() * total
  for (let i = 0; i < items.length; i++) {
    r -= weights[i]
    if (r <= 0) return items[i]
  }
  return items[items.length - 1]
}

// ── Mock Provider Class ─────────────────────────────────────────────────────

export class MockProvider {
  private outerTimerId: ReturnType<typeof setTimeout> | null = null
  private innerTimerId: ReturnType<typeof setTimeout> | null = null
  private idleTimerId: ReturnType<typeof setTimeout> | null = null
  /** Tracks all ad-hoc timers (thinking delay, text reply, user message) so stop() can cancel them */
  private miscTimerIds = new Set<ReturnType<typeof setTimeout>>()
  private onEvent: ((event: SessionLogEvent) => void) | null = null
  private eventSeq = 0
  private toolCount = 0
  private maxToolsPerSession = 0
  private running = false

  // ── Public API ──────────────────────────────────────────────────────────

  start(onEvent: (event: SessionLogEvent) => void): void {
    if (this.running) return
    this.running = true
    this.onEvent = onEvent
    this.startNewSession()
  }

  stop(): void {
    this.running = false
    this.clearAllTimers()
    if (this.onEvent) {
      this.emitEndTurn()
    }
    this.onEvent = null
  }

  get isRunning(): boolean {
    return this.running
  }

  // ── Session lifecycle ─────────────────────────────────────────────────

  private startNewSession(): void {
    if (!this.running) return

    this.eventSeq = 0
    this.toolCount = 0
    this.maxToolsPerSession = randomBetween(10, 30)

    // Emit session init
    this.emitSessionInit()

    // Emit user message after a short pause
    this.scheduleTimer(() => {
      if (!this.running) return
      this.emitUserMessage(this.randomUserMessage())
      this.scheduleNextTool()
    }, 500)
  }

  private scheduleNextTool(): void {
    if (!this.running) return

    this.toolCount++
    if (this.toolCount > this.maxToolsPerSession) {
      // End the session
      this.emitEndTurn()
      // Schedule new session after idle
      this.idleTimerId = setTimeout(
        () => {
          this.idleTimerId = null
          this.startNewSession()
        },
        randomBetween(10_000, 30_000),
      )
      return
    }

    // Sometimes emit thinking before tool
    const thinkFirst = Math.random() < 0.3
    const thinkDelay = thinkFirst ? randomBetween(1000, 3000) : 0

    if (thinkFirst) {
      this.scheduleTimer(() => {
        if (!this.running) return
        this.emitAssistantThinking()
      }, thinkDelay / 2)
    }

    const toolDelay = randomBetween(3000, 8000)
    this.outerTimerId = setTimeout(() => {
      this.outerTimerId = null
      if (!this.running) return

      const tool = this.randomTool()
      this.emitAssistantToolCall(tool)

      // Tool result after 1-5s
      const duration = randomBetween(1000, 5000)
      this.innerTimerId = setTimeout(() => {
        this.innerTimerId = null
        if (!this.running) return
        this.emitToolResult(tool, duration)

        // Sometimes emit assistant text after tool result
        if (Math.random() < 0.2) {
          this.scheduleTimer(
            () => {
              if (!this.running) return
              this.emitAssistantTextReply()
            },
            randomBetween(500, 1500),
          )
        }

        this.scheduleNextTool()
      }, duration)
    }, toolDelay)
  }

  // ── Event emitters ────────────────────────────────────────────────────

  private emitSessionInit(): void {
    this.emit({
      type: 'session',
      id: this.nextId(),
      parentId: null,
      timestamp: new Date().toISOString(),
      version: 3,
      cwd: '/mock/project',
    })
  }

  private emitUserMessage(text: string): void {
    this.emit({
      type: 'message',
      id: this.nextId(),
      parentId: null,
      timestamp: new Date().toISOString(),
      message: {
        role: 'user',
        content: text,
      },
    })
  }

  private emitAssistantToolCall(toolName: string): void {
    this.emit({
      type: 'message',
      id: this.nextId(),
      parentId: null,
      timestamp: new Date().toISOString(),
      message: {
        role: 'assistant',
        content: [
          { type: 'thinking', thinking: 'Let me use ' + toolName + '...' },
          {
            type: 'toolCall',
            id: generateId(),
            name: toolName,
            arguments: this.randomToolArgs(toolName),
          },
        ],
        provider: 'github-copilot',
        model: 'claude-opus-4.6',
        stopReason: 'toolUse',
        usage: this.randomUsage(),
      },
    })
  }

  private emitToolResult(toolName: string, durationMs: number): void {
    this.emit({
      type: 'message',
      id: this.nextId(),
      parentId: null,
      timestamp: new Date().toISOString(),
      message: {
        role: 'toolResult',
        toolCallId: generateId(),
        toolName,
        content: [{ type: 'text', text: this.randomToolResultText(toolName) }],
        details: {
          status: Math.random() < 0.95 ? 'completed' : 'error',
          exitCode: Math.random() < 0.95 ? 0 : 1,
          durationMs,
        },
        isError: Math.random() < 0.05,
      },
    })
  }

  private emitAssistantThinking(): void {
    this.emit({
      type: 'message',
      id: this.nextId(),
      parentId: null,
      timestamp: new Date().toISOString(),
      message: {
        role: 'assistant',
        content: [
          {
            type: 'thinking',
            thinking: this.randomThinkingText(),
          },
        ],
        provider: 'github-copilot',
        model: 'claude-opus-4.6',
        stopReason: 'toolUse',
      },
    })
  }

  private emitAssistantTextReply(): void {
    this.emit({
      type: 'message',
      id: this.nextId(),
      parentId: null,
      timestamp: new Date().toISOString(),
      message: {
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: this.randomAssistantText(),
          },
        ],
        provider: 'github-copilot',
        model: 'claude-opus-4.6',
        stopReason: 'toolUse',
      },
    })
  }

  private emitEndTurn(): void {
    this.emit({
      type: 'message',
      id: this.nextId(),
      parentId: null,
      timestamp: new Date().toISOString(),
      message: {
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: 'Done! The task is complete.',
          },
        ],
        provider: 'github-copilot',
        model: 'claude-opus-4.6',
        stopReason: 'stop',
      },
    })
  }

  // ── Emit helper ───────────────────────────────────────────────────────

  private emit(event: SessionLogEvent): void {
    if (this.onEvent) {
      this.onEvent(event)
    }
  }

  // ── Random data generators ────────────────────────────────────────────

  private randomTool(): string {
    const tools = [
      'write',
      'edit',
      'read',
      'exec',
      'grep',
      'glob',
      'web_search',
      'task',
    ]
    const weights = [25, 20, 20, 15, 8, 5, 5, 2]
    return weightedRandom(tools, weights)
  }

  private randomToolArgs(toolName: string): Record<string, unknown> {
    switch (toolName) {
      case 'write':
      case 'edit':
        return {
          filePath: '/src/' + this.randomFilename(),
          content: '// updated code',
        }
      case 'read':
        return { filePath: '/src/' + this.randomFilename() }
      case 'exec':
        return { command: 'pnpm test' }
      case 'grep':
        return { pattern: 'TODO', path: '/src' }
      case 'glob':
        return { pattern: '**/*.ts', path: '/src' }
      case 'web_search':
        return { query: 'typescript best practices' }
      case 'task':
        return { name: 'analyze-codebase' }
      default:
        return {}
    }
  }

  private randomFilename(): string {
    const files = [
      'App.tsx',
      'index.ts',
      'utils.ts',
      'types.ts',
      'config.ts',
      'helpers.ts',
      'service.ts',
      'api.ts',
      'auth.ts',
      'store.ts',
    ]
    return files[randomBetween(0, files.length - 1)]
  }

  private randomUserMessage(): string {
    const messages = [
      'Help me refactor the auth module',
      'Fix the bug in the login page',
      'Add unit tests for the API service',
      'Update the README documentation',
      'Optimize the database queries',
      'Implement the search feature',
      'Review the pull request changes',
      'Set up the CI/CD pipeline',
    ]
    return messages[randomBetween(0, messages.length - 1)]
  }

  private randomThinkingText(): string {
    const thoughts = [
      'Analyzing the codebase structure...',
      'Let me check the existing implementation...',
      'I need to understand the dependencies first...',
      'Considering the best approach for this...',
      'Let me review the related files...',
    ]
    return thoughts[randomBetween(0, thoughts.length - 1)]
  }

  private randomAssistantText(): string {
    const texts = [
      "I've updated the file. Let me verify it works.",
      'The test is passing now. Let me check the other files.',
      'Good, the changes look correct. Let me move on.',
      'I found the issue. Let me fix it.',
      'Let me run the tests to make sure everything works.',
    ]
    return texts[randomBetween(0, texts.length - 1)]
  }

  private randomToolResultText(toolName: string): string {
    switch (toolName) {
      case 'write':
        return 'File written successfully.'
      case 'edit':
        return 'File edited successfully.'
      case 'read':
        return 'File content: // ... (truncated)'
      case 'exec':
        return 'Tests passed: 42 passed, 0 failed'
      case 'grep':
        return 'Found 3 matches in 2 files'
      case 'glob':
        return 'Found 15 files matching pattern'
      case 'web_search':
        return 'Found relevant results for the query'
      case 'task':
        return 'Subtask completed successfully'
      default:
        return 'Tool completed.'
    }
  }

  private randomUsage() {
    const input = randomBetween(100, 2000)
    const output = randomBetween(50, 500)
    const cacheRead = randomBetween(0, 1000)
    const cacheWrite = randomBetween(0, 200)
    return {
      input,
      output,
      cacheRead,
      cacheWrite,
      totalTokens: input + output + cacheRead + cacheWrite,
      cost: {
        input: input * 0.00001,
        output: output * 0.00003,
        cacheRead: cacheRead * 0.000001,
        cacheWrite: cacheWrite * 0.000005,
        total:
          input * 0.00001 +
          output * 0.00003 +
          cacheRead * 0.000001 +
          cacheWrite * 0.000005,
      },
    }
  }

  // ── Utilities ─────────────────────────────────────────────────────────

  private nextId(): string {
    return `mock-${++this.eventSeq}`
  }

  /**
   * Schedule a callback and track its timer ID so clearAllTimers() can cancel it.
   */
  private scheduleTimer(callback: () => void, delayMs: number): void {
    const id = setTimeout(() => {
      this.miscTimerIds.delete(id)
      callback()
    }, delayMs)
    this.miscTimerIds.add(id)
  }

  private clearAllTimers(): void {
    if (this.outerTimerId) {
      clearTimeout(this.outerTimerId)
      this.outerTimerId = null
    }
    if (this.innerTimerId) {
      clearTimeout(this.innerTimerId)
      this.innerTimerId = null
    }
    if (this.idleTimerId) {
      clearTimeout(this.idleTimerId)
      this.idleTimerId = null
    }
    for (const id of this.miscTimerIds) {
      clearTimeout(id)
    }
    this.miscTimerIds.clear()
  }
}
