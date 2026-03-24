/**
 * Tile Map — defines the horizontal three-room house layout.
 *
 * Layout: 24 columns x 10 rows with 3 rooms in a row:
 *   - Workshop (left)   cols 1-7
 *   - Study (center)    cols 9-15
 *   - Bedroom (right)   cols 17-22
 *
 * Walls are 1 tile thick. Doors connect rooms at row 5.
 */

import { TileType } from '@/engine/gameState.ts'

// W = WALL, F = FLOOR_WOOD, C = FLOOR_CARPET, D = DOOR, E = EMPTY
const W = TileType.WALL
const F = TileType.FLOOR_WOOD
const C = TileType.FLOOR_CARPET
const D = TileType.DOOR
const E = TileType.EMPTY

/**
 * The main floor layout (10 rows x 24 cols).
 * Three rooms in a horizontal row: Workshop | Study | Bedroom
 */
// prettier-ignore
export const FLOOR_LAYOUT: TileType[][] = [
  //0  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15 16 17 18 19 20 21 22 23
  [W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W],  // row 0: top wall
  [W, F, F, F, F, F, F, W, C, C, C, C, C, C, C, W, C, C, C, C, C, C, C, W],  // row 1
  [W, F, F, F, F, F, F, W, C, C, C, C, C, C, C, W, C, C, C, C, C, C, C, W],  // row 2
  [W, F, F, F, F, F, F, W, C, C, C, C, C, C, C, W, C, C, C, C, C, C, C, W],  // row 3
  [W, F, F, F, F, F, F, D, C, C, C, C, C, C, C, D, C, C, C, C, C, C, C, W],  // row 4: doors
  [W, F, F, F, F, F, F, W, C, C, C, C, C, C, C, W, C, C, C, C, C, C, C, W],  // row 5
  [W, F, F, F, F, F, F, W, C, C, C, C, C, C, C, W, C, C, C, C, C, C, C, W],  // row 6
  [W, F, F, F, F, F, F, W, C, C, C, C, C, C, C, W, C, C, C, C, C, C, C, W],  // row 7
  [W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W],  // row 8: bottom wall
  [E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E],  // row 9: empty
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
