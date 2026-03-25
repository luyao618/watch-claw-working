/**
 * LobsterCharacter — main character sprite with Arcade Physics, FSM, and auto-navigation.
 * Movement: walk left/right, jump between floors via passage openings.
 */

import Phaser from 'phaser'
import type { CharacterAction } from '@/connection/types.ts'
import type { HouseScene } from '../scenes/HouseScene.ts'

export type LobsterState =
  | 'idle'
  | 'walking'
  | 'jumping'
  | 'typing'
  | 'thinking'
  | 'sleeping'
  | 'celebrating'

// Passage X positions — where character.x should be so body fits in the opening
// Body: offset_x=9, width=14 → body spans [x+9, x+22]
// 3F↔2F left:  cols 8-10  (px 128-175), char.x = 136 (body 145-158)
// 3F↔2F right: cols 18-20 (px 288-335), char.x = 296 (body 305-318)
// 2F↔1F:       cols 18-20 (px 288-335), char.x = 296 (body 305-318)
const PASSAGES_UP: Record<number, number[]> = {
  2: [136, 296], // from 2F go up to 3F
  1: [296], // from 1F go up to 2F
}
const PASSAGES_DOWN: Record<number, number[]> = {
  3: [136, 296], // from 3F go down to 2F
  2: [296], // from 2F go down to 1F
}

export class LobsterCharacter extends Phaser.Physics.Arcade.Sprite {
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private autoNavTarget: { x: number; y: number } | null = null
  private autoNavPhase:
    | 'walk-to-passage'
    | 'jumping'
    | 'dropping'
    | 'walk-to-target'
    | null = null
  private passageX = 0
  private targetState: string | null = null
  private targetEmotion: string | null = null
  private _lobsterState: LobsterState = 'idle'
  private idleTimer = 0
  private readonly IDLE_SLEEP_THRESHOLD = 30
  private dropping = false
  private goingUp = false

  constructor(scene: Phaser.Scene, x: number, y: number) {
    const textureKey = scene.textures.exists('lobster')
      ? 'lobster'
      : 'placeholder-char'
    super(scene, x, y, textureKey)

    scene.add.existing(this as Phaser.GameObjects.GameObject)
    scene.physics.add.existing(this as Phaser.GameObjects.GameObject)

    const body = this.body as Phaser.Physics.Arcade.Body
    body.setSize(14, 20)
    body.setOffset(9, 12)
    body.setMaxVelocity(300, 700)
    body.setDrag(1000, 0)
    body.setBounce(0)
    body.setCollideWorldBounds(true)

    this.setDepth(10)
    this.createAnimations()

    if (scene.input.keyboard) {
      this.cursors = scene.input.keyboard.createCursorKeys()
    }
  }

  private createAnimations(): void {
    const scene = this.scene
    const key = this.texture.key
    if (key === 'placeholder-char') return

    const anims: Array<{
      key: string
      row: number
      frames: number
      rate: number
      loop: boolean
    }> = [
      { key: 'idle', row: 0, frames: 4, rate: 6, loop: true },
      { key: 'walk', row: 1, frames: 6, rate: 10, loop: true },
      { key: 'jump', row: 2, frames: 3, rate: 8, loop: false },
      { key: 'type', row: 3, frames: 4, rate: 8, loop: true },
      { key: 'sleep', row: 4, frames: 2, rate: 2, loop: true },
      { key: 'think', row: 5, frames: 4, rate: 4, loop: true },
      { key: 'celebrate', row: 6, frames: 4, rate: 8, loop: true },
    ]

    const cols = 6
    for (const a of anims) {
      if (scene.anims.exists(a.key)) continue
      scene.anims.create({
        key: a.key,
        frames: scene.anims.generateFrameNumbers(key, {
          start: a.row * cols,
          end: a.row * cols + a.frames - 1,
        }),
        frameRate: a.rate,
        repeat: a.loop ? -1 : 0,
      })
    }
  }

  get currentState(): LobsterState {
    return this._lobsterState
  }

  private getFloor(): number {
    if (this.y < 176) return 3
    if (this.y < 352) return 2
    return 1
  }

  setLobsterState(newState: LobsterState): void {
    if (this._lobsterState === newState) return
    this._lobsterState = newState
    this.idleTimer = 0

    const stateToAnim: Record<string, string> = {
      idle: 'idle',
      walking: 'walk',
      jumping: 'jump',
      typing: 'type',
      sleeping: 'sleep',
      thinking: 'think',
      celebrating: 'celebrate',
    }
    this.playAnim(stateToAnim[newState] ?? 'idle')

    const body = this.body as Phaser.Physics.Arcade.Body
    if (newState === 'sleeping') {
      body.setVelocity(0, 0)
      body.setAllowGravity(false)
    } else {
      body.setAllowGravity(true)
    }

    this.scene.events.emit('character-state-change', {
      state: newState as string,
      room:
        (this.scene as HouseScene).roomManager?.getCurrentRoom(this.x, this.y)
          ?.id ?? null,
      emotion: this.targetEmotion,
    })
  }

