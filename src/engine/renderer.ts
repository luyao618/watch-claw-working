/**
 * Canvas 2D Isometric Renderer
 *
 * Renders the isometric tile map, walls, furniture, character, and UI overlays.
 * Uses painter's algorithm for correct depth ordering.
 */

import { cartesianToIso } from './isometric.ts'
import { TILE_WIDTH, TILE_HEIGHT } from '@/utils/constants.ts'
import { lerp } from '@/utils/helpers.ts'
import { TileType } from './gameState.ts'
import type {
  GameState,
  CharacterState,
  FurniturePlacement,
} from './gameState.ts'
import { FURNITURE_COLORS } from '@/world/furniture.ts'

// ── Tile Colors ─────────────────────────────────────────────────────────────

const TILE_COLORS: Record<TileType, string> = {
  [TileType.EMPTY]: 'transparent',
  [TileType.FLOOR_WOOD]: '#c4a882',
  [TileType.FLOOR_CARPET]: '#7a8a6a',
  [TileType.WALL]: '#5a5a7a',
  [TileType.DOOR]: '#8a7a5a',
}

const WALL_COLOR = '#4a4a6a'
const WALL_HEIGHT = 32 // Wall extends 32px above the tile

// ── Emotion Bubble Colors ───────────────────────────────────────────────────

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

// ── Character Colors ────────────────────────────────────────────────────────

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

  // 1. Render floor tiles
  for (let row = 0; row < world.height; row++) {
    for (let col = 0; col < world.width; col++) {
      const tile = world.tiles[row][col]
      if (tile !== TileType.EMPTY) {
        renderFloorTile(ctx, tile, col, row)
      }
    }
  }

  // 2. Collect all entities for z-sorting
  const entities: Renderable[] = []

  // Add walls
  for (const wall of world.walls) {
    const sortY = wall.row + wall.col
    entities.push({
      sortY,
      render: (c) => renderWall(c, wall.col, wall.row, wall.wallType),
    })
  }

  // Add furniture
  for (const item of world.furniture) {
    const sortY = item.row + item.col
    entities.push({
      sortY,
      render: (c) => renderFurniture(c, item),
    })
  }

  // Add character (with interpolation for smooth rendering)
  const renderCol =
    character.state === 'walking' && character.prevPosition
      ? lerp(character.prevPosition.col, character.position.col, interpolation)
      : character.position.col
  const renderRow =
    character.state === 'walking' && character.prevPosition
      ? lerp(character.prevPosition.row, character.position.row, interpolation)
      : character.position.row
  const charSortY = renderRow + renderCol
  entities.push({
    sortY: charSortY,
    render: (c) => renderCharacter(c, character, renderCol, renderRow),
  })

  // 3. Sort by sortY (back to front)
  entities.sort((a, b) => a.sortY - b.sortY)

  // 4. Render entities in sorted order
  for (const entity of entities) {
    entity.render(ctx)
  }

  // 5. Render emotion bubble (on top of everything)
  if (character.emotion !== 'none') {
    renderEmotionBubble(ctx, character, renderCol, renderRow)
  }

  // 6. Render debug grid if enabled
  if (state.debug.showGrid) {
    renderDebugGrid(ctx, world.width, world.height)
  }

  ctx.restore()

  // Render FPS counter outside camera transform
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
  const iso = cartesianToIso(col, row)
  const color = TILE_COLORS[tileType]

  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(iso.x, iso.y + TILE_HEIGHT / 2) // left
  ctx.lineTo(iso.x + TILE_WIDTH / 2, iso.y) // top
  ctx.lineTo(iso.x + TILE_WIDTH, iso.y + TILE_HEIGHT / 2) // right
  ctx.lineTo(iso.x + TILE_WIDTH / 2, iso.y + TILE_HEIGHT) // bottom
  ctx.closePath()
  ctx.fill()

  // Tile outline
  ctx.strokeStyle = tileType === TileType.DOOR ? '#aa9a6a' : '#00000020'
  ctx.lineWidth = 0.5
  ctx.stroke()

  // Door indicator
  if (tileType === TileType.DOOR) {
    ctx.fillStyle = '#aa9a6a40'
    ctx.fill()
  }
}

// ── Wall Rendering ──────────────────────────────────────────────────────────

