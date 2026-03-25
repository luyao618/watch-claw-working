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

// Passage X positions — where character sprite.x (center) should be so the
// physics body fits entirely within the collision gap.
//
// Sprite: 32×32px, origin (0.5, 0.5) → sprite left edge = sprite.x - 16
// Body:   setSize(14, 20), setOffset(9, 12)
//         body left  = sprite.x - 16 + 9  = sprite.x - 7
//         body right = sprite.x - 7  + 14 = sprite.x + 7
//
// Collision gaps (from Tiled collision layer, 16px tiles):
//   3F↔2F left:  cols 9-10  → px [144, 176], gap center = 160
//   3F↔2F right: cols 19-20 → px [304, 336], gap center = 320
//   2F↔1F:       cols 19-20 → px [304, 336], gap center = 320 (only right exists)
//
// sprite.x = gap center → body spans [center-7, center+7], well within 32px gap
const PASSAGE_X_LEFT = 160
const PASSAGE_X_RIGHT = 320

// Available passages for each floor transition
const PASSAGES: Record<string, number[]> = {
  // Going up
  '2→3': [PASSAGE_X_LEFT, PASSAGE_X_RIGHT], // 2F→3F: two passages
  '1→2': [PASSAGE_X_RIGHT], // 1F→2F: only right passage
  // Going down
  '3→2': [PASSAGE_X_LEFT, PASSAGE_X_RIGHT], // 3F→2F: two passages
  '2→1': [PASSAGE_X_RIGHT], // 2F→1F: only right passage
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
  /** Stuck detection: time spent in current auto-nav without floor change */
  private navStuckTimer = 0
  private readonly NAV_STUCK_TIMEOUT = 8000 // 8 seconds max per floor transition
  private lastNavFloor = 0

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
      // think: reuse type frames (row 3) as fallback
      { key: 'think', row: 3, frames: 4, rate: 4, loop: true },
      // celebrate: spritesheet only has 6 rows (0-5), row 6 doesn't exist, fallback to idle frames
      { key: 'celebrate', row: 0, frames: 4, rate: 12, loop: true },
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

    // Only set the dropping flag — the one-way platform collider's process
    // callback checks isDropping() and skips collision when true.
    // We do NOT disable body.checkCollision.down because that would also
    // let the character fall through solid collision-layer tiles (walls/floors).
    const body = this.body as Phaser.Physics.Arcade.Body
    body.setVelocityY(200)
    this.playAnim('jump')
    ;(this.scene as HouseScene).time.delayedCall(400, () => {
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

  /**
   * Choose the best passage for the next floor transition.
   *
   * Strategy: pick the passage that minimizes total walk distance,
   * considering both the walk to the passage AND the walk from the passage
   * to the target X. If only one passage exists, use it.
   *
   * For multi-floor transitions (e.g. 3F→1F), we also consider that the
   * 2F→1F transition only has a right passage (x=304), so if the route
   * requires going through 1F↔2F, we may prefer the right passage on
   * the 3F→2F leg to avoid backtracking.
   */
  private findBestPassage(
    currentFloor: number,
    targetFloor: number,
    targetX: number,
  ): number {
    const goingUp = targetFloor > currentFloor
    const nextFloor = goingUp ? currentFloor + 1 : currentFloor - 1
    const key = `${currentFloor}→${nextFloor}`
    const passages = PASSAGES[key] ?? [PASSAGE_X_RIGHT]

    if (passages.length === 1) return passages[0]

    // If we'll need another floor transition after this one, factor in
    // the constraint of the next leg's available passages.
    let effectiveTargetX = targetX
    if (nextFloor !== targetFloor) {
      // There's another transition after this — check what passages are
      // available for the next leg.
      const nextKey = `${nextFloor}→${goingUp ? nextFloor + 1 : nextFloor - 1}`
      const nextPassages = PASSAGES[nextKey]
      if (nextPassages && nextPassages.length === 1) {
        // Only one passage available on the next leg — prefer to be near it
        // after this transition, so weight the effective target toward it.
        effectiveTargetX = nextPassages[0]
      }
    }

    // Pick the passage that minimizes: walk-to-passage + walk-from-passage-to-effectiveTarget
    let best = passages[0]
    let bestCost = Math.abs(this.x - best) + Math.abs(best - effectiveTargetX)
    for (let i = 1; i < passages.length; i++) {
      const px = passages[i]
      const cost = Math.abs(this.x - px) + Math.abs(px - effectiveTargetX)
      if (cost < bestCost) {
        bestCost = cost
        best = px
      }
    }
    return best
  }

  navigateTo(x: number, y: number, state?: string, emotion?: string): void {
    this.autoNavTarget = { x, y }
    this.targetState = state ?? null
    this.targetEmotion = emotion ?? null
    this.navStuckTimer = 0
    this.lastNavFloor = this.getFloor()

    const currentFloor = this.getFloor()
    const targetFloor = y < 176 ? 3 : y < 352 ? 2 : 1

    if (currentFloor !== targetFloor) {
      this.goingUp = targetFloor > currentFloor
      this.passageX = this.findBestPassage(currentFloor, targetFloor, x)
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

    // Stuck detection: if we're navigating between floors and floor hasn't
    // changed in NAV_STUCK_TIMEOUT, cancel to prevent infinite loops.
    // During walk-to-target phase (same floor), we don't check stuck
    // because horizontal movement is always straightforward.
    if (
      this.autoNavPhase === 'walk-to-passage' ||
      this.autoNavPhase === 'jumping' ||
      this.autoNavPhase === 'dropping'
    ) {
      const currentFloor = this.getFloor()
      if (currentFloor !== this.lastNavFloor) {
        this.lastNavFloor = currentFloor
        this.navStuckTimer = 0
      } else {
        this.navStuckTimer += this.scene.game.loop.delta
        if (this.navStuckTimer > this.NAV_STUCK_TIMEOUT) {
          console.warn(
            `[LobsterCharacter] Navigation stuck for ${this.NAV_STUCK_TIMEOUT}ms, cancelling`,
          )
          this.cancelNavigation()
          this.setLobsterState('idle')
          return
        }
      }
    }

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
      if (onGround && !this.dropping) {
        if (this.goingUp) {
          // Jump up through the passage gap.
          // The collision layer has no tiles at passage openings, so we only
          // need to bypass the one-way platform. Setting dropping=true makes
          // the platform collider's process callback return false.
          this.dropping = true
          body.setVelocityY(-650)
          this.playAnim('jump')
          ;(this.scene as HouseScene).time.delayedCall(500, () => {
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
        this.passageX = this.findBestPassage(
          currentFloor,
          targetFloor,
          this.autoNavTarget.x,
        )
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
        this.passageX = this.findBestPassage(
          currentFloor,
          targetFloor,
          this.autoNavTarget.x,
        )
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
