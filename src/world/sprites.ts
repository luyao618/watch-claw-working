/**
 * Sprite definitions and loading system.
 *
 * Defines animation configs and sprite asset paths for the game.
 * Uses the spritesheet system from engine/spritesheet.ts.
 */

import type { AnimationId } from '@/connection/types.ts'
import {
  Spritesheet,
  type SpritesheetConfig,
  loadSprite,
  getCachedSprite,
} from '@/engine/spritesheet.ts'

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

// ── Character Spritesheet ───────────────────────────────────────────────────
// LPC format: Walk spritesheet is 512x256 (8 frames x 4 dirs, 64x64 per frame)
// Row order: 0=up, 1=left, 2=down, 3=right

const CHARACTER_SPRITESHEET_CONFIG: SpritesheetConfig = {
  src: '/assets/character/character-walk.png',
  frameWidth: 64,
  frameHeight: 64,
  animations: {
    // Walk animations (8 frames each, from the walk spritesheet)
    walk_up: { row: 0, frameCount: 8, fps: 8, loop: true },
    walk_left: { row: 1, frameCount: 8, fps: 8, loop: true },
    walk_down: { row: 2, frameCount: 8, fps: 8, loop: true },
    walk_right: { row: 3, frameCount: 8, fps: 8, loop: true },
    // Idle: reuse first frame of each walk direction
    idle_up: { row: 0, frameCount: 1, fps: 2, loop: true },
    idle_left: { row: 1, frameCount: 1, fps: 2, loop: true },
    idle_down: { row: 2, frameCount: 1, fps: 2, loop: true },
    idle_right: { row: 3, frameCount: 1, fps: 2, loop: true },
    // Activity states: reuse walk-down as base
    type: { row: 2, frameCount: 2, fps: 4, loop: true },
    sleep: { row: 2, frameCount: 1, fps: 1, loop: true },
    sit: { row: 2, frameCount: 1, fps: 1, loop: true },
    think: { row: 0, frameCount: 1, fps: 2, loop: true },
    celebrate: { row: 2, frameCount: 4, fps: 4, loop: false },
  },
}

let characterSpritesheet: Spritesheet | null = null

/**
 * Get the character spritesheet (creates and loads on first call).
 */
export function getCharacterSpritesheet(): Spritesheet {
  if (!characterSpritesheet) {
    characterSpritesheet = new Spritesheet(CHARACTER_SPRITESHEET_CONFIG)
  }
  return characterSpritesheet
}

// ── Furniture Sprite Paths ──────────────────────────────────────────────────

export const FURNITURE_SPRITE_PATHS: Record<string, string> = {
  'desk-computer': '/assets/furniture/desk-computer.png',
  'chair-office': '/assets/furniture/chair-office.png',
  sofa: '/assets/furniture/sofa.png',
  bookshelf: '/assets/furniture/bookshelf.png',
  bed: '/assets/furniture/bed.png',
  lamp: '/assets/furniture/lamp.png',
  table: '/assets/furniture/table.png',
  nightstand: '/assets/furniture/nightstand.png',
}

// ── Tileset ─────────────────────────────────────────────────────────────────
// LPC interior.png: 512x512, 32x32 per tile, 16 cols x 16 rows
// Row 0: various floor tiles
// Rows 1-6: furniture items
// We'll just reference tile positions directly

const TILESET_CONFIG: SpritesheetConfig = {
  src: '/assets/tilesets/interior.png',
  frameWidth: 32,
  frameHeight: 32,
  animations: {
    // Floor tiles from interior.png
    floor_wood: { row: 0, frameCount: 1, fps: 1, loop: false },
    floor_carpet: { row: 1, frameCount: 1, fps: 1, loop: false },
    wall: { row: 2, frameCount: 1, fps: 1, loop: false },
    door: { row: 3, frameCount: 1, fps: 1, loop: false },
  },
}

let tilesetSpritesheet: Spritesheet | null = null

export function getTilesetSpritesheet(): Spritesheet {
  if (!tilesetSpritesheet) {
    tilesetSpritesheet = new Spritesheet(TILESET_CONFIG)
  }
  return tilesetSpritesheet
}

// ── Emotion Bubbles ─────────────────────────────────────────────────────────

const EMOTION_SPRITESHEET_CONFIG: SpritesheetConfig = {
  src: '/assets/ui/emotion-bubbles.png',
  frameWidth: 16,
  frameHeight: 16,
  animations: {
    focused: { row: 0, frameCount: 1, fps: 1, loop: false },
    thinking: { row: 1, frameCount: 1, fps: 1, loop: false },
    sleepy: { row: 2, frameCount: 1, fps: 1, loop: false },
    happy: { row: 3, frameCount: 1, fps: 1, loop: false },
    confused: { row: 4, frameCount: 1, fps: 1, loop: false },
    curious: { row: 5, frameCount: 1, fps: 1, loop: false },
    serious: { row: 6, frameCount: 1, fps: 1, loop: false },
    satisfied: { row: 7, frameCount: 1, fps: 1, loop: false },
  },
}

let emotionSpritesheet: Spritesheet | null = null

export function getEmotionSpritesheet(): Spritesheet {
  if (!emotionSpritesheet) {
    emotionSpritesheet = new Spritesheet(EMOTION_SPRITESHEET_CONFIG)
  }
  return emotionSpritesheet
}

// ── Preloading ──────────────────────────────────────────────────────────────

/**
 * Preload all sprite assets. Failures are silently logged —
 * the renderer will use fallback colors.
 */
export async function preloadAllSprites(): Promise<void> {
  const promises: Promise<unknown>[] = []

  // Load spritesheets
  promises.push(getCharacterSpritesheet().load())
  promises.push(getTilesetSpritesheet().load())
  promises.push(getEmotionSpritesheet().load())

  // Load individual furniture sprites
  for (const path of Object.values(FURNITURE_SPRITE_PATHS)) {
    promises.push(loadSprite(path))
  }

  await Promise.allSettled(promises)
  console.log('[sprites] Preloading complete')
}

// Re-export for backwards compatibility
export { loadSprite, getCachedSprite }

/**
 * Clear the sprite cache.
 */
export function clearSpriteCache(): void {
  characterSpritesheet = null
  tilesetSpritesheet = null
  emotionSpritesheet = null
}
