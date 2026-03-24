/**
 * Programmatic Pixel Furniture Renderer
 * Hand-crafted pixel art for Stardew Valley style 3/4 top-down view.
 */

const TW = 32
const TH = 32

// ── Colors ──────────────────────────────────────────────────────────────────

const WOOD_DARK = '#5c3a1e'
const WOOD_MED = '#7a5230'
const WOOD_HIGHLIGHT = '#b8884a'
const METAL_DARK = '#3a3a4a'
const METAL_MED = '#5a5a6a'
const SCREEN_BG = '#1a2a3a'
const SCREEN_GLOW = '#4a8aff'
const FABRIC_RED = '#8a3030'
const FABRIC_BLUE = '#3a4a7a'
const PILLOW_WHITE = '#d8d0c0'
const BOOK_COLORS = ['#8a3030', '#3a5a8a', '#3a7a3a', '#8a7a30', '#6a3a6a']
const LAMP_BASE = '#6a5a3a'
const LAMP_SHADE = '#c8b888'
const LAMP_GLOW = '#fff8e0'

// ── Workshop: Workbench (top-down desk surface with items) ──────────────────

export function drawWorkbench(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  variant: number = 0,
): void {
  // Desk surface (top-down view)
  ctx.fillStyle = WOOD_MED
  ctx.fillRect(x + 1, y + 2, TW - 2, TH - 4)
  ctx.fillStyle = WOOD_HIGHLIGHT
  ctx.fillRect(x + 1, y + 2, TW - 2, 2)
  ctx.fillStyle = WOOD_DARK
  ctx.fillRect(x + 1, y + TH - 4, TW - 2, 2)

  // Items on desk vary by tile
  switch (variant % 4) {
    case 0: // Small monitor
      ctx.fillStyle = METAL_DARK
      ctx.fillRect(x + 6, y + 6, 20, 12)
      ctx.fillStyle = SCREEN_BG
      ctx.fillRect(x + 7, y + 7, 18, 10)
      ctx.fillStyle = SCREEN_GLOW
      ctx.fillRect(x + 9, y + 9, 10, 1)
      ctx.fillRect(x + 9, y + 11, 14, 1)
      ctx.fillRect(x + 9, y + 13, 8, 1)
      ctx.fillStyle = METAL_MED
      ctx.fillRect(x + 14, y + 18, 4, 4)
      break
    case 1: // Books + papers
      ctx.fillStyle = BOOK_COLORS[0]
      ctx.fillRect(x + 4, y + 6, 8, 10)
      ctx.fillStyle = BOOK_COLORS[1]
      ctx.fillRect(x + 14, y + 8, 6, 8)
      ctx.fillStyle = '#e8e0d0'
      ctx.fillRect(x + 6, y + 18, 14, 8)
      ctx.fillStyle = '#aaa'
      ctx.fillRect(x + 8, y + 20, 8, 1)
      ctx.fillRect(x + 8, y + 22, 6, 1)
      break
    case 2: // Lamp + notepad
      ctx.fillStyle = LAMP_SHADE
      ctx.fillRect(x + 4, y + 6, 10, 8)
      ctx.fillStyle = LAMP_GLOW
      ctx.fillRect(x + 5, y + 7, 8, 6)
      ctx.fillStyle = LAMP_BASE
      ctx.fillRect(x + 8, y + 14, 3, 6)
      ctx.fillStyle = '#e8e0d0'
      ctx.fillRect(x + 16, y + 10, 10, 14)
      break
    case 3: // Tools
      ctx.fillStyle = '#8a8a9a'
      ctx.fillRect(x + 5, y + 7, 3, 14) // wrench
      ctx.fillRect(x + 3, y + 6, 7, 3)
      ctx.fillStyle = '#aaa'
      ctx.fillRect(x + 14, y + 8, 12, 3) // ruler
      ctx.fillStyle = '#e04040'
      ctx.fillRect(x + 16, y + 16, 4, 8) // screwdriver handle
      ctx.fillStyle = '#bbb'
      ctx.fillRect(x + 17, y + 14, 2, 3)
      break
  }
}

// ── Study: Big Computer (top-down view) ─────────────────────────────────────

