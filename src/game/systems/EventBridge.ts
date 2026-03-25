/**
 * EventBridge — wires ConnectionManager to Phaser HouseScene.
 * [T3.1] ConnectionManager → Phaser
 */

import type { ConnectionManager } from '@/connection/connectionManager.ts'
import type { CharacterAction } from '@/connection/types.ts'
import type { HouseScene } from '../scenes/HouseScene.ts'

export class EventBridge {
  private cm: ConnectionManager
  private scene: HouseScene
  private unsubAction: (() => void) | null = null
  private unsubStatus: (() => void) | null = null

  constructor(cm: ConnectionManager, scene: HouseScene) {
    this.cm = cm
    this.scene = scene
  }

  connect(): void {
    this.unsubAction = this.cm.onAction((action: CharacterAction) => {
      // Dispatch to character in the HouseScene
      if (this.scene.character) {
        this.scene.character.handleCharacterAction(action)
      }
    })

    this.unsubStatus = this.cm.onStatusChange((status) => {
      // Emit event for UIScene to display
      this.scene.events.emit('connection-status', status)
    })
  }

  disconnect(): void {
    this.unsubAction?.()
    this.unsubStatus?.()
    this.unsubAction = null
    this.unsubStatus = null
  }
}
