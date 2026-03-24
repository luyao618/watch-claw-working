/**
 * Canvas 2D 3/4 Top-Down Renderer
 *
 * Renders the tile map, walls, furniture, character, and UI overlays
 * in a Stardew Valley style 3/4 top-down perspective.
 * Uses y-sorting for correct depth ordering.
 */

import { cartesianToScreen } from './coordinates.ts'
import { TILE_WIDTH, TILE_HEIGHT } from '@/utils/constants.ts'
import { lerp } from '@/utils/helpers.ts'
import { TileType } from './gameState.ts'
import type {
  GameState,
  CharacterState,
  FurniturePlacement,
} from './gameState.ts'
import { FURNITURE_COLORS } from '@/world/furniture.ts'
import { drawFallbackRect } from './spritesheet.ts'
import {
  getCharacterSpritesheet,
  getEmotionSpritesheet,
} from '@/world/sprites.ts'
import {
  drawPixelFurniture,
  drawWallTile as drawPixelWall,
} from './pixelFurniture.ts'

// ── Tile Colors (clean solid colors) ─────────────────────────────────────────

const TILE_COLORS: Record<TileType, string> = {
  [TileType.EMPTY]: 'transparent',
  [TileType.FLOOR_WOOD]: '#b89870', // warm honey wood
  [TileType.FLOOR_CARPET]: '#a8946c', // warm tan/beige
  [TileType.WALL]: '#6b5544',
  [TileType.DOOR]: '#c8a878', // lighter wood for doorways
}

// ── Emotion Bubble Colors (fallback) ────────────────────────────────────────

const EMOTION_COLORS: Record<string, { bg: string; icon: string }> = {
  focused: { bg: '#4a9eff', icon: '!' },
  thinking: { bg: '#a855f7', icon: '?' },
  sleepy: { bg: '#6b7280', icon: 'Z' },
  happy: { bg: '#22c55e', icon: ':)' },
  confused: { bg: '#ef4444', icon: '??' },
  curious: { bg: '#f59e0b', icon: '...' },
  serious: { bg: '#dc2626', icon: '!' },
  satisfied: { bg: '#10b981', icon: ':D' },
  none: { bg: 'transparent', icon: '' },
}

// ── Character Colors (fallback) ─────────────────────────────────────────────

const CHARACTER_BODY_COLOR = '#4a7ab5'
const CHARACTER_HEAD_COLOR = '#f0d0a0'
const LOBSTER_HAT_COLOR = '#e04040'
const LOBSTER_HAT_CLAW_COLOR = '#c03030'

// ── Renderable Entity ───────────────────────────────────────────────────────

interface Renderable {
  sortY: number
  render: (ctx: CanvasRenderingContext2D) => void
}

// ── Main Render Function ────────────────────────────────────────────────────

export function renderFrame(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  interpolation: number,
): void {
  const { camera, world, character } = state

  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)

  // Fill background
  ctx.fillStyle = '#1a1a2e'
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)

  ctx.save()

  // Apply camera transform
  ctx.translate(camera.offsetX, camera.offsetY)
  ctx.scale(camera.zoom, camera.zoom)

  // 1. Render floor tiles (all non-wall, non-empty tiles)
  for (let row = 0; row < world.height; row++) {
    for (let col = 0; col < world.width; col++) {
      const tile = world.tiles[row][col]
      if (tile !== TileType.EMPTY && tile !== TileType.WALL) {
        renderFloorTile(ctx, tile, col, row)
      }
    }
  }

  // 2. Collect all entities for y-sorting
  const entities: Renderable[] = []

  // Add walls (render as blocks with height)
  for (const wall of world.walls) {
    entities.push({
      sortY: wall.row * TILE_HEIGHT,
      render: (c) => renderWall(c, wall.col, wall.row),
    })
  }

  // Add furniture
  for (const item of world.furniture) {
    entities.push({
      sortY: (item.row + 1) * TILE_HEIGHT,
      render: (c) => renderFurniture(c, item),
    })
  }

  // Add character
  const renderCol =
    character.state === 'walking' && character.prevPosition
      ? lerp(character.prevPosition.col, character.position.col, interpolation)
      : character.position.col
  const renderRow =
    character.state === 'walking' && character.prevPosition
      ? lerp(character.prevPosition.row, character.position.row, interpolation)
      : character.position.row
  entities.push({
    sortY: (renderRow + 1) * TILE_HEIGHT,
    render: (c) => renderCharacter(c, character, renderCol, renderRow),
  })

  // 3. Sort by sortY
  entities.sort((a, b) => a.sortY - b.sortY)

  // 4. Render entities
  for (const entity of entities) {
    entity.render(ctx)
  }

  // 5. Render emotion bubble (only when not walking)
  if (character.emotion !== 'none' && character.state !== 'walking') {
    renderEmotionBubble(ctx, character, renderCol, renderRow)
  }

  // 6. Debug grid
  if (state.debug.showGrid) {
    renderDebugGrid(ctx, world.width, world.height)
  }

  ctx.restore()

  if (state.debug.showFps) {
    renderFpsCounter(ctx, state)
  }
}

