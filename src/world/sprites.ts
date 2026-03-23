/**
 * Sprite loading and caching system.
 *
 * For MVP, provides programmatic placeholder sprites (colored shapes)
 * that can be replaced with pixel art later.
 */

import type { AnimationId } from '@/connection/types.ts'

// ── Animation Config ────────────────────────────────────────────────────────

export interface AnimationConfig {
  frameCount: number
  fps: number
  loop: boolean
}

export const ANIMATIONS: Record<AnimationId, AnimationConfig> = {
  idle: { frameCount: 4, fps: 2, loop: true },
  walk: { frameCount: 6, fps: 8, loop: true },
  type: { frameCount: 4, fps: 6, loop: true },
  sleep: { frameCount: 4, fps: 1, loop: true },
  sit: { frameCount: 2, fps: 1, loop: true },
  think: { frameCount: 4, fps: 2, loop: true },
  celebrate: { frameCount: 6, fps: 4, loop: false },
}

// ── Sprite Cache ────────────────────────────────────────────────────────────

const spriteCache = new Map<string, HTMLImageElement>()

/**
 * Load a sprite image and cache it. Returns from cache if already loaded.
 */
export async function loadSprite(path: string): Promise<HTMLImageElement> {
  const cached = spriteCache.get(path)
  if (cached) return cached

  return new Promise<HTMLImageElement>((resolve) => {
    const img = new Image()
    img.onload = () => {
      spriteCache.set(path, img)
      resolve(img)
    }
    img.onerror = () => {
      console.warn(`[sprites] Failed to load: ${path}, using placeholder`)
      // Return the image anyway (will be empty)
      spriteCache.set(path, img)
      resolve(img)
    }
    img.src = path
  })
}

/**
 * Get a cached sprite or null.
 */
export function getCachedSprite(path: string): HTMLImageElement | null {
  return spriteCache.get(path) ?? null
}

/**
 * Clear the sprite cache.
 */
export function clearSpriteCache(): void {
  spriteCache.clear()
}
