/**
 * ModeSelector — Pixel-art style mode toggle buttons.
 * Three modes: Monitor (default), Game, Desktop Pet.
 */

import { useState } from 'react'

export type AppMode = 'monitor' | 'game' | 'pet'

interface ModeSelectorProps {
  currentMode: AppMode
  onModeChange: (mode: AppMode) => void
}

interface ModeButton {
  mode: AppMode
  label: string
}

const MODES: ModeButton[] = [
  { mode: 'monitor', label: 'Monitor Mode' },
  { mode: 'game', label: 'Game Mode' },
  { mode: 'pet', label: 'Pet Mode' },
]

// Fixed width so all buttons are the same size
const BUTTON_WIDTH = 88

export default function ModeSelector({
  currentMode,
  onModeChange,
}: ModeSelectorProps) {
  const [hovered, setHovered] = useState<AppMode | null>(null)

  return (
    <div
      style={{
        display: 'flex',
        gap: '4px',
        padding: '3px 6px',
        opacity: 0.7,
      }}
    >
      {MODES.map(({ mode, label }) => {
        const isActive = currentMode === mode
        const isHovered = hovered === mode && !isActive

        return (
          <button
            key={mode}
            onClick={() => onModeChange(mode)}
            onMouseEnter={() => setHovered(mode)}
            onMouseLeave={() => setHovered(null)}
            style={{
              // Fixed width for uniform buttons
              width: BUTTON_WIDTH,
              // Pixel-art button base
              fontFamily: '"Press Start 2P", "Courier New", monospace',
              fontSize: '6px',
              lineHeight: 1,
              padding: '4px 0',
              cursor: 'pointer',
              border: '1px solid',
              borderRadius: '0px',
              transition: 'none',
              imageRendering: 'pixelated',
              // Subdued colors — blend with dark game background
              backgroundColor: isActive
                ? 'rgba(60, 120, 200, 0.5)'
                : isHovered
                  ? 'rgba(50, 50, 80, 0.6)'
                  : 'rgba(30, 30, 50, 0.5)',
              color: isActive ? '#b0c8e8' : '#707088',
              borderColor: isActive
                ? 'rgba(90, 150, 220, 0.5)'
                : isHovered
                  ? 'rgba(80, 80, 110, 0.5)'
                  : 'rgba(50, 50, 70, 0.4)',
              // Subtle pixel-art 3D inset
              boxShadow: isActive
                ? 'inset -1px -1px 0px rgba(30, 70, 140, 0.5), inset 1px 1px 0px rgba(120, 180, 255, 0.3)'
                : 'none',
              outline: 'none',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              userSelect: 'none',
              letterSpacing: '0.3px',
            }}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
