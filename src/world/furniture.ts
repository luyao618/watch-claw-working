/**
 * Furniture catalog — defines furniture placements in each room.
 */

import type { FurniturePlacement } from '@/engine/gameState.ts'

// ── Furniture Type Identifiers ──────────────────────────────────────────────

export const FurnitureType = {
  DESK_COMPUTER: 'desk-computer',
  CHAIR_OFFICE: 'chair-office',
  SOFA: 'sofa',
  FIREPLACE: 'fireplace',
  BED: 'bed',
  LAMP: 'lamp',
  BOOKSHELF: 'bookshelf',
  TABLE: 'table',
} as const

// ── Furniture Colors (for placeholder rendering) ────────────────────────────

export const FURNITURE_COLORS: Record<string, string> = {
  [FurnitureType.DESK_COMPUTER]: '#5a4a3a',
  [FurnitureType.CHAIR_OFFICE]: '#3a3a5a',
  [FurnitureType.SOFA]: '#6a3a3a',
  [FurnitureType.FIREPLACE]: '#8a4a2a',
  [FurnitureType.BED]: '#4a5a6a',
  [FurnitureType.LAMP]: '#8a8a3a',
  [FurnitureType.BOOKSHELF]: '#5a3a2a',
  [FurnitureType.TABLE]: '#6a5a4a',
}

// ── Office Furniture ────────────────────────────────────────────────────────

export const OFFICE_FURNITURE: FurniturePlacement[] = [
  {
    type: FurnitureType.DESK_COMPUTER,
    col: 3,
    row: 3,
    spriteKey: 'desk-computer',
    zOffset: 0,
    walkable: false,
    occupiable: false,
  },
  {
    type: FurnitureType.CHAIR_OFFICE,
    col: 3,
    row: 4,
    spriteKey: 'chair-office',
    zOffset: 0,
    walkable: true,
    occupiable: true,
  },
  {
    type: FurnitureType.BOOKSHELF,
    col: 2,
    row: 2,
    spriteKey: 'bookshelf',
    zOffset: 0,
    walkable: false,
    occupiable: false,
  },
  {
    type: FurnitureType.LAMP,
    col: 4,
    row: 3,
    spriteKey: 'lamp',
    zOffset: 0,
    walkable: false,
    occupiable: false,
  },
]

// ── Living Room Furniture ───────────────────────────────────────────────────

export const LIVING_ROOM_FURNITURE: FurniturePlacement[] = [
  {
    type: FurnitureType.SOFA,
    col: 7,
    row: 5,
    spriteKey: 'sofa',
    zOffset: 0,
    walkable: true,
    occupiable: true,
  },
  {
    type: FurnitureType.FIREPLACE,
    col: 8,
    row: 2,
    spriteKey: 'fireplace',
    zOffset: 0,
    walkable: false,
    occupiable: false,
  },
  {
    type: FurnitureType.TABLE,
    col: 7,
    row: 4,
    spriteKey: 'table',
    zOffset: 0,
    walkable: false,
    occupiable: false,
  },
  {
    type: FurnitureType.BOOKSHELF,
    col: 9,
    row: 3,
    spriteKey: 'bookshelf',
    zOffset: 0,
    walkable: false,
    occupiable: false,
  },
]

// ── Bedroom Furniture ───────────────────────────────────────────────────────

export const BEDROOM_FURNITURE: FurniturePlacement[] = [
  {
    type: FurnitureType.BED,
    col: 12,
    row: 4,
    spriteKey: 'bed',
    zOffset: 0,
    walkable: true,
    occupiable: true,
  },
  {
    type: FurnitureType.LAMP,
    col: 13,
    row: 3,
    spriteKey: 'lamp',
    zOffset: 0,
    walkable: false,
    occupiable: false,
  },
  {
    type: FurnitureType.TABLE,
    col: 12,
    row: 6,
    spriteKey: 'table',
    zOffset: 0,
    walkable: false,
    occupiable: false,
  },
]

// ── All Furniture ───────────────────────────────────────────────────────────

export const ALL_FURNITURE: FurniturePlacement[] = [
  ...OFFICE_FURNITURE,
  ...LIVING_ROOM_FURNITURE,
  ...BEDROOM_FURNITURE,
]

/**
 * Get furniture at a specific tile position.
 */
export function getFurnitureAt(
  col: number,
  row: number,
): FurniturePlacement | undefined {
  return ALL_FURNITURE.find((f) => f.col === col && f.row === row)
}
