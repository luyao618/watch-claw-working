/**
 * Character FSM — manages character state transitions, animation, and movement.
 */

import { findPath, getDirection } from './pathfinding.ts'
import type { TileCoord } from './coordinates.ts'
import type {
  CharacterState,
  CharacterFSMState,
  WorldState,
  Direction,
} from './gameState.ts'
import type {
  CharacterAction,
  AnimationId,
  EmotionId,
} from '@/connection/types.ts'
import { ANIMATIONS } from '@/world/sprites.ts'
import {
  CHARACTER_SPEED,
  CHARACTER_SPEED_FAST,
  CHARACTER_SPEED_SLOW,
  IDLE_SLEEP_THRESHOLD_S,
  SLEEP_DELAY_S,
} from '@/utils/constants.ts'

// ── Animation Helpers ───────────────────────────────────────────────────────

function mapAnimationToState(animation: AnimationId): CharacterFSMState {
  switch (animation) {
    case 'type':
      return 'typing'
    case 'sleep':
      return 'sleeping'
    case 'think':
      return 'thinking'
    case 'sit':
      return 'sitting'
    case 'celebrate':
      return 'celebrating'
    case 'walk':
      return 'walking'
    case 'idle':
    default:
      return 'idle'
  }
}

function transitionTo(
  character: CharacterState,
  state: CharacterFSMState,
  emotion: EmotionId,
): void {
  character.state = state
  character.emotion = emotion
  character.idleTimer = 0

  // Map state to animation
  switch (state) {
    case 'typing':
      character.currentAnimation = 'type'
      break
    case 'sleeping':
      character.currentAnimation = 'sleep'
      break
    case 'thinking':
      character.currentAnimation = 'think'
      break
    case 'sitting':
      character.currentAnimation = 'sit'
      break
    case 'celebrating':
      character.currentAnimation = 'celebrate'
      break
    case 'walking':
      character.currentAnimation = 'walk'
      break
    case 'idle':
    default:
      character.currentAnimation = 'idle'
      break
  }

  character.animationFrame = 0
}

// ── Movement ────────────────────────────────────────────────────────────────

function moveAlongPath(character: CharacterState, dt: number): void {
  if (!character.path || character.pathIndex >= character.path.length) return

  const target = character.path[character.pathIndex]
  const dx = target.col - character.position.col
  const dy = target.row - character.position.row
  const distance = Math.sqrt(dx * dx + dy * dy)

  // Store previous position for render interpolation
  character.prevPosition = {
    col: character.position.col,
    row: character.position.row,
  }

  if (distance < 0.05) {
    // Snap to tile
    character.position.col = target.col
    character.position.row = target.row
    character.pathIndex++

    // Update facing direction for next waypoint
    if (character.pathIndex < character.path.length) {
      const next = character.path[character.pathIndex]
      character.direction = getDirection(character.position, next) as Direction
    }
  } else {
    // Move toward target using current speed
    const speed = character.currentSpeed * dt
    character.position.col += (dx / distance) * speed
    character.position.row += (dy / distance) * speed
  }
}

function hasReachedDestination(character: CharacterState): boolean {
  return !character.path || character.pathIndex >= character.path.length
}

// ── Update ──────────────────────────────────────────────────────────────────

export function updateCharacter(
  character: CharacterState,
  dt: number,
  world: WorldState,
): void {
  switch (character.state) {
    case 'idle':
      // Check sleep delay (waiting at computer before going to bed)
      if (character.sleepDelayTimer > 0) {
        character.sleepDelayTimer -= dt
        if (character.sleepDelayTimer <= 0) {
          character.sleepDelayTimer = 0
          // Now slowly walk to bedroom
          character.currentSpeed = CHARACTER_SPEED_SLOW
          processAction(
            character,
            {
              type: 'GOTO_ROOM',
              room: 'bedroom',
              animation: 'sleep',
              emotion: 'sleepy',
              speed: 'slow',
            },
            world,
          )
        }
        break
      }
      // Check pending actions
      if (character.pendingActions.length > 0) {
        processAction(character, character.pendingActions.shift()!, world)
      }
      // Auto-sleep after idle threshold
      character.idleTimer += dt
      if (character.idleTimer > IDLE_SLEEP_THRESHOLD_S) {
        processAction(character, { type: 'GO_SLEEP' }, world)
      }
      break

    case 'walking':
      moveAlongPath(character, dt)
      if (hasReachedDestination(character)) {
        // Transition to target state
        transitionTo(
          character,
          character.targetState ?? 'idle',
          character.targetEmotion ?? 'none',
        )
        character.path = null
        character.targetState = null
        character.targetEmotion = null

        // Update current room based on final position
        updateCurrentRoom(character, world)

        // If arrived at bedroom to sleep, snap to bed center
        if (
          character.currentRoom === 'bedroom' &&
          character.emotion === 'sleepy'
        ) {
          character.position = { col: 18.5, row: 3.5 }
        }
      }
      break

    case 'typing':
    case 'sitting':
    case 'thinking':
    case 'sleeping':
    case 'celebrating':
      // These states can be interrupted by pending actions
      if (character.pendingActions.length > 0) {
        processAction(character, character.pendingActions.shift()!, world)
      }
      break
  }

  // Update animation frame
  updateAnimation(character, dt)
}