function renderWall(
  ctx: CanvasRenderingContext2D,
  col: number,
  row: number,
  wallType: 'front' | 'side',
): void {
  const iso = cartesianToIso(col, row)

  // Wall base (isometric diamond, same as floor)
  ctx.fillStyle = WALL_COLOR
  ctx.beginPath()
  ctx.moveTo(iso.x, iso.y + TILE_HEIGHT / 2)
  ctx.lineTo(iso.x + TILE_WIDTH / 2, iso.y)
  ctx.lineTo(iso.x + TILE_WIDTH, iso.y + TILE_HEIGHT / 2)
  ctx.lineTo(iso.x + TILE_WIDTH / 2, iso.y + TILE_HEIGHT)
  ctx.closePath()
  ctx.fill()

  // Wall height (raised portion)
  if (wallType === 'front') {
    // Front wall — raised rectangle on the bottom-left and bottom-right edges
    ctx.fillStyle = '#3a3a5a'
    ctx.beginPath()
    ctx.moveTo(iso.x, iso.y + TILE_HEIGHT / 2)
    ctx.lineTo(iso.x, iso.y + TILE_HEIGHT / 2 - WALL_HEIGHT)
    ctx.lineTo(iso.x + TILE_WIDTH / 2, iso.y + TILE_HEIGHT - WALL_HEIGHT)
    ctx.lineTo(iso.x + TILE_WIDTH / 2, iso.y + TILE_HEIGHT)
    ctx.closePath()
    ctx.fill()

    ctx.fillStyle = '#4a4a6a'
    ctx.beginPath()
    ctx.moveTo(iso.x + TILE_WIDTH / 2, iso.y + TILE_HEIGHT)
    ctx.lineTo(iso.x + TILE_WIDTH / 2, iso.y + TILE_HEIGHT - WALL_HEIGHT)
    ctx.lineTo(iso.x + TILE_WIDTH, iso.y + TILE_HEIGHT / 2 - WALL_HEIGHT)
    ctx.lineTo(iso.x + TILE_WIDTH, iso.y + TILE_HEIGHT / 2)
    ctx.closePath()
    ctx.fill()
  } else {
    // Side wall
    ctx.fillStyle = '#3a3a5a'
    ctx.beginPath()
    ctx.moveTo(iso.x, iso.y + TILE_HEIGHT / 2)
    ctx.lineTo(iso.x, iso.y + TILE_HEIGHT / 2 - WALL_HEIGHT)
    ctx.lineTo(iso.x + TILE_WIDTH / 2, iso.y - WALL_HEIGHT)
    ctx.lineTo(iso.x + TILE_WIDTH / 2, iso.y)
    ctx.closePath()
    ctx.fill()

    ctx.fillStyle = '#4a4a6a'
    ctx.beginPath()
    ctx.moveTo(iso.x + TILE_WIDTH / 2, iso.y)
    ctx.lineTo(iso.x + TILE_WIDTH / 2, iso.y - WALL_HEIGHT)
    ctx.lineTo(iso.x + TILE_WIDTH, iso.y + TILE_HEIGHT / 2 - WALL_HEIGHT)
    ctx.lineTo(iso.x + TILE_WIDTH, iso.y + TILE_HEIGHT / 2)
    ctx.closePath()
    ctx.fill()
  }

  // Wall outline
  ctx.strokeStyle = '#2a2a4a'
  ctx.lineWidth = 0.5
  ctx.stroke()
}

// ── Furniture Rendering ─────────────────────────────────────────────────────

