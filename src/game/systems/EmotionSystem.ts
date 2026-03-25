/**
 * EmotionSystem — shows emotion bubbles above the character.
 * [T3.2] EmotionSystem
 */

import Phaser from 'phaser'

const EMOTION_MAP: Record<string, { frame: number; fallback: string }> = {
  focused: { frame: 0, fallback: '\u{1F4A1}' },
  thinking: { frame: 1, fallback: '?' },
  sleepy: { frame: 2, fallback: '\u{1F4A4}' },
  happy: { frame: 3, fallback: '\u{2728}' },
  confused: { frame: 4, fallback: '!' },
  curious: { frame: 5, fallback: '\u{1F50D}' },
  serious: { frame: 6, fallback: '\u{26A1}' },
  satisfied: { frame: 7, fallback: '\u{2714}' },
  busy: { frame: 5, fallback: '\u{1F50D}' },
  none: { frame: -1, fallback: '' },
}

export class EmotionSystem {
  private scene: Phaser.Scene
  private container: Phaser.GameObjects.Container | null = null
  private character: Phaser.Physics.Arcade.Sprite
  private floatTween: Phaser.Tweens.Tween | null = null
  private hideTimer: Phaser.Time.TimerEvent | null = null

  constructor(scene: Phaser.Scene, character: Phaser.Physics.Arcade.Sprite) {
    this.scene = scene
    this.character = character

    // Listen for show-emotion events
    scene.events.on('show-emotion', (emotion: string) => {
      this.show(emotion)
    })
  }

  show(emotion: string): void {
    // Hide any previous bubble
    this.hide()

    const info = EMOTION_MAP[emotion]
    if (!info || emotion === 'none') return

    // Create container above character
    this.container = this.scene.add.container(
      this.character.x,
      this.character.y - 28,
    )
    this.container.setDepth(30)

    // Speech bubble background
    const bg = this.scene.add.graphics()
    bg.fillStyle(0xffffff, 0.9)
    bg.fillRoundedRect(-10, -10, 20, 20, 4)
    // Small triangle pointer
    bg.fillTriangle(-3, 10, 3, 10, 0, 14)
    this.container.add(bg)

    // Try to use spritesheet, otherwise use text fallback
    if (this.scene.textures.exists('emotions') && info.frame >= 0) {
      const icon = this.scene.add.sprite(0, 0, 'emotions', info.frame)
      icon.setScale(0.8)
      this.container.add(icon)
    } else {
      const text = this.scene.add
        .text(0, 0, info.fallback, {
          fontSize: '10px',
          color: '#333333',
        })
        .setOrigin(0.5)
      this.container.add(text)
    }

    // Auto-hide after 5 seconds
    this.hideTimer = this.scene.time.delayedCall(5000, () => {
      this.hide()
    })
  }

  hide(): void {
    if (this.floatTween) {
      this.floatTween.destroy()
      this.floatTween = null
    }
    if (this.container) {
      this.container.destroy()
      this.container = null
    }
    if (this.hideTimer) {
      this.hideTimer.destroy()
      this.hideTimer = null
    }
  }

  update(): void {
    if (this.container && this.character) {
      this.container.x = this.character.x
      this.container.y = this.character.y - 28
    }
  }

  destroy(): void {
    this.hide()
    this.scene.events.off('show-emotion')
  }
}
