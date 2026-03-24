import { describe, it, expect } from 'vitest'
import { findPath, getDirection } from './pathfinding.ts'
import { buildWalkabilityGrid, FLOOR_LAYOUT } from '@/world/tileMap.ts'
import { ALL_FURNITURE } from '@/world/furniture.ts'
import { ROOMS } from '@/world/rooms.ts'

// Build the walkability grid with furniture
const grid = buildWalkabilityGrid(FLOOR_LAYOUT, ALL_FURNITURE)

describe('findPath', () => {
  it('returns empty array when already at destination', () => {
    const path = findPath({ col: 4, row: 5 }, { col: 4, row: 5 }, grid)
    expect(path).toEqual([])
  })

  it('returns null for unreachable destination (wall)', () => {
    const path = findPath({ col: 4, row: 5 }, { col: 0, row: 0 }, grid)
    expect(path).toBeNull()
  })

  it('finds path from workshop to study through doors', () => {
    const workshopTile = ROOMS.workshop.activityZone
    const studyTile = ROOMS.study.activityZone

    const path = findPath(workshopTile, studyTile, grid)
    expect(path).not.toBeNull()
    expect(path!.length).toBeGreaterThan(0)

    // Path should end at study activity zone
    const last = path![path!.length - 1]
    expect(last.col).toBe(studyTile.col)
    expect(last.row).toBe(studyTile.row)

    // All tiles in path should be walkable
    for (const tile of path!) {
      expect(grid[tile.row][tile.col]).toBe(true)
    }
  })

  it('finds path from workshop to bedroom through doors', () => {
    const workshopTile = ROOMS.workshop.activityZone
    const bedroomTile = ROOMS.bedroom.activityZone

    const path = findPath(workshopTile, bedroomTile, grid)
    expect(path).not.toBeNull()
    expect(path!.length).toBeGreaterThan(0)

    const last = path![path!.length - 1]
    expect(last.col).toBe(bedroomTile.col)
    expect(last.row).toBe(bedroomTile.row)
  })

  it('finds path from bedroom to workshop', () => {
    const bedroomTile = ROOMS.bedroom.activityZone
    const workshopTile = ROOMS.workshop.activityZone

    const path = findPath(bedroomTile, workshopTile, grid)
    expect(path).not.toBeNull()
    expect(path!.length).toBeGreaterThan(0)
  })

  it('never routes through walls', () => {
    const workshopTile = ROOMS.workshop.activityZone
    const bedroomTile = ROOMS.bedroom.activityZone

    const path = findPath(workshopTile, bedroomTile, grid)
    expect(path).not.toBeNull()

    for (const tile of path!) {
      // Verify walkable
      expect(grid[tile.row][tile.col]).toBe(true)
    }
  })

  it('never routes through non-walkable furniture', () => {
    const workshopTile = ROOMS.workshop.activityZone
    const studyTile = ROOMS.study.activityZone

    const path = findPath(workshopTile, studyTile, grid)
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
