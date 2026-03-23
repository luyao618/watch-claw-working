/**
 * Game State — central state object for the entire game.
 *
 * This is a plain TypeScript object modified imperatively.
 * React components subscribe to specific slices via EventBus.
 */

import type {
  AnimationId,
  EmotionId,
  RoomId,
  CharacterAction,
} from '@/connection/types.ts'
import type { TileCoord } from './isometric.ts'

// ── Character State ─────────────────────────────────────────────────────────

export type CharacterFSMState =
  | 'idle'
  | 'walking'
  | 'typing'
  | 'sitting'
  | 'sleeping'
  | 'thinking'
  | 'celebrating'

export type Direction = 'ne' | 'nw' | 'se' | 'sw'

export interface CharacterState {
  position: TileCoord
  prevPosition: TileCoord | null
  state: CharacterFSMState
  emotion: EmotionId
  currentRoom: RoomId
  path: TileCoord[] | null
  pathIndex: number
  targetState: CharacterFSMState | null
  targetEmotion: EmotionId | null
  currentAnimation: AnimationId
  animationFrame: number
  animationTimer: number
  direction: Direction
  idleTimer: number
  pendingActions: CharacterAction[]
}

// ── World State ─────────────────────────────────────────────────────────────

export const TileType = {
  EMPTY: 0,
  FLOOR_WOOD: 1,
  FLOOR_CARPET: 2,
  WALL: 3,
  DOOR: 4,
} as const

export type TileType = (typeof TileType)[keyof typeof TileType]

export interface FurniturePlacement {
  type: string
  col: number
  row: number
  spriteKey: string
  zOffset: number
  walkable: boolean
  occupiable: boolean
}

export interface Room {
  id: RoomId
  name: string
  bounds: {
    startCol: number
    startRow: number
    endCol: number
    endRow: number
  }
  entryTile: TileCoord
  activityZone: TileCoord
  furnitureItems: FurniturePlacement[]
}

export interface WorldState {
  width: number
  height: number
  tiles: TileType[][]
  walkabilityGrid: boolean[][]
  rooms: Record<RoomId, Room>
  furniture: FurniturePlacement[]
  walls: Array<{ col: number; row: number; wallType: 'front' | 'side' }>
}

// ── Camera State ────────────────────────────────────────────────────────────

export interface CameraState {
  offsetX: number
  offsetY: number
  zoom: number
  targetOffsetX: number
  targetOffsetY: number
  targetZoom: number
}

// ── Connection Info ─────────────────────────────────────────────────────────

export interface ConnectionInfo {
  status: 'live' | 'mock' | 'connecting' | 'disconnected'
  lastEventTime: number | null
  model: string | null
  provider: string | null
  sessionId: string | null
  totalTokens: number
  totalCost: number
}

// ── Debug State ─────────────────────────────────────────────────────────────

export interface DebugState {
  showGrid: boolean
  showFps: boolean
  showDashboard: boolean
  forceMock: boolean
  currentFps: number
}

// ── Game State ──────────────────────────────────────────────────────────────

export interface GameState {
  character: CharacterState
  world: WorldState
  camera: CameraState
  connection: ConnectionInfo
  debug: DebugState
}

// ── Factory ─────────────────────────────────────────────────────────────────

export function createInitialCharacterState(): CharacterState {
  return {
    position: { col: 12, row: 5 }, // Start in bedroom
    prevPosition: null,
    state: 'sleeping',
    emotion: 'sleepy',
    currentRoom: 'bedroom',
    path: null,
    pathIndex: 0,
    targetState: null,
    targetEmotion: null,
    currentAnimation: 'sleep',
    animationFrame: 0,
    animationTimer: 0,
    direction: 'sw',
    idleTimer: 0,
    pendingActions: [],
  }
}

export function createInitialCameraState(): CameraState {
  return {
    offsetX: 0,
    offsetY: 0,
    zoom: 2,
    targetOffsetX: 0,
    targetOffsetY: 0,
    targetZoom: 2,
  }
}

export function createInitialConnectionInfo(): ConnectionInfo {
  return {
    status: 'disconnected',
    lastEventTime: null,
    model: null,
    provider: null,
    sessionId: null,
    totalTokens: 0,
    totalCost: 0,
  }
}

export function createInitialDebugState(): DebugState {
  return {
    showGrid: false,
    showFps: true,
    showDashboard: true,
    forceMock: false,
    currentFps: 0,
  }
}
