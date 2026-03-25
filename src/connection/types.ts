// ── Connection State ────────────────────────────────────────────────────────

export type ConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'

// ── Session Log Event Types ─────────────────────────────────────────────────

export interface SessionLogEventBase {
  type: string
  id: string
  parentId?: string | null
  timestamp: string // ISO 8601
}

export interface SessionInitEvent extends SessionLogEventBase {
  type: 'session'
  version: number
  cwd: string
}

export interface ModelChangeEvent extends SessionLogEventBase {
  type: 'model_change'
  provider: string
  modelId: string
}

export interface ThinkingLevelChangeEvent extends SessionLogEventBase {
  type: 'thinking_level_change'
  thinkingLevel: string
}

// ── Message Content Types ───────────────────────────────────────────────────

export interface TextContent {
  type: 'text'
  text: string
}

export interface ThinkingContent {
  type: 'thinking'
  thinking: string
}

export interface ToolCallContent {
  type: 'toolCall'
  id: string
  name: string
  arguments: Record<string, unknown>
}

export type ContentItem = TextContent | ThinkingContent | ToolCallContent

// ── Message Usage ───────────────────────────────────────────────────────────

export interface TokenUsage {
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
  totalTokens: number
  cost: {
    input: number
    output: number
    cacheRead: number
    cacheWrite: number
    total: number
  }
}

// ── Message Types ───────────────────────────────────────────────────────────

export interface UserMessage {
  role: 'user'
  content: string
}

export interface AssistantMessage {
  role: 'assistant'
  content: ContentItem[]
  provider?: string
  model?: string
  usage?: TokenUsage
  stopReason?: 'toolUse' | 'stop'
  timestamp?: number
}

export interface ToolResultMessage {
  role: 'toolResult'
  toolCallId: string
  toolName: string
  content: TextContent[]
  details: {
    status: 'completed' | 'error'
    exitCode?: number
    durationMs: number
    cwd?: string
  }
  isError: boolean
  timestamp?: number
}

export type SessionMessage = UserMessage | AssistantMessage | ToolResultMessage

export interface MessageEvent extends SessionLogEventBase {
  type: 'message'
  message: SessionMessage
}

// ── Union Type ──────────────────────────────────────────────────────────────

export type SessionLogEvent =
  | SessionInitEvent
  | ModelChangeEvent
  | ThinkingLevelChangeEvent
  | MessageEvent

// ── Bridge-specific Messages ────────────────────────────────────────────────

export interface BridgeStatusMessage {
  _bridge: true
  type: 'status'
  watching: string | null
  port: number
}

export interface BridgeSessionSwitchMessage {
  _bridge: true
  type: 'session_switch'
  file: string
}

export type BridgeMessage = BridgeStatusMessage | BridgeSessionSwitchMessage

// ── Character Actions ───────────────────────────────────────────────────────

export type RoomId =
  | 'warehouse'
  | 'study'
  | 'balcony' // 3F
  | 'toolbox'
  | 'office'
  | 'bedroom' // 2F
  | 'basement'
  | 'server_room'
  | 'trash' // 1F
  // Legacy v0.2 aliases (kept for backwards compatibility)
  | 'workshop'

export type AnimationId =
  | 'idle'
  | 'walk'
  | 'sit'
  | 'type'
  | 'sleep'
  | 'think'
  | 'celebrate'

export type EmotionId =
  | 'focused'
  | 'thinking'
  | 'sleepy'
  | 'happy'
  | 'confused'
  | 'curious'
  | 'serious'
  | 'satisfied'
  | 'busy'
  | 'none'

export type CharacterAction =
  | {
      type: 'GOTO_ROOM'
      room: RoomId
      animation: AnimationId
      emotion: EmotionId
      speed?: 'fast' | 'slow' | 'normal'
    }
  | { type: 'CHANGE_EMOTION'; emotion: EmotionId }
  | { type: 'CHANGE_ANIMATION'; animation: AnimationId }
  | { type: 'WAKE_UP' }
  | { type: 'GO_SLEEP' }
  | { type: 'CELEBRATE' }
  | { type: 'CONFUSED' }
  | { type: 'RESET' }

// ── Bridge Client Options ───────────────────────────────────────────────────

export interface BridgeClientOptions {
  url: string
  reconnectBaseMs?: number
  reconnectMaxMs?: number
  maxReconnectAttempts?: number
}
