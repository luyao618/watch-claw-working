import { describe, it, expect } from 'vitest'
import {
  getFloorLayout,
  buildWalkabilityGrid,
  FLOOR_LAYOUT,
  MAP_COLS,
  MAP_ROWS,
} from './tileMap.ts'
import { ROOMS } from './rooms.ts'
import { ALL_FURNITURE } from './furniture.ts'
import { TileType } from '@/engine/gameState.ts'

describe('tileMap', () => {
  it('has correct dimensions', () => {
    expect(MAP_COLS).toBe(24)
    expect(MAP_ROWS).toBe(10)
  })

  it('getFloorLayout returns the layout', () => {
    const layout = getFloorLayout()
    expect(layout).toBe(FLOOR_LAYOUT)
    expect(layout.length).toBe(MAP_ROWS)
    expect(layout[0].length).toBe(MAP_COLS)
  })
})

describe('buildWalkabilityGrid', () => {
  const grid = buildWalkabilityGrid(FLOOR_LAYOUT, ALL_FURNITURE)

  it('marks floor tiles as walkable (without furniture blocking)', () => {
    // Row 5, col 4 should be FLOOR_WOOD (office) and no furniture blocks it
    expect(FLOOR_LAYOUT[5][4]).toBe(TileType.FLOOR_WOOD)
    // Check grid without furniture
    const gridNoFurniture = buildWalkabilityGrid(FLOOR_LAYOUT)
    expect(gridNoFurniture[5][4]).toBe(true)
  })

  it('marks carpet tiles as walkable', () => {
    // Row 3, col 9 should be FLOOR_CARPET (study)
    expect(FLOOR_LAYOUT[3][9]).toBe(TileType.FLOOR_CARPET)
    expect(grid[3][9]).toBe(true)
  })

  it('marks wall tiles as non-walkable', () => {
    // Row 0, col 2 should be WALL
    expect(FLOOR_LAYOUT[0][2]).toBe(TileType.WALL)
    expect(grid[0][2]).toBe(false)
  })

  it('marks empty tiles as non-walkable', () => {
    // Row 9, col 0 should be EMPTY
    expect(FLOOR_LAYOUT[9][0]).toBe(TileType.EMPTY)
    expect(grid[9][0]).toBe(false)
  })

  it('marks door tiles as walkable', () => {
    // Find a door tile
    let foundDoor = false
    for (let row = 0; row < MAP_ROWS; row++) {
      for (let col = 0; col < MAP_COLS; col++) {
        if (FLOOR_LAYOUT[row][col] === TileType.DOOR) {
          expect(grid[row][col]).toBe(true)
          foundDoor = true
        }
      }
    }
    expect(foundDoor).toBe(true)
  })

  it('marks non-walkable furniture as blocked', () => {
    const nonWalkableFurniture = ALL_FURNITURE.filter((f) => !f.walkable)
    expect(nonWalkableFurniture.length).toBeGreaterThan(0)

    for (const f of nonWalkableFurniture) {
      expect(grid[f.row][f.col]).toBe(false)
    }
  })

  it('marks occupiable furniture as walkable', () => {
    const occupiableFurniture = ALL_FURNITURE.filter((f) => f.occupiable)
    expect(occupiableFurniture.length).toBeGreaterThan(0)

    for (const f of occupiableFurniture) {
      expect(grid[f.row][f.col]).toBe(true)
    }
  })

  it('all room activity zones are walkable', () => {
    for (const room of Object.values(ROOMS)) {
      const { col, row } = room.activityZone
      expect(grid[row][col]).toBe(true)
    }
  })

  it('all room entry tiles are walkable', () => {
    for (const room of Object.values(ROOMS)) {
      const { col, row } = room.entryTile
      expect(grid[row][col]).toBe(true)
    }
  })
})
