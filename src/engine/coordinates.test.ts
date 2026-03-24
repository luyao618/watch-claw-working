import { describe, it, expect } from 'vitest'
import {
  cartesianToScreen,
  screenToCartesian,
  getTileAtScreen,
  tileCenter,
} from './coordinates.ts'

describe('cartesianToScreen', () => {
  it('converts origin (0,0) to (0,0)', () => {
    const result = cartesianToScreen(0, 0)
    expect(result.x).toBe(0)
    expect(result.y).toBe(0)
  })

  it('converts (1,0) to (32, 0)', () => {
    const result = cartesianToScreen(1, 0)
    expect(result.x).toBe(32)
    expect(result.y).toBe(0)
  })

  it('converts (0,1) to (0, 32)', () => {
    const result = cartesianToScreen(0, 1)
    expect(result.x).toBe(0)
    expect(result.y).toBe(32)
  })

  it('converts (3,2) to (96, 64)', () => {
    const result = cartesianToScreen(3, 2)
    expect(result.x).toBe(96)
    expect(result.y).toBe(64)
  })
})

describe('screenToCartesian', () => {
  it('converts (0,0) to tile (0,0)', () => {
    const result = screenToCartesian(0, 0)
    expect(result.col).toBe(0)
    expect(result.row).toBe(0)
  })

  it('converts mid-tile position to correct tile', () => {
    const result = screenToCartesian(48, 48)
    expect(result.col).toBe(1)
    expect(result.row).toBe(1)
  })

  it('roundtrips (3,2) through screen and back', () => {
    const screen = cartesianToScreen(3, 2)
    const cart = screenToCartesian(screen.x + 1, screen.y + 1) // +1 to be inside tile
    expect(cart.col).toBe(3)
    expect(cart.row).toBe(2)
  })

  it('handles negative coordinates', () => {
    const result = screenToCartesian(-10, -10)
    expect(result.col).toBeLessThan(0)
    expect(result.row).toBeLessThan(0)
  })
})

describe('getTileAtScreen', () => {
  it('returns correct tile with no camera offset and 1x zoom', () => {
    const screen = cartesianToScreen(3, 2)
    const tile = getTileAtScreen(screen.x + 1, screen.y + 1, 0, 0, 1)
    expect(tile.col).toBe(3)
    expect(tile.row).toBe(2)
  })

  it('accounts for camera offset', () => {
    const screen = cartesianToScreen(3, 2)
    const tile = getTileAtScreen(
      screen.x + 100 + 1,
      screen.y + 50 + 1,
      100,
      50,
      1,
    )
    expect(tile.col).toBe(3)
    expect(tile.row).toBe(2)
  })

  it('accounts for zoom', () => {
    const screen = cartesianToScreen(3, 2)
    const tile = getTileAtScreen(screen.x * 2 + 1, screen.y * 2 + 1, 0, 0, 2)
    expect(tile.col).toBe(3)
    expect(tile.row).toBe(2)
  })
})

describe('tileCenter', () => {
  it('returns the center of tile (0,0)', () => {
    const center = tileCenter(0, 0)
    expect(center.x).toBe(16)
    expect(center.y).toBe(16)
  })

  it('returns the center of tile (1,1)', () => {
    const center = tileCenter(1, 1)
    expect(center.x).toBe(48)
    expect(center.y).toBe(48)
  })
})
