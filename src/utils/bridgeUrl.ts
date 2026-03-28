/**
 * Bridge URL persistence helpers.
 *
 * Reads / writes the user-configured Bridge Server WebSocket URL from
 * localStorage so it survives page reloads and PWA restarts.
 */

import { BRIDGE_WS_URL } from '@/utils/constants.ts'

const STORAGE_KEY = 'watchclaw_bridge_ws_url'

/** Read the persisted Bridge URL, falling back to the compiled-in default. */
export function getSavedBridgeUrl(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) || BRIDGE_WS_URL
  } catch {
    return BRIDGE_WS_URL
  }
}

/** Persist a new Bridge URL to localStorage. */
export function saveBridgeUrl(url: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, url)
  } catch {
    // Storage may be unavailable in some contexts — silently ignore.
  }
}