// ── Floor Tile Rendering ────────────────────────────────────────────────────

function renderFloorTile(
  ctx: CanvasRenderingContext2D,
  tileType: TileType,
  col: number,
  row: number,
): void {
  const pos = cartesianToScreen(col, row)

  // Clean solid color floor
  const color = TILE_COLORS[tileType]
  ctx.fillStyle = color
  ctx.fillRect(pos.x, pos.y, TILE_WIDTH, TILE_HEIGHT)

  // Subtle grid line
  ctx.strokeStyle = 'rgba(0,0,0,0.06)'
  ctx.lineWidth = 0.5
  ctx.strokeRect(pos.x, pos.y, TILE_WIDTH, TILE_HEIGHT)

  // Door highlight
  if (tileType === TileType.DOOR) {
    ctx.fillStyle = 'rgba(255,255,200,0.08)'
    ctx.fillRect(pos.x, pos.y, TILE_WIDTH, TILE_HEIGHT)
  }
}

// ── Wall Rendering ──────────────────────────────────────────────────────────

function renderWall(
  ctx: CanvasRenderingContext2D,
  col: number,
  row: number,
): void {
  const pos = cartesianToScreen(col, row)
  const isTopWall = row === 0
  // Add windows on top walls at certain intervals
  const hasWindow = isTopWall && col % 4 === 2 && col > 0 && col < 23
  drawPixelWall(ctx, pos.x, pos.y, isTopWall, hasWindow)
}

// ── Furniture Rendering ─────────────────────────────────────────────────────

function renderFurniture(
  ctx: CanvasRenderingContext2D,
  item: FurniturePlacement,
): void {
  const pos = cartesianToScreen(item.col, item.row)

  // Use programmatic pixel furniture
  if (drawPixelFurniture(ctx, item.type, pos.x, pos.y, item.col, item.row)) {
    return
  }

  // Fallback: colored rectangle with label
  const color = FURNITURE_COLORS[item.type] || '#666'
  drawFallbackRect(
    ctx,
    pos.x + 2,
    pos.y + 2,
    TILE_WIDTH - 4,
    TILE_HEIGHT - 4,
    color,
    item.type.split('-')[0],
  )
}

// ── Character Rendering ─────────────────────────────────────────────────────

function renderCharacter(
  ctx: CanvasRenderingContext2D,
  character: CharacterState,
  col: number,
  row: number,
): void {
  const pos = cartesianToScreen(col, row)
  const charDrawW = TILE_WIDTH
  const charDrawH = TILE_WIDTH * 2 // LPC characters are tall
  const centerX = pos.x + TILE_WIDTH / 2
  const baseY = pos.y + TILE_HEIGHT

  // Try spritesheet
  const spritesheet = getCharacterSpritesheet()
  if (spritesheet.isLoaded) {
    const dirMap: Record<string, string> = {
      se: 'down',
      sw: 'left',
      ne: 'up',
      nw: 'right',
    }
    const dir = dirMap[character.direction] || 'down'

    let animName: string
    if (character.state === 'walking') {
      animName = `walk_${dir}`
    } else if (character.state === 'idle') {
      animName = `idle_${dir}`
    } else {
      const stateAnimMap: Record<string, string> = {
        typing: 'type',
        sleeping: 'sleep',
        sitting: 'sit',
        thinking: 'think',
        celebrating: 'celebrate',
      }
      animName = stateAnimMap[character.state] || `idle_${dir}`
    }

    if (
      spritesheet.drawFrame(
        ctx,
        animName,
        character.animationFrame,
        centerX - charDrawW / 2,
        baseY - charDrawH,
        charDrawW,
        charDrawH,
      )
    ) {
      // Draw state effects on top of sprite
      renderCharacterStateEffects(ctx, character, centerX, baseY)
      return
    }
  }

  // Fallback: programmatic character
  const bodyWidth = 16
  const bodyHeight = 20
  const headSize = 12
  const breathOffset = Math.sin(character.animationTimer * 2) * 1

  ctx.fillStyle = CHARACTER_BODY_COLOR
  ctx.fillRect(
    centerX - bodyWidth / 2,
    baseY - bodyHeight + breathOffset,
    bodyWidth,
    bodyHeight,
  )

  ctx.fillStyle = CHARACTER_HEAD_COLOR
  ctx.beginPath()
  ctx.arc(
    centerX,
    baseY - bodyHeight - headSize / 2 + breathOffset,
    headSize / 2,
    0,
    Math.PI * 2,
  )
  ctx.fill()

  const hatY = baseY - bodyHeight - headSize + breathOffset
  drawLobsterHat(ctx, centerX, hatY)

  renderCharacterStateEffects(ctx, character, centerX, baseY)
}

