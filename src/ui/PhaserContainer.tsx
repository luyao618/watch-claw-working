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

/**
 * Try to create an EventBridge between ConnectionManager and HouseScene.
 * Returns the bridge if successful, null otherwise.
 */
function tryCreateBridge(
  cm: ConnectionManager,
  game: Phaser.Game,
): EventBridge | null {
  const houseScene = game.scene.getScene('HouseScene') as HouseScene | null
  if (houseScene && houseScene.character) {
    const bridge = new EventBridge(cm, houseScene)
    bridge.connect()
    return bridge
  }
  return null
}

export const PhaserContainer = forwardRef<
  PhaserContainerHandle,
  PhaserContainerProps
>(function PhaserContainer({ connectionManager }, ref) {
  const containerRef = useRef<HTMLDivElement>(null)
  const gameRef = useRef<Phaser.Game | null>(null)
  const bridgeRef = useRef<EventBridge | null>(null)
  // Keep connectionManager in a ref so event callbacks always see the latest value,
  // avoiding stale-closure bugs in the [] useEffect.
  const connectionManagerRef = useRef(connectionManager)
  connectionManagerRef.current = connectionManager

  useImperativeHandle(ref, () => ({
    getGame: () => gameRef.current,
  }))

  /**
   * Idempotent helper: if both scene and connectionManager are ready and no
   * bridge exists yet, create one. Called from two paths:
   *   1. scene-ready fires (scene became ready, connectionManager may already exist)
   *   2. connectionManager useEffect (connectionManager arrived, scene may already be ready)
   */
  const ensureBridge = () => {
    const cm = connectionManagerRef.current
    const game = gameRef.current
    if (!cm || !game || bridgeRef.current) return

    const houseScene = game.scene.getScene('HouseScene') as HouseScene | null
    if (houseScene?.isReady) {
      bridgeRef.current = tryCreateBridge(cm, game)
    }
  }

  // Mount Phaser game once — stable across connectionManager changes
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

    // Listen for the scene-ready event emitted by HouseScene.create().
    // Uses connectionManagerRef (not the prop) so the callback always reads
    // the latest value, avoiding stale-closure bugs.
    game.events.once('ready', () => {
      const houseScene = game.scene.getScene('HouseScene') as HouseScene | null
      if (!houseScene) return

      // If scene already finished create() before we registered, isReady is true
      if (houseScene.isReady) {
        ensureBridge()
      } else {
        houseScene.events.once('scene-ready', () => {
          ensureBridge()
        })
      }
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

  // When connectionManager changes (or arrives late), set up / replace bridge
  useEffect(() => {
    if (!connectionManager || !gameRef.current) return

    // Clean up old bridge
    if (bridgeRef.current) {
      bridgeRef.current.disconnect()
      bridgeRef.current = null
    }

    // If scene is already ready, create bridge immediately;
    // otherwise the scene-ready listener (registered above) will handle it.
    ensureBridge()
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
