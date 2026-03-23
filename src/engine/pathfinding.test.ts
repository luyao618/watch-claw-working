import { describe, it, expect } from 'vitest'
import { findPath, getDirection } from './pathfinding.ts'
import { buildWalkabilityGrid, FLOOR_LAYOUT } from '@/world/tileMap.ts'
import { ALL_FURNITURE } from '@/world/furniture.ts'
import { ROOMS } from '@/world/rooms.ts'

// Build the walkability grid with furniture
const grid = buildWalkabilityGrid(FLOOR_LAYOUT, ALL_FURNITURE)

describe('findPath', () => {
  it('returns empty array when already at destination', () => {
    const path = findPath({ col: 3, row: 4 }, { col: 3, row: 4 }, grid)
    expect(path).toEqual([])
  })

  it('returns null for unreachable destination (wall)', () => {
    const path = findPath({ col: 3, row: 4 }, { col: 0, row: 0 }, grid)
    expect(path).toBeNull()
  })

  it('finds path from office to living room through doors', () => {
    const officeTile = ROOMS.office.activityZone
    const livingTile = ROOMS['living-room'].activityZone

    const path = findPath(officeTile, livingTile, grid)
    expect(path).not.toBeNull()
    expect(path!.length).toBeGreaterThan(0)

    // Path should end at living room activity zone
    const last = path![path!.length - 1]
    expect(last.col).toBe(livingTile.col)
    expect(last.row).toBe(livingTile.row)

    // All tiles in path should be walkable
    for (const tile of path!) {
      expect(grid[tile.row][tile.col]).toBe(true)
    }
  })

  it('finds path from office to bedroom through doors', () => {
    const officeTile = ROOMS.office.activityZone
    const bedroomTile = ROOMS.bedroom.activityZone

    const path = findPath(officeTile, bedroomTile, grid)
    expect(path).not.toBeNull()
    expect(path!.length).toBeGreaterThan(0)

    const last = path![path!.length - 1]
    expect(last.col).toBe(bedroomTile.col)
    expect(last.row).toBe(bedroomTile.row)
  })

  it('finds path from bedroom to office', () => {
    const bedroomTile = ROOMS.bedroom.activityZone
    const officeTile = ROOMS.office.activityZone

    const path = findPath(bedroomTile, officeTile, grid)
    expect(path).not.toBeNull()
    expect(path!.length).toBeGreaterThan(0)
  })

  it('never routes through walls', () => {
    const officeTile = ROOMS.office.activityZone
    const bedroomTile = ROOMS.bedroom.activityZone

    const path = findPath(officeTile, bedroomTile, grid)
    expect(path).not.toBeNull()

    for (const tile of path!) {
      // Verify walkable
      expect(grid[tile.row][tile.col]).toBe(true)
    }
  })

  it('never routes through non-walkable furniture', () => {
    const officeTile = ROOMS.office.activityZone
    const livingTile = ROOMS['living-room'].activityZone

    const path = findPath(officeTile, livingTile, grid)
    expect(path).not.toBeNull()

    for (const tile of path!) {
      expect(grid[tile.row][tile.col]).toBe(true)
    }
  })

  it('all room activity zones are reachable from each other', () => {
    const rooms = Object.values(ROOMS)
    for (let i = 0; i < rooms.length; i++) {
      for (let j = i + 1; j < rooms.length; j++) {
        const path = findPath(
          rooms[i].activityZone,
          rooms[j].activityZone,
          grid,
        )
        expect(path).not.toBeNull()
      }
    }
  })
})

describe('getDirection', () => {
  it('returns ne for positive x, negative y', () => {
    expect(getDirection({ col: 0, row: 0 }, { col: 1, row: -1 })).toBe('ne')
  })

  it('returns nw for negative x, negative y', () => {
    expect(getDirection({ col: 0, row: 0 }, { col: -1, row: -1 })).toBe('nw')
  })

  it('returns se for positive x, positive y', () => {
    expect(getDirection({ col: 0, row: 0 }, { col: 1, row: 1 })).toBe('se')
  })

  it('returns sw for negative x, positive y', () => {
    expect(getDirection({ col: 0, row: 0 }, { col: -1, row: 1 })).toBe('sw')
  })

  it('returns se for same position (dx=0, dy=0)', () => {
    expect(getDirection({ col: 0, row: 0 }, { col: 0, row: 0 })).toBe('se')
  })
})
