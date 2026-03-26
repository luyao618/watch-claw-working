// ── Tile dimensions (3/4 top-down, rectangular) ─────────────────────────
export const TILE_WIDTH = 32
export const TILE_HEIGHT = 32

// ── Bridge Server connection ─────────────────────────────────────────────
// Override with VITE_BRIDGE_WS_URL env var if the bridge server uses a
// custom port (set via BRIDGE_PORT in bridge/server.ts).
// Note: backend and frontend use separate env vars, so both must be set
// when changing the default port.
export const BRIDGE_WS_URL: string =
  (import.meta.env?.VITE_BRIDGE_WS_URL as string | undefined) ||
  'ws://127.0.0.1:18790'
export const BRIDGE_RECONNECT_BASE_MS = 1000
export const BRIDGE_RECONNECT_MAX_MS = 30_000

// ── Character ────────────────────────────────────────────────────────────
export const CHARACTER_SPEED_FAST = 6 // Running to work/computer
export const CHARACTER_SPEED_SLOW = 1.5 // Strolling back to bed
export const CHARACTER_SPEED = 3 // Default speed
export const ANIMATION_FPS = 8

// ── Dashboard / UI ───────────────────────────────────────────────────────
export const DASHBOARD_UPDATE_INTERVAL_MS = 250

// ── Idle detection ───────────────────────────────────────────────────────
export const IDLE_SLEEP_THRESHOLD_S = 30

// ── Sleep delay (wait at computer before going to bed) ───────────────────
export const SLEEP_DELAY_S = 3
