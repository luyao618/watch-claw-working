/**
 * Spritesheet — loading, frame cutting, and animation frame definitions
 * for 3/4 top-down pixel art sprites.
 */

// ── Types ──────────────────────────────────────────────────────────────────

export interface SpriteFrame {
  x: number
  y: number
  width: number
  height: number
}

export interface SpritesheetConfig {
  /** Path to the spritesheet image */
  src: string
  /** Width of each frame in pixels */
  frameWidth: number
  /** Height of each frame in pixels */
  frameHeight: number
  /** Named animation definitions */
  animations: Record<string, SpriteAnimationDef>
}

export interface SpriteAnimationDef {
  /** Row in the spritesheet (0-based) */
  row: number
  /** Number of frames */
  frameCount: number
  /** Frames per second */
  fps: number
  /** Whether the animation loops */
  loop: boolean
}

// ── Spritesheet Class ──────────────────────────────────────────────────────

export class Spritesheet {
  private image: HTMLImageElement | null = null
  private loaded = false
  private loadFailed = false
  readonly config: SpritesheetConfig

  constructor(config: SpritesheetConfig) {
    this.config = config
  }

  /**
   * Load the spritesheet image. Returns true if successful.
   */
  async load(): Promise<boolean> {
    if (this.loaded) return true

    return new Promise<boolean>((resolve) => {
      const img = new Image()
      img.onload = () => {
        this.image = img
        this.loaded = true
        resolve(true)
      }
      img.onerror = () => {
        console.warn(
          `[Spritesheet] Failed to load: ${this.config.src}, will use fallback`,
        )
        this.loadFailed = true
        resolve(false)
      }
      img.src = this.config.src
    })
  }

  get isLoaded(): boolean {
    return this.loaded
  }

  get hasFailed(): boolean {
    return this.loadFailed
  }

  /**
   * Get the frame rectangle for a given animation and frame index.
   */
  getFrame(animationName: string, frameIndex: number): SpriteFrame | null {
    const anim = this.config.animations[animationName]
    if (!anim) return null

    const frame = Math.floor(frameIndex) % anim.frameCount

    return {
      x: frame * this.config.frameWidth,
      y: anim.row * this.config.frameHeight,
      width: this.config.frameWidth,
      height: this.config.frameHeight,
    }
  }

  /**
   * Draw a frame from this spritesheet onto a canvas context.
   * Returns false if the image isn't loaded (caller should draw fallback).
   */
  drawFrame(
    ctx: CanvasRenderingContext2D,
    animationName: string,
    frameIndex: number,
    destX: number,
    destY: number,
    destWidth?: number,
    destHeight?: number,
  ): boolean {
    if (!this.image || !this.loaded) return false

    const frame = this.getFrame(animationName, frameIndex)
    if (!frame) return false

    ctx.drawImage(
      this.image,
      frame.x,
      frame.y,
      frame.width,
      frame.height,
      destX,
      destY,
      destWidth ?? frame.width,
      destHeight ?? frame.height,
    )
    return true
  }
}

// ── Single Sprite Loader ──────────────────────────────────────────────────

const spriteCache = new Map<string, HTMLImageElement>()
const failedSprites = new Set<string>()

/**
 * Load a single sprite image and cache it.
 * Returns null if the image fails to load.
 */
export async function loadSprite(
  path: string,
): Promise<HTMLImageElement | null> {
  if (failedSprites.has(path)) return null

  const cached = spriteCache.get(path)
  if (cached) return cached

  return new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image()
    img.onload = () => {
      spriteCache.set(path, img)
      resolve(img)
    }
    img.onerror = () => {
      console.warn(`[Spritesheet] Failed to load sprite: ${path}`)
      failedSprites.add(path)
      resolve(null)
    }
    img.src = path
  })
}

/**
 * Get a cached sprite, or null if not loaded.
 */
export function getCachedSprite(path: string): HTMLImageElement | null {
  return spriteCache.get(path) ?? null
}

/**
 * Draw a fallback colored rectangle when sprite is unavailable.
 */
export function drawFallbackRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  color: string,
  label?: string,
): void {
  ctx.fillStyle = color
  ctx.fillRect(x, y, width, height)

  // Border
  ctx.strokeStyle = '#00000040'
  ctx.lineWidth = 1
  ctx.strokeRect(x, y, width, height)

  // Label
  if (label) {
    ctx.fillStyle = '#fff'
    ctx.font = '8px monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(label, x + width / 2, y + height / 2)
    ctx.textBaseline = 'alphabetic'
  }
}