// ── Action Processing ───────────────────────────────────────────────────────

export function processAction(
  character: CharacterState,
  action: CharacterAction,
  world: WorldState,
): void {
  switch (action.type) {
    case 'GOTO_ROOM': {
      const room = world.rooms[action.room]
      if (!room) {
        console.warn(`[Character] Unknown room: ${action.room}`)
        return
      }

      // Set speed based on action
      if (action.speed === 'fast') {
        character.currentSpeed = CHARACTER_SPEED_FAST
      } else if (action.speed === 'slow') {
        character.currentSpeed = CHARACTER_SPEED_SLOW
      } else {
        character.currentSpeed = CHARACTER_SPEED
      }

      // Cancel any pending sleep delay
      character.sleepDelayTimer = 0

      const targetTile = room.activityZone
      const fromTile: TileCoord = {
        col: Math.round(character.position.col),
        row: Math.round(character.position.row),
      }

      const path = findPath(fromTile, targetTile, world.walkabilityGrid)

      if (path && path.length > 0) {
        character.state = 'walking'
        character.currentAnimation = 'walk'
        character.path = path
        character.pathIndex = 0
        character.prevPosition = null
        character.targetState = mapAnimationToState(action.animation)
        character.targetEmotion = action.emotion
        character.direction = getDirection(fromTile, path[0]) as Direction
      } else {
        // Already at destination or no path found
        transitionTo(
          character,
          mapAnimationToState(action.animation),
          action.emotion,
        )
        character.currentRoom = action.room
      }
      break
    }

    case 'WAKE_UP':
      if (character.state === 'sleeping') {
        transitionTo(character, 'idle', 'thinking')
      }
      break

    case 'GO_SLEEP':
      // Set a delay timer — character waits at current position before going to bed
      character.sleepDelayTimer = SLEEP_DELAY_S
      transitionTo(character, 'idle', 'sleepy')
      break

    case 'CELEBRATE':
      transitionTo(character, 'celebrating', 'happy')
      break

    case 'CONFUSED':
      character.emotion = 'confused'
      break

    case 'CHANGE_EMOTION':
      character.emotion = action.emotion
      break

    case 'CHANGE_ANIMATION':
      character.currentAnimation = action.animation
      character.animationFrame = 0
      break

    case 'RESET':
      // Full reset — used when session switches or reconnecting.
      // Clears all pending actions and returns character to bedroom/sleeping.
      character.pendingActions.length = 0
      character.path = null
      character.pathIndex = 0
      character.targetState = null
      character.targetEmotion = null
      character.prevPosition = null
      transitionTo(character, 'sleeping', 'sleepy')
      character.currentRoom = 'bedroom'
      character.position = { col: 18.5, row: 3.5 } // Center of bed
      break
  }
}

// ── Animation Update ────────────────────────────────────────────────────────

function updateAnimation(character: CharacterState, dt: number): void {
  character.animationTimer += dt

  const config = ANIMATIONS[character.currentAnimation]
  if (!config) return

  const frameDuration = 1 / config.fps
  character.animationFrame += dt / frameDuration

  if (character.animationFrame >= config.frameCount) {
    if (config.loop) {
      character.animationFrame = character.animationFrame % config.frameCount
    } else {
      character.animationFrame = config.frameCount - 1
    }
  }
}

// ── Room Detection ──────────────────────────────────────────────────────────

function updateCurrentRoom(character: CharacterState, world: WorldState): void {
  const col = Math.round(character.position.col)
  const row = Math.round(character.position.row)

  for (const room of Object.values(world.rooms)) {
    if (
      col >= room.bounds.startCol &&
      col <= room.bounds.endCol &&
      row >= room.bounds.startRow &&
      row <= room.bounds.endRow
    ) {
      character.currentRoom = room.id
      return
    }
  }
}

const MAX_PENDING_ACTIONS = 5

/**
 * Queue an action for the character. Used by ConnectionManager.
 * Caps the queue at MAX_PENDING_ACTIONS and deduplicates same-room GOTO_ROOM actions.
 */
export function queueAction(
  character: CharacterState,
  action: CharacterAction,
): void {
  const queue = character.pendingActions

  // Dedup: if the last action targets the same room, replace it
  if (queue.length > 0) {
    const last = queue[queue.length - 1]
    if (
      last.type === 'GOTO_ROOM' &&
      action.type === 'GOTO_ROOM' &&
      last.room === action.room
    ) {
      queue[queue.length - 1] = action
      return
    }
  }

  // Cap queue size — drop oldest non-critical actions when full
  if (queue.length >= MAX_PENDING_ACTIONS) {
    queue.shift()
  }

  queue.push(action)
}
