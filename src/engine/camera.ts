/**
 * Camera — viewport pan and zoom for 3/4 top-down view navigation.
 *
 * The camera defines an offset and zoom level applied to all rendering.
 * Smooth interpolation is used for transitions.
 */

import { clamp, lerp } from '@/utils/helpers.ts'
import { cartesianToScreen } from './coordinates.ts'
import type { CameraState } from './gameState.ts'
import { TILE_WIDTH, TILE_HEIGHT } from '@/utils/constants.ts'

// ── Constants ───────────────────────────────────────────────────────────────

const MIN_ZOOM = 0.5
const MAX_ZOOM = 5.0
const ZOOM_STEP = 0.25
const CAMERA_LERP_SPEED = 0.1 // Base lerp factor at 60fps

// ── Camera Functions ────────────────────────────────────────────────────────

/**
 * Pan the camera by pixel deltas.
 */
export function pan(camera: CameraState, dx: number, dy: number): void {
  camera.targetOffsetX += dx
  camera.targetOffsetY += dy
}

/**
 * Set the zoom level, clamped between MIN_ZOOM and MAX_ZOOM.
 * Zooms toward the screen center.
 */
export function zoomTo(
  camera: CameraState,
  level: number,
  screenCenterX?: number,
  screenCenterY?: number,
): void {
  const newZoom = clamp(level, MIN_ZOOM, MAX_ZOOM)
  if (newZoom === camera.targetZoom) return

  if (screenCenterX !== undefined && screenCenterY !== undefined) {
    // Zoom toward screen center
    const zoomRatio = newZoom / camera.targetZoom
    camera.targetOffsetX =
      screenCenterX - (screenCenterX - camera.targetOffsetX) * zoomRatio
    camera.targetOffsetY =
      screenCenterY - (screenCenterY - camera.targetOffsetY) * zoomRatio
  }

  camera.targetZoom = newZoom
}

/**
 * Adjust zoom by one step in the given direction.
 */
export function zoomStep(
  camera: CameraState,
  direction: 1 | -1,
  screenCenterX?: number,
  screenCenterY?: number,
): void {
  zoomTo(
    camera,
    camera.targetZoom + ZOOM_STEP * direction,
    screenCenterX,
    screenCenterY,
  )
}

/**
 * Center the camera on a tile position.
 */
export function centerOn(
  camera: CameraState,
  col: number,
  row: number,
  canvasWidth: number,
  canvasHeight: number,
): void {
  const screen = cartesianToScreen(col, row)
  camera.targetOffsetX =
    canvasWidth / 2 - (screen.x + TILE_WIDTH / 2) * camera.targetZoom
  camera.targetOffsetY =
    canvasHeight / 2 - (screen.y + TILE_HEIGHT / 2) * camera.targetZoom
}

/**
 * Reset camera to default view centered on the map.
 */
export function resetCamera(
  camera: CameraState,
  mapCols: number,
  mapRows: number,
  canvasWidth: number,
  canvasHeight: number,
): void {
  camera.targetZoom = 1
  centerOn(camera, mapCols / 2, mapRows / 2, canvasWidth, canvasHeight)
}

/**
 * Convert world coordinates to screen coordinates using current camera state.
 */
export function worldToScreen(
  worldX: number,
  worldY: number,
  camera: CameraState,
): { x: number; y: number } {
  return {
    x: worldX * camera.zoom + camera.offsetX,
    y: worldY * camera.zoom + camera.offsetY,
  }
}

/**
 * Convert screen coordinates to world coordinates.
 */
export function screenToWorld(
  screenX: number,
  screenY: number,
  camera: CameraState,
): { x: number; y: number } {
  return {
    x: (screenX - camera.offsetX) / camera.zoom,
    y: (screenY - camera.offsetY) / camera.zoom,
  }
}

/**
 * Update camera state with smooth interpolation toward target values.
 */
export function updateCamera(camera: CameraState, dt = 1 / 60): void {
  const t = 1 - Math.pow(1 - CAMERA_LERP_SPEED, dt * 60)

  camera.offsetX = lerp(camera.offsetX, camera.targetOffsetX, t)
  camera.offsetY = lerp(camera.offsetY, camera.targetOffsetY, t)
  camera.zoom = lerp(camera.zoom, camera.targetZoom, t)

  if (Math.abs(camera.offsetX - camera.targetOffsetX) < 0.5) {
    camera.offsetX = camera.targetOffsetX
  }
  if (Math.abs(camera.offsetY - camera.targetOffsetY) < 0.5) {
    camera.offsetY = camera.targetOffsetY
  }
  if (Math.abs(camera.zoom - camera.targetZoom) < 0.001) {
    camera.zoom = camera.targetZoom
  }
}

export { MIN_ZOOM, MAX_ZOOM, ZOOM_STEP, TILE_WIDTH, TILE_HEIGHT }
