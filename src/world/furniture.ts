/**
 * Furniture catalog — v0.2 layout with centered main pieces.
 */

import type { FurniturePlacement } from '@/engine/gameState.ts'

export const FurnitureType = {
  DESK_COMPUTER: 'desk-computer',
  CHAIR_OFFICE: 'chair-office',
  SOFA: 'sofa',
  BED: 'bed',
  LAMP: 'lamp',
  BOOKSHELF: 'bookshelf',
  TABLE: 'table',
  NIGHTSTAND: 'nightstand',
  RUG: 'rug',
  PLANT: 'plant',
} as const

export const FURNITURE_COLORS: Record<string, string> = {
  [FurnitureType.DESK_COMPUTER]: '#5a4a3a',
  [FurnitureType.CHAIR_OFFICE]: '#3a3a5a',
  [FurnitureType.SOFA]: '#6a3a3a',
  [FurnitureType.BED]: '#4a5a6a',
  [FurnitureType.LAMP]: '#8a8a3a',
  [FurnitureType.BOOKSHELF]: '#5a3a2a',
  [FurnitureType.TABLE]: '#6a5a4a',
  [FurnitureType.NIGHTSTAND]: '#7a6a5a',
  [FurnitureType.RUG]: '#8a6040',
  [FurnitureType.PLANT]: '#3a7a3a',
}

const F = (
  type: string,
  col: number,
  row: number,
  walkable = false,
  occupiable = false,
): FurniturePlacement => ({
  type,
  col,
  row,
  spriteKey: type,
  zOffset: 0,
  walkable,
  occupiable,
})

// ── Workshop (工作室) — vertical workbench centered ─────────────────────────

export const WORKSHOP_FURNITURE: FurniturePlacement[] = [
  // Vertical workbench: 2 wide x 3 tall, centered (cols 3-4, rows 2-4)
  F('desk-computer', 3, 2),
  F('desk-computer', 4, 2),
  F('desk-computer', 3, 3),
  F('desk-computer', 4, 3),
  F('desk-computer', 3, 4),
  F('desk-computer', 4, 4),
  // Chair below workbench
  F('chair-office', 3, 5, true, true),
  // Left wall: bookshelves (tools/parts storage)
  F('bookshelf', 1, 1),
  F('bookshelf', 1, 2),
  F('bookshelf', 1, 3),
  // Right wall: bookshelves
  F('bookshelf', 6, 1),
  F('bookshelf', 6, 2),
  // Lamps for lighting
  F('lamp', 2, 1),
  F('lamp', 5, 1),
  // Bottom corners: table + plant
  F('table', 1, 7),
  F('plant', 6, 7),
  // Rug in work area
  F('rug', 3, 6, true),
  F('rug', 4, 6, true),
]

// ── Study (书房) — big computer centered ────────────────────────────────────

export const STUDY_FURNITURE: FurniturePlacement[] = [
  // Big computer: 2 wide, row 3 (center of room)
  F('desk-computer', 10, 3),
  F('desk-computer', 11, 3),
  // Chair below desk
  F('chair-office', 10, 5, true, true),
  // Left wall: tall bookshelf column
  F('bookshelf', 8, 1),
  F('bookshelf', 8, 2),
  F('bookshelf', 8, 3),
  // Right wall: bookshelf + lamp
  F('bookshelf', 14, 1),
  F('bookshelf', 14, 2),
  F('lamp', 14, 5),
  // Top center: lamps
  F('lamp', 10, 1),
  F('lamp', 12, 1),
  // Bottom: sofa + coffee table
  F('sofa', 10, 7, true, true),
  F('sofa', 11, 7, true, true),
  F('table', 10, 6),
  // Corners: plants
  F('plant', 9, 1),
  F('plant', 13, 7),
  // Rug under desk area
  F('rug', 10, 4, true),
  F('rug', 11, 4, true),
  F('rug', 10, 5, true),
  F('rug', 11, 5, true),
]

// ── Bedroom (卧室) — big bed centered ───────────────────────────────────────

export const BEDROOM_FURNITURE: FurniturePlacement[] = [
  // Big bed: 2x2, centered (cols 18-19, rows 3-4)
  F('bed', 18, 3, true, true),
  F('bed', 19, 3, true, true),
  F('bed', 18, 4, true, true),
  F('bed', 19, 4, true, true),
  // Nightstands beside bed
  F('nightstand', 17, 3),
  F('nightstand', 20, 3),
  // Lamps on nightstands
  F('lamp', 17, 1),
  F('lamp', 20, 1),
  // Left wall: bookshelf
  F('bookshelf', 16, 1),
  F('bookshelf', 16, 2),
  // Right wall: bookshelf
  F('bookshelf', 22, 1),
  F('bookshelf', 22, 2),
  // Bottom: table + sofa
  F('table', 18, 7),
  F('sofa', 20, 7, true, true),
  // Rug at foot of bed
  F('rug', 18, 5, true),
  F('rug', 19, 5, true),
  // Plants in corners
  F('plant', 16, 7),
  F('plant', 22, 7),
  // Top center decor
  F('table', 18, 1),
  F('table', 19, 1),
]

export const OFFICE_FURNITURE = WORKSHOP_FURNITURE
export const LIVING_ROOM_FURNITURE = STUDY_FURNITURE

export const ALL_FURNITURE: FurniturePlacement[] = [
  ...WORKSHOP_FURNITURE,
  ...STUDY_FURNITURE,
  ...BEDROOM_FURNITURE,
]

export function getFurnitureAt(
  col: number,
  row: number,
): FurniturePlacement | undefined {
  return ALL_FURNITURE.find((f) => f.col === col && f.row === row)
}
