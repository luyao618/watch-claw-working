/**
 * SoundManager — plays sound effects based on character state changes.
 * [T4.4] Sound System
 */

import Phaser from 'phaser'
import type { LobsterState } from '../characters/LobsterCharacter.ts'

export class SoundManager {
  private scene: Phaser.Scene
  private muted = false
  private footstepTimer = 0
  private currentLoopKey: string | null = null
  private currentLoop: Phaser.Sound.BaseSound | null = null

  constructor(scene: Phaser.Scene) {
    this.scene = scene

    // Listen for 'M' key to toggle mute
    scene.input.keyboard?.on('keydown-M', () => {
      this.toggleMute()
    })
  }

  toggleMute(): void {
    this.muted = !this.muted
    this.scene.sound.mute = this.muted
    console.log(`[SoundManager] Sound ${this.muted ? 'muted' : 'unmuted'}`)
  }

  onStateChange(newState: LobsterState): void {
    // Stop any current loop
    this.stopLoop()

    switch (newState) {
      case 'walking':
        this.footstepTimer = 0
        break
      case 'typing':
        this.startLoop('typing', 0.3)
        break
      case 'sleeping':
        this.startLoop('snore', 0.2)
        break
      case 'celebrating':
        this.playOnce('celebrate', 0.5)
        break
      case 'jumping':
        this.playOnce('jump', 0.4)
        break
    }
  }

  update(state: LobsterState, delta: number): void {
    if (state === 'walking') {
      this.footstepTimer += delta
      if (this.footstepTimer >= 300) {
        this.footstepTimer = 0
        this.playOnce('footstep', 0.3)
      }
    }
  }

  private playOnce(key: string, volume: number): void {
    if (this.muted) return
    if (!this.scene.cache.audio.has(key)) return
    try {
      this.scene.sound.play(key, { volume })
    } catch {
      // Silently skip if audio playback fails
    }
  }

  private startLoop(key: string, volume: number): void {
    if (this.muted) return
    if (!this.scene.cache.audio.has(key)) return
    if (this.currentLoopKey === key) return

    this.stopLoop()
    try {
      this.currentLoop = this.scene.sound.add(key, { volume, loop: true })
      this.currentLoop.play()
      this.currentLoopKey = key
    } catch {
      // Silently skip
    }
  }

  private stopLoop(): void {
    if (this.currentLoop) {
      try {
        this.currentLoop.stop()
        this.currentLoop.destroy()
      } catch {
        // Silently skip
      }
      this.currentLoop = null
      this.currentLoopKey = null
    }
  }

  destroy(): void {
    this.stopLoop()
  }
}
