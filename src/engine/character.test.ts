import { describe, it, expect } from 'vitest'
import { updateCharacter, processAction } from './character.ts'
import {
  createInitialCharacterState,
  type WorldState,
  type CharacterState,
} from './gameState.ts'
import {
  buildWalkabilityGrid,
  FLOOR_LAYOUT,
  MAP_COLS,
  MAP_ROWS,
} from '@/world/tileMap.ts'
import { ROOMS } from '@/world/rooms.ts'
import { ALL_FURNITURE } from '@/world/furniture.ts'

function makeWorld(): WorldState {
  return {
    width: MAP_COLS,
    height: MAP_ROWS,
    tiles: FLOOR_LAYOUT,
    walkabilityGrid: buildWalkabilityGrid(FLOOR_LAYOUT, ALL_FURNITURE),
    rooms: ROOMS,
    furniture: ALL_FURNITURE,
    walls: [],
  }
}

function makeCharacter(overrides?: Partial<CharacterState>): CharacterState {
  return { ...createInitialCharacterState(), ...overrides }
}

describe('Character FSM', () => {
  describe('processAction', () => {
    it('GOTO_ROOM sets walking state and path', () => {
      const world = makeWorld()
      const character = makeCharacter({
        position: { col: 3, row: 6 },
        state: 'idle',
      })

      processAction(
        character,
        {
          type: 'GOTO_ROOM',
          room: 'study',
          animation: 'sit',
          emotion: 'curious',
        },
        world,
      )

      expect(character.state).toBe('walking')
      expect(character.path).not.toBeNull()
      expect(character.path!.length).toBeGreaterThan(0)
      expect(character.targetState).toBe('sitting')
      expect(character.targetEmotion).toBe('curious')
    })

    it('GOTO_ROOM transitions directly if already at destination', () => {
      const world = makeWorld()
      const activityZone = ROOMS.workshop.activityZone
      const character = makeCharacter({
        position: { col: activityZone.col, row: activityZone.row },
        state: 'idle',
      })

      processAction(
        character,
        {
          type: 'GOTO_ROOM',
          room: 'workshop',
          animation: 'type',
          emotion: 'focused',
        },
        world,
      )

      expect(character.state).toBe('typing')
      expect(character.emotion).toBe('focused')
    })

    it('WAKE_UP transitions from sleeping to idle', () => {
      const world = makeWorld()
      const character = makeCharacter({ state: 'sleeping' })

      processAction(character, { type: 'WAKE_UP' }, world)

      expect(character.state).toBe('idle')
      expect(character.emotion).toBe('thinking')
    })

    it('WAKE_UP does nothing if not sleeping', () => {
      const world = makeWorld()
      const character = makeCharacter({ state: 'typing' })

      processAction(character, { type: 'WAKE_UP' }, world)

      expect(character.state).toBe('typing')
    })

    it('GO_SLEEP sets idle with sleep delay', () => {
      const world = makeWorld()
      const character = makeCharacter({
        position: { col: 3, row: 6 },
        state: 'idle',
      })

      processAction(character, { type: 'GO_SLEEP' }, world)

      expect(character.state).toBe('idle')
      expect(character.emotion).toBe('sleepy')
      expect(character.sleepDelayTimer).toBeGreaterThan(0)
    })

    it('CELEBRATE sets celebrating state', () => {
      const world = makeWorld()
      const character = makeCharacter({ state: 'idle' })

      processAction(character, { type: 'CELEBRATE' }, world)

      expect(character.state).toBe('celebrating')
      expect(character.emotion).toBe('happy')
    })

    it('CONFUSED changes emotion only', () => {
      const world = makeWorld()
      const character = makeCharacter({ state: 'typing', emotion: 'focused' })

      processAction(character, { type: 'CONFUSED' }, world)

      expect(character.state).toBe('typing')
      expect(character.emotion).toBe('confused')
    })
  })

  describe('updateCharacter', () => {
    it('processes pending actions when idle', () => {
      const world = makeWorld()
      const character = makeCharacter({
        position: { col: 4, row: 5 },
        state: 'idle',
        pendingActions: [{ type: 'CELEBRATE' }],
      })

      updateCharacter(character, 1 / 60, world)

      expect(character.state).toBe('celebrating')
      expect(character.pendingActions.length).toBe(0)
    })

    it('auto-sleeps after idle threshold', () => {
      const world = makeWorld()
      const character = makeCharacter({
        position: { col: 4, row: 5 },
        state: 'idle',
        idleTimer: 29,
        sleepDelayTimer: 0,
        currentSpeed: 3,
      })

      // Push past threshold (30s)
      updateCharacter(character, 2, world)

      // Should now be idle with sleepDelay set (waiting before going to bed)
      expect(character.state).toBe('idle')
      expect(character.sleepDelayTimer).toBeGreaterThan(0)
    })

    it('advances along path when walking', () => {
      const world = makeWorld()
      const character = makeCharacter({
        position: { col: 2, row: 5 },
        state: 'walking',
        path: [
          { col: 2, row: 6 },
          { col: 3, row: 6 },
        ],
        pathIndex: 0,
        targetState: 'typing',
        targetEmotion: 'focused',
        currentAnimation: 'walk',
      })

      // Update several times to move
      for (let i = 0; i < 200; i++) {
        updateCharacter(character, 1 / 60, world)
      }

      // Should have reached destination
      expect(character.state).toBe('typing')
      expect(character.emotion).toBe('focused')
    })

    it('can be interrupted while typing', () => {
      const world = makeWorld()
      const character = makeCharacter({
        position: { col: 4, row: 5 },
        state: 'typing',
        pendingActions: [{ type: 'CELEBRATE' }],
      })

      updateCharacter(character, 1 / 60, world)

      expect(character.state).toBe('celebrating')
    })
  })
})