function renderFurniture(
  ctx: CanvasRenderingContext2D,
  item: FurniturePlacement,
): void {
  const iso = cartesianToIso(item.col, item.row)
  const color = FURNITURE_COLORS[item.type] || '#666'
  const centerX = iso.x + TILE_WIDTH / 2
  const centerY = iso.y + TILE_HEIGHT / 2

  // Draw a simple isometric box for furniture
  const boxWidth = TILE_WIDTH * 0.6
  const boxHeight = TILE_HEIGHT * 0.6
  const boxRise = 16 + item.zOffset

  // Top face
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(centerX, centerY - boxRise)
  ctx.lineTo(centerX + boxWidth / 2, centerY - boxRise + boxHeight / 2)
  ctx.lineTo(centerX, centerY - boxRise + boxHeight)
  ctx.lineTo(centerX - boxWidth / 2, centerY - boxRise + boxHeight / 2)
  ctx.closePath()
  ctx.fill()

  // Left face
  ctx.fillStyle = adjustBrightness(color, -30)
  ctx.beginPath()
  ctx.moveTo(centerX - boxWidth / 2, centerY - boxRise + boxHeight / 2)
  ctx.lineTo(centerX, centerY - boxRise + boxHeight)
  ctx.lineTo(centerX, centerY + boxHeight)
  ctx.lineTo(centerX - boxWidth / 2, centerY + boxHeight / 2)
  ctx.closePath()
  ctx.fill()

  // Right face
  ctx.fillStyle = adjustBrightness(color, -15)
  ctx.beginPath()
  ctx.moveTo(centerX + boxWidth / 2, centerY - boxRise + boxHeight / 2)
  ctx.lineTo(centerX, centerY - boxRise + boxHeight)
  ctx.lineTo(centerX, centerY + boxHeight)
  ctx.lineTo(centerX + boxWidth / 2, centerY + boxHeight / 2)
  ctx.closePath()
  ctx.fill()

  // Label
  ctx.fillStyle = '#fff'
  ctx.font = '6px monospace'
  ctx.textAlign = 'center'
  ctx.fillText(item.type.split('-')[0], centerX, centerY - boxRise - 2)
}

// ── Character Rendering ─────────────────────────────────────────────────────

function renderCharacter(
  ctx: CanvasRenderingContext2D,
  character: CharacterState,
  col: number,
  row: number,
): void {
  const iso = cartesianToIso(col, row)
  const centerX = iso.x + TILE_WIDTH / 2
  const baseY = iso.y + TILE_HEIGHT / 2

  // Character dimensions
  const bodyWidth = 16
  const bodyHeight = 20
  const headSize = 12

  // Breathing animation (subtle vertical offset)
  const breathOffset = Math.sin(character.animationTimer * 2) * 1

  // Body
  ctx.fillStyle = CHARACTER_BODY_COLOR
  ctx.fillRect(
    centerX - bodyWidth / 2,
    baseY - bodyHeight + breathOffset,
    bodyWidth,
    bodyHeight,
  )

  // Head
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

  // Lobster Hat!
  const hatY = baseY - bodyHeight - headSize + breathOffset
  drawLobsterHat(ctx, centerX, hatY)

  // State-specific rendering
  renderCharacterState(ctx, character, centerX, baseY, breathOffset)
}

