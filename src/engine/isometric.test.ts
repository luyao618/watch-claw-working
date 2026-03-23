import { describe, it, expect } from 'vitest'
import {
  cartesianToIso,
  isoToCartesian,
  getTileAtScreen,
  tileCenter,
} from './isometric.ts'

describe('cartesianToIso', () => {
  it('converts origin (0,0) to (0,0)', () => {
    const result = cartesianToIso(0, 0)
    expect(result.x).toBe(0)
    expect(result.y).toBe(0)
  })

  it('converts (1,0) to (32, 16)', () => {
    const result = cartesianToIso(1, 0)
    expect(result.x).toBe(32) // (1-0) * 32
    expect(result.y).toBe(16) // (1+0) * 16
  })

  it('converts (0,1) to (-32, 16)', () => {
    const result = cartesianToIso(0, 1)
    expect(result.x).toBe(-32) // (0-1) * 32
    expect(result.y).toBe(16) // (0+1) * 16
  })

  it('converts (1,1) to (0, 32)', () => {
    const result = cartesianToIso(1, 1)
    expect(result.x).toBe(0) // (1-1) * 32
    expect(result.y).toBe(32) // (1+1) * 16
  })

  it('handles fractional positions', () => {
    const result = cartesianToIso(0.5, 0.5)
    expect(result.x).toBe(0) // (0.5-0.5) * 32
    expect(result.y).toBe(16) // (0.5+0.5) * 16
  })
})

describe('isoToCartesian', () => {
  it('converts (0,0) back to origin', () => {
    const result = isoToCartesian(0, 0)
    expect(result.col).toBe(0)
    expect(result.row).toBe(0)
  })

  it('roundtrips (3,2) through iso and back', () => {
    const iso = cartesianToIso(3, 2)
    const cart = isoToCartesian(iso.x, iso.y)
    expect(cart.col).toBe(3)
    expect(cart.row).toBe(2)
  })

  it('roundtrips (0,5) through iso and back', () => {
    const iso = cartesianToIso(0, 5)
    const cart = isoToCartesian(iso.x, iso.y)
    expect(cart.col).toBe(0)
    expect(cart.row).toBe(5)
  })

  it('roundtrips (7,0) through iso and back', () => {
    const iso = cartesianToIso(7, 0)
    const cart = isoToCartesian(iso.x, iso.y)
    expect(cart.col).toBe(7)
    expect(cart.row).toBe(0)
  })

  it('handles negative result from out-of-bounds screen coords', () => {
    const result = isoToCartesian(-200, -200)
    expect(result.col).toBeLessThan(0)
    expect(result.row).toBeLessThan(0)
  })
})

describe('getTileAtScreen', () => {
  it('returns correct tile with no camera offset and 1x zoom', () => {
    const iso = cartesianToIso(3, 2)
    const tile = getTileAtScreen(iso.x, iso.y, 0, 0, 1)
    expect(tile.col).toBe(3)
    expect(tile.row).toBe(2)
  })

  it('accounts for camera offset', () => {
    const iso = cartesianToIso(3, 2)
    // If camera offset shifts everything by +100x, +50y, then screen pos is
    // iso.x + 100, iso.y + 50
    const tile = getTileAtScreen(iso.x + 100, iso.y + 50, 100, 50, 1)
    expect(tile.col).toBe(3)
    expect(tile.row).toBe(2)
  })

  it('accounts for zoom', () => {
    const iso = cartesianToIso(3, 2)
    // At 2x zoom, screen pos is doubled
    const tile = getTileAtScreen(iso.x * 2, iso.y * 2, 0, 0, 2)
    expect(tile.col).toBe(3)
    expect(tile.row).toBe(2)
  })
})

describe('tileCenter', () => {
  it('returns the center of tile (0,0)', () => {
    const center = tileCenter(0, 0)
    expect(center.x).toBe(0)
    expect(center.y).toBe(16) // TILE_HEIGHT / 2
  })

  it('returns the center of tile (1,1)', () => {
    const center = tileCenter(1, 1)
    expect(center.x).toBe(0)
    expect(center.y).toBe(48) // 32 + 16
  })
})
