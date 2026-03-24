/**
 * CanvasView — React component that mounts the game canvas and connects
 * it to the game engine.
 */

import { useRef, useEffect, useCallback, useState } from 'react'
import { setupCanvas, renderFrame } from '@/engine/renderer.ts'
import { GameLoop } from '@/engine/gameLoop.ts'
import { updateCharacter } from '@/engine/character.ts'
import { updateCamera, pan, zoomStep, centerOn } from '@/engine/camera.ts'
import { getTileAtScreen } from '@/engine/coordinates.ts'
import type { GameState } from '@/engine/gameState.ts'

interface CanvasViewProps {
  gameState: GameState
  onFpsUpdate?: (fps: number) => void
}

export default function CanvasView({
  gameState,
  onFpsUpdate,
}: CanvasViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null)
  const isDraggingRef = useRef(false)
  const lastMouseRef = useRef({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)

  // Store gameState in a ref so engine callbacks always see the latest
  const gsRef = useRef(gameState)
  useEffect(() => {
    gsRef.current = gameState
  }, [gameState])

  // Setup canvas
  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    ctxRef.current = setupCanvas(canvas)

    const gs = gsRef.current
    // Center camera on map
    const rect = canvas.getBoundingClientRect()
    centerOn(
      gs.camera,
      gs.world.width / 2,
      gs.world.height / 2,
      rect.width,
      rect.height,
    )
    // Set current position immediately
    gs.camera.offsetX = gs.camera.targetOffsetX
    gs.camera.offsetY = gs.camera.targetOffsetY
  }, [])

  useEffect(() => {
    initCanvas()

    // Throttle FPS reporting to ~4Hz to avoid 60fps React state updates
    let lastFpsReportTime = 0
    const FPS_REPORT_INTERVAL_MS = 250

    // Create game loop
    const loop = new GameLoop(
      // Update
      (dt) => {
        const gs = gsRef.current
        updateCharacter(gs.character, dt, gs.world)
        updateCamera(gs.camera, dt)
      },
      // Render
      (interpolation) => {
        if (!ctxRef.current) return
        const gs = gsRef.current
        // Write FPS into game state so the renderer's FPS counter can display it
        gs.debug.currentFps = loop.fps
        renderFrame(ctxRef.current, gs, interpolation)
        if (onFpsUpdate) {
          const now = performance.now()
          if (now - lastFpsReportTime >= FPS_REPORT_INTERVAL_MS) {
            lastFpsReportTime = now
            onFpsUpdate(loop.fps)
          }
        }
      },
    )

    loop.start()

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      initCanvas()
    })

    if (canvasRef.current) {
      resizeObserver.observe(canvasRef.current.parentElement!)
    }

    // Handle DPR changes
    let currentDPR = window.devicePixelRatio
    let mql: MediaQueryList | null = null

    const updateDPR = () => {
      const newDPR = window.devicePixelRatio
      if (newDPR !== currentDPR) {
        currentDPR = newDPR
        initCanvas()
      }
      registerMediaQuery()
    }

    const registerMediaQuery = () => {
      mql?.removeEventListener('change', updateDPR)
      mql = window.matchMedia(`(resolution: ${currentDPR}dppx)`)
      mql.addEventListener('change', updateDPR)
    }
    registerMediaQuery()

    // Handle visibility
    const onVisibility = () => {
      if (document.hidden) {
        loop.pause()
      } else {
        loop.resetAccumulator()
        loop.resume()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    // Handle wheel events natively with { passive: false } to avoid Chrome warnings
    const canvas = canvasRef.current
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      zoomStep(
        gsRef.current.camera,
        e.deltaY < 0 ? 1 : -1,
        rect.width / 2,
        rect.height / 2,
      )
    }
    canvas?.addEventListener('wheel', onWheel, { passive: false })

    return () => {
      loop.stop()
      resizeObserver.disconnect()
      mql?.removeEventListener('change', updateDPR)
      document.removeEventListener('visibilitychange', onVisibility)
      canvas?.removeEventListener('wheel', onWheel)
    }
  }, [initCanvas, onFpsUpdate])

  // Mouse event handlers — left click drag to pan the view
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Any mouse button can pan (left, middle, right)
    isDraggingRef.current = true
    setIsDragging(true)
    lastMouseRef.current = { x: e.clientX, y: e.clientY }
    e.preventDefault()
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDraggingRef.current) {
      const dx = e.clientX - lastMouseRef.current.x
      const dy = e.clientY - lastMouseRef.current.y
      pan(gsRef.current.camera, dx, dy)
      lastMouseRef.current = { x: e.clientX, y: e.clientY }
    }
  }, [])

  const handleMouseUp = useCallback(() => {
    isDraggingRef.current = false
    setIsDragging(false)
  }, [])

  const handleClick = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const gs = gsRef.current
    const tile = getTileAtScreen(
      e.clientX - rect.left,
      e.clientY - rect.top,
      gs.camera.offsetX,
      gs.camera.offsetY,
      gs.camera.zoom,
    )
    if (import.meta.env.DEV) {
      console.log(`[CanvasView] Clicked tile: (${tile.col}, ${tile.row})`)
    }
  }, [])

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: '100%',
        height: '100%',
        display: 'block',
        cursor: isDragging ? 'grabbing' : 'default',
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
    />
  )
}
