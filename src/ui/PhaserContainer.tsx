/**
 * PhaserContainer — React component that mounts and manages the Phaser game lifecycle.
 *
 * Replaces the old CanvasView. Does NOT wire to ConnectionManager yet (that's T3.1).
 */

import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import Phaser from 'phaser'
import { gameConfig } from '@/game'

export interface PhaserContainerHandle {
  getGame(): Phaser.Game | null
}

export const PhaserContainer = forwardRef<PhaserContainerHandle>(
  function PhaserContainer(_props, ref) {
    const containerRef = useRef<HTMLDivElement>(null)
    const gameRef = useRef<Phaser.Game | null>(null)

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

      return () => {
        try {
          game.destroy(true)
        } catch {
          // Phaser may throw if destroyed during boot (e.g. HMR mid-init)
        }
        gameRef.current = null
      }
    }, [])

    return (
      <div
        ref={containerRef}
        style={{ flex: 1, minWidth: 0, minHeight: 0, background: '#1a1a2e' }}
      />
    )
  },
)
