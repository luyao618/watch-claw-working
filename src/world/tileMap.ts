/**
 * Tile Map — defines the single-floor house layout.
 *
 * Layout: 16 columns x 12 rows with 3 rooms:
 *   - Office (left)
 *   - Living Room (center)
 *   - Bedroom (right)
 */

import { TileType } from '@/engine/gameState.ts'

// W = WALL, F = FLOOR_WOOD, C = FLOOR_CARPET, D = DOOR, E = EMPTY
const W = TileType.WALL
const F = TileType.FLOOR_WOOD
const C = TileType.FLOOR_CARPET
const D = TileType.DOOR
const E = TileType.EMPTY

/**
 * The main floor layout (12 rows x 16 cols).
 * Row 0 is the top (north), row 11 is the bottom (south).
 */
// prettier-ignore
export const FLOOR_LAYOUT: TileType[][] = [
  //0  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15
  [E, E, W, W, W, W, W, W, W, W, W, W, W, W, E, E],  // row 0
  [E, W, W, W, W, W, W, W, W, W, W, W, W, W, W, E],  // row 1
  [W, W, F, F, F, W, D, C, C, C, W, D, C, C, W, W],  // row 2
  [W, W, F, F, F, W, C, C, C, C, W, C, C, C, W, W],  // row 3
  [W, W, F, F, F, W, C, C, C, C, W, C, C, C, W, W],  // row 4
  [W, W, F, F, F, D, C, C, C, C, D, C, C, C, W, W],  // row 5
  [W, W, F, F, F, W, C, C, C, C, W, C, C, C, W, W],  // row 6
  [W, W, F, F, F, W, C, C, C, C, W, C, C, C, W, W],  // row 7
  [E, W, W, W, W, W, W, W, W, W, W, W, W, W, W, E],  // row 8
  [E, E, W, W, W, W, W, W, W, W, W, W, W, W, E, E],  // row 9
  [E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E],  // row 10
  [E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E],  // row 11
]

export const MAP_COLS = FLOOR_LAYOUT[0].length
export const MAP_ROWS = FLOOR_LAYOUT.length

/**
 * Get the floor layout.
 */
export function getFloorLayout(): TileType[][] {
  return FLOOR_LAYOUT
}

/**
 * Build a walkability grid from the tile layout.
 * Floor and door tiles are walkable; walls and empty are not.
 */
export function buildWalkabilityGrid(
  layout: TileType[][],
  furniture?: Array<{ col: number; row: number; walkable: boolean }>,
): boolean[][] {
  const grid: boolean[][] = []

  for (let row = 0; row < layout.length; row++) {
    grid[row] = []
    for (let col = 0; col < layout[row].length; col++) {
      const tile = layout[row][col]
      grid[row][col] =
        tile === TileType.FLOOR_WOOD ||
        tile === TileType.FLOOR_CARPET ||
        tile === TileType.DOOR
    }
  }

  // Mark non-walkable furniture tiles
  if (furniture) {
    for (const f of furniture) {
      if (!f.walkable && grid[f.row]?.[f.col] !== undefined) {
        grid[f.row][f.col] = false
      }
    }
  }

  return grid
}