  private dropThroughFloor(): void {
    if (this.dropping) return
    this.dropping = true

    const body = this.body as Phaser.Physics.Arcade.Body
    body.checkCollision.down = false
    body.setVelocityY(200)
    this.playAnim('jump')
    ;(this.scene as HouseScene).time.delayedCall(400, () => {
      body.checkCollision.down = true
      this.dropping = false
    })
  }

  isDropping(): boolean {
    return this.dropping
  }

  update(_time: number, delta: number): void {
    const body = this.body as Phaser.Physics.Arcade.Body
    const onGround = body.blocked.down

    // Sleeping: freeze
    if (this._lobsterState === 'sleeping') {
      body.setVelocity(0, 0)
      body.setAllowGravity(false)
      return
    }

    // Auto-nav
    if (this.autoNavTarget) {
      this.updateAutoNav()
      return
    }

    // Idle timer
    if (this._lobsterState === 'idle') {
      this.idleTimer += delta / 1000
      if (this.idleTimer >= this.IDLE_SLEEP_THRESHOLD) {
        this.handleCharacterAction({ type: 'GO_SLEEP' })
        return
      }
    }

    // Block manual control during activity states
    if (
      this._lobsterState === 'typing' ||
      this._lobsterState === 'thinking' ||
      this._lobsterState === 'celebrating' ||
      this.autoNavTarget
    ) {
      return
    }

    if (!this.cursors) return

    // Manual movement
    if (this.cursors.left.isDown) {
      body.setVelocityX(-260)
      this.setFlipX(true)
      if (onGround) this.playAnim('walk')
    } else if (this.cursors.right.isDown) {
      body.setVelocityX(260)
      this.setFlipX(false)
      if (onGround) this.playAnim('walk')
    } else {
      if (onGround && this._lobsterState !== 'idle') {
        this.setLobsterState('idle')
      }
    }

    if (this.cursors.up.isDown && onGround && !this.dropping) {
      body.setVelocityY(-650)
      this.playAnim('jump')
    }

    if (this.cursors.down.isDown && onGround && !this.dropping) {
      this.dropThroughFloor()
    }
  }

  private playAnim(key: string): void {
    if (this.scene.anims.exists(key) && this.anims.currentAnim?.key !== key) {
      this.anims.play(key, true)
    }
  }

  // --- Auto-navigation ---

  private findNearestPassage(goingUp: boolean): number {
    const floor = this.getFloor()
    const passages = goingUp
      ? (PASSAGES_UP[floor] ?? [320])
      : (PASSAGES_DOWN[floor] ?? [320])

    let nearest = passages[0]
    let minDist = Math.abs(this.x - nearest)
    for (const px of passages) {
      const dist = Math.abs(this.x - px)
      if (dist < minDist) {
        minDist = dist
        nearest = px
      }
    }
    return nearest
  }

  navigateTo(x: number, y: number, state?: string, emotion?: string): void {
    this.autoNavTarget = { x, y }
    this.targetState = state ?? null
    this.targetEmotion = emotion ?? null

    const currentFloor = this.getFloor()
    const targetFloor = y < 176 ? 3 : y < 352 ? 2 : 1

    if (currentFloor !== targetFloor) {
      this.goingUp = targetFloor > currentFloor
      this.passageX = this.findNearestPassage(this.goingUp)
      this.autoNavPhase = 'walk-to-passage'
    } else {
      this.autoNavPhase = 'walk-to-target'
    }
  }

  cancelNavigation(): void {
    this.autoNavTarget = null
    this.autoNavPhase = null
    this.targetState = null
    this.targetEmotion = null
  }

  private updateAutoNav(): void {
    if (!this.autoNavTarget) return

    switch (this.autoNavPhase) {
      case 'walk-to-passage':
        this.navWalkToPassage()
        break
      case 'jumping':
        this.navJumping()
        break
      case 'dropping':
        this.navDropping()
        break
      case 'walk-to-target':
      default:
        this.navWalkToTarget()
        break
    }
  }

  /** Walk to the passage opening */
  private navWalkToPassage(): void {
    if (!this.autoNavTarget) return
    const body = this.body as Phaser.Physics.Arcade.Body
    const dx = this.passageX - this.x
    const onGround = body.blocked.down

    if (Math.abs(dx) > 6) {
      body.setVelocityX(dx > 0 ? 220 : -220)
      this.setFlipX(dx < 0)
      if (onGround) this.playAnim('walk')
    } else {
      // At passage — jump or drop
      body.setVelocityX(0)
      // At passage — jump or drop (both use dropThroughFloor to pass through solid floor)
      body.setVelocityX(0)
      if (onGround && !this.dropping) {
        if (this.goingUp) {
          // Jump up: disable floor collision temporarily + strong upward velocity
          this.dropping = true
          body.checkCollision.up = false
          body.checkCollision.down = false
          body.setVelocityY(-650)
          this.playAnim('jump')
          ;(this.scene as HouseScene).time.delayedCall(500, () => {
            body.checkCollision.up = true
            body.checkCollision.down = true
            this.dropping = false
          })
          this.autoNavPhase = 'jumping'
        } else {
          this.dropThroughFloor()
          this.autoNavPhase = 'dropping'
        }
      }
    }
  }