function drawLobsterHat(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  topY: number,
): void {
  ctx.fillStyle = LOBSTER_HAT_COLOR
  ctx.beginPath()
  ctx.ellipse(centerX, topY, 8, 5, 0, Math.PI, 0)
  ctx.fill()

  ctx.fillStyle = LOBSTER_HAT_CLAW_COLOR
  ctx.beginPath()
  ctx.moveTo(centerX - 6, topY - 2)
  ctx.lineTo(centerX - 12, topY - 6)
  ctx.lineTo(centerX - 10, topY - 2)
  ctx.lineTo(centerX - 12, topY + 1)
  ctx.lineTo(centerX - 6, topY - 1)
  ctx.closePath()
  ctx.fill()

  ctx.beginPath()
  ctx.moveTo(centerX + 6, topY - 2)
  ctx.lineTo(centerX + 12, topY - 6)
  ctx.lineTo(centerX + 10, topY - 2)
  ctx.lineTo(centerX + 12, topY + 1)
  ctx.lineTo(centerX + 6, topY - 1)
  ctx.closePath()
  ctx.fill()

  ctx.fillStyle = '#fff'
  ctx.beginPath()
  ctx.arc(centerX - 3, topY - 2, 1.5, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(centerX + 3, topY - 2, 1.5, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = '#000'
  ctx.beginPath()
  ctx.arc(centerX - 3, topY - 2, 0.8, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(centerX + 3, topY - 2, 0.8, 0, Math.PI * 2)
  ctx.fill()
}

function renderCharacterStateEffects(
  ctx: CanvasRenderingContext2D,
  character: CharacterState,
  centerX: number,
  baseY: number,
): void {
  switch (character.state) {
    case 'typing': {
      const handOffset = Math.sin(character.animationTimer * 12) * 2
      ctx.fillStyle = CHARACTER_HEAD_COLOR
      ctx.fillRect(centerX - 10 + handOffset, baseY - 8, 4, 3)
      ctx.fillRect(centerX + 6 - handOffset, baseY - 8, 4, 3)
      break
    }
    case 'sleeping': {
      const zzY = baseY - 45
      ctx.fillStyle = '#aaa'
      ctx.font = 'bold 8px monospace'
      ctx.textAlign = 'left'
      const zzOffset = Math.sin(character.animationTimer) * 3
      ctx.fillText('z', centerX + 8, zzY + zzOffset)
      ctx.font = 'bold 10px monospace'
      ctx.fillText('Z', centerX + 12, zzY - 6 + zzOffset * 0.7)
      ctx.font = 'bold 12px monospace'
      ctx.fillText('Z', centerX + 16, zzY - 14 + zzOffset * 0.5)
      break
    }
    case 'thinking': {
      const dotPhase = character.animationTimer * 3
      for (let i = 0; i < 3; i++) {
        const alpha = (Math.sin(dotPhase + i * 0.8) + 1) / 2
        ctx.fillStyle = `rgba(168, 85, 247, ${alpha * 0.8})`
        ctx.beginPath()
        ctx.arc(
          centerX + 10 + i * 5,
          baseY - 40 - i * 4,
          2 - i * 0.3,
          0,
          Math.PI * 2,
        )
        ctx.fill()
      }
      break
    }
    case 'celebrating': {
      for (let i = 0; i < 5; i++) {
        const angle = (i / 5) * Math.PI * 2 + character.animationTimer * 3
        const r = 15 + Math.sin(character.animationTimer * 4 + i) * 5
        const px = centerX + Math.cos(angle) * r
        const py = baseY - 35 + Math.sin(angle) * r * 0.5
        ctx.fillStyle = ['#ff6b6b', '#ffd93d', '#6bff6b', '#6b9fff', '#ff6bff'][
          i
        ]
        ctx.fillRect(px - 1.5, py - 1.5, 3, 3)
      }
      break
    }
  }
}

// ── Emotion Bubble Rendering ────────────────────────────────────────────────

function renderEmotionBubble(
  ctx: CanvasRenderingContext2D,
  character: CharacterState,
  col: number,
  row: number,
): void {
  const pos = cartesianToScreen(col, row)
  const centerX = pos.x + TILE_WIDTH / 2
  const baseY = pos.y

  const floatOffset = Math.sin(character.animationTimer * 2) * 2
  const bubbleY = baseY - 20 + floatOffset

  // Try spritesheet
  const emotionSheet = getEmotionSpritesheet()
  if (
    emotionSheet.drawFrame(ctx, character.emotion, 0, centerX - 8, bubbleY - 8)
  ) {
    return
  }

  // Fallback: colored bubble
  const config = EMOTION_COLORS[character.emotion] || EMOTION_COLORS.none
  if (config.bg === 'transparent') return

  ctx.fillStyle = config.bg
  ctx.beginPath()
  ctx.roundRect(centerX - 8, bubbleY - 8, 16, 14, 4)
  ctx.fill()

  ctx.beginPath()
  ctx.moveTo(centerX - 3, bubbleY + 6)
  ctx.lineTo(centerX, bubbleY + 10)
  ctx.lineTo(centerX + 3, bubbleY + 6)
  ctx.closePath()
  ctx.fill()

  ctx.fillStyle = '#fff'
  ctx.font = 'bold 7px monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(config.icon, centerX, bubbleY)
  ctx.textBaseline = 'alphabetic'
}

// ── Debug Grid ──────────────────────────────────────────────────────────────

function renderDebugGrid(
  ctx: CanvasRenderingContext2D,
  cols: number,
  rows: number,
): void {
  ctx.strokeStyle = '#ffffff20'
  ctx.lineWidth = 0.5

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const pos = cartesianToScreen(col, row)
      ctx.strokeRect(pos.x, pos.y, TILE_WIDTH, TILE_HEIGHT)

      ctx.fillStyle = '#ffffff40'
      ctx.font = '6px monospace'
      ctx.textAlign = 'center'
      ctx.fillText(
        `${col},${row}`,
        pos.x + TILE_WIDTH / 2,
        pos.y + TILE_HEIGHT / 2 + 2,
      )
    }
  }
}

// ── FPS Counter ─────────────────────────────────────────────────────────────

function renderFpsCounter(
  ctx: CanvasRenderingContext2D,
  state: GameState,
): void {
  const fpsText = `FPS: ${state.debug.currentFps}`
  ctx.fillStyle = '#00000080'
  ctx.fillRect(
    8,
    ctx.canvas.height / (window.devicePixelRatio || 1) - 28,
    70,
    20,
  )
  ctx.fillStyle = '#0f0'
  ctx.font = '12px monospace'
  ctx.textAlign = 'left'
  ctx.fillText(
    fpsText,
    12,
    ctx.canvas.height / (window.devicePixelRatio || 1) - 14,
  )
}

// ── DPR-aware Canvas Setup ──────────────────────────────────────────────────

export function setupCanvas(
  canvas: HTMLCanvasElement,
): CanvasRenderingContext2D {
  const dpr = window.devicePixelRatio || 1
  const rect = canvas.getBoundingClientRect()

  canvas.width = rect.width * dpr
  canvas.height = rect.height * dpr

  canvas.style.width = `${rect.width}px`
  canvas.style.height = `${rect.height}px`

  const ctx = canvas.getContext('2d')!
  ctx.scale(dpr, dpr)
  ctx.imageSmoothingEnabled = false

  return ctx
}
