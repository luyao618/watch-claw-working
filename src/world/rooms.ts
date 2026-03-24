/**
 * Room Definitions — defines the three rooms in the horizontal layout.
 *
 * Layout (1-tile-thick walls):
 *   Workshop (cols 1-6) | Study (cols 8-14) | Bedroom (cols 16-22)
 *   Doors at row 4, cols 7 and 15
 */

import type { Room } from '@/engine/gameState.ts'
import type { RoomId } from '@/connection/types.ts'

// ── Room Definitions ────────────────────────────────────────────────────────

export const ROOMS: Record<RoomId, Room> = {
  workshop: {
    id: 'workshop',
    name: 'Workshop',
    bounds: {
      startCol: 1,
      startRow: 1,
      endCol: 6,
      endRow: 7,
    },
    entryTile: { col: 6, row: 4 },
    activityZone: { col: 4, row: 5 }, // Clear tile in front of workbench
    furnitureItems: [],
  },
  study: {
    id: 'study',
    name: 'Study',
    bounds: {
      startCol: 8,
      startRow: 1,
      endCol: 14,
      endRow: 7,
    },
    entryTile: { col: 8, row: 4 },
    activityZone: { col: 11, row: 4 }, // In front of the centered computer
    furnitureItems: [],
  },
  bedroom: {
    id: 'bedroom',
    name: 'Bedroom',
    bounds: {
      startCol: 16,
      startRow: 1,
      endCol: 22,
      endRow: 7,
    },
    entryTile: { col: 16, row: 4 },
    activityZone: { col: 19, row: 3 }, // On the bed
    furnitureItems: [],
  },
}

/**
 * Get a room by its ID.
 */
export function getRoomById(id: RoomId): Room {
  return ROOMS[id]
}

/**
 * Get all rooms.
 */
export function getAllRooms(): Room[] {
  return Object.values(ROOMS)
}
