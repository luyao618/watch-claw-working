/**
 * PhaserContainer — React component that mounts and manages the Phaser game lifecycle.
 * [T0.2] Mount Phaser game
 * [T3.1] Wire ConnectionManager → EventBridge
 */

import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import Phaser from 'phaser'
import { gameConfig } from '@/game'
import { EventBridge } from '@/game/systems/EventBridge.ts'
import type { ConnectionManager } from '@/connection/connectionManager.ts'
import type { HouseScene } from '@/game/scenes/HouseScene.ts'

export interface PhaserContainerHandle {
  getGame(): Phaser.Game | null
}

interface PhaserContainerProps {
  connectionManager?: ConnectionManager | null
}

export const PhaserContainer = forwardRef<
  PhaserContainerHandle,
  PhaserContainerProps
>(function PhaserContainer({ connectionManager }, ref) {
  const containerRef = useRef<HTMLDivElement>(null)
  const gameRef = useRef<Phaser.Game | null>(null)
  const bridgeRef = useRef<EventBridge | null>(null)

  useImperativeHandle(ref, () => ({
    getGame: () => gameRef.current,
  }))

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Defensive: clear any leftover canvas from prior mount (Strict Mode / HMR)
    container.innerHTML = ''

    const game = new Phaser.Game({
      ...gameConfig,
      parent: container,
    })
    gameRef.current = game

    // Wait for HouseScene to be ready, then create EventBridge
    const setupBridge = () => {
      if (!connectionManager) return

      const houseScene = game.scene.getScene('HouseScene') as HouseScene | null
      if (houseScene && houseScene.character) {
        const bridge = new EventBridge(connectionManager, houseScene)
        bridge.connect()
        bridgeRef.current = bridge
      } else {
        // Scene not ready yet, try again on next frame
        game.events.once('step', setupBridge)
      }
    }

    // Start checking after game boots
    game.events.once('ready', () => {
      // Give scenes time to create
      game.events.once('step', () => {
        // Wait a few more frames for scene.create() to run
        setTimeout(setupBridge, 100)
      })
    })

    return () => {
      if (bridgeRef.current) {
        bridgeRef.current.disconnect()
        bridgeRef.current = null
      }
      try {
        game.destroy(true)
      } catch {
        // Phaser may throw if destroyed during boot (e.g. HMR mid-init)
      }
      gameRef.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // When connectionManager changes after initial mount, set up bridge
  useEffect(() => {
    if (!connectionManager || !gameRef.current) return

    // Clean up old bridge
    if (bridgeRef.current) {
      bridgeRef.current.disconnect()
      bridgeRef.current = null
    }

    const game = gameRef.current
    const houseScene = game.scene.getScene('HouseScene') as HouseScene | null
    if (houseScene && houseScene.character) {
      const bridge = new EventBridge(connectionManager, houseScene)
      bridge.connect()
      bridgeRef.current = bridge
    }
  }, [connectionManager])

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        background: '#1a1a2e',
        imageRendering: 'pixelated',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    />
  )
})
