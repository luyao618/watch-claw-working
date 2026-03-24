/**
 * Pathfinding — BFS-based tile pathfinding for room-to-room navigation.
 *
 * Uses 4-directional movement (N, S, E, W) on the walkability grid.
 */

import type { TileCoord } from './coordinates.ts'

interface PathNode {
  col: number
  row: number
  parent: PathNode | null
}

// 4-directional neighbors
const DIRS = [
  { dc: 1, dr: 0 }, // east
  { dc: -1, dr: 0 }, // west
  { dc: 0, dr: 1 }, // south
  { dc: 0, dr: -1 }, // north
]

/**
 * Find a path from `from` to `to` using BFS on the walkability grid.
 * Returns an array of tile coordinates (including destination, excluding start),
 * or null if no path exists.
 */
export function findPath(
  from: TileCoord,
  to: TileCoord,
  grid: boolean[][],
): TileCoord[] | null {
  // Same position
  if (from.col === to.col && from.row === to.row) return []

  // Destination not walkable
  if (!grid[to.row]?.[to.col]) return null

  // Start not on grid
  if (!grid[from.row]?.[from.col]) return null

  const visited = new Set<string>()
  const queue: PathNode[] = [
    { col: Math.round(from.col), row: Math.round(from.row), parent: null },
  ]
  visited.add(`${Math.round(from.col)},${Math.round(from.row)}`)

  while (queue.length > 0) {
    const current = queue.shift()!

    if (current.col === to.col && current.row === to.row) {
      // Reconstruct path (exclude start)
      const path: TileCoord[] = []
      let node: PathNode | null = current
      while (node && node.parent) {
        path.unshift({ col: node.col, row: node.row })
        node = node.parent
      }
      return path
    }

    for (const dir of DIRS) {
      const nc = current.col + dir.dc
      const nr = current.row + dir.dr
      const key = `${nc},${nr}`

      if (
        nr >= 0 &&
        nr < grid.length &&
        nc >= 0 &&
        nc < grid[0].length &&
        grid[nr][nc] &&
        !visited.has(key)
      ) {
        visited.add(key)
        queue.push({ col: nc, row: nr, parent: current })
      }
    }
  }

  return null // No path found
}

/**
 * Determine the direction from one tile to another.
 */
export function getDirection(
  from: TileCoord,
  to: TileCoord,
): 'ne' | 'nw' | 'se' | 'sw' {
  const dx = to.col - from.col
  const dy = to.row - from.row

  if (dx >= 0 && dy < 0) return 'ne'
  if (dx < 0 && dy < 0) return 'nw'
  if (dx >= 0 && dy >= 0) return 'se'
  return 'sw'
}
