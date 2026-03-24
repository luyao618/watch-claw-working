/**
 * Tile Atlas — manages loading and cutting tiles from LPC tileset images.
 *
 * LPC floor tiles are 64x64 (2x2 sub-tiles of 32x32 each) in floors.png.
 * We pre-cut them into individual 32x32 tiles at load time.
 */

import { loadSprite, getCachedSprite } from './spritesheet.ts'

// ── Tile Atlas Definitions ──────────────────────────────────────────────────

// Pixel coordinates in floors.png (1024x2048) for specific floor tiles
// Found by sampling:
//   y=1088, x=16: warm brown wood plank tile
//   y=400, x=144: muted tan/olive carpet (warmer than green)
const FLOOR_TILE_COORDS = {
  // Wood floor: warm brown planks
  wood: { sx: 16, sy: 1088, sw: 32, sh: 32 },
  // Carpet: warm tan/beige (row 6 area, warmer tones)
  carpet: { sx: 80, sy: 400, sw: 32, sh: 32 },
  // Door: same wood as floor
  door: { sx: 16, sy: 1088, sw: 32, sh: 32 },
} as const

// Pixel coordinates in walls.png (2048x3072) for wall tiles
// Top rows have wall segments in various colors
// Row 2-3 area has wall face/panel tiles in warm wood tones
const WALL_TILE_COORDS = {
  // Wall top cap (darker, row ~2 in the 32px grid)
  top: { sx: 0, sy: 64, sw: 32, sh: 32 },
  // Wall face/body (warmer color, row ~3)
  face: { sx: 0, sy: 96, sw: 32, sh: 32 },
} as const

// Pixel coordinates in interior.png (512x512) for furniture
// Verified by visual sampling:
//   (448, 0): bed headboard
//   (0, 224): bookshelf top
//   (0, 256): bookshelf bottom with books
//   (128, 256): desk with quill
//   (192, 96): countertop surface
const FURNITURE_TILE_COORDS: Record<
  string,
  { sx: number; sy: number; sw: number; sh: number }
> = {
  // Desk: quill and books desk at (128, 256)
  'desk-computer': { sx: 128, sy: 224, sw: 32, sh: 64 },
  // Chair: small stool area
  'chair-office': { sx: 192, sy: 256, sw: 32, sh: 32 },
  // Bookshelf: tall bookshelf (0, 224) spanning 2 tiles vertically
  bookshelf: { sx: 0, sy: 224, sw: 32, sh: 64 },
  // Bed: bed at top-right (448, 0), 2 tiles tall
  bed: { sx: 448, sy: 0, sw: 32, sh: 64 },
  // Lamp/candle: small item area
  lamp: { sx: 256, sy: 0, sw: 32, sh: 32 },
  // Table: countertop section
  table: { sx: 192, sy: 96, sw: 32, sh: 32 },
  // Sofa: use the barrel/bench area
  sofa: { sx: 0, sy: 288, sw: 64, sh: 32 },
  // Nightstand: small cabinet
  nightstand: { sx: 64, sy: 256, sw: 32, sh: 32 },
}

// ── Pre-rendered tile canvases ──────────────────────────────────────────────

const tileCache = new Map<string, HTMLCanvasElement>()

/**
 * Cut a tile from a source image and cache it as a small canvas.
 */
function cutTile(
  source: HTMLImageElement,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  destW: number,
  destH: number,
  key: string,
): HTMLCanvasElement {
  const cached = tileCache.get(key)
  if (cached) return cached

  const canvas = document.createElement('canvas')
  canvas.width = destW
  canvas.height = destH
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, destW, destH)
  tileCache.set(key, canvas)
  return canvas
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Load all tileset images and prepare tile caches.
 */
export async function loadTileAtlas(): Promise<void> {
  // Clear cache on reload (HMR support)
  tileCache.clear()

  await Promise.all([
    loadSprite('/assets/tilesets/floors.png'),
    loadSprite('/assets/tilesets/walls.png'),
    loadSprite('/assets/tilesets/interior.png'),
  ])

  console.log('[TileAtlas] Tile atlas loaded')
}

/**
 * Draw a floor tile at the given position.
 * Returns true if sprite was drawn, false if fallback needed.
 */
export function drawFloorTile(
  ctx: CanvasRenderingContext2D,
  type: 'wood' | 'carpet' | 'door',
  destX: number,
  destY: number,
  destW: number,
  destH: number,
): boolean {
  const floors = getCachedSprite('/assets/tilesets/floors.png')
  if (!floors) return false

  const coords = FLOOR_TILE_COORDS[type]
  const tile = cutTile(
    floors,
    coords.sx,
    coords.sy,
    coords.sw,
    coords.sh,
    destW,
    destH,
    `floor_${type}`,
  )
  ctx.drawImage(tile, destX, destY)
  return true
}

/**
 * Draw a wall tile at the given position.
 */
export function drawWallTile(
  ctx: CanvasRenderingContext2D,
  part: 'top' | 'face',
  destX: number,
  destY: number,
  destW: number,
  destH: number,
): boolean {
  const walls = getCachedSprite('/assets/tilesets/walls.png')
  if (!walls) return false

  const coords = WALL_TILE_COORDS[part]
  const tile = cutTile(
    walls,
    coords.sx,
    coords.sy,
    coords.sw,
    coords.sh,
    destW,
    destH,
    `wall_${part}`,
  )
  ctx.drawImage(tile, destX, destY)
  return true
}

/**
 * Draw a furniture item from the interior tileset.
 */
export function drawFurnitureTile(
  ctx: CanvasRenderingContext2D,
  furnitureType: string,
  destX: number,
  destY: number,
  destW: number,
  destH: number,
): boolean {
  const interior = getCachedSprite('/assets/tilesets/interior.png')
  if (!interior) return false

  const coords = FURNITURE_TILE_COORDS[furnitureType]
  if (!coords) return false

  const key = `furniture_${furnitureType}`
  const tile = cutTile(
    interior,
    coords.sx,
    coords.sy,
    coords.sw,
    coords.sh,
    destW,
    destH,
    key,
  )
  ctx.drawImage(tile, destX, destY)
  return true
}
