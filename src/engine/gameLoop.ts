/**
 * Game Loop — fixed-timestep update with variable-rate rendering.
 *
 * Uses requestAnimationFrame with a fixed timestep accumulator to ensure
 * deterministic updates regardless of display refresh rate.
 */

const FIXED_DT = 1 / 60 // 60 updates per second
const MAX_FRAME_DT = 0.1 // Cap to prevent spiral of death

export class GameLoop {
  private running = false
  private paused = false
  private lastTime = 0
  private accumulator = 0
  private rafId = 0

  // FPS tracking
  private frameTimes: number[] = []
  private _fps = 0

  private updateFn: (dt: number) => void
  private renderFn: (interpolation: number) => void

  constructor(
    updateFn: (dt: number) => void,
    renderFn: (interpolation: number) => void,
  ) {
    this.updateFn = updateFn
    this.renderFn = renderFn
  }

  // ── Public API ──────────────────────────────────────────────────────────

  start(): void {
    if (this.running) return
    this.running = true
    this.paused = false
    this.lastTime = performance.now()
    this.accumulator = 0
    this.frameTimes = []
    this.tick(this.lastTime)
  }

  stop(): void {
    this.running = false
    if (this.rafId) {
      cancelAnimationFrame(this.rafId)
      this.rafId = 0
    }
  }

  pause(): void {
    this.paused = true
  }

  resume(): void {
    if (this.paused) {
      this.paused = false
      this.lastTime = performance.now()
      this.accumulator = 0
    }
  }

  get fps(): number {
    return this._fps
  }

  get isRunning(): boolean {
    return this.running
  }

  get isPaused(): boolean {
    return this.paused
  }

  /**
   * Reset the accumulator — useful after tab becomes visible again
   * to avoid processing a huge dt spike.
   */
  resetAccumulator(): void {
    this.accumulator = 0
    this.lastTime = performance.now()
  }

  // ── Private ─────────────────────────────────────────────────────────────

  private tick = (currentTime: number): void => {
    if (!this.running) return

    this.rafId = requestAnimationFrame(this.tick)

    if (this.paused) {
      this.lastTime = currentTime
      return
    }

    let frameDt = (currentTime - this.lastTime) / 1000
    this.lastTime = currentTime

    // Prevent spiral of death
    if (frameDt > MAX_FRAME_DT) frameDt = MAX_FRAME_DT

    // Track FPS
    this.trackFps(currentTime)

    this.accumulator += frameDt

    // Fixed timestep updates
    while (this.accumulator >= FIXED_DT) {
      this.updateFn(FIXED_DT)
      this.accumulator -= FIXED_DT
    }

    // Render with interpolation factor
    const interpolation = this.accumulator / FIXED_DT
    this.renderFn(interpolation)
  }

  private trackFps(currentTime: number): void {
    this.frameTimes.push(currentTime)

    // Keep only the last 60 frame times
    while (
      this.frameTimes.length > 60 ||
      (this.frameTimes.length > 1 && currentTime - this.frameTimes[0] > 1000)
    ) {
      this.frameTimes.shift()
    }

    if (this.frameTimes.length > 1) {
      const elapsed =
        this.frameTimes[this.frameTimes.length - 1] - this.frameTimes[0]
      if (elapsed > 0) {
        this._fps = Math.round(((this.frameTimes.length - 1) / elapsed) * 1000)
      }
    }
  }
}
