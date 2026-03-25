/**
 * ParticleEffects — celebration confetti, error sparks, sleeping Z's.
 * [T3.3] Particle Effects
 */

import Phaser from 'phaser'

export class ParticleEffects {
  private scene: Phaser.Scene
  private sleepInterval: Phaser.Time.TimerEvent | null = null

  constructor(scene: Phaser.Scene) {
    this.scene = scene

    // Listen for particle events
    scene.events.on('celebration', (pos: { x: number; y: number }) => {
      this.celebration(pos.x, pos.y)
    })
    scene.events.on('error-sparks', (pos: { x: number; y: number }) => {
      this.errorSparks(pos.x, pos.y)
    })
  }

  celebration(x: number, y: number): void {
    if (this.scene.textures.exists('confetti')) {
      try {
        const emitter = this.scene.add.particles(x, y - 16, 'confetti', {
          speed: { min: 50, max: 200 },
          angle: { min: 230, max: 310 },
          gravityY: 300,
          lifespan: 1500,
          quantity: 20,
          emitting: false,
          scale: { start: 1, end: 0.5 },
        })
        emitter.setDepth(35)
        emitter.explode()
        // Clean up after particles are done
        this.scene.time.delayedCall(2000, () => {
          emitter.destroy()
        })
      } catch {
        // Fallback: text-based celebration
        this.textBurst(x, y, ['\u{2728}', '\u{1F389}', '\u{2B50}'], 0xffdd44)
      }
    } else {
      this.textBurst(x, y, ['\u{2728}', '\u{1F389}', '\u{2B50}'], 0xffdd44)
    }

    // Play celebration sound
    if (
      this.scene.sound.get('celebrate') ||
      this.scene.cache.audio.has('celebrate')
    ) {
      try {
        this.scene.sound.play('celebrate', { volume: 0.5 })
      } catch {
        // silently skip
      }
    }
  }

  errorSparks(x: number, y: number): void {
    if (this.scene.textures.exists('spark')) {
      try {
        const emitter = this.scene.add.particles(x, y - 16, 'spark', {
          speed: { min: 30, max: 100 },
          angle: { min: 0, max: 360 },
          tint: [0xff4444, 0xff8800],
          lifespan: 800,
          quantity: 10,
          emitting: false,
          scale: { start: 1.5, end: 0 },
        })
        emitter.setDepth(35)
        emitter.explode()
        this.scene.time.delayedCall(1200, () => {
          emitter.destroy()
        })
      } catch {
        this.textBurst(x, y, ['!', '!', '\u{26A1}'], 0xff4444)
      }
    } else {
      this.textBurst(x, y, ['!', '!', '\u{26A1}'], 0xff4444)
    }

    // Play error sound
    if (this.scene.cache.audio.has('error')) {
      try {
        this.scene.sound.play('error', { volume: 0.4 })
      } catch {
        // silently skip
      }
    }
  }

  startSleepZzz(character: Phaser.Physics.Arcade.Sprite): void {
    this.stopSleepZzz()
    this.sleepInterval = this.scene.time.addEvent({
      delay: 1500,
      loop: true,
      callback: () => {
        this.spawnZzz(character.x + 8, character.y - 20)
      },
    })
    // Spawn first Z immediately
    this.spawnZzz(character.x + 8, character.y - 20)
  }

  stopSleepZzz(): void {
    if (this.sleepInterval) {
      this.sleepInterval.destroy()
      this.sleepInterval = null
    }
  }

  private spawnZzz(x: number, y: number): void {
    const letters = ['z', 'Z']
    const letter = letters[Math.floor(Math.random() * letters.length)]

    const text = this.scene.add
      .text(x, y, letter, {
        fontSize: '8px',
        color: '#aaaaee',
        fontFamily: 'monospace',
      })
      .setDepth(30)
      .setAlpha(0.8)

    this.scene.tweens.add({
      targets: text,
      x: x + Phaser.Math.Between(-8, 8),
      y: y - 24,
      alpha: 0,
      duration: 1200,
      ease: 'Sine.easeOut',
      onComplete: () => {
        text.destroy()
      },
    })
  }

  private textBurst(
    x: number,
    y: number,
    chars: string[],
    color: number,
  ): void {
    const hexColor = '#' + color.toString(16).padStart(6, '0')
    for (const char of chars) {
      const offsetX = Phaser.Math.Between(-20, 20)
      const offsetY = Phaser.Math.Between(-10, -30)

      const text = this.scene.add
        .text(x, y - 16, char, {
          fontSize: '10px',
          color: hexColor,
        })
        .setDepth(35)

      this.scene.tweens.add({
        targets: text,
        x: x + offsetX,
        y: y + offsetY,
        alpha: 0,
        duration: 1000,
        ease: 'Sine.easeOut',
        onComplete: () => {
          text.destroy()
        },
      })
    }
  }

  destroy(): void {
    this.stopSleepZzz()
    this.scene.events.off('celebration')
    this.scene.events.off('error-sparks')
  }
}
