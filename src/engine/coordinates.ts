/**
 * 3/4 Top-Down coordinate math utilities.
 *
 * Uses simple rectangular tile grid (Stardew Valley style):
 *   TILE_WIDTH  = 32px
 *   TILE_HEIGHT = 32px
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
 * Returns the top-left corner of the tile.
 */
export function cartesianToScreen(col: number, row: number): ScreenPos {
  return {
    x: col * TILE_WIDTH,
    y: row * TILE_HEIGHT,
  }
}

/**
 * Convert screen pixel position to cartesian grid position.
 * Useful for mouse hit-testing.
 */
export function screenToCartesian(screenX: number, screenY: number): TileCoord {
  return {
    col: Math.floor(screenX / TILE_WIDTH),
    row: Math.floor(screenY / TILE_HEIGHT),
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
  return screenToCartesian(worldX, worldY)
}

/**
 * Get the center screen position of a tile.
 */
export function tileCenter(col: number, row: number): ScreenPos {
  return {
    x: col * TILE_WIDTH + TILE_WIDTH / 2,
    y: row * TILE_HEIGHT + TILE_HEIGHT / 2,
  }
}