export function drawBigComputer(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  side: 'left' | 'right',
): void {
  // Desk surface
  ctx.fillStyle = WOOD_MED
  ctx.fillRect(x, y + 2, TW, TH - 4)
  ctx.fillStyle = WOOD_HIGHLIGHT
  ctx.fillRect(x, y + 2, TW, 2)
  ctx.fillStyle = WOOD_DARK
  ctx.fillRect(x, y + TH - 4, TW, 2)

  if (side === 'left') {
    // Big monitor (seen from front, raised)
    ctx.fillStyle = '#2a2a3a'
    ctx.fillRect(x + 2, y - 8, TW + 4, 18) // monitor bezel
    ctx.fillStyle = SCREEN_BG
    ctx.fillRect(x + 4, y - 6, TW, 14) // screen
    // Code lines on screen
    ctx.fillStyle = SCREEN_GLOW
    ctx.fillRect(x + 7, y - 4, 14, 1)
    ctx.fillRect(x + 9, y - 2, 18, 1)
    ctx.fillRect(x + 7, y, 10, 1)
    ctx.fillStyle = '#4aff8a'
    ctx.fillRect(x + 9, y + 2, 12, 1)
    ctx.fillStyle = '#ffaa4a'
    ctx.fillRect(x + 7, y + 4, 8, 1)
    // Monitor stand
    ctx.fillStyle = METAL_MED
    ctx.fillRect(x + 12, y + 10, 8, 3)
    ctx.fillRect(x + 14, y + 6, 4, 6)
  } else {
    // Keyboard (top-down, clearly visible)
    ctx.fillStyle = '#2a2a2a'
    ctx.fillRect(x + 2, y + 6, 22, 12) // keyboard body
    ctx.fillStyle = '#4a4a4a'
    // Key rows
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 9; c++) {
        ctx.fillRect(x + 3 + c * 2, y + 7 + r * 4, 1, 3)
      }
    }
    // Spacebar
    ctx.fillStyle = '#5a5a5a'
    ctx.fillRect(x + 7, y + 15, 10, 2)

    // Mouse (to the right)
    ctx.fillStyle = '#e0e0e0'
    ctx.fillRect(x + 26, y + 10, 4, 7)
    ctx.fillStyle = '#ccc'
    ctx.fillRect(x + 27, y + 9, 2, 2) // scroll wheel area

    // Coffee mug (top-down = circle)
    ctx.fillStyle = '#c0a070'
    ctx.beginPath()
    ctx.arc(x + 8, y + 24, 4, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#3a2a1a'
    ctx.beginPath()
    ctx.arc(x + 8, y + 24, 3, 0, Math.PI * 2)
    ctx.fill()
  }
}

// ── Bedroom: Big Bed (2x2 seamless) ─────────────────────────────────────────

export function drawBigBed(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  part: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right',
): void {
  switch (part) {
    case 'top-left':
      // Headboard (wood, full width)
      ctx.fillStyle = WOOD_DARK
      ctx.fillRect(x, y + 1, TW, 10)
      ctx.fillStyle = '#6a4a2a'
      ctx.fillRect(x + 1, y + 2, TW - 1, 8)
      ctx.fillStyle = WOOD_HIGHLIGHT
      ctx.fillRect(x + 3, y + 4, TW - 3, 3) // decorative bar
      // Left pillow
      ctx.fillStyle = PILLOW_WHITE
      ctx.fillRect(x + 2, y + 13, TW - 2, 8)
      ctx.fillStyle = '#ece4d4'
      ctx.fillRect(x + 2, y + 13, TW - 2, 2)
      // Blanket
      ctx.fillStyle = FABRIC_BLUE
      ctx.fillRect(x, y + 23, TW, 9)
      ctx.fillStyle = '#4a5a8a'
      ctx.fillRect(x, y + 23, TW, 2) // fold
      break
    case 'top-right':
      // Headboard continues
      ctx.fillStyle = WOOD_DARK
      ctx.fillRect(x, y + 1, TW, 10)
      ctx.fillStyle = '#6a4a2a'
      ctx.fillRect(x, y + 2, TW - 1, 8)
      ctx.fillStyle = WOOD_HIGHLIGHT
      ctx.fillRect(x, y + 4, TW - 3, 3)
      // Right pillow
      ctx.fillStyle = PILLOW_WHITE
      ctx.fillRect(x, y + 13, TW - 2, 8)
      ctx.fillStyle = '#ece4d4'
      ctx.fillRect(x, y + 13, TW - 2, 2)
      // Blanket
      ctx.fillStyle = FABRIC_BLUE
      ctx.fillRect(x, y + 23, TW, 9)
      ctx.fillStyle = '#4a5a8a'
      ctx.fillRect(x, y + 23, TW, 2)
      break
    case 'bottom-left':
      // Blanket body with pattern
      ctx.fillStyle = FABRIC_BLUE
      ctx.fillRect(x, y, TW, 24)
      ctx.fillStyle = '#4a5a8a'
      ctx.fillRect(x + 2, y + 5, TW - 2, 2) // stripe
      ctx.fillStyle = '#5a6a9a'
      ctx.fillRect(x + 2, y + 13, TW - 2, 2) // stripe
      // Footboard
      ctx.fillStyle = WOOD_DARK
      ctx.fillRect(x, y + 24, TW, 8)
      ctx.fillStyle = '#6a4a2a'
      ctx.fillRect(x + 1, y + 25, TW - 1, 6)
      break
    case 'bottom-right':
      ctx.fillStyle = FABRIC_BLUE
      ctx.fillRect(x, y, TW, 24)
      ctx.fillStyle = '#4a5a8a'
      ctx.fillRect(x, y + 5, TW - 2, 2)
      ctx.fillStyle = '#5a6a9a'
      ctx.fillRect(x, y + 13, TW - 2, 2)
      // Footboard
      ctx.fillStyle = WOOD_DARK
      ctx.fillRect(x, y + 24, TW, 8)
      ctx.fillStyle = '#6a4a2a'
      ctx.fillRect(x, y + 25, TW - 1, 6)
      break
  }
}

