// Connection Layer
// WebSocket client, event parsing, mock provider, connection management

export { BridgeClient } from './bridgeClient.ts'
export { MockProvider } from './mockProvider.ts'
export { ConnectionManager } from './connectionManager.ts'
export { ActionQueue } from './actionQueue.ts'
export {
  parseSessionLogEvent,
  mapToolToRoom,
  resetAssistantThrottle,
} from './eventParser.ts'
export type {
  ConnectionState,
  SessionLogEvent,
  SessionInitEvent,
  ModelChangeEvent,
  ThinkingLevelChangeEvent,
  MessageEvent,
  SessionMessage,
  UserMessage,
  AssistantMessage,
  ToolResultMessage,
  ContentItem,
  TextContent,
  ThinkingContent,
  ToolCallContent,
  TokenUsage,
  CharacterAction,
  RoomId,
  AnimationId,
  EmotionId,
  BridgeClientOptions,
  BridgeMessage,
} from './types.ts'
export type { ConnectionStatus, SessionInfo } from './connectionManager.ts'
export type { ActionPriority } from './actionQueue.ts'
