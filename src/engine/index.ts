// Game Engine Layer
// Game loop, renderer, character FSM, pathfinding, camera, isometric math

export {
  cartesianToIso,
  isoToCartesian,
  getTileAtScreen,
  tileCenter,
} from './isometric.ts'
export type { ScreenPos, TileCoord } from './isometric.ts'

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