function drawLobsterHat(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  topY: number,
): void {
  // Main hat body (red dome)
  ctx.fillStyle = LOBSTER_HAT_COLOR
  ctx.beginPath()
  ctx.ellipse(centerX, topY, 8, 5, 0, Math.PI, 0)
  ctx.fill()

  // Left claw
  ctx.fillStyle = LOBSTER_HAT_CLAW_COLOR
  ctx.beginPath()
  ctx.moveTo(centerX - 6, topY - 2)
  ctx.lineTo(centerX - 12, topY - 6)
  ctx.lineTo(centerX - 10, topY - 2)
  ctx.lineTo(centerX - 12, topY + 1)
  ctx.lineTo(centerX - 6, topY - 1)
  ctx.closePath()
  ctx.fill()

  // Right claw
  ctx.beginPath()
  ctx.moveTo(centerX + 6, topY - 2)
  ctx.lineTo(centerX + 12, topY - 6)
  ctx.lineTo(centerX + 10, topY - 2)
  ctx.lineTo(centerX + 12, topY + 1)
  ctx.lineTo(centerX + 6, topY - 1)
  ctx.closePath()
  ctx.fill()

  // Eyes on hat (small white dots)
  ctx.fillStyle = '#fff'
  ctx.beginPath()
  ctx.arc(centerX - 3, topY - 2, 1.5, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(centerX + 3, topY - 2, 1.5, 0, Math.PI * 2)
  ctx.fill()

  // Pupils
  ctx.fillStyle = '#000'
  ctx.beginPath()
  ctx.arc(centerX - 3, topY - 2, 0.8, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(centerX + 3, topY - 2, 0.8, 0, Math.PI * 2)
  ctx.fill()
}

function renderCharacterState(
  ctx: CanvasRenderingContext2D,
  character: CharacterState,
  centerX: number,
  baseY: number,
  breathOffset: number,
): void {
  switch (character.state) {
    case 'typing': {
      // Show typing hands
      const handOffset = Math.sin(character.animationTimer * 12) * 2
      ctx.fillStyle = CHARACTER_HEAD_COLOR
      ctx.fillRect(centerX - 10 + handOffset, baseY - 8, 4, 3)
      ctx.fillRect(centerX + 6 - handOffset, baseY - 8, 4, 3)
      break
    }
    case 'sleeping': {
      // ZZZ
      const zzY = baseY - 35 + breathOffset
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
      // Thought dots
      const dotPhase = character.animationTimer * 3
      for (let i = 0; i < 3; i++) {
        const alpha = (Math.sin(dotPhase + i * 0.8) + 1) / 2
        ctx.fillStyle = `rgba(168, 85, 247, ${alpha * 0.8})`
        ctx.beginPath()
        ctx.arc(
          centerX + 10 + i * 5,
          baseY - 30 - i * 4,
          2 - i * 0.3,
          0,
          Math.PI * 2,
        )
        ctx.fill()
      }
      break
    }
    case 'celebrating': {
      // Confetti particles
      for (let i = 0; i < 5; i++) {
        const angle = (i / 5) * Math.PI * 2 + character.animationTimer * 3
        const r = 15 + Math.sin(character.animationTimer * 4 + i) * 5
        const px = centerX + Math.cos(angle) * r
        const py = baseY - 25 + Math.sin(angle) * r * 0.5
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
  const iso = cartesianToIso(col, row)
  const centerX = iso.x + TILE_WIDTH / 2
  const baseY = iso.y + TILE_HEIGHT / 2

  // Bubble position (floating above character)
  const floatOffset = Math.sin(character.animationTimer * 2) * 2
  const bubbleY = baseY - 52 + floatOffset

  const config = EMOTION_COLORS[character.emotion] || EMOTION_COLORS.none
  if (config.bg === 'transparent') return

  // Bubble background
  ctx.fillStyle = config.bg
  ctx.beginPath()
  ctx.roundRect(centerX - 8, bubbleY - 8, 16, 14, 4)
  ctx.fill()

  // Connection triangle
  ctx.beginPath()
  ctx.moveTo(centerX - 3, bubbleY + 6)
  ctx.lineTo(centerX, bubbleY + 10)
  ctx.lineTo(centerX + 3, bubbleY + 6)
  ctx.closePath()
  ctx.fill()

  // Icon text
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
      const iso = cartesianToIso(col, row)

      ctx.beginPath()
      ctx.moveTo(iso.x, iso.y + TILE_HEIGHT / 2)
      ctx.lineTo(iso.x + TILE_WIDTH / 2, iso.y)
      ctx.lineTo(iso.x + TILE_WIDTH, iso.y + TILE_HEIGHT / 2)
      ctx.lineTo(iso.x + TILE_WIDTH / 2, iso.y + TILE_HEIGHT)
      ctx.closePath()
      ctx.stroke()

      // Coordinate labels
      ctx.fillStyle = '#ffffff40'
      ctx.font = '5px monospace'
      ctx.textAlign = 'center'
      ctx.fillText(
        `${col},${row}`,
        iso.x + TILE_WIDTH / 2,
        iso.y + TILE_HEIGHT / 2 + 2,
      )
    }
  }
}

// ── FPS Counter ─────────────────────────────────────────────────────────────

function renderFpsCounter(
  ctx: CanvasRenderingContext2D,
  _state: GameState, // eslint-disable-line @typescript-eslint/no-unused-vars
): void {
  ctx.fillStyle = '#00000080'
  ctx.fillRect(
    8,
    ctx.canvas.height / (window.devicePixelRatio || 1) - 28,
    60,
    20,
  )
  ctx.fillStyle = '#0f0'
  ctx.font = '12px monospace'
  ctx.textAlign = 'left'
  ctx.fillText(
    'FPS: --',
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

// ── Helper ──────────────────────────────────────────────────────────────────

function adjustBrightness(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16)
  const r = Math.max(0, Math.min(255, ((num >> 16) & 0xff) + amount))
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0xff) + amount))
  const b = Math.max(0, Math.min(255, (num & 0xff) + amount))
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}