// ── Common Furniture ────────────────────────────────────────────────────────

export function drawBookshelf(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
): void {
  ctx.fillStyle = WOOD_DARK
  ctx.fillRect(x + 2, y, TW - 4, TH)
  ctx.fillStyle = WOOD_MED
  ctx.fillRect(x + 3, y + 1, TW - 6, TH - 2)
  for (let row = 0; row < 3; row++) {
    const sy = y + 2 + row * 10
    ctx.fillStyle = WOOD_DARK
    ctx.fillRect(x + 3, sy + 9, TW - 6, 1)
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = BOOK_COLORS[i]
      ctx.fillRect(
        x + 4 + i * 5,
        sy + 9 - (6 + (i % 3)),
        3 + (i % 2),
        6 + (i % 3),
      )
    }
  }
}

export function drawChair(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
): void {
  // Top-down chair
  ctx.fillStyle = FABRIC_BLUE
  ctx.fillRect(x + 6, y + 4, 20, 18) // seat
  ctx.fillStyle = '#4a5a8a'
  ctx.fillRect(x + 6, y + 4, 20, 3) // back
  ctx.fillStyle = METAL_DARK
  ctx.fillRect(x + 8, y + 24, 2, 6)
  ctx.fillRect(x + 22, y + 24, 2, 6)
  ctx.fillRect(x + 6, y + 28, 20, 2)
}

export function drawTable(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
): void {
  ctx.fillStyle = WOOD_MED
  ctx.fillRect(x + 3, y + 10, TW - 6, 12)
  ctx.fillStyle = WOOD_HIGHLIGHT
  ctx.fillRect(x + 3, y + 10, TW - 6, 2)
  ctx.fillStyle = WOOD_DARK
  ctx.fillRect(x + 5, y + 22, 3, 8)
  ctx.fillRect(x + TW - 8, y + 22, 3, 8)
}

export function drawSofa(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
): void {
  ctx.fillStyle = FABRIC_RED
  ctx.fillRect(x + 1, y + 4, TW - 2, 10) // back
  ctx.fillStyle = '#7a2828'
  ctx.fillRect(x + 1, y + 4, TW - 2, 2)
  ctx.fillStyle = '#9a3838'
  ctx.fillRect(x + 1, y + 14, TW - 2, 12) // seat
  ctx.fillStyle = FABRIC_RED
  ctx.fillRect(x + 2, y + 15, TW - 4, 2)
  ctx.fillStyle = '#7a2828'
  ctx.fillRect(x - 1, y + 6, 3, 22) // left arm
  ctx.fillRect(x + TW - 2, y + 6, 3, 22) // right arm
  ctx.fillStyle = WOOD_DARK
  ctx.fillRect(x + 1, y + 28, 3, 4)
  ctx.fillRect(x + TW - 4, y + 28, 3, 4)
}

