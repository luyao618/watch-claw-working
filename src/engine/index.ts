// Game Engine Layer
// Game loop, renderer, character FSM, pathfinding, camera, coordinate math

export {
  cartesianToScreen,
  screenToCartesian,
  getTileAtScreen,
  tileCenter,
} from './coordinates.ts'
export type { ScreenPos, TileCoord } from './coordinates.ts'

export { GameLoop } from './gameLoop.ts'

export {
  TileType,
  createInitialCharacterState,
  createInitialCameraState,
  createInitialConnectionInfo,
  createInitialDebugState,
} from './gameState.ts'
export type {
  GameState,
  CharacterState,
  CharacterFSMState,
  Direction,
  WorldState,
  CameraState,
  ConnectionInfo,
  DebugState,
  Room,
  FurniturePlacement,
} from './gameState.ts'

export { renderFrame, setupCanvas } from './renderer.ts'

export { findPath, getDirection } from './pathfinding.ts'

export { updateCharacter, processAction, queueAction } from './character.ts'

export {
  pan,
  zoomTo,
  zoomStep,
  centerOn,
  resetCamera,
  worldToScreen,
  screenToWorld,
  updateCamera,
  MIN_ZOOM,
  MAX_ZOOM,
} from './camera.ts'

export { Spritesheet, loadSprite, drawFallbackRect } from './spritesheet.ts'
