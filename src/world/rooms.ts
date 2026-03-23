/**
 * Room Definitions — defines the three rooms in the single-floor house.
 */

import type { Room } from '@/engine/gameState.ts'
import type { RoomId } from '@/connection/types.ts'

// ── Room Definitions ────────────────────────────────────────────────────────

export const ROOMS: Record<RoomId, Room> = {
  office: {
    id: 'office',
    name: 'Office',
    bounds: {
      startCol: 2,
      startRow: 2,
      endCol: 4,
      endRow: 7,
    },
    entryTile: { col: 4, row: 5 }, // Door position
    activityZone: { col: 3, row: 4 }, // Chair position (where character sits to type)
    furnitureItems: [],
  },
  'living-room': {
    id: 'living-room',
    name: 'Living Room',
    bounds: {
      startCol: 6,
      startRow: 2,
      endCol: 9,
      endRow: 7,
    },
    entryTile: { col: 6, row: 5 }, // Door position
    activityZone: { col: 7, row: 5 }, // Sofa position
    furnitureItems: [],
  },
  bedroom: {
    id: 'bedroom',
    name: 'Bedroom',
    bounds: {
      startCol: 11,
      startRow: 2,
      endCol: 13,
      endRow: 7,
    },
    entryTile: { col: 11, row: 5 }, // Door position
    activityZone: { col: 12, row: 4 }, // Bed position
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
