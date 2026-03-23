/**
 * Isometric coordinate math utilities.
 *
 * Uses standard 2:1 isometric projection:
 *   TILE_WIDTH  = 64px (diamond width)
 *   TILE_HEIGHT = 32px (diamond height)
 */

import { TILE_WIDTH, TILE_HEIGHT } from '@/utils/constants.ts'

// ── Coordinate Types ────────────────────────────────────────────────────────

export interface ScreenPos {
  x: number
  y: number
}

export interface TileCoord {
  col: number
  row: number
}

// ── Conversions ─────────────────────────────────────────────────────────────

/**
 * Convert cartesian grid position (col, row) to screen pixel position.
 * Returns the top-center of the isometric diamond.
 */
export function cartesianToIso(col: number, row: number): ScreenPos {
  return {
    x: (col - row) * (TILE_WIDTH / 2),
    y: (col + row) * (TILE_HEIGHT / 2),
  }
}

/**
 * Convert screen pixel position to cartesian grid position.
 * Useful for mouse hit-testing.
 */
export function isoToCartesian(screenX: number, screenY: number): TileCoord {
  return {
    col: Math.floor(
      (screenX / (TILE_WIDTH / 2) + screenY / (TILE_HEIGHT / 2)) / 2,
    ),
    row: Math.floor(
      (screenY / (TILE_HEIGHT / 2) - screenX / (TILE_WIDTH / 2)) / 2,
    ),
  }
}

/**
 * Get the tile coordinate at a screen position, accounting for camera offset.
 */
export function getTileAtScreen(
  screenX: number,
  screenY: number,
  cameraOffsetX: number,
  cameraOffsetY: number,
  zoom: number,
): TileCoord {
  // Remove camera transform to get world coordinates
  const worldX = (screenX - cameraOffsetX) / zoom
  const worldY = (screenY - cameraOffsetY) / zoom
  return isoToCartesian(worldX, worldY)
}

/**
 * Get the center screen position of a tile (center of the diamond).
 */
export function tileCenter(col: number, row: number): ScreenPos {
  const iso = cartesianToIso(col, row)
  return {
    x: iso.x,
    y: iso.y + TILE_HEIGHT / 2,
  }
}
