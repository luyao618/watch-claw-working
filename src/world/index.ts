// World Data Layer
// Tile map, room definitions, furniture catalog, sprite loading

export {
  getFloorLayout,
  buildWalkabilityGrid,
  FLOOR_LAYOUT,
  MAP_COLS,
  MAP_ROWS,
} from './tileMap.ts'

export { ROOMS, getRoomById, getAllRooms } from './rooms.ts'

export {
  ALL_FURNITURE,
  OFFICE_FURNITURE,
  LIVING_ROOM_FURNITURE,
  BEDROOM_FURNITURE,
  FURNITURE_COLORS,
  FurnitureType,
  getFurnitureAt,
} from './furniture.ts'

export {
  ANIMATIONS,
  loadSprite,
  getCachedSprite,
  clearSpriteCache,
} from './sprites.ts'
export type { AnimationConfig } from './sprites.ts'
