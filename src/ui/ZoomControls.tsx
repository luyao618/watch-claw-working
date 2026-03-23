/**
 * ZoomControls — +/- zoom buttons and reset.
 */

import type { CameraState } from '@/engine/gameState.ts'
import { zoomStep, resetCamera } from '@/engine/camera.ts'

interface ZoomControlsProps {
  camera: CameraState
  mapCols: number
  mapRows: number
  canvasWidth: number
  canvasHeight: number
}

const buttonStyle: React.CSSProperties = {
  width: '28px',
  height: '28px',
  border: '1px solid #4a4a6a',
  borderRadius: '4px',
  backgroundColor: '#2a2a4a',
  color: '#e0e0e0',
  fontSize: '14px',
  fontFamily: 'monospace',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
}

export default function ZoomControls({
  camera,
  mapCols,
  mapRows,
  canvasWidth,
  canvasHeight,
}: ZoomControlsProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        position: 'absolute',
        bottom: '12px',
        right: '12px',
        zIndex: 10,
      }}
    >
      <button
        style={buttonStyle}
        onClick={() => zoomStep(camera, 1, canvasWidth / 2, canvasHeight / 2)}
        title="Zoom In"
      >
        +
      </button>
      <div
        style={{
          textAlign: 'center',
          fontSize: '9px',
          fontFamily: 'monospace',
          color: '#888',
        }}
      >
        {camera.targetZoom.toFixed(1)}x
      </div>
      <button
        style={buttonStyle}
        onClick={() => zoomStep(camera, -1, canvasWidth / 2, canvasHeight / 2)}
        title="Zoom Out"
      >
        -
      </button>
      <button
        style={{
          ...buttonStyle,
          fontSize: '9px',
          marginTop: '4px',
        }}
        onClick={() =>
          resetCamera(camera, mapCols, mapRows, canvasWidth, canvasHeight)
        }
        title="Reset View"
      >
        R
      </button>
    </div>
  )
}