  /** Wait until character lands after jumping up */
  private navJumping(): void {
    if (!this.autoNavTarget) return
    const body = this.body as Phaser.Physics.Arcade.Body
    const onGround = body.blocked.down

    if (onGround && body.velocity.y >= 0) {
      // Landed! Check if we need to go more floors
      const currentFloor = this.getFloor()
      const targetFloor =
        this.autoNavTarget.y < 176 ? 3 : this.autoNavTarget.y < 352 ? 2 : 1

      if (currentFloor !== targetFloor) {
        // Need another jump
        this.goingUp = targetFloor > currentFloor
        this.passageX = this.findNearestPassage(this.goingUp)
        this.autoNavPhase = 'walk-to-passage'
      } else {
        this.autoNavPhase = 'walk-to-target'
      }
    }
  }

  /** Wait until character lands after dropping down */
  private navDropping(): void {
    if (!this.autoNavTarget) return
    const body = this.body as Phaser.Physics.Arcade.Body
    const onGround = body.blocked.down

    // Wait for dropping to finish and character to land
    if (!this.dropping && onGround) {
      const currentFloor = this.getFloor()
      const targetFloor =
        this.autoNavTarget.y < 176 ? 3 : this.autoNavTarget.y < 352 ? 2 : 1

      if (currentFloor !== targetFloor) {
        this.goingUp = targetFloor > currentFloor
        this.passageX = this.findNearestPassage(this.goingUp)
        this.autoNavPhase = 'walk-to-passage'
      } else {
        this.autoNavPhase = 'walk-to-target'
      }
    }
  }

  /** Walk horizontally to the final target */
  private navWalkToTarget(): void {
    if (!this.autoNavTarget) return
    const body = this.body as Phaser.Physics.Arcade.Body
    const dx = this.autoNavTarget.x - this.x

    if (Math.abs(dx) > 4) {
      body.setVelocityX(dx > 0 ? 200 : -200)
      this.setFlipX(dx < 0)
      if (body.blocked.down) this.playAnim('walk')
    } else {
      // Arrived
      body.setVelocityX(0)

      const animState = this.targetState
      if (animState) {
        const stateMap: Record<string, LobsterState> = {
          type: 'typing',
          think: 'thinking',
          sleep: 'sleeping',
          celebrate: 'celebrating',
          idle: 'idle',
          walk: 'walking',
        }
        const newState = stateMap[animState] ?? 'idle'

        if (newState === 'sleeping') {
          this.y = this.autoNavTarget.y
          body.setVelocity(0, 0)
        }

        this.setLobsterState(newState)
      } else {
        this.setLobsterState('idle')
      }

      if (this.targetEmotion) {
        this.scene.events.emit('show-emotion', this.targetEmotion)
      }

      this.autoNavTarget = null
      this.targetState = null
      this.targetEmotion = null
    }
  }

  // --- Character Action Handler ---
  handleCharacterAction(action: CharacterAction): void {
    switch (action.type) {
      case 'GOTO_ROOM': {
        const scene = this.scene as HouseScene
        const room = scene.roomManager.getRoomById(action.room)
        if (!room) {
          console.warn(`[LobsterCharacter] Unknown room: ${action.room}`)
          return
        }
        this.navigateTo(
          room.activitySpot.x,
          room.activitySpot.y,
          action.animation,
          action.emotion,
        )
        this.setLobsterState('walking')
        break
      }
      case 'WAKE_UP':
        if (this._lobsterState === 'sleeping') {
          this.setLobsterState('idle')
        }
        break
      case 'GO_SLEEP': {
        const scene = this.scene as HouseScene
        const bedroom = scene.roomManager.getRoomById('bedroom')
        if (bedroom) {
          this.navigateTo(
            bedroom.activitySpot.x,
            bedroom.activitySpot.y,
            'sleep',
            'sleepy',
          )
          this.setLobsterState('walking')
        }
        break
      }
      case 'CELEBRATE':
        this.setLobsterState('celebrating')
        this.scene.events.emit('show-emotion', 'happy')
        this.scene.events.emit('celebration', { x: this.x, y: this.y })
        break
      case 'CONFUSED':
        this.scene.events.emit('show-emotion', 'confused')
        this.scene.events.emit('error-sparks', { x: this.x, y: this.y })
        break
      case 'RESET': {
        this.cancelNavigation()
        const scene2 = this.scene as HouseScene
        const bed = scene2.roomManager.getRoomById('bedroom')
        if (bed) {
          this.setPosition(bed.activitySpot.x, bed.activitySpot.y)
        }
        this.setLobsterState('sleeping')
        break
      }
      case 'CHANGE_EMOTION':
        this.scene.events.emit('show-emotion', action.emotion)
        break
      case 'CHANGE_ANIMATION': {
        const stateMap: Record<string, LobsterState> = {
          type: 'typing',
          think: 'thinking',
          sleep: 'sleeping',
          celebrate: 'celebrating',
          idle: 'idle',
          walk: 'walking',
        }
        this.setLobsterState(stateMap[action.animation] ?? 'idle')
        break
      }
    }
  }
}