export function drawLamp(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
): void {
  ctx.fillStyle = 'rgba(255, 248, 200, 0.2)'
  ctx.beginPath()
  ctx.arc(x + TW / 2, y + 10, 14, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = LAMP_SHADE
  ctx.fillRect(x + 7, y + 4, 18, 12)
  ctx.fillStyle = LAMP_GLOW
  ctx.fillRect(x + 8, y + 5, 16, 10)
  ctx.fillStyle = LAMP_BASE
  ctx.fillRect(x + 13, y + 16, 6, 10)
  ctx.fillRect(x + 9, y + 26, 14, 4)
}

export function drawNightstand(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
): void {
  ctx.fillStyle = WOOD_MED
  ctx.fillRect(x + 4, y + 6, TW - 8, 22)
  ctx.fillStyle = WOOD_HIGHLIGHT
  ctx.fillRect(x + 4, y + 6, TW - 8, 2)
  ctx.fillStyle = WOOD_DARK
  ctx.fillRect(x + 6, y + 12, TW - 12, 10)
  ctx.fillStyle = WOOD_MED
  ctx.fillRect(x + 7, y + 13, TW - 14, 8)
  ctx.fillStyle = '#b0a080'
  ctx.fillRect(x + TW / 2 - 1, y + 16, 3, 2)
  ctx.fillStyle = WOOD_DARK
  ctx.fillRect(x + 6, y + 28, 2, 4)
  ctx.fillRect(x + TW - 8, y + 28, 2, 4)
}

export function drawRug(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
): void {
  ctx.fillStyle = '#8a5030'
  ctx.fillRect(x + 1, y + 1, TW - 2, TH - 2)
  ctx.fillStyle = '#9a6040'
  ctx.fillRect(x + 3, y + 3, TW - 6, TH - 6)
  ctx.fillStyle = '#aa7050'
  ctx.fillRect(x + 5, y + 5, TW - 10, TH - 10)
}

export function drawPlant(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
): void {
  // Pot
  ctx.fillStyle = '#9a6040'
  ctx.fillRect(x + 10, y + 20, 12, 10)
  ctx.fillRect(x + 8, y + 18, 16, 3)
  // Leaves
  ctx.fillStyle = '#3a8a3a'
  ctx.beginPath()
  ctx.arc(x + 16, y + 12, 8, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#4a9a4a'
  ctx.beginPath()
  ctx.arc(x + 12, y + 10, 5, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(x + 20, y + 14, 5, 0, Math.PI * 2)
  ctx.fill()
}

// ── Wall Drawing ────────────────────────────────────────────────────────────

export function drawWallTile(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  isTopWall: boolean,
  hasWindow: boolean = false,
): void {
  const wallH = isTopWall ? 28 : 16
  ctx.fillStyle = '#6b5544'
  ctx.fillRect(x, y - wallH, TW, wallH + TH)
  ctx.fillStyle = '#5a4433'
  ctx.fillRect(x, y, TW, TH)
  ctx.fillStyle = '#7a6655'
  ctx.fillRect(x, y - 1, TW, 1)
  ctx.fillStyle = '#8a7a66'
  ctx.fillRect(x, y - wallH, TW, 2)
  if (hasWindow && isTopWall) {
    ctx.fillStyle = WOOD_DARK
    ctx.fillRect(x + 6, y - wallH + 6, 20, 16)
    ctx.fillStyle = '#8ab8d8'
    ctx.fillRect(x + 8, y - wallH + 8, 16, 12)
    ctx.fillStyle = WOOD_DARK
    ctx.fillRect(x + 15, y - wallH + 8, 2, 12)
    ctx.fillRect(x + 8, y - wallH + 13, 16, 2)
    ctx.fillStyle = 'rgba(200, 220, 255, 0.15)'
    ctx.fillRect(x + 8, y - wallH + 8, 7, 5)
  }
}

// ── Master draw function ────────────────────────────────────────────────────

export function drawPixelFurniture(
  ctx: CanvasRenderingContext2D,
  type: string,
  x: number,
  y: number,
  col: number,
  row: number,
): boolean {
  switch (type) {
    case 'desk-computer':
      if (col <= 7) {
        drawWorkbench(ctx, x, y, col + row)
      } else {
        if (col === 10) drawBigComputer(ctx, x, y, 'left')
        else drawBigComputer(ctx, x, y, 'right')
      }
      return true
    case 'chair-office':
      drawChair(ctx, x, y)
      return true
    case 'bookshelf':
      drawBookshelf(ctx, x, y)
      return true
    case 'bed': {
      const isLeft = col === 18
      const isTop = row === 3
      if (isTop && isLeft) drawBigBed(ctx, x, y, 'top-left')
      else if (isTop && !isLeft) drawBigBed(ctx, x, y, 'top-right')
      else if (!isTop && isLeft) drawBigBed(ctx, x, y, 'bottom-left')
      else drawBigBed(ctx, x, y, 'bottom-right')
      return true
    }
    case 'table':
      drawTable(ctx, x, y)
      return true
    case 'sofa':
      drawSofa(ctx, x, y)
      return true
    case 'lamp':
      drawLamp(ctx, x, y)
      return true
    case 'nightstand':
      drawNightstand(ctx, x, y)
      return true
    case 'rug':
      drawRug(ctx, x, y)
      return true
    case 'plant':
      drawPlant(ctx, x, y)
      return true
    default:
      return false
  }
}
